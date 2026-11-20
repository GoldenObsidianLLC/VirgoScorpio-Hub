'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');
const { waitForDatabaseWriteLock } = require('../helpers/postgres-locks');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

test(
  'community feed: private-group visibility and comment parents remain site and group scoped',
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
      ['community-feed-a-' + randomUUID().slice(0, 10), 'Community Feed Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['community-feed-b-' + randomUUID().slice(0, 10), 'Community Feed Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [
        'community-feed-' + randomUUID().slice(0, 10),
        'Community Feed Integration Member',
        JSON.stringify(['content:create']),
      ]
    );
    roleId = roleResult.rows[0].id;

    async function createUser(label) {
      const email = 'community-feed-' +
        label.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
        '-' + randomUUID() + '@example.test';
      const result = await pool.query(
        "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
        [email, label, await hashPassword('Isolation-Password-2026')]
      );
      userIds.push(result.rows[0].id);
      return result.rows[0];
    }

    const groupOwnerA = await createUser('Site A Private Group Owner');
    const groupMemberA = await createUser('Site A Private Group Member');
    const siteMemberA = await createUser('Site A Non Group Member');
    const siteMemberB = await createUser('Site B Member');

    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($1,$4,$3),($1,$5,$3),($6,$7,$3)',
      [siteA, groupOwnerA.id, roleId, groupMemberA.id, siteMemberA.id, siteB, siteMemberB.id]
    );

    const privateGroupResult = await pool.query(
      'INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [siteA, 'private-' + randomUUID().slice(0, 10), 'Private Feed Group', 'Private feed visibility fixture', 'private', groupOwnerA.id]
    );
    const privateGroupId = privateGroupResult.rows[0].id;

    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active'),($1,$3,'member','active')",
      [privateGroupId, groupOwnerA.id, groupMemberA.id]
    );

    const hiddenGroupResult = await pool.query(
      'INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [siteA, 'hidden-' + randomUUID().slice(0, 10), 'Hidden Feed Group', 'Hidden feed visibility fixture', 'hidden', groupOwnerA.id]
    );
    const hiddenGroupId = hiddenGroupResult.rows[0].id;
    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active'),($1,$3,'member','active')",
      [hiddenGroupId, groupOwnerA.id, groupMemberA.id]
    );

    const publicGroupResult = await pool.query(
      'INSERT INTO social_groups(site_id,slug,name,description,privacy,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [siteA, 'public-' + randomUUID().slice(0, 10), 'Public Feed Group', 'Public feed visibility fixture', 'public', groupOwnerA.id]
    );
    const publicGroupId = publicGroupResult.rows[0].id;
    await pool.query(
      "INSERT INTO social_group_memberships(group_id,user_id,role,status) VALUES($1,$2,'owner','active')",
      [publicGroupId, groupOwnerA.id]
    );

    async function login(user, label) {
      const session = await identity.login({
        email: user.email,
        password: 'Isolation-Password-2026',
        ip: '127.0.0.1',
        userAgent: 'community-feed-privacy-test-' + label,
      });
      assert.equal(session.mfaRequired, false);
      return session;
    }

    const sessionOwnerA = await login(groupOwnerA, 'owner');
    const sessionMemberA = await login(groupMemberA, 'group-member');
    const sessionSiteMemberA = await login(siteMemberA, 'site-member');
    const sessionSiteMemberB = await login(siteMemberB, 'site-b');

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

    const base = 'http://127.0.0.1:' + server.address().port;
    const headersFor = token => ({ authorization: 'Bearer ' + token });
    const jsonHeadersFor = token => ({
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    });
    const feedPath = siteId => '/api/v1/sites/' + siteId + '/community/feed';

    async function requestFeed(siteId, token, options = {}) {
      const method = options.method || 'GET';
      const body = options.body;
      const response = await fetch(base + feedPath(siteId), {
        method,
        headers: body === undefined ? headersFor(token) : jsonHeadersFor(token),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { response, payload: await response.json() };
    }

    async function snapshotFeedSite(siteId) {
      const [activities, groups, memberships, auditEvents, outboxEvents] = await Promise.all([
        pool.query(
          'SELECT id,site_id,actor_id,group_id,activity_type,body,visibility,parent_id,metadata,created_at,deleted_at FROM social_activities WHERE site_id=$1 ORDER BY id',
          [siteId]
        ),
        pool.query(
          'SELECT id,site_id,slug,privacy,created_by FROM social_groups WHERE site_id=$1 ORDER BY id',
          [siteId]
        ),
        pool.query(
          'SELECT gm.group_id,gm.user_id,gm.role,gm.status FROM social_group_memberships gm JOIN social_groups g ON g.id=gm.group_id WHERE g.site_id=$1 ORDER BY gm.group_id,gm.user_id',
          [siteId]
        ),
        pool.query(
          'SELECT id,site_id,actor_id,action,target_type,target_id,request_id,details,created_at FROM audit_events WHERE site_id=$1 ORDER BY created_at,id',
          [siteId]
        ),
        pool.query(
          'SELECT id,site_id,actor_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,status,attempts,correlation_id,classification,created_at FROM outbox_events WHERE site_id=$1 ORDER BY created_at,id',
          [siteId]
        ),
      ]);
      return {
        activities: activities.rows,
        groups: groups.rows,
        memberships: memberships.rows,
        auditEvents: auditEvents.rows,
        outboxEvents: outboxEvents.rows,
      };
    }

    const defaultPrivatePost = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'group_post',
        groupId: privateGroupId,
        body: 'PRIVATE_GROUP_DEFAULT_VISIBILITY_MARKER',
      },
    });
    assert.equal(defaultPrivatePost.response.status, 201);
    assert.equal(defaultPrivatePost.payload.activity.visibility, 'group');
    const defaultPrivatePostId = defaultPrivatePost.payload.activity.id;

    const explicitlyPublicPrivatePost = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'group_post',
        groupId: privateGroupId,
        visibility: 'public',
        body: 'PRIVATE_GROUP_EXPLICIT_PUBLIC_MARKER',
      },
    });
    assert.equal(explicitlyPublicPrivatePost.response.status, 201);
    assert.equal(explicitlyPublicPrivatePost.payload.activity.visibility, 'group');
    const explicitlyPublicPrivatePostId = explicitlyPublicPrivatePost.payload.activity.id;

    const hiddenGroupPost = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'group_post',
        groupId: hiddenGroupId,
        body: 'HIDDEN_GROUP_DEFAULT_VISIBILITY_MARKER',
      },
    });
    assert.equal(hiddenGroupPost.response.status, 201);
    assert.equal(hiddenGroupPost.payload.activity.visibility, 'group');
    const hiddenGroupPostId = hiddenGroupPost.payload.activity.id;

    const membersStatus = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'status',
        visibility: 'members',
        body: 'NON_GROUP_MEMBERS_VISIBILITY_CONTROL',
      },
    });
    assert.equal(membersStatus.response.status, 201);
    const membersStatusId = membersStatus.payload.activity.id;

    const privateStatus = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'status',
        visibility: 'private',
        body: 'NON_GROUP_PRIVATE_VISIBILITY_CONTROL',
      },
    });
    assert.equal(privateStatus.response.status, 201);
    const privateStatusId = privateStatus.payload.activity.id;

    const publicStatus = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'status',
        visibility: 'public',
        body: 'NON_GROUP_PUBLIC_VISIBILITY_CONTROL',
      },
    });
    assert.equal(publicStatus.response.status, 201);
    const publicStatusId = publicStatus.payload.activity.id;

    const publicGroupMembersPost = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'group_post',
        groupId: publicGroupId,
        visibility: 'members',
        body: 'PUBLIC_GROUP_MEMBERS_VISIBILITY_CONTROL',
      },
    });
    assert.equal(publicGroupMembersPost.response.status, 201);
    const publicGroupMembersPostId = publicGroupMembersPost.payload.activity.id;

    const publicGroupOnlyPost = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'group_post',
        groupId: publicGroupId,
        visibility: 'group',
        body: 'PUBLIC_GROUP_RESTRICTED_VISIBILITY_CONTROL',
      },
    });
    assert.equal(publicGroupOnlyPost.response.status, 201);
    const publicGroupOnlyPostId = publicGroupOnlyPost.payload.activity.id;

    const privateParent = await requestFeed(siteA, sessionOwnerA.token, {
      method: 'POST',
      body: {
        activityType: 'group_post',
        groupId: privateGroupId,
        visibility: 'group',
        body: 'PRIVATE_GROUP_COMMENT_PARENT_MARKER',
      },
    });
    assert.equal(privateParent.response.status, 201);
    const privateParentId = privateParent.payload.activity.id;

    const siteBParent = await requestFeed(siteB, sessionSiteMemberB.token, {
      method: 'POST',
      body: {
        activityType: 'status',
        visibility: 'members',
        body: 'SITE_B_COMMENT_PARENT_MARKER',
      },
    });
    assert.equal(siteBParent.response.status, 201);
    const siteBParentId = siteBParent.payload.activity.id;

    const deletedParentResult = await pool.query(
      "INSERT INTO social_activities(site_id,actor_id,group_id,activity_type,body,visibility,deleted_at) VALUES($1,$2,$3,'group_post',$4,'group',now()) RETURNING id",
      [siteA, groupOwnerA.id, privateGroupId, 'DELETED_PRIVATE_PARENT_MARKER']
    );
    const deletedParentId = deletedParentResult.rows[0].id;

    async function seedLegacyComment(actorId, commentGroupId, visibility, body) {
      const result = await pool.query(
        'INSERT INTO social_activities(site_id,actor_id,group_id,activity_type,body,visibility,parent_id) VALUES($1,$2,$3,\'comment\',$4,$5,$6) RETURNING id',
        [siteA, actorId, commentGroupId, body, visibility, privateParentId]
      );
      return result.rows[0].id;
    }

    // These rows model records created before the route bound comments to the
    // parent's group and visibility. Feed reads must fail closed for them.
    const legacyUnscopedCommentId = await seedLegacyComment(
      siteMemberA.id, null, 'members', 'LEGACY_UNSCOPED_PRIVATE_GROUP_COMMENT'
    );
    const legacyMovedCommentId = await seedLegacyComment(
      siteMemberA.id, publicGroupId, 'public', 'LEGACY_MOVED_PRIVATE_GROUP_COMMENT'
    );
    const validLegacyCommentId = await seedLegacyComment(
      groupMemberA.id, privateGroupId, 'group', 'LEGACY_VALID_PRIVATE_GROUP_COMMENT'
    );

    // Legacy cyclic parent references must terminate and remain hidden.
    const cycleFirst = await pool.query(
      "INSERT INTO social_activities(site_id,actor_id,group_id,activity_type,body,visibility) VALUES($1,$2,$3,'comment',$4,'group') RETURNING id",
      [siteA, groupMemberA.id, privateGroupId, 'LEGACY_COMMENT_CYCLE_FIRST']
    );
    const cycleSecond = await pool.query(
      "INSERT INTO social_activities(site_id,actor_id,group_id,activity_type,body,visibility) VALUES($1,$2,$3,'comment',$4,'group') RETURNING id",
      [siteA, groupMemberA.id, privateGroupId, 'LEGACY_COMMENT_CYCLE_SECOND']
    );
    const legacyCycleIds = [cycleFirst.rows[0].id, cycleSecond.rows[0].id];
    await pool.query(
      'UPDATE social_activities SET parent_id=$2 WHERE id=$1',
      [legacyCycleIds[0], legacyCycleIds[1]]
    );
    await pool.query(
      'UPDATE social_activities SET parent_id=$2 WHERE id=$1',
      [legacyCycleIds[1], legacyCycleIds[0]]
    );

    const initialA = await snapshotFeedSite(siteA);
    const initialB = await snapshotFeedSite(siteB);

    await t.test('community feed writes revalidate author and group eligibility at the final insert', async t => {
      const scenarios = [
        {
          name: 'actor disabled after route authorization',
          body: { activityType: 'status', visibility: 'members' },
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN',
          mutate: async query => {
            const result = await query("UPDATE users SET status='disabled' WHERE id=$1 RETURNING id", [groupOwnerA.id]);
            assert.equal(result.rowCount, 1);
          },
          restore: query => query("UPDATE users SET status='active' WHERE id=$1", [groupOwnerA.id]),
        },
        {
          name: 'selected-site membership revoked after route authorization',
          body: { activityType: 'status', visibility: 'members' },
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN',
          mutate: async query => {
            const result = await query(
              'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2 RETURNING role_id',
              [siteA, groupOwnerA.id]
            );
            assert.equal(result.rowCount, 1);
          },
          restore: query => query(
            'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [siteA, groupOwnerA.id, roleId]
          ),
        },
        {
          name: 'private-group membership revoked after route authorization',
          body: { activityType: 'group_post', groupId: privateGroupId, visibility: 'group' },
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_GROUP_MEMBERSHIP',
          mutate: async query => {
            const result = await query(
              "UPDATE social_group_memberships SET status='banned' WHERE group_id=$1 AND user_id=$2 AND status='active' RETURNING status",
              [privateGroupId, groupOwnerA.id]
            );
            assert.equal(result.rowCount, 1);
          },
          restore: query => query(
            "UPDATE social_group_memberships SET status='active' WHERE group_id=$1 AND user_id=$2",
            [privateGroupId, groupOwnerA.id]
          ),
        },
        {
          name: 'parent group becomes private after comment authorization',
          token: sessionSiteMemberA.token,
          body: { activityType: 'comment', parentId: publicGroupMembersPostId },
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_GROUP_MEMBERSHIP',
          mutate: async query => {
            const result = await query(
              "UPDATE social_groups SET privacy='private' WHERE id=$1 AND privacy='public' RETURNING id",
              [publicGroupId]
            );
            assert.equal(result.rowCount, 1);
          },
          restore: query => query(
            "UPDATE social_groups SET privacy='public' WHERE id=$1",
            [publicGroupId]
          ),
        },
        {
          name: 'eligible group member comment narrows to group visibility when privacy changes after preflight',
          token: sessionOwnerA.token,
          body: { activityType: 'comment', parentId: publicGroupMembersPostId },
          expectedStatus: 201,
          expectedVisibility: 'group',
          mutate: async query => {
            const result = await query(
              "UPDATE social_groups SET privacy='private' WHERE id=$1 AND privacy='public' RETURNING id",
              [publicGroupId]
            );
            assert.equal(result.rowCount, 1);
          },
          restore: query => query(
            "UPDATE social_groups SET privacy='public' WHERE id=$1",
            [publicGroupId]
          ),
        },
      ];

      for (const scenario of scenarios) {
        await t.test(scenario.name, async () => {
          const beforeA = await snapshotFeedSite(siteA);
          const beforeB = await snapshotFeedSite(siteB);
          const marker = 'F1.58_' + randomUUID();
          const body = { ...scenario.body, body: marker };
          const originalQueryDescriptor = Object.getOwnPropertyDescriptor(pool, 'query');
          const originalConnectDescriptor = Object.getOwnPropertyDescriptor(pool, 'connect');
          const query = pool.query.bind(pool);
          const connect = pool.connect.bind(pool);
          let mutationStarted = false;
          let mutationApplied = false;

          const beforeWriteTransaction = async sql => {
            if (
              !mutationStarted &&
              typeof sql === 'string' &&
              sql.trim().toUpperCase() === 'BEGIN'
            ) {
              mutationStarted = true;
              await scenario.mutate(query);
              mutationApplied = true;
            }
          };

          pool.query = async (sql, params) => {
            await beforeWriteTransaction(sql);
            return query(sql, params);
          };
          pool.connect = function (callback) {
            if (typeof callback === 'function') return connect(callback);
            return connect().then(client => ({
              query: async (sql, params) => {
                await beforeWriteTransaction(sql);
                return client.query(sql, params);
              },
              release: (...args) => client.release(...args),
            }));
          };

          try {
            const denied = await requestFeed(siteA, scenario.token || sessionOwnerA.token, { method: 'POST', body });
            assert.equal(mutationStarted, true, scenario.name + ': eligibility mutation must happen after route preflight and before the write transaction begins');
            assert.equal(mutationApplied, true, scenario.name + ': injected eligibility change must commit before the write transaction begins');
            assert.equal(denied.response.status, scenario.expectedStatus || 403, scenario.name + ': final write must preserve the locked authorization and privacy decision');
            if (scenario.expectedCode) assert.equal(denied.payload.code, scenario.expectedCode);
            if (scenario.expectedVisibility) {
              assert.equal(denied.payload.activity.visibility, scenario.expectedVisibility);
              assert.equal(denied.payload.activity.group_id, publicGroupId);
              assert.equal(denied.payload.activity.parent_id, publicGroupMembersPostId);
            }
            const persisted = await query(
              'SELECT id FROM social_activities WHERE site_id=$1 AND actor_id=$2 AND body=$3',
              [siteA, groupOwnerA.id, marker]
            );
            assert.equal(persisted.rowCount, scenario.expectedStatus === 201 ? 1 : 0, scenario.name + ': persisted activity count must match the expected outcome');
          } finally {
            if (originalQueryDescriptor) Object.defineProperty(pool, 'query', originalQueryDescriptor);
            else delete pool.query;
            if (originalConnectDescriptor) Object.defineProperty(pool, 'connect', originalConnectDescriptor);
            else delete pool.connect;
            try {
              if (mutationApplied) await scenario.restore(query);
            } finally {
              await query(
                'DELETE FROM social_activities WHERE site_id=$1 AND actor_id=$2 AND body=$3',
                [siteA, groupOwnerA.id, marker]
              );
            }
          }

          assert.deepEqual(await snapshotFeedSite(siteA), beforeA, scenario.name + ': Site A feed/audit/outbox state must be unchanged');
          assert.deepEqual(await snapshotFeedSite(siteB), beforeB, scenario.name + ': Site B feed/audit/outbox state must be unchanged');
        });
      }
    });

    await t.test('community feed writes serialize with concurrent lifecycle changes', async t => {
      const scenarios = [
        {
          name: 'account disablement waits for the actor user lock',
          lockSql: 'SELECT id FROM users WHERE id=$1 FOR UPDATE',
          lockParams: [groupOwnerA.id],
          body: { activityType: 'status', visibility: 'members' },
          expectedStatus: 403,
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN',
          mutate: blocker => blocker.query("UPDATE users SET status='disabled' WHERE id=$1", [groupOwnerA.id]),
          restore: query => query("UPDATE users SET status='active' WHERE id=$1", [groupOwnerA.id]),
        },
        {
          name: 'site-membership revocation waits for the selected-site membership lock',
          lockSql: 'SELECT user_id FROM site_memberships WHERE site_id=$1 AND user_id=$2 ORDER BY role_id FOR UPDATE',
          lockParams: [siteA, groupOwnerA.id],
          body: { activityType: 'status', visibility: 'members' },
          expectedStatus: 403,
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN',
          mutate: blocker => blocker.query(
            'DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2',
            [siteA, groupOwnerA.id]
          ),
          restore: query => query(
            'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [siteA, groupOwnerA.id, roleId]
          ),
        },
        {
          name: 'private-group membership ban waits for the group-membership lock',
          lockSql: 'SELECT group_id,user_id FROM social_group_memberships WHERE group_id=$1 AND user_id=$2 FOR UPDATE',
          lockParams: [privateGroupId, groupOwnerA.id],
          body: { activityType: 'group_post', groupId: privateGroupId, visibility: 'group' },
          expectedStatus: 403,
          expectedCode: 'ERR_VIRGOSCORPIO_HUB_GROUP_MEMBERSHIP',
          mutate: blocker => blocker.query(
            "UPDATE social_group_memberships SET status='banned' WHERE group_id=$1 AND user_id=$2",
            [privateGroupId, groupOwnerA.id]
          ),
          restore: query => query(
            "UPDATE social_group_memberships SET status='active' WHERE group_id=$1 AND user_id=$2",
            [privateGroupId, groupOwnerA.id]
          ),
        },
        {
          name: 'parent-group privacy changes wait for the group lock and narrow comment visibility',
          lockSql: 'SELECT id FROM social_groups WHERE site_id=$1 AND id=$2 FOR UPDATE',
          lockParams: [siteA, publicGroupId],
          body: { activityType: 'comment', parentId: publicGroupMembersPostId },
          expectedStatus: 201,
          expectedVisibility: 'group',
          mutate: blocker => blocker.query(
            "UPDATE social_groups SET privacy='private' WHERE site_id=$1 AND id=$2",
            [siteA, publicGroupId]
          ),
          restore: query => query(
            "UPDATE social_groups SET privacy='public' WHERE site_id=$1 AND id=$2",
            [siteA, publicGroupId]
          ),
        },
      ];

      for (const scenario of scenarios) {
        await t.test(scenario.name, async () => {
          const beforeA = await snapshotFeedSite(siteA);
          const beforeB = await snapshotFeedSite(siteB);
          const marker = 'F1.58_LOCK_' + randomUUID();
          const body = { ...scenario.body, body: marker };
          const blocker = await pool.connect();
          const originalConnectDescriptor = Object.getOwnPropertyDescriptor(pool, 'connect');
          const connect = pool.connect.bind(pool);
          const query = pool.query.bind(pool);
          let transactionOpen = false;
          let mutationCommitted = false;
          let writeStarted = false;
          let requestPromise = null;

          try {
            await blocker.query('BEGIN');
            transactionOpen = true;
            const locked = await blocker.query(scenario.lockSql, scenario.lockParams);
            assert.ok(locked.rowCount > 0, scenario.name + ': the blocker row must exist');

            pool.connect = function (callback) {
              if (typeof callback === 'function') return connect(callback);
              return connect().then(client => ({
                query: (sql, params) => {
                  if (
                    !writeStarted &&
                    typeof sql === 'string' &&
                    sql.toUpperCase().includes('WITH PARTICIPANT_USERS AS MATERIALIZED')
                  ) {
                    writeStarted = true;
                  }
                  return client.query(sql, params);
                },
                release: (...args) => client.release(...args),
              }));
            };

            requestPromise = requestFeed(siteA, sessionOwnerA.token, { method: 'POST', body });
            const writeDeadline = Date.now() + 5000;
            while (!writeStarted && Date.now() < writeDeadline) {
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            assert.equal(writeStarted, true, scenario.name + ': final feed transaction must reach PostgreSQL');

            const waitingOnLock = await waitForDatabaseWriteLock(
              blocker,
              'WITH PARTICIPANT_USERS AS MATERIALIZED'
            );
            assert.equal(
              waitingOnLock,
              true,
              scenario.name + ': the final feed write must wait for the lifecycle row lock'
            );

            await scenario.mutate(blocker);
            await blocker.query('COMMIT');
            transactionOpen = false;
            mutationCommitted = true;

            const result = await requestPromise;
            requestPromise = null;
            assert.equal(result.response.status, scenario.expectedStatus, scenario.name + ': response must reflect the committed lifecycle change');
            if (scenario.expectedCode) assert.equal(result.payload.code, scenario.expectedCode);
            if (scenario.expectedVisibility) {
              assert.equal(result.payload.activity.visibility, scenario.expectedVisibility);
              assert.equal(result.payload.activity.group_id, publicGroupId);
              assert.equal(result.payload.activity.parent_id, publicGroupMembersPostId);
            }

            const persisted = await query(
              'SELECT id FROM social_activities WHERE site_id=$1 AND actor_id=$2 AND body=$3',
              [siteA, groupOwnerA.id, marker]
            );
            assert.equal(
              persisted.rowCount,
              scenario.expectedStatus === 201 ? 1 : 0,
              scenario.name + ': persisted activity count must match the expected response'
            );
          } finally {
            if (transactionOpen) await blocker.query('ROLLBACK').catch(() => {});
            if (originalConnectDescriptor) Object.defineProperty(pool, 'connect', originalConnectDescriptor);
            else delete pool.connect;
            if (requestPromise) await requestPromise.catch(() => {});
            blocker.release();

            try {
              if (mutationCommitted) await scenario.restore(query);
            } finally {
              await query(
                'DELETE FROM social_activities WHERE site_id=$1 AND actor_id=$2 AND body=$3',
                [siteA, groupOwnerA.id, marker]
              );
            }
          }

          assert.deepEqual(await snapshotFeedSite(siteA), beforeA, scenario.name + ': Site A feed/audit/outbox state must be unchanged');
          assert.deepEqual(await snapshotFeedSite(siteB), beforeB, scenario.name + ': Site B feed/audit/outbox state must be unchanged');
        });
      }
    });

    await t.test('legacy comments cannot widen or move a private-group parent scope', async () => {
      const commentAuthorFeed = await requestFeed(siteA, sessionSiteMemberA.token);
      const groupMemberFeed = await requestFeed(siteA, sessionMemberA.token);

      for (const id of [legacyUnscopedCommentId, legacyMovedCommentId]) {
        assert.equal(
          commentAuthorFeed.payload.activities.some(item => item.id === id),
          false,
          'a comment author must not bypass the visibility of an inaccessible parent'
        );
        assert.equal(
          groupMemberFeed.payload.activities.some(item => item.id === id),
          false,
          'a comment with mismatched group/visibility scope must not appear in the private group feed'
        );
      }

      assert.ok(
        groupMemberFeed.payload.activities.some(item => item.id === validLegacyCommentId),
        'a comment whose stored scope matches its visible parent remains readable by group members'
      );
      assert.equal(commentAuthorFeed.payload.activities.some(item => item.id === validLegacyCommentId), false);
    });

    await t.test('cyclic legacy comment parents terminate and fail closed', async () => {
      const groupMemberFeed = await requestFeed(siteA, sessionMemberA.token);
      assert.equal(groupMemberFeed.response.status, 200);
      for (const id of legacyCycleIds) {
        assert.equal(
          groupMemberFeed.payload.activities.some(item => item.id === id),
          false,
          'a cyclic comment parent chain must not be exposed as valid feed content'
        );
      }
    });

    await t.test('private-group posts with default visibility stay hidden from other site members', async () => {
      const groupMemberFeed = await requestFeed(siteA, sessionMemberA.token);
      assert.equal(groupMemberFeed.response.status, 200);
      for (const activityId of [defaultPrivatePostId, explicitlyPublicPrivatePostId, hiddenGroupPostId]) {
        assert.ok(groupMemberFeed.payload.activities.some(item => item.id === activityId));
      }
      assert.equal(
        groupMemberFeed.payload.activities.some(item => item.id === publicGroupOnlyPostId),
        false,
        'a member of Site A who is not a member of the public group cannot read group-only activity'
      );

      const siteMemberFeed = await requestFeed(siteA, sessionSiteMemberA.token);
      assert.equal(siteMemberFeed.response.status, 200);
      for (const activityId of [
        defaultPrivatePostId,
        explicitlyPublicPrivatePostId,
        hiddenGroupPostId,
        privateStatusId,
        publicGroupOnlyPostId,
      ]) {
        assert.equal(
          siteMemberFeed.payload.activities.some(item => item.id === activityId),
          false,
          'site-only and group-only content must respect the applicable visibility boundary'
        );
      }
      assert.ok(siteMemberFeed.payload.activities.some(item => item.id === membersStatusId));
      assert.ok(siteMemberFeed.payload.activities.some(item => item.id === publicStatusId));
      assert.ok(siteMemberFeed.payload.activities.some(item => item.id === publicGroupMembersPostId));
      assert.doesNotMatch(JSON.stringify(siteMemberFeed.payload), /PRIVATE_GROUP_DEFAULT_VISIBILITY_MARKER/);
      assert.doesNotMatch(JSON.stringify(siteMemberFeed.payload), /PRIVATE_GROUP_EXPLICIT_PUBLIC_MARKER/);
      assert.doesNotMatch(JSON.stringify(siteMemberFeed.payload), /HIDDEN_GROUP_DEFAULT_VISIBILITY_MARKER/);

      const ownerFeed = await requestFeed(siteA, sessionOwnerA.token);
      assert.ok(ownerFeed.payload.activities.some(item => item.id === privateStatusId));

      const foreignSiteFeed = await requestFeed(siteB, sessionSiteMemberB.token);
      assert.equal(foreignSiteFeed.response.status, 200);
      for (const activityId of [defaultPrivatePostId, explicitlyPublicPrivatePostId, hiddenGroupPostId, membersStatusId]) {
        assert.equal(foreignSiteFeed.payload.activities.some(item => item.id === activityId), false);
      }
      assert.deepEqual(await snapshotFeedSite(siteA), initialA);
      assert.deepEqual(await snapshotFeedSite(siteB), initialB);
    });

    await t.test('site members outside a private group cannot comment on its activity', async () => {
      const beforeA = await snapshotFeedSite(siteA);
      const denied = await requestFeed(siteA, sessionSiteMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: privateParentId,
          body: 'UNAUTHORIZED_PRIVATE_GROUP_COMMENT',
        },
      });
      assert.equal(denied.response.status, 404);
      assert.equal(denied.payload.code, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_NOT_FOUND');
      assert.deepEqual(await snapshotFeedSite(siteA), beforeA);
    });

    await t.test('site members cannot reply to legacy comments whose stored scope widens the parent', async () => {
      const beforeA = await snapshotFeedSite(siteA);
      const denied = await requestFeed(siteA, sessionSiteMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: legacyUnscopedCommentId,
          body: 'UNAUTHORIZED_REPLY_TO_LEGACY_UNSCOPED_COMMENT',
        },
      });
      assert.equal(denied.response.status, 404);
      assert.equal(denied.payload.code, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_NOT_FOUND');
      assert.deepEqual(await snapshotFeedSite(siteA), beforeA);
    });

    await t.test('comment parents must belong to the selected site', async () => {
      const beforeA = await snapshotFeedSite(siteA);
      const beforeB = await snapshotFeedSite(siteB);
      const denied = await requestFeed(siteA, sessionMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: siteBParentId,
          body: 'CROSS_SITE_PARENT_COMMENT_ATTEMPT',
        },
      });
      assert.equal(denied.response.status, 404);
      assert.equal(denied.payload.code, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_NOT_FOUND');
      assert.deepEqual(await snapshotFeedSite(siteA), beforeA);
      assert.deepEqual(await snapshotFeedSite(siteB), beforeB);
    });

    await t.test('comment scope cannot be moved by a caller-supplied group ID', async () => {
      const beforeA = await snapshotFeedSite(siteA);
      const denied = await requestFeed(siteA, sessionMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: privateParentId,
          groupId: publicGroupId,
          visibility: 'public',
          body: 'COMMENT_SCOPE_MOVE_ATTEMPT',
        },
      });
      assert.equal(denied.response.status, 400);
      assert.equal(denied.payload.code, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_PARENT_SCOPE_MISMATCH');
      assert.deepEqual(await snapshotFeedSite(siteA), beforeA);
    });

    await t.test('comments cannot target soft-deleted parent activities', async () => {
      const beforeA = await snapshotFeedSite(siteA);
      const denied = await requestFeed(siteA, sessionOwnerA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: deletedParentId,
          groupId: privateGroupId,
          body: 'COMMENT_ON_DELETED_PRIVATE_GROUP_ACTIVITY',
        },
      });
      assert.equal(denied.response.status, 404);
      assert.equal(denied.payload.code, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_NOT_FOUND');
      assert.deepEqual(await snapshotFeedSite(siteA), beforeA);
    });

    await t.test('comments inherit the parent group scope and visibility', async () => {
      const created = await requestFeed(siteA, sessionMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: privateParentId,
          visibility: 'members',
          body: 'AUTHORIZED_PRIVATE_GROUP_COMMENT',
        },
      });
      assert.equal(created.response.status, 201);
      assert.equal(created.payload.activity.parent_id, privateParentId);
      assert.equal(created.payload.activity.group_id, privateGroupId);
      assert.equal(created.payload.activity.visibility, 'group');

      const groupMemberFeed = await requestFeed(siteA, sessionMemberA.token);
      assert.ok(groupMemberFeed.payload.activities.some(item => item.id === created.payload.activity.id));

      const siteMemberFeed = await requestFeed(siteA, sessionSiteMemberA.token);
      assert.equal(siteMemberFeed.payload.activities.some(item => item.id === created.payload.activity.id), false);
      assert.doesNotMatch(JSON.stringify(siteMemberFeed.payload), /AUTHORIZED_PRIVATE_GROUP_COMMENT/);

      const nested = await requestFeed(siteA, sessionMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          parentId: created.payload.activity.id,
          visibility: 'public',
          body: 'AUTHORIZED_NESTED_PRIVATE_GROUP_COMMENT',
        },
      });
      assert.equal(nested.response.status, 201);
      assert.equal(nested.payload.activity.parent_id, created.payload.activity.id);
      assert.equal(nested.payload.activity.group_id, privateGroupId);
      assert.equal(nested.payload.activity.visibility, 'group');

      const nestedGroupMemberFeed = await requestFeed(siteA, sessionMemberA.token);
      assert.ok(nestedGroupMemberFeed.payload.activities.some(item => item.id === nested.payload.activity.id));
      const nestedSiteMemberFeed = await requestFeed(siteA, sessionSiteMemberA.token);
      assert.equal(nestedSiteMemberFeed.payload.activities.some(item => item.id === nested.payload.activity.id), false);
      assert.doesNotMatch(JSON.stringify(nestedSiteMemberFeed.payload), /AUTHORIZED_NESTED_PRIVATE_GROUP_COMMENT/);
      assert.deepEqual(await snapshotFeedSite(siteB), initialB);
    });

    await t.test('comments require a parent and cannot be posted as detached activities', async () => {
      const beforeA = await snapshotFeedSite(siteA);
      const denied = await requestFeed(siteA, sessionMemberA.token, {
        method: 'POST',
        body: {
          activityType: 'comment',
          body: 'DETACHED_COMMENT_ATTEMPT',
        },
      });
      assert.equal(denied.response.status, 400);
      assert.equal(denied.payload.code, 'ERR_VIRGOSCORPIO_HUB_ACTIVITY_PARENT_REQUIRED');
      assert.deepEqual(await snapshotFeedSite(siteA), beforeA);
    });
  }
);
