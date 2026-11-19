'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

async function snapshotCommunitySite(pool, siteId) {
  const queries = {
    groups: [
      'SELECT id,site_id,slug,name,privacy,created_by,created_at FROM social_groups WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
    groupMembers: [
      `SELECT gm.group_id,gm.user_id,gm.role,gm.status,gm.created_at
         FROM social_group_memberships gm JOIN social_groups g ON g.id=gm.group_id
        WHERE g.site_id=$1 ORDER BY gm.group_id,gm.user_id`,
      [siteId],
    ],
    conversations: [
      'SELECT id,site_id,conversation_type,group_id,created_by,created_at,updated_at FROM social_conversations WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
    conversationMembers: [
      'SELECT conversation_id,site_id,user_id,joined_at,left_at,last_read_at FROM social_conversation_members WHERE site_id=$1 ORDER BY conversation_id,user_id',
      [siteId],
    ],
    messages: [
      'SELECT id,site_id,conversation_id,sender_id,body,status,created_at,updated_at,deleted_at FROM social_messages WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
    blocks: [
      'SELECT site_id,blocker_id,blocked_id,reason,created_at FROM social_blocks WHERE site_id=$1 ORDER BY blocker_id,blocked_id',
      [siteId],
    ],
    reports: [
      'SELECT id,site_id,reporter_id,target_type,target_id,category,detail,status,moderation_note,reviewed_by,created_at,updated_at FROM social_reports WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
    friendships: [
      'SELECT site_id,requester_id,addressee_id,status,created_at,updated_at FROM social_friendships WHERE site_id=$1 ORDER BY requester_id,addressee_id',
      [siteId],
    ],
    activities: [
      'SELECT id,site_id,actor_id,group_id,activity_type,body,visibility,parent_id,metadata,created_at,deleted_at FROM social_activities WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
    notifications: [
      'SELECT id,site_id,user_id,notification_type,payload,read_at,created_at FROM social_notifications WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
    outbox: [
      'SELECT id,site_id,actor_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,status,attempts,correlation_id,classification,created_at FROM outbox_events WHERE site_id=$1 ORDER BY created_at,id',
      [siteId],
    ],
    moderation: [
      'SELECT id,site_id,actor_id,target_type,target_id,action,reason,created_at FROM virgoscorpio_hub_moderation_actions WHERE site_id=$1 ORDER BY id',
      [siteId],
    ],
  };
  const result = {};
  for (const [name, [sql, params]] of Object.entries(queries)) {
    const rows = await pool.query(sql, params);
    result[name] = rows.rows;
  }
  return result;
}

test(
  'tenant isolation: community object IDs, moderation, conversations, and notifications stay site-scoped',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '10',
    });
    const siteIds = [];
    const userIds = [];
    let roleId = null;
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;
    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      if (roleId) await pool.query('DELETE FROM roles WHERE id=$1', [roleId]).catch(() => {});
      await pool.end();
    });

    const siteAResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-community-a-${randomUUID().slice(0, 8)}`, 'Tenant Community Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-community-b-${randomUUID().slice(0, 8)}`, 'Tenant Community Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [
        `tenant-community-${randomUUID().slice(0, 10)}`,
        'Tenant Community Integration Moderator',
        JSON.stringify(['community:moderate', 'content:create', 'content:edit']),
      ]
    );
    roleId = roleResult.rows[0].id;

    async function createUser(label, withPassword = false, status = 'active') {
      const email = `tenant-community-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID()}@example.test`;
      const result = await pool.query(
        withPassword
          ? `INSERT INTO users(email,display_name,password_hash,status)
             VALUES($1,$2,$3,$4) RETURNING id,email,display_name`
          : `INSERT INTO users(email,display_name,status)
             VALUES($1,$2,$3) RETURNING id,email,display_name`,
        withPassword
          ? [email, label, await hashPassword('Isolation-Password-2026'), status]
          : [email, label, status]
      );
      userIds.push(result.rows[0].id);
      return result.rows[0];
    }

    const userA = await createUser('Site A Member');
    const userA2 = await createUser('Site A Target');
    const actorB = await createUser('Site B Moderator', true);
    const userB2 = await createUser('Site B Member', true);
    const userBInvited = await createUser('Site B Invited Recipient', false, 'invited');
    const userBDisabled = await createUser('Site B Disabled Recipient', false, 'disabled');
    const userBPublicJoinControl = await createUser('Site B Public Join Control', true);

    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($1,$4,$3),($5,$6,$3),($5,$7,$3),($5,$8,$3),($5,$9,$3)',
      [siteA, userA.id, roleId, userA2.id, siteB, actorB.id, userB2.id, userBInvited.id, userBDisabled.id]
    );
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteB, userBPublicJoinControl.id, roleId]
    );

    const groupAResult = await pool.query(
      `INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by)
       VALUES($1,$2,$3,'Private tenant A group','private',$4) RETURNING id`,
      [siteA, `private-a-${randomUUID().slice(0, 8)}`, 'PRIVATE_SITE_A_GROUP_MARKER', userA.id]
    );
    const groupA = groupAResult.rows[0].id;
    await pool.query(
      `INSERT INTO social_group_memberships(group_id,user_id,role,status)
       VALUES($1,$2,'owner','active'),($1,$3,'member','active')`,
      [groupA, userA.id, userA2.id]
    );

    const groupBResult = await pool.query(
      `INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by)
       VALUES($1,$2,$3,'Positive control group','public',$4) RETURNING id`,
      [siteB, `control-b-${randomUUID().slice(0, 8)}`, 'Site B Community Control', actorB.id]
    );
    const groupB = groupBResult.rows[0].id;
    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active')",
      [groupB, actorB.id]
    );

    const privateGroupBResult = await pool.query(
      `INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by)
       VALUES($1,$2,$3,'Private group join idempotency control','private',$4) RETURNING id`,
      [siteB, `private-control-b-${randomUUID().slice(0, 8)}`, 'Site B Private Group Control', actorB.id]
    );
    const privateGroupB = privateGroupBResult.rows[0].id;
    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active')",
      [privateGroupB, actorB.id]
    );
    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'member','pending')",
      [privateGroupB, userB2.id]
    );

    const freshPrivateGroupBResult = await pool.query(
      `INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by)
       VALUES($1,$2,$3,'Fresh private-group join control','private',$4) RETURNING id`,
      [siteB, `private-fresh-b-${randomUUID().slice(0, 8)}`, 'Site B Fresh Private Join Control', actorB.id]
    );
    const freshPrivateGroupB = freshPrivateGroupBResult.rows[0].id;
    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active')",
      [freshPrivateGroupB, actorB.id]
    );

    const conversationAResult = await pool.query(
      `INSERT INTO social_conversations(site_id,conversation_type,created_by)
       VALUES($1,'direct',$2) RETURNING id`,
      [siteA, userA.id]
    );
    const conversationA = conversationAResult.rows[0].id;
    await pool.query(
      'INSERT INTO social_conversation_members(conversation_id,site_id,user_id) VALUES($1,$2,$3),($1,$2,$4)',
      [conversationA, siteA, userA.id, userA2.id]
    );
    const messageAResult = await pool.query(
      `INSERT INTO social_messages(site_id,conversation_id,sender_id,body)
       VALUES($1,$2,$3,'PRIVATE_SITE_A_MESSAGE_MARKER') RETURNING id`,
      [siteA, conversationA, userA.id]
    );
    const messageA = messageAResult.rows[0].id;

    const conversationBResult = await pool.query(
      `INSERT INTO social_conversations(site_id,conversation_type,created_by)
       VALUES($1,'direct',$2) RETURNING id`,
      [siteB, actorB.id]
    );
    const conversationB = conversationBResult.rows[0].id;
    await pool.query(
      'INSERT INTO social_conversation_members(conversation_id,site_id,user_id) VALUES($1,$2,$3),($1,$2,$4)',
      [conversationB, siteB, actorB.id, userB2.id]
    );
    const messageBResult = await pool.query(
      `INSERT INTO social_messages(site_id,conversation_id,sender_id,body)
       VALUES($1,$2,$3,'Site B message control') RETURNING id`,
      [siteB, conversationB, userB2.id]
    );
    const messageB = messageBResult.rows[0].id;

    await pool.query(
      'INSERT INTO social_blocks(site_id,blocker_id,blocked_id,reason) VALUES($1,$2,$3,$4)',
      [siteA, userA.id, userA2.id, 'Site A block fixture']
    );
    await pool.query(
      'INSERT INTO social_friendships(site_id,requester_id,addressee_id,status) VALUES($1,$2,$3,\'accepted\')',
      [siteA, userA.id, userA2.id]
    );

    const reportAResult = await pool.query(
      `INSERT INTO social_reports(site_id,reporter_id,target_type,target_id,category,detail)
       VALUES($1,$2,'user',$3,'harassment','PRIVATE_SITE_A_REPORT_MARKER') RETURNING id`,
      [siteA, userA.id, userA2.id]
    );
    const reportA = reportAResult.rows[0].id;

    const activityAResult = await pool.query(
      `INSERT INTO social_activities(site_id,actor_id,activity_type,body,visibility)
       VALUES($1,$2,'status','PRIVATE_SITE_A_ACTIVITY_MARKER','members') RETURNING id,deleted_at`,
      [siteA, userA.id]
    );
    const activityA = activityAResult.rows[0].id;

    const notificationAResult = await pool.query(
      `INSERT INTO social_notifications(site_id,user_id,notification_type,payload)
       VALUES($1,$2,'community.message.new',jsonb_build_object('messageId',$3::text))
       RETURNING id`,
      [siteA, actorB.id, messageA]
    );
    const notificationA = notificationAResult.rows[0].id;
    const notificationBResult = await pool.query(
      `INSERT INTO social_notifications(site_id,user_id,notification_type,payload)
       VALUES($1,$2,'community.message.new',jsonb_build_object('messageId',$3::text))
       RETURNING id`,
      [siteB, actorB.id, messageB]
    );
    const notificationB = notificationBResult.rows[0].id;

    const session = await identity.login({
      email: actorB.email,
      password: 'Isolation-Password-2026',
      ip: '127.0.0.1',
      userAgent: 'tenant-community-isolation-test',
    });
    assert.equal(session.mfaRequired, false);

    server = createApiServer({
      env,
      pool,
      identityService: identity,
      logger: { error() {} },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = {
      authorization: `Bearer ${session.token}`,
      'x-virgoscorpio-hub-site-id': siteB,
    };
    const before = await snapshotCommunitySite(pool, siteA);
    const beforeSiteB = await snapshotCommunitySite(pool, siteB);

    async function assertSiteAUnchanged() {
      assert.deepEqual(await snapshotCommunitySite(pool, siteA), before);
    }

    async function assertSiteBUnchanged() {
      assert.deepEqual(await snapshotCommunitySite(pool, siteB), beforeSiteB);
    }

    async function assertFriendshipCreateRace({ description, mutation, restore, verifyMutation }) {
      const originalQueryDescriptor = Object.getOwnPropertyDescriptor(pool, 'query');
      const query = pool.query.bind(pool);
      let mutationStarted = false;
      let mutationApplied = false;
      let siteAAtInsert = null;
      let siteBAtInsert = null;

      pool.query = async (sql, params) => {
        if (
          !mutationApplied &&
          typeof sql === 'string' &&
          sql.toUpperCase().includes('INSERT INTO SOCIAL_FRIENDSHIPS')
        ) {
          mutationStarted = true;
          await mutation(query);
          mutationApplied = true;
          siteAAtInsert = await snapshotCommunitySite(pool, siteA);
          siteBAtInsert = await snapshotCommunitySite(pool, siteB);
        }

        return query(sql, params);
      };

      try {
        const response = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userB2.id}`, {
          method: 'POST',
          headers,
        });
        const payload = await response.json();
        const serialized = JSON.stringify(payload);

        assert.equal(mutationApplied, true, `${description}: state change must run immediately before the INSERT`);
        assert.equal(response.status, 404, `${description}: ineligible participants must not create or update a friendship`);
        assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND');
        assert.equal(serialized.includes(actorB.id), false, 'requester ID must not be disclosed');
        assert.equal(serialized.includes(userB2.id), false, 'recipient ID must not be disclosed');
        assert.equal(serialized.includes(actorB.display_name), false, 'requester display name must not be disclosed');
        assert.equal(serialized.includes(userB2.display_name), false, 'recipient display name must not be disclosed');

        await verifyMutation(query);
        assert.deepEqual(
          await snapshotCommunitySite(pool, siteA),
          siteAAtInsert,
          `${description}: Site A state must remain unchanged`
        );
        assert.deepEqual(
          await snapshotCommunitySite(pool, siteB),
          siteBAtInsert,
          `${description}: denied friendship write must not alter Site B community state`
        );
      } finally {
        if (originalQueryDescriptor) Object.defineProperty(pool, 'query', originalQueryDescriptor);
        else delete pool.query;
        if (mutationStarted) await restore(query);
      }
    }

    async function assertFriendshipCreateSerializesChange({
      description,
      lockSql,
      lockParams,
      mutate,
      restore,
      verifyMutation,
    }) {
      const originalQueryDescriptor = Object.getOwnPropertyDescriptor(pool, 'query');
      const query = pool.query.bind(pool);
      const client = await pool.connect();
      const siteAStateBefore = await snapshotCommunitySite(pool, siteA);
      const siteBStateBefore = await snapshotCommunitySite(pool, siteB);
      let requestPromise = null;
      let transactionOpen = false;
      let mutationCommitted = false;
      let writeStarted = false;

      try {
        await client.query('BEGIN');
        transactionOpen = true;
        const locked = await client.query(lockSql, lockParams);
        assert.equal(locked.rowCount, 1, `${description}: the fixture row must exist`);

        pool.query = async (sql, params) => {
          if (
            !writeStarted &&
            typeof sql === 'string' &&
            sql.toUpperCase().includes('INSERT INTO SOCIAL_FRIENDSHIPS')
          ) {
            writeStarted = true;
          }
          return query(sql, params);
        };

        requestPromise = fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userB2.id}`, {
          method: 'POST',
          headers,
        });

        const startDeadline = Date.now() + 5000;
        while (!writeStarted && Date.now() < startDeadline) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(writeStarted, true, `${description}: friendship INSERT must reach PostgreSQL`);

        let waitingOnLock = false;
        const lockDeadline = Date.now() + 5000;
        while (!waitingOnLock && Date.now() < lockDeadline) {
          const activity = await client.query(
            `SELECT wait_event_type
               FROM pg_stat_activity
              WHERE datname = current_database()
                AND pid <> pg_backend_pid()
                AND query ILIKE '%INSERT INTO social_friendships%'
              ORDER BY query_start DESC
              LIMIT 1`
          );
          waitingOnLock = activity.rows[0]?.wait_event_type === 'Lock';
          if (!waitingOnLock) await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.equal(
          waitingOnLock,
          true,
          `${description}: the friendship write must wait for the participant row lock`
        );

        await mutate(client);
        await client.query('COMMIT');
        transactionOpen = false;
        mutationCommitted = true;

        const response = await requestPromise;
        const payload = await response.json();
        assert.equal(response.status, 404, `${description}: post-lock ineligibility must deny friendship creation`);
        assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND');
        assert.equal(JSON.stringify(payload).includes(actorB.id), false);
        assert.equal(JSON.stringify(payload).includes(userB2.id), false);

        await verifyMutation(query);
        assert.deepEqual(await snapshotCommunitySite(pool, siteA), siteAStateBefore);
        assert.deepEqual(await snapshotCommunitySite(pool, siteB), siteBStateBefore);
      } finally {
        if (transactionOpen) await client.query('ROLLBACK').catch(() => {});
        if (originalQueryDescriptor) Object.defineProperty(pool, 'query', originalQueryDescriptor);
        else delete pool.query;
        client.release();
        if (mutationCommitted) await restore(query);
        if (requestPromise) await requestPromise.catch(() => {});
      }
    }

    await t.test('site B group listing and member reads do not reveal a foreign group', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/community/groups`, { headers });
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.ok(payload.groups.some(group => group.id === groupB));
      assert.equal(payload.groups.some(group => group.id === groupA), false);
      assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_SITE_A_GROUP_MARKER/);

      const members = await fetch(`${base}/api/v1/sites/${siteB}/community/groups/${groupA}/members`, { headers });
      assert.equal(members.status, 200);
      assert.deepEqual((await members.json()).members, []);
      await assertSiteAUnchanged();
    });

    await t.test('foreign group join is rejected without creating a site B membership', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/community/groups/${groupA}/join`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_GROUP_NOT_FOUND');
      const membership = await pool.query(
        'SELECT 1 FROM social_group_memberships WHERE group_id=$1 AND user_id=$2',
        [groupA, actorB.id]
      );
      assert.equal(membership.rows.length, 0);
      await assertSiteAUnchanged();
    });

    await t.test('private-group join retries preserve active, pending, and banned membership states', async () => {
      const activeRetrySnapshot = await snapshotCommunitySite(pool, siteB);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${base}/api/v1/sites/${siteB}/community/groups/${privateGroupB}/join`, {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.membership.status, 'active', 'an active private-group member must not be downgraded to pending by retrying join');
        assert.equal(payload.membership.role, 'owner', 'rejoining must preserve the existing group role');
      }
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        activeRetrySnapshot,
        'repeated active-member joins must not create notifications or other community side effects'
      );

      const pendingSession = await identity.login({
        email: userB2.email,
        password: 'Isolation-Password-2026',
        ip: '127.0.0.1',
        userAgent: 'tenant-community-private-group-pending-join-test',
      });
      assert.equal(pendingSession.mfaRequired, false);
      const pendingHeaders = {
        authorization: `Bearer ${pendingSession.token}`,
        'x-virgoscorpio-hub-site-id': siteB,
        'content-type': 'application/json',
      };
      const pendingRetrySnapshot = await snapshotCommunitySite(pool, siteB);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(`${base}/api/v1/sites/${siteB}/community/groups/${privateGroupB}/join`, {
          method: 'POST',
          headers: pendingHeaders,
          body: JSON.stringify({}),
        });
        const payload = await response.json();
        assert.equal(response.status, 200);
        assert.equal(payload.membership.status, 'pending', 'a pending private-group request must remain pending on retry');
        assert.equal(payload.membership.role, 'member');
      }
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        pendingRetrySnapshot,
        'repeated pending-member joins must not create notifications or other community side effects'
      );

      const membershipBeforeBannedRetry = await pool.query(
        'UPDATE social_group_memberships SET status=$3 WHERE group_id=$1 AND user_id=$2 RETURNING status,role',
        [privateGroupB, userB2.id, 'banned']
      );
      assert.deepEqual(membershipBeforeBannedRetry.rows, [{ status: 'banned', role: 'member' }]);
      const bannedSnapshot = await snapshotCommunitySite(pool, siteB);
      const bannedRetry = await fetch(`${base}/api/v1/sites/${siteB}/community/groups/${privateGroupB}/join`, {
        method: 'POST',
        headers: pendingHeaders,
        body: JSON.stringify({}),
      });
      assert.equal(bannedRetry.status, 403);
      assert.equal((await bannedRetry.json()).code, 'ERR_VIRGOSCORPIO_HUB_GROUP_BANNED');
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        bannedSnapshot,
        'a banned member retry must neither change the banned state nor create community side effects'
      );

      await pool.query(
        'UPDATE social_group_memberships SET status=$3 WHERE group_id=$1 AND user_id=$2',
        [privateGroupB, userB2.id, 'pending']
      );

      const publicJoinSession = await identity.login({
        email: userBPublicJoinControl.email,
        password: 'Isolation-Password-2026',
        ip: '127.0.0.1',
        userAgent: 'tenant-community-public-group-join-test',
      });
      assert.equal(publicJoinSession.mfaRequired, false);
      const publicJoinHeaders = {
        authorization: 'Bearer ' + publicJoinSession.token,
        'x-virgoscorpio-hub-site-id': siteB,
        'content-type': 'application/json',
      };

      const freshPrivateJoin = await fetch(
        base + '/api/v1/sites/' + siteB + '/community/groups/' + freshPrivateGroupB + '/join',
        { method: 'POST', headers: publicJoinHeaders, body: JSON.stringify({}) }
      );
      assert.equal(freshPrivateJoin.status, 200);
      const freshPrivatePayload = await freshPrivateJoin.json();
      assert.equal(freshPrivatePayload.membership.status, 'pending', 'a first-time private-group join must remain pending');
      assert.equal(freshPrivatePayload.membership.role, 'member');
      const freshPrivateJoinSnapshot = await snapshotCommunitySite(pool, siteB);
      const freshPrivateRetry = await fetch(
        base + '/api/v1/sites/' + siteB + '/community/groups/' + freshPrivateGroupB + '/join',
        { method: 'POST', headers: publicJoinHeaders, body: JSON.stringify({}) }
      );
      assert.equal(freshPrivateRetry.status, 200);
      const freshPrivateRetryPayload = await freshPrivateRetry.json();
      assert.equal(freshPrivateRetryPayload.membership.status, 'pending');
      assert.equal(freshPrivateRetryPayload.membership.role, 'member');
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        freshPrivateJoinSnapshot,
        'retrying a fresh private-group request must not add notifications or unrelated community side effects'
      );

      const publicFirstJoin = await fetch(
        base + '/api/v1/sites/' + siteB + '/community/groups/' + groupB + '/join',
        { method: 'POST', headers: publicJoinHeaders, body: JSON.stringify({}) }
      );
      assert.equal(publicFirstJoin.status, 200);
      const publicFirstPayload = await publicFirstJoin.json();
      assert.equal(publicFirstPayload.membership.status, 'active', 'a first-time public-group join must remain active');
      assert.equal(publicFirstPayload.membership.role, 'member');
      const publicJoinSnapshot = await snapshotCommunitySite(pool, siteB);
      const publicRetry = await fetch(
        base + '/api/v1/sites/' + siteB + '/community/groups/' + groupB + '/join',
        { method: 'POST', headers: publicJoinHeaders, body: JSON.stringify({}) }
      );
      assert.equal(publicRetry.status, 200);
      const publicRetryPayload = await publicRetry.json();
      assert.equal(publicRetryPayload.membership.status, 'active', 'repeated public-group joins must remain active');
      assert.equal(publicRetryPayload.membership.role, 'member');
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        publicJoinSnapshot,
        'repeated public-group joins must not add notifications or unrelated community side effects'
      );

      await pool.query(
        'DELETE FROM social_group_memberships WHERE group_id=ANY($1::uuid[]) AND user_id=$2',
        [[freshPrivateGroupB, groupB], userBPublicJoinControl.id]
      );
      await assertSiteAUnchanged();
      await assertSiteBUnchanged();
    });

    await t.test('foreign conversation list, messages, send, and read do not cross sites', async () => {
      const list = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations`, { headers });
      const listed = await list.json();
      assert.equal(list.status, 200);
      assert.ok(listed.conversations.some(conversation => conversation.id === conversationB));
      assert.equal(listed.conversations.some(conversation => conversation.id === conversationA), false);

      const messageList = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations/${conversationA}/messages`, { headers });
      assert.equal(messageList.status, 404);
      assert.equal((await messageList.json()).code, 'ERR_VIRGOSCORPIO_HUB_CONVERSATION_NOT_FOUND');

      const send = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations/${conversationA}/messages`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'Attempted cross-site message' }),
      });
      assert.equal(send.status, 404);
      assert.equal((await send.json()).code, 'ERR_VIRGOSCORPIO_HUB_CONVERSATION_NOT_FOUND');

      const read = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations/${conversationA}/read`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(read.status, 404);
      assert.equal((await read.json()).code, 'ERR_VIRGOSCORPIO_HUB_CONVERSATION_NOT_FOUND');

    });

    await t.test('direct conversation creation rejects foreign recipients without side effects and preserves same-site reuse', async () => {
      const foreignRecipientCreate = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ recipientId: userA.id }),
      });
      const foreignRecipientPayload = await foreignRecipientCreate.json();
      const serializedForeignRecipientPayload = JSON.stringify(foreignRecipientPayload);
      assert.equal(foreignRecipientCreate.status, 404);
      assert.equal(foreignRecipientPayload.code, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND');
      assert.ok(!serializedForeignRecipientPayload.includes(userA.id), 'the response must not disclose the foreign recipient ID');
      assert.ok(!serializedForeignRecipientPayload.includes(siteA), 'the response must not disclose the foreign site ID');
      assert.doesNotMatch(serializedForeignRecipientPayload, /PRIVATE_SITE_A|Site A Member/);
      await assertSiteAUnchanged();
      await assertSiteBUnchanged();

      const sameSiteReuse = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ recipientId: userB2.id }),
      });
      assert.equal(sameSiteReuse.status, 200);
      const sameSiteReusePayload = await sameSiteReuse.json();
      assert.equal(sameSiteReusePayload.created, false);
      assert.equal(sameSiteReusePayload.conversation.id, conversationB);
      await assertSiteAUnchanged();
      await assertSiteBUnchanged();
    });

    await t.test('friendship requests reject foreign, invited, and disabled recipients without side effects', async () => {
      const blocks = await fetch(`${base}/api/v1/sites/${siteB}/community/blocks`, { headers });
      assert.equal(blocks.status, 200);
      assert.deepEqual((await blocks.json()).blocks, []);

      const createBlock = await fetch(`${base}/api/v1/sites/${siteB}/community/blocks`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ userId: userA.id, reason: 'Cross-site block attempt' }),
      });
      assert.equal(createBlock.status, 404);
      assert.equal((await createBlock.json()).code, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND');

      const removeBlock = await fetch(`${base}/api/v1/sites/${siteB}/community/blocks/${userA2.id}`, {
        method: 'DELETE',
        headers,
      });
      assert.equal(removeBlock.status, 404);
      assert.equal((await removeBlock.json()).code, 'ERR_VIRGOSCORPIO_HUB_BLOCK_NOT_FOUND');

      const friends = await fetch(`${base}/api/v1/sites/${siteB}/community/friends`, { headers });
      assert.equal(friends.status, 200);
      assert.deepEqual((await friends.json()).friendships, []);

      const createForeignFriend = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userA.id}`, {
        method: 'POST',
        headers,
      });
      assert.equal(createForeignFriend.status, 404);
      assert.equal((await createForeignFriend.json()).code, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND');

      const acceptForeign = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userA.id}`, {
        method: 'PUT',
        headers,
      });
      assert.equal(acceptForeign.status, 404);
      assert.equal((await acceptForeign.json()).code, 'ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND');
      await assertSiteAUnchanged();
      await assertSiteBUnchanged();

      const inactiveMemberships = await pool.query(
        'SELECT sm.user_id,u.status FROM site_memberships sm JOIN users u ON u.id=sm.user_id WHERE sm.site_id=$1 AND sm.user_id=ANY($2::uuid[]) ORDER BY u.status',
        [siteB, [userBInvited.id, userBDisabled.id]]
      );
      assert.deepEqual(
        inactiveMemberships.rows,
        [
          { user_id: userBDisabled.id, status: 'disabled' },
          { user_id: userBInvited.id, status: 'invited' },
        ],
        'both inactive recipient accounts deliberately retain Site B membership rows'
      );

      const createActiveFriend = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userB2.id}`, {
        method: 'POST',
        headers,
      });
      assert.equal(createActiveFriend.status, 201);
      const activeFriendPayload = await createActiveFriend.json();
      assert.equal(activeFriendPayload.friendship.requester_id, actorB.id);
      assert.equal(activeFriendPayload.friendship.addressee_id, userB2.id);
      assert.equal(activeFriendPayload.friendship.status, 'pending');
      await assertSiteAUnchanged();

      const addresseeSession = await identity.login({
        email: userB2.email,
        password: 'Isolation-Password-2026',
        ip: '127.0.0.1',
        userAgent: 'tenant-community-friendship-acceptance-test',
      });
      assert.equal(addresseeSession.mfaRequired, false);
      const addresseeHeaders = {
        authorization: `Bearer ${addresseeSession.token}`,
        'x-virgoscorpio-hub-site-id': siteB,
      };
      const acceptActiveFriend = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${actorB.id}`, {
        method: 'PUT',
        headers: addresseeHeaders,
      });
      assert.equal(acceptActiveFriend.status, 200);
      const acceptedActiveFriendPayload = await acceptActiveFriend.json();
      assert.equal(acceptedActiveFriendPayload.friendship.requester_id, actorB.id);
      assert.equal(acceptedActiveFriendPayload.friendship.addressee_id, userB2.id);
      assert.equal(acceptedActiveFriendPayload.friendship.status, 'accepted');
      const siteBAfterActiveFriend = await snapshotCommunitySite(pool, siteB);
      const inactiveFriendshipAttempts = [];
      for (const recipient of [
        { user: userBInvited, expectedStatus: 'invited' },
        { user: userBDisabled, expectedStatus: 'disabled' },
      ]) {
        const response = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${recipient.user.id}`, {
          method: 'POST',
          headers,
        });
        inactiveFriendshipAttempts.push({
          recipient,
          status: response.status,
          payload: await response.json(),
        });
      }

      assert.deepEqual(
        inactiveFriendshipAttempts.map(attempt => attempt.status),
        [404, 404],
        'invited and disabled recipients must both be rejected'
      );
      for (const attempt of inactiveFriendshipAttempts) {
        assert.equal(attempt.payload.code, 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND');
        assert.doesNotMatch(JSON.stringify(attempt.payload), new RegExp(attempt.recipient.user.id));
        assert.doesNotMatch(JSON.stringify(attempt.payload), new RegExp(attempt.recipient.user.display_name));
      }
      assert.deepEqual(await snapshotCommunitySite(pool, siteA), before, 'inactive-recipient denials must not change Site A state');
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        siteBAfterActiveFriend,
        'inactive-recipient denials must not create friendships or any other community side effects'
      );

      const inactiveRequesterSession = await identity.login({
        email: userBPublicJoinControl.email,
        password: 'Isolation-Password-2026',
        ip: '127.0.0.1',
        userAgent: 'tenant-community-inactive-friendship-requester-test',
      });
      assert.equal(inactiveRequesterSession.mfaRequired, false);
      const inactiveRequesterHeaders = {
        authorization: `Bearer ${inactiveRequesterSession.token}`,
        'x-virgoscorpio-hub-site-id': siteB,
      };
      const createPendingFriendship = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userB2.id}`, {
        method: 'POST',
        headers: inactiveRequesterHeaders,
      });
      assert.equal(createPendingFriendship.status, 201);
      const pendingFriendshipPayload = await createPendingFriendship.json();
      assert.equal(pendingFriendshipPayload.friendship.requester_id, userBPublicJoinControl.id);
      assert.equal(pendingFriendshipPayload.friendship.addressee_id, userB2.id);
      assert.equal(pendingFriendshipPayload.friendship.status, 'pending');

      await pool.query("UPDATE users SET status='disabled' WHERE id=$1", [userBPublicJoinControl.id]);
      const beforeInactiveRequesterAcceptanceA = await snapshotCommunitySite(pool, siteA);
      const beforeInactiveRequesterAcceptanceB = await snapshotCommunitySite(pool, siteB);
      const acceptInactiveRequester = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userBPublicJoinControl.id}`, {
        method: 'PUT',
        headers: addresseeHeaders,
      });
      assert.equal(acceptInactiveRequester.status, 404);
      const inactiveRequesterAcceptancePayload = await acceptInactiveRequester.json();
      assert.equal(inactiveRequesterAcceptancePayload.code, 'ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND');
      assert.doesNotMatch(JSON.stringify(inactiveRequesterAcceptancePayload), new RegExp(userBPublicJoinControl.id));
      assert.doesNotMatch(JSON.stringify(inactiveRequesterAcceptancePayload), new RegExp(userBPublicJoinControl.display_name));
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteA),
        beforeInactiveRequesterAcceptanceA,
        'accepting a friendship from an inactive requester must not change Site A state'
      );
      assert.deepEqual(
        await snapshotCommunitySite(pool, siteB),
        beforeInactiveRequesterAcceptanceB,
        'an inactive requester denial must leave the pending friendship and all Site B community state unchanged'
      );
    });

    await t.test('friendship creation revalidates both participants at the write boundary', async t => {
      await t.test('disabled addressee is rejected after the active-membership preflight', async () => {
        await assertFriendshipCreateRace({
          description: 'disabled addressee',
          mutation: query => query("UPDATE users SET status='disabled' WHERE id=$1", [userB2.id]),
          restore: query => query("UPDATE users SET status='active' WHERE id=$1", [userB2.id]),
          verifyMutation: async query => {
            const result = await query('SELECT status FROM users WHERE id=$1', [userB2.id]);
            assert.equal(result.rows[0].status, 'disabled');
          },
        });
      });

      await t.test('disabled requester is rejected after request authentication', async () => {
        await assertFriendshipCreateRace({
          description: 'disabled requester',
          mutation: query => query("UPDATE users SET status='disabled' WHERE id=$1", [actorB.id]),
          restore: query => query("UPDATE users SET status='active' WHERE id=$1", [actorB.id]),
          verifyMutation: async query => {
            const result = await query('SELECT status FROM users WHERE id=$1', [actorB.id]);
            assert.equal(result.rows[0].status, 'disabled');
          },
        });
      });

      await t.test('revoked addressee membership is rejected after the active-membership preflight', async () => {
        await assertFriendshipCreateRace({
          description: 'revoked addressee membership',
          mutation: query => query(
            'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2',
            [siteB, userB2.id]
          ),
          restore: query => query(
            'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
            [siteB, userB2.id, roleId]
          ),
          verifyMutation: async query => {
            const result = await query(
              'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2',
              [siteB, userB2.id]
            );
            assert.equal(result.rowCount, 0);
          },
        });
      });

      await t.test('revoked requester membership is rejected after site authorization', async () => {
        await assertFriendshipCreateRace({
          description: 'revoked requester membership',
          mutation: query => query(
            'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2',
            [siteB, actorB.id]
          ),
          restore: query => query(
            'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
            [siteB, actorB.id, roleId]
          ),
          verifyMutation: async query => {
            const result = await query(
              'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2',
              [siteB, actorB.id]
            );
            assert.equal(result.rowCount, 0);
          },
        });
      });
    });

    await t.test('friendship creation serializes concurrent participant changes', async t => {
      await t.test('account disablement waits for the locked participant user row', async () => {
        await assertFriendshipCreateSerializesChange({
          description: 'concurrent addressee disablement',
          lockSql: 'SELECT id FROM users WHERE id=$1 FOR UPDATE',
          lockParams: [userB2.id],
          mutate: client => client.query(
            "UPDATE users SET status='disabled' WHERE id=$1",
            [userB2.id]
          ),
          restore: query => query(
            "UPDATE users SET status='active' WHERE id=$1",
            [userB2.id]
          ),
          verifyMutation: async query => {
            const result = await query('SELECT status FROM users WHERE id=$1', [userB2.id]);
            assert.equal(result.rows[0].status, 'disabled');
          },
        });
      });

      await t.test('membership revocation waits for the locked participant membership row', async () => {
        await assertFriendshipCreateSerializesChange({
          description: 'concurrent addressee membership revocation',
          lockSql: 'SELECT user_id FROM site_memberships WHERE site_id=$1 AND user_id=$2 FOR UPDATE',
          lockParams: [siteB, userB2.id],
          mutate: client => client.query(
            'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2',
            [siteB, userB2.id]
          ),
          restore: query => query(
            'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
            [siteB, userB2.id, roleId]
          ),
          verifyMutation: async query => {
            const result = await query(
              'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2',
              [siteB, userB2.id]
            );
            assert.equal(result.rowCount, 0);
          },
        });
      });
    });

    await t.test('friendship creation remains single-row when participants have multiple site roles', async () => {
      const siteAStateBefore = await snapshotCommunitySite(pool, siteA);
      const additionalRoleResult = await pool.query(
        'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
        [
          `tenant-community-friendship-extra-${randomUUID().slice(0, 10)}`,
          'Tenant Community Additional Friendship Role',
          JSON.stringify([]),
        ]
      );
      const additionalRoleId = additionalRoleResult.rows[0].id;
      let siteBStateAfterRequest = null;

      try {
        await pool.query(
          'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($1,$4,$3)',
          [siteB, actorB.id, additionalRoleId, userB2.id]
        );

        const response = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${userB2.id}`, {
          method: 'POST',
          headers,
        });
        assert.equal(response.status, 201);
        const payload = await response.json();
        assert.equal(payload.friendship.requester_id, actorB.id);
        assert.equal(payload.friendship.addressee_id, userB2.id);
        assert.equal(payload.friendship.status, 'accepted');

        const rows = await pool.query(
          'SELECT status FROM social_friendships WHERE site_id=$1 AND requester_id=$2 AND addressee_id=$3',
          [siteB, actorB.id, userB2.id]
        );
        assert.deepEqual(rows.rows, [{ status: 'accepted' }], 'multiple membership roles must still produce one friendship row');
        siteBStateAfterRequest = await snapshotCommunitySite(pool, siteB);
      } finally {
        await pool.query(
          'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=ANY($2::uuid[]) AND role_id=$3',
          [siteB, [actorB.id, userB2.id], additionalRoleId]
        );
        await pool.query('DELETE FROM roles WHERE id=$1', [additionalRoleId]);
      }

      assert.deepEqual(await snapshotCommunitySite(pool, siteA), siteAStateBefore);
      assert.deepEqual(await snapshotCommunitySite(pool, siteB), siteBStateAfterRequest);
    });

    await t.test('friendship create preserves an existing blocked state on conflict', async () => {
      const blockedRecipient = await createUser('Site B Blocked Friendship Recipient');
      const siteAStateBeforeBlockedRetry = await snapshotCommunitySite(pool, siteA);
      const siteBStateBeforeBlockedRetry = await snapshotCommunitySite(pool, siteB);
      try {
        await pool.query(
          'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
          [siteB, blockedRecipient.id, roleId]
        );
        await pool.query(
          "INSERT INTO social_friendships(site_id,requester_id,addressee_id,status) VALUES($1,$2,$3,'blocked')",
          [siteB, actorB.id, blockedRecipient.id]
        );

        const response = await fetch(`${base}/api/v1/sites/${siteB}/community/friends/${blockedRecipient.id}`, {
          method: 'POST',
          headers,
        });
        assert.equal(response.status, 201);
        const payload = await response.json();
        assert.equal(payload.friendship.status, 'blocked');

        const rows = await pool.query(
          'SELECT status FROM social_friendships WHERE site_id=$1 AND requester_id=$2 AND addressee_id=$3',
          [siteB, actorB.id, blockedRecipient.id]
        );
        assert.deepEqual(rows.rows, [{ status: 'blocked' }], 'conflict upsert must retain one blocked friendship');
      } finally {
        await pool.query(
          'DELETE FROM social_friendships WHERE site_id=$1 AND requester_id=$2 AND addressee_id=$3',
          [siteB, actorB.id, blockedRecipient.id]
        );
        await pool.query(
          'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2',
          [siteB, blockedRecipient.id]
        );
        await pool.query('DELETE FROM users WHERE id=$1', [blockedRecipient.id]);
      }

      assert.deepEqual(await snapshotCommunitySite(pool, siteA), siteAStateBeforeBlockedRetry);
      assert.deepEqual(await snapshotCommunitySite(pool, siteB), siteBStateBeforeBlockedRetry);
    });

    await t.test('foreign report target and review IDs cannot reveal or change site A reports', async () => {
      const reports = await fetch(`${base}/api/v1/sites/${siteB}/community/reports`, { headers });
      assert.equal(reports.status, 200);
      assert.deepEqual((await reports.json()).reports, []);

      const createReport = await fetch(`${base}/api/v1/sites/${siteB}/community/reports`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ targetType: 'user', targetId: userA.id, category: 'harassment', detail: 'Cross-site report attempt' }),
      });
      assert.equal(createReport.status, 404);
      assert.equal((await createReport.json()).code, 'ERR_VIRGOSCORPIO_HUB_REPORT_TARGET_NOT_FOUND');

      const review = await fetch(`${base}/api/v1/sites/${siteB}/community/reports/${reportA}`, {
        method: 'PATCH',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed', moderationNote: 'Cross-site review attempt' }),
      });
      assert.equal(review.status, 404);
      assert.equal((await review.json()).code, 'ERR_VIRGOSCORPIO_HUB_REPORT_NOT_FOUND');
      await assertSiteAUnchanged();
    });

    await t.test('foreign moderation IDs cannot hide site A activity or emit audit rows', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/community/moderation`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ targetType: 'activity', targetId: activityA, action: 'hide', reason: 'Cross-site moderation attempt' }),
      });
      assert.equal(response.status, 404);
      assert.equal((await response.json()).code, 'ERR_VIRGOSCORPIO_HUB_MODERATION_TARGET_NOT_FOUND');

      const foreignMessage = await fetch(`${base}/api/v1/sites/${siteB}/community/moderation`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ targetType: 'message', targetId: messageA, action: 'hide', reason: 'Cross-site message moderation attempt' }),
      });
      assert.equal(foreignMessage.status, 404);
      assert.equal((await foreignMessage.json()).code, 'ERR_VIRGOSCORPIO_HUB_MODERATION_TARGET_NOT_FOUND');
      await assertSiteAUnchanged();
    });

    await t.test('notification reads are bounded by both site and recipient', async () => {
      const inbox = await fetch(`${base}/api/v1/sites/${siteB}/community/notifications`, { headers });
      const inboxPayload = await inbox.json();
      assert.equal(inbox.status, 200);
      assert.ok(inboxPayload.notifications.some(item => item.id === notificationB));
      assert.equal(inboxPayload.notifications.some(item => item.id === notificationA), false);

      const readForeign = await fetch(`${base}/api/v1/sites/${siteB}/community/notifications/${notificationA}/read`, {
        method: 'POST',
        headers,
      });
      assert.equal(readForeign.status, 404);
      assert.equal((await readForeign.json()).code, 'ERR_VIRGOSCORPIO_HUB_NOTIFICATION_NOT_FOUND');

      const readAll = await fetch(`${base}/api/v1/sites/${siteB}/community/notifications/read-all`, {
        method: 'POST',
        headers,
      });
      assert.equal(readAll.status, 200);
      const states = await pool.query(
        'SELECT id,site_id,read_at FROM social_notifications WHERE id=ANY($1::uuid[]) ORDER BY site_id',
        [[notificationA, notificationB]]
      );
      const aState = states.rows.find(row => row.id === notificationA);
      const bState = states.rows.find(row => row.id === notificationB);
      assert.equal(aState.site_id, siteA);
      assert.equal(aState.read_at, null, 'site B read-all must not acknowledge a foreign site notification');
      assert.equal(bState.site_id, siteB);
      assert.ok(bState.read_at, 'site B read-all should acknowledge the site B control notification');
      await assertSiteAUnchanged();
    });

    const ownMessage = await fetch(`${base}/api/v1/sites/${siteB}/community/conversations/${conversationB}/messages`, { headers });
    assert.equal(ownMessage.status, 200, 'the actor can still read a conversation belonging to site B');
    assert.match(JSON.stringify(await ownMessage.json()), /Site B message control/);
  }
);
