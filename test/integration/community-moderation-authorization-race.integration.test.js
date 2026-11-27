'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { handleCommunityWorkflowRoute } = require('../../packages/community/src/workflows');
const { waitForDatabaseWriteLock } = require('../helpers/postgres-locks');

const enabled = Boolean(process.env.DATABASE_URL && process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true');

/**
 * Integration test suite for F1.64: Community moderation authorization revalidation.
 *
 * This test verifies that the mitigation for the post-revocation authorization
 * vulnerability prevents a moderator from completing a moderation action after
 * their capability has been revoked.
 *
 * The vulnerability allowed a request that passed the preflight capability check
 * to commit moderation changes even after the actor's membership, active status,
 * or capability was revoked, because the authorization check was not revalidated
 * inside the mutation transaction.
 *
 * The mitigation adds a transaction-scoped revalidation with shared row locks
 * that serialize with membership removal, ensuring that either:
 * 1. The revocation completes before the moderation transaction starts, or
 * 2. The moderation transaction completes before the revocation starts
 *
 * This test creates scenarios where:
 * - A moderator begins a moderation request
 * - The membership is removed concurrently
 * - The moderation transaction must detect the revocation and reject the action
 */

function createContext({ method = 'GET', path, body = {}, pool, actor, siteId, afterCapability }) {
  const url = new URL(`http://virgoscorpio-hub.integration${path}`);
  const res = {};
  return {
    req: { method, headers: {} },
    res,
    url,
    actor: { user: { id: actor.id, email: actor.email, displayName: actor.displayName } },
    localPool: pool,
    maxBody: 64_000,
    requestId: randomUUID(),
    async siteIdFor({ body: requested, actor: requestingActor }) {
      const requestedSiteId = requested.siteId || siteId;
      if (requestingActor?.isDeveloper) return requestedSiteId;
      const requestingUserId = requestingActor?.user?.id || actor.id;
      const member = await pool.query(
        'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2 LIMIT 1',
        [requestedSiteId, requestingUserId]
      );
      if (!member.rows[0]) {
        throw Object.assign(new Error('Site membership required.'), {
          code: 'ERR_VIRGOSCORPIO_HUB_SITE_ACCESS',
          statusCode: 403
        });
      }
      return requestedSiteId;
    },
    async requireCapability(actorObj, requestedSiteId, capability) {
      const result = await pool.query(
        `SELECT 1 FROM site_memberships sm
          JOIN roles r ON r.id=sm.role_id
          JOIN users u ON u.id=sm.user_id
         WHERE sm.site_id=$1 AND sm.user_id=$2 AND u.status='active'
           AND (r.capabilities ? $3 OR r.capabilities ? 'site:manage' OR r.capabilities ? '*')
         LIMIT 1`,
        [requestedSiteId, actorObj.user.id, capability]
      );
      if (!result.rows[0]) {
        throw Object.assign(new Error('Capability required.'), {
          code: 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN',
          statusCode: 403
        });
      }
      if (afterCapability) await afterCapability({ actor: actorObj, siteId: requestedSiteId, capability });
    },
    async readJson() {
      return body;
    },
    sendJson(response, statusCode, payload) {
      response.statusCode = statusCode;
      response.payload = payload;
      return true;
    },
    fail(statusCode, code, message, details) {
      return Object.assign(new Error(message), { statusCode, code, details });
    }
  };
}

test('moderation action is rejected when membership is revoked during request processing', { skip: !enabled }, async t => {
  const pool = createPostgresPool({ ...process.env, DATABASE_POOL_MAX: '8' });
  const siteSlug = `moderation-race-${randomUUID().slice(0, 10)}`;
  const site = await pool.query('INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id', [siteSlug, 'Moderation Race Test']);
  const siteId = site.rows[0].id;

  // Create a moderator role with community:moderate capability
  const moderatorRole = await pool.query(
    'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
    [`moderator-${randomUUID().slice(0, 10)}`, 'Test Moderator', JSON.stringify(['community:moderate'])]
  );
  const moderatorRoleId = moderatorRole.rows[0].id;

  // Create a regular member role without moderation capability
  const memberRole = await pool.query(
    'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
    [`member-${randomUUID().slice(0, 10)}`, 'Test Member', JSON.stringify(['content:create'])]
  );
  const memberRoleId = memberRole.rows[0].id;

  // Create moderator user
  const moderator = await pool.query(
    'INSERT INTO users(email,display_name,status) VALUES($1,$2,\'active\') RETURNING id,email,display_name',
    [`moderator-${randomUUID()}@example.test`, 'Test Moderator']
  );
  const moderatorUser = moderator.rows[0];

  // Create content author user
  const author = await pool.query(
    'INSERT INTO users(email,display_name,status) VALUES($1,$2,\'active\') RETURNING id,email,display_name',
    [`author-${randomUUID()}@example.test`, 'Test Author']
  );
  const authorUser = author.rows[0];

  // Add both users to the site
  await pool.query('INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)', [siteId, moderatorUser.id, moderatorRoleId]);
  await pool.query('INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)', [siteId, authorUser.id, memberRoleId]);

  // Create a social activity to moderate
  const activity = await pool.query(
    "INSERT INTO social_activities(site_id,actor_id,activity_type,body,visibility) VALUES($1,$2,'status','Test content for moderation','members') RETURNING id",
    [siteId, authorUser.id]
  );
  const activityId = activity.rows[0].id;

  t.after(async () => {
    await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[moderatorUser.id, authorUser.id]]).catch(() => {});
    await pool.query('DELETE FROM roles WHERE id=ANY($1::uuid[])', [[moderatorRoleId, memberRoleId]]).catch(() => {});
    await pool.end();
  });

  await t.test('moderation succeeds when membership remains valid throughout the transaction', async () => {
    const ctx = createContext({
      method: 'POST',
      path: `/api/v1/sites/${siteId}/community/moderation`,
      body: {
        targetType: 'activity',
        targetId: activityId,
        action: 'hide',
        reason: 'Test moderation with valid membership'
      },
      pool,
      actor: moderatorUser,
      siteId
    });

    const handled = await handleCommunityWorkflowRoute(ctx);
    assert.equal(handled, true);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.payload.moderation.action, 'hide');

    // Verify the activity was marked as deleted
    const hiddenActivity = await pool.query(
      'SELECT deleted_at FROM social_activities WHERE site_id=$1 AND id=$2',
      [siteId, activityId]
    );
    assert.ok(hiddenActivity.rows[0].deleted_at, 'activity should be marked as deleted');

    // Verify moderation action was audited
    const auditRecord = await pool.query(
      'SELECT actor_id,action,reason FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2 AND action=\'hide\'',
      [siteId, activityId]
    );
    assert.equal(auditRecord.rows.length, 1);
    assert.equal(auditRecord.rows[0].actor_id, moderatorUser.id);
    assert.equal(auditRecord.rows[0].action, 'hide');

    // Restore the activity for the next test
    await pool.query('UPDATE social_activities SET deleted_at=NULL WHERE site_id=$1 AND id=$2', [siteId, activityId]);
    await pool.query('DELETE FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2', [siteId, activityId]);
  });

  await t.test('moderation is rejected when membership is revoked before transaction starts', async () => {
    // Remove the moderator's membership
    await pool.query('DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteId, moderatorUser.id]);

    const ctx = createContext({
      method: 'POST',
      path: `/api/v1/sites/${siteId}/community/moderation`,
      body: {
        targetType: 'activity',
        targetId: activityId,
        action: 'hide',
        reason: 'Attempt after membership revoked'
      },
      pool,
      actor: moderatorUser,
      siteId
    });

    // The preflight check should fail because membership is already gone
    await assert.rejects(
      handleCommunityWorkflowRoute(ctx),
      error => error.statusCode === 403 && ['ERR_VIRGOSCORPIO_HUB_FORBIDDEN', 'ERR_VIRGOSCORPIO_HUB_SITE_ACCESS'].includes(error.code),
      'moderation should be rejected when membership is already revoked'
    );

    // Verify the activity was NOT modified
    const unchangedActivity = await pool.query(
      'SELECT deleted_at FROM social_activities WHERE site_id=$1 AND id=$2',
      [siteId, activityId]
    );
    assert.equal(unchangedActivity.rows[0].deleted_at, null, 'activity should remain unmodified');

    // Verify no audit record was created
    const noAudit = await pool.query(
      'SELECT 1 FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2 AND reason=\'Attempt after membership revoked\'',
      [siteId, activityId]
    );
    assert.equal(noAudit.rows.length, 0, 'no audit record should be created for rejected action');

    // Restore membership for the next test
    await pool.query('INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)', [siteId, moderatorUser.id, moderatorRoleId]);
  });

  await t.test('transaction-scoped revalidation rejects membership revoked after preflight', async () => {
    const ctx = createContext({
      method: 'POST',
      path: '/api/v1/sites/' + siteId + '/community/moderation',
      body: { targetType: 'activity', targetId: activityId, action: 'hide', reason: 'Revoked after preflight' },
      pool,
      actor: moderatorUser,
      siteId,
      afterCapability: async () => {
        const removed = await pool.query(
          'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2 RETURNING user_id',
          [siteId, moderatorUser.id]
        );
        assert.equal(removed.rowCount, 1);
      }
    });

    await assert.rejects(
      handleCommunityWorkflowRoute(ctx),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN' && error.statusCode === 403
    );
    const unchanged = await pool.query(
      'SELECT deleted_at FROM social_activities WHERE site_id=$1 AND id=$2',
      [siteId, activityId]
    );
    assert.equal(unchanged.rows[0].deleted_at, null);
    const audits = await pool.query(
      "SELECT 1 FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2 AND reason='Revoked after preflight'",
      [siteId, activityId]
    );
    assert.equal(audits.rowCount, 0);
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteId, moderatorUser.id, moderatorRoleId]
    );
  });
  await t.test('transaction-scoped revalidation rejects a user disabled after preflight', async () => {
    const ctx = createContext({
      method: 'POST',
      path: '/api/v1/sites/' + siteId + '/community/moderation',
      body: { targetType: 'activity', targetId: activityId, action: 'hide', reason: 'Disabled after preflight' },
      pool,
      actor: moderatorUser,
      siteId,
      afterCapability: async () => {
        await pool.query("UPDATE users SET status='disabled' WHERE id=$1", [moderatorUser.id]);
      }
    });
    await assert.rejects(
      handleCommunityWorkflowRoute(ctx),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN' && error.statusCode === 403
    );
    const unchanged = await pool.query(
      'SELECT deleted_at FROM social_activities WHERE site_id=$1 AND id=$2',
      [siteId, activityId]
    );
    assert.equal(unchanged.rows[0].deleted_at, null);
    await pool.query("UPDATE users SET status='active' WHERE id=$1", [moderatorUser.id]);
  });
  await t.test('transaction-scoped revalidation rejects a role capability removed after preflight', async () => {
    const ctx = createContext({
      method: 'POST',
      path: '/api/v1/sites/' + siteId + '/community/moderation',
      body: { targetType: 'activity', targetId: activityId, action: 'hide', reason: 'Role capability removed after preflight' },
      pool,
      actor: moderatorUser,
      siteId,
      afterCapability: async () => {
        await pool.query(
          'UPDATE roles SET capabilities=$1::jsonb WHERE id=$2',
          [JSON.stringify(['content:create']), moderatorRoleId]
        );
      }
    });
    await assert.rejects(
      handleCommunityWorkflowRoute(ctx),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN' && error.statusCode === 403
    );
    const unchanged = await pool.query(
      'SELECT deleted_at FROM social_activities WHERE site_id=$1 AND id=$2',
      [siteId, activityId]
    );
    assert.equal(unchanged.rows[0].deleted_at, null);
    await pool.query(
      'UPDATE roles SET capabilities=$1::jsonb WHERE id=$2',
      [JSON.stringify(['community:moderate']), moderatorRoleId]
    );
  });
  await t.test('moderation of message is also protected by transaction-scoped revalidation', async () => {
    // Create a conversation and message to moderate
    const conversation = await pool.query(
      "INSERT INTO social_conversations(site_id,conversation_type) VALUES($1,'direct') RETURNING id",
      [siteId]
    );
    const conversationId = conversation.rows[0].id;

    await pool.query(
      'INSERT INTO social_conversation_members(site_id,conversation_id,user_id) VALUES($1,$2,$3)',
      [siteId, conversationId, moderatorUser.id]
    );
    await pool.query(
      'INSERT INTO social_conversation_members(site_id,conversation_id,user_id) VALUES($1,$2,$3)',
      [siteId, conversationId, authorUser.id]
    );

    const message = await pool.query(
      "INSERT INTO social_messages(site_id,conversation_id,sender_id,body,status) VALUES($1,$2,$3,'Test message','sent') RETURNING id",
      [siteId, conversationId, authorUser.id]
    );
    const messageId = message.rows[0].id;

    // Remove membership
    await pool.query('DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteId, moderatorUser.id]);

    const ctx = createContext({
      method: 'POST',
      path: `/api/v1/sites/${siteId}/community/moderation`,
      body: {
        targetType: 'message',
        targetId: messageId,
        action: 'hide',
        reason: 'Message moderation after revocation'
      },
      pool,
      actor: moderatorUser,
      siteId
    });

    await assert.rejects(
      handleCommunityWorkflowRoute(ctx),
      error => error.statusCode === 403 && ['ERR_VIRGOSCORPIO_HUB_FORBIDDEN', 'ERR_VIRGOSCORPIO_HUB_SITE_ACCESS'].includes(error.code),
      'message moderation should be rejected when membership is revoked'
    );

    // Verify the message was NOT modified
    const unchangedMessage = await pool.query(
      'SELECT deleted_at,status FROM social_messages WHERE site_id=$1 AND id=$2',
      [siteId, messageId]
    );
    assert.equal(unchangedMessage.rows[0].deleted_at, null, 'message should remain unmodified');
    assert.equal(unchangedMessage.rows[0].status, 'sent', 'message status should remain unchanged');

    // Cleanup
    await pool.query('DELETE FROM social_conversations WHERE id=$1', [conversationId]).catch(() => {});
    // Restore membership
    await pool.query('INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)', [siteId, moderatorUser.id, moderatorRoleId]);
  });

  await t.test('moderation waits for an in-flight member revocation before authorizing', async () => {
    const revocationClient = await pool.connect();
    let revocationOpen = false;
    let moderationPromise;
    let moderationOutcome;

    try {
      await revocationClient.query('BEGIN');
      revocationOpen = true;
      // Match the production removeMember lock order and hold the site row while
      // removing the membership, so the moderation transaction must serialize.
      await revocationClient.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [siteId]);
      await revocationClient.query(
        'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2',
        [siteId, moderatorUser.id]
      );

      let preflightCompleted;
      const preflight = new Promise(resolve => { preflightCompleted = resolve; });
      const ctx = createContext({
        method: 'POST',
        path: `/api/v1/sites/${siteId}/community/moderation`,
        body: { targetType: 'activity', targetId: activityId, action: 'hide', reason: 'Concurrent membership revocation' },
        pool,
        actor: moderatorUser,
        siteId,
        afterCapability: async () => preflightCompleted()
      });
      moderationPromise = handleCommunityWorkflowRoute(ctx).then(
        value => ({ kind: 'resolved', value }),
        error => ({ kind: 'rejected', error })
      );

      await preflight;
      const lockObserved = await waitForDatabaseWriteLock(revocationClient, 'FOR KEY SHARE', 5000, { relationName: 'sites' });

      await revocationClient.query(lockObserved ? 'COMMIT' : 'ROLLBACK');
      revocationOpen = false;
      moderationOutcome = moderationOutcome || await moderationPromise;
      assert.equal(lockObserved, true, 'moderation must wait on the site lock held by member revocation');
      assert.equal(moderationOutcome.kind, 'rejected', 'moderation must re-read authorization after revocation commits');
      assert.equal(moderationOutcome.error.statusCode, 403);
      assert.equal(moderationOutcome.error.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');

      const unchanged = await pool.query(
        'SELECT deleted_at FROM social_activities WHERE site_id=$1 AND id=$2',
        [siteId, activityId]
      );
      assert.equal(unchanged.rows[0].deleted_at, null, 'revoked moderator must not mutate the target');
      const audits = await pool.query(
        'SELECT 1 FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2 AND reason=$3',
        [siteId, activityId, 'Concurrent membership revocation']
      );
      assert.equal(audits.rowCount, 0, 'revoked moderation must not write an audit action');

      await pool.query(
        'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
        [siteId, moderatorUser.id, moderatorRoleId]
      );
    } finally {
      if (revocationOpen) await revocationClient.query('ROLLBACK').catch(() => {});
      if (moderationPromise && !moderationOutcome) moderationOutcome = await moderationPromise;
      revocationClient.release();
    }
  });
  await t.test('developer actor bypasses transaction-scoped revalidation', async () => {
    // Remove membership to ensure developer bypass works
    await pool.query('DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteId, moderatorUser.id]);

    const ctx = createContext({
      method: 'POST',
      path: `/api/v1/sites/${siteId}/community/moderation`,
      body: {
        targetType: 'activity',
        targetId: activityId,
        action: 'restore',
        reason: 'Developer override'
      },
      pool,
      actor: moderatorUser,
      siteId
    });

    // Override actor to be a developer
    ctx.actor.isDeveloper = true;

    // Override requireCapability to allow developer
    ctx.requireCapability = async () => true;

    const handled = await handleCommunityWorkflowRoute(ctx);
    assert.equal(handled, true);
    assert.equal(ctx.res.statusCode, 200);
    assert.equal(ctx.res.payload.moderation.action, 'restore');

    // Verify the action was audited
    const auditRecord = await pool.query(
      'SELECT actor_id,action FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2 AND action=\'restore\'',
      [siteId, activityId]
    );
    assert.equal(auditRecord.rows.length, 1);

    // Cleanup
    await pool.query('DELETE FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 AND target_id=$2', [siteId, activityId]);
    // Restore membership
    await pool.query('INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)', [siteId, moderatorUser.id, moderatorRoleId]);
  });
});
