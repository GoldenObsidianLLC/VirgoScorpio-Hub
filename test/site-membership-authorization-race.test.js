'use strict';

/**
 * Test suite for verifying mitigation of the stale-authorization race condition
 * in site membership operations (pentest finding: "Revoked site managers can
 * complete in-flight membership operations after revocation").
 *
 * The vulnerability allowed a request whose preflight authorization succeeded
 * to commit membership changes even after the actor's site:manage capability
 * was revoked by another manager. The fix adds transactional revalidation
 * using requireCurrentSiteManager() with FOR SHARE locks inside each service
 * method's transaction.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TARGET_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EDITOR_ROLE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const VIEWER_ROLE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

/**
 * Create a mock pool that simulates the race condition: the actor's membership
 * is valid during preflight but revoked before the service method executes.
 */
function createRaceConditionPool({ operation, actorRevokedInTransaction = true } = {}) {
  const events = [];
  let transactionDepth = 0;

  const mockClient = {
    async query(sql, values = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      events.push({ sql: normalized, values, inTransaction: transactionDepth > 0 });

      // Lock acquisition for site
      if (normalized.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) {
        return { rowCount: 1, rows: [{ id: SITE_ID }] };
      }

      if (normalized.includes('SELECT id FROM sites WHERE id=$1 FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: SITE_ID }] };
      }

      // Authorization revalidation inside transaction - this is where we simulate revocation
      if (normalized.includes('SELECT r.capabilities FROM site_memberships m JOIN roles r') &&
          normalized.includes('FOR SHARE OF m, r, u')) {
        // If actor was revoked during the transaction, return no rows (unauthorized)
        if (actorRevokedInTransaction && transactionDepth > 0) {
          return { rowCount: 0, rows: [] };
        }
        // Otherwise, actor still has site:manage capability
        return { rowCount: 1, rows: [{ capabilities: ['site:manage'] }] };
      }

      // listMembers query
      if (normalized.includes('SELECT u.id,u.email,u.display_name,u.status,r.slug AS role,m.created_at')) {
        return {
          rowCount: 1,
          rows: [{ id: ACTOR_ID, email: 'actor@example.test', display_name: 'Actor', status: 'active', role: 'editor', created_at: new Date() }]
        };
      }

      // addMember queries
      if (normalized.includes("SELECT id,email,display_name,status FROM users WHERE lower(email)=$1 AND status='active'")) {
        return {
          rowCount: 1,
          rows: [{ id: TARGET_USER_ID, email: 'target@example.test', display_name: 'Target User', status: 'active' }]
        };
      }

      if (normalized.includes("SELECT id FROM roles WHERE slug=$1")) {
        return { rowCount: 1, rows: [{ id: EDITOR_ROLE_ID }] };
      }

      if (normalized.includes('INSERT INTO site_memberships(site_id,user_id,role_id)')) {
        return { rowCount: 1, rows: [{ user_id: TARGET_USER_ID }] };
      }

      // removeMember queries
      if (normalized.includes("SELECT 1 FROM site_memberships m JOIN roles r ON r.id=m.role_id WHERE m.site_id=$1 AND m.user_id=$2 AND r.slug='site-owner'")) {
        return { rowCount: 0, rows: [] }; // Target is not an owner
      }

      if (normalized.includes('DELETE FROM site_memberships WHERE site_id=$1 AND user_id=$2 RETURNING user_id')) {
        return { rowCount: 1, rows: [{ user_id: TARGET_USER_ID }] };
      }

      // createInvitation queries
      if (normalized.includes('SELECT slug,name FROM sites WHERE id=$1')) {
        return { rowCount: 1, rows: [{ slug: 'test-site', name: 'Test Site' }] };
      }

      if (normalized.includes('INSERT INTO site_invitations')) {
        return { rowCount: 1, rows: [{ id: 'invitation-id-123' }] };
      }

      if (normalized.includes('INSERT INTO mail_outbox')) {
        return { rowCount: 1, rows: [] };
      }

      // Audit event insertion
      if (normalized.includes('INSERT INTO audit_events')) {
        return { rowCount: 1, rows: [] };
      }

      throw new Error(`Unmocked query: ${normalized}`);
    },
    release: () => {},
  };

  const pool = {
    async query(sql, values) {
      return mockClient.query(sql, values);
    },
    async connect() {
      return mockClient;
    },
    events,
    // Helper to track transaction boundaries
    _wrapClient(client) {
      return {
        ...client,
        async query(sql, values) {
          if (sql === 'BEGIN') {
            transactionDepth++;
            events.push({ sql: 'BEGIN', inTransaction: true });
            return { rowCount: 0, rows: [] };
          }
          if (sql === 'COMMIT') {
            transactionDepth--;
            events.push({ sql: 'COMMIT', inTransaction: true });
            return { rowCount: 0, rows: [] };
          }
          if (sql === 'ROLLBACK') {
            transactionDepth--;
            events.push({ sql: 'ROLLBACK', inTransaction: true });
            return { rowCount: 0, rows: [] };
          }
          return client.query(sql, values);
        },
        release: client.release,
      };
    },
  };

  // Wrap connect to track transactions
  const originalConnect = pool.connect.bind(pool);
  pool.connect = async function() {
    const client = await originalConnect();
    return pool._wrapClient(client);
  };

  return pool;
}

test('listMembers rejects revoked actor inside transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'listMembers', actorRevokedInTransaction: true });
  const identity = createIdentityService({ pool, env: {} });

  await assert.rejects(
    identity.listMembers({ siteId: SITE_ID, actorId: ACTOR_ID }),
    error => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.match(error.message, /site:manage capability is required/i);
      return true;
    },
    'listMembers must reject when actor is revoked during transaction'
  );

  // Verify that authorization was checked inside the transaction
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  assert.ok(authCheckEvent, 'Authorization must be revalidated inside the transaction');
});

test('listMembers succeeds when actor remains authorized throughout transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'listMembers', actorRevokedInTransaction: false });
  const identity = createIdentityService({ pool, env: {} });

  const members = await identity.listMembers({ siteId: SITE_ID, actorId: ACTOR_ID });

  assert.ok(Array.isArray(members), 'listMembers should return an array');
  assert.equal(members.length, 1);
  assert.equal(members[0].id, ACTOR_ID);

  // Verify authorization was checked inside transaction
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  assert.ok(authCheckEvent, 'Authorization must be revalidated inside the transaction');
});

test('addMember rejects revoked actor inside transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'addMember', actorRevokedInTransaction: true });
  const identity = createIdentityService({ pool, env: {} });

  await assert.rejects(
    identity.addMember({
      siteId: SITE_ID,
      email: 'target@example.test',
      roleSlug: 'editor',
      actorId: ACTOR_ID,
      requestId: 'test-request-123',
    }),
    error => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.match(error.message, /site:manage capability is required/i);
      return true;
    },
    'addMember must reject when actor is revoked during transaction'
  );

  // Verify that authorization was checked inside the transaction
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  assert.ok(authCheckEvent, 'Authorization must be revalidated inside the transaction');

  // Verify that the membership insertion did NOT occur
  const insertEvent = pool.events.find(e =>
    e.sql.includes('INSERT INTO site_memberships')
  );
  assert.equal(insertEvent, undefined, 'Membership insertion must not occur after authorization failure');
});

test('addMember succeeds when actor remains authorized throughout transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'addMember', actorRevokedInTransaction: false });
  const identity = createIdentityService({
    pool,
    env: {},
    onAuthorizationChange: async () => {}, // Mock the callback
  });

  const member = await identity.addMember({
    siteId: SITE_ID,
    email: 'target@example.test',
    roleSlug: 'editor',
    actorId: ACTOR_ID,
    requestId: 'test-request-123',
  });

  assert.equal(member.id, TARGET_USER_ID);
  assert.equal(member.email, 'target@example.test');

  // Verify authorization was checked inside transaction before insertion
  const events = pool.events;
  const authCheckIndex = events.findIndex(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  const insertIndex = events.findIndex(e =>
    e.sql.includes('INSERT INTO site_memberships')
  );

  assert.ok(authCheckIndex >= 0, 'Authorization check must occur');
  assert.ok(insertIndex >= 0, 'Membership insertion must occur');
  assert.ok(authCheckIndex < insertIndex, 'Authorization check must occur before insertion');
});

test('removeMember rejects revoked actor inside transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'removeMember', actorRevokedInTransaction: true });
  const identity = createIdentityService({ pool, env: {} });

  await assert.rejects(
    identity.removeMember({
      siteId: SITE_ID,
      userId: TARGET_USER_ID,
      actorId: ACTOR_ID,
      requestId: 'test-request-123',
    }),
    error => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.match(error.message, /site:manage capability is required/i);
      return true;
    },
    'removeMember must reject when actor is revoked during transaction'
  );

  // Verify that authorization was checked inside the transaction
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  assert.ok(authCheckEvent, 'Authorization must be revalidated inside the transaction');

  // Verify that the membership deletion did NOT occur
  const deleteEvent = pool.events.find(e =>
    e.sql.includes('DELETE FROM site_memberships')
  );
  assert.equal(deleteEvent, undefined, 'Membership deletion must not occur after authorization failure');
});

test('removeMember succeeds when actor remains authorized throughout transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'removeMember', actorRevokedInTransaction: false });
  const identity = createIdentityService({
    pool,
    env: {},
    onAuthorizationChange: async () => {}, // Mock the callback
  });

  await identity.removeMember({
    siteId: SITE_ID,
    userId: TARGET_USER_ID,
    actorId: ACTOR_ID,
    requestId: 'test-request-123',
  });

  // Verify authorization was checked inside transaction before deletion
  const events = pool.events;
  const authCheckIndex = events.findIndex(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  const deleteIndex = events.findIndex(e =>
    e.sql.includes('DELETE FROM site_memberships')
  );

  assert.ok(authCheckIndex >= 0, 'Authorization check must occur');
  assert.ok(deleteIndex >= 0, 'Membership deletion must occur');
  assert.ok(authCheckIndex < deleteIndex, 'Authorization check must occur before deletion');
});

test('createInvitation rejects revoked actor inside transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'createInvitation', actorRevokedInTransaction: true });
  const identity = createIdentityService({ pool, env: {} });

  await assert.rejects(
    identity.createInvitation({
      siteId: SITE_ID,
      email: 'invitee@example.test',
      roleSlug: 'viewer',
      invitedBy: ACTOR_ID,
    }),
    error => {
      assert.equal(error.statusCode, 403);
      assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.match(error.message, /site:manage capability is required/i);
      return true;
    },
    'createInvitation must reject when actor is revoked during transaction'
  );

  // Verify that authorization was checked inside the transaction
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  assert.ok(authCheckEvent, 'Authorization must be revalidated inside the transaction');

  // Verify that the invitation insertion did NOT occur
  const insertEvent = pool.events.find(e =>
    e.sql.includes('INSERT INTO site_invitations')
  );
  assert.equal(insertEvent, undefined, 'Invitation insertion must not occur after authorization failure');

  // Verify that mail outbox record was NOT created
  const mailEvent = pool.events.find(e =>
    e.sql.includes('INSERT INTO mail_outbox')
  );
  assert.equal(mailEvent, undefined, 'Mail outbox record must not be created after authorization failure');

  // Protected site metadata must not be read until the transactional actor check passes.
  const siteReadEvent = pool.events.find(e =>
    e.sql.includes('SELECT slug,name FROM sites')
  );
  assert.equal(siteReadEvent, undefined, 'Site metadata must not be read after authorization failure');
});

test('createInvitation succeeds when actor remains authorized throughout transaction', async () => {
  const pool = createRaceConditionPool({ operation: 'createInvitation', actorRevokedInTransaction: false });
  const identity = createIdentityService({ pool, env: { VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS: 'true' } });

  const invitation = await identity.createInvitation({
    siteId: SITE_ID,
    email: 'invitee@example.test',
    roleSlug: 'viewer',
    invitedBy: ACTOR_ID,
  });

  assert.equal(invitation.email, 'invitee@example.test');
  assert.equal(invitation.role, 'viewer');

  // Verify authorization was checked inside transaction before insertion
  const events = pool.events;
  const authCheckIndex = events.findIndex(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );
  const siteReadIndex = events.findIndex(e =>
    e.sql.includes('SELECT slug,name FROM sites')
  );
  const insertIndex = events.findIndex(e =>
    e.sql.includes('INSERT INTO site_invitations')
  );

  assert.ok(authCheckIndex >= 0, 'Authorization check must occur');
  assert.ok(siteReadIndex >= 0, 'Site metadata is read for an authorized invitation');
  assert.ok(insertIndex >= 0, 'Invitation insertion must occur');
  assert.ok(authCheckIndex < siteReadIndex, 'Authorization must be revalidated before reading site metadata');
  assert.ok(siteReadIndex < insertIndex, 'Site metadata must be read before invitation insertion');
});

test('operations with null actorId bypass authorization check (developer principal)', async () => {
  const pool = createRaceConditionPool({ operation: 'listMembers', actorRevokedInTransaction: true });
  const identity = createIdentityService({ pool, env: {} });

  // With null actorId, the operation should succeed even though actorRevokedInTransaction is true
  const members = await identity.listMembers({ siteId: SITE_ID, actorId: null });

  assert.ok(Array.isArray(members), 'listMembers should return an array for developer principal');

  // Verify that authorization check was NOT performed (developer bypass)
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u')
  );
  assert.equal(authCheckEvent, undefined, 'Authorization check should be bypassed for null actorId (developer principal)');
});

test('operations with undefined actorId bypass authorization check (developer principal)', async () => {
  const pool = createRaceConditionPool({ operation: 'addMember', actorRevokedInTransaction: true });
  const identity = createIdentityService({
    pool,
    env: {},
    onAuthorizationChange: async () => {},
  });

  // With undefined actorId, the operation should succeed
  const member = await identity.addMember({
    siteId: SITE_ID,
    email: 'target@example.test',
    roleSlug: 'editor',
    actorId: undefined,
    requestId: 'test-request-123',
  });

  assert.equal(member.id, TARGET_USER_ID);

  // Verify that authorization check was NOT performed
  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u')
  );
  assert.equal(authCheckEvent, undefined, 'Authorization check should be bypassed for undefined actorId (developer principal)');
});

test('lockSiteShared is called before requireCurrentSiteManager to maintain lock order', async () => {
  const pool = createRaceConditionPool({ operation: 'addMember', actorRevokedInTransaction: false });
  const identity = createIdentityService({
    pool,
    env: {},
    onAuthorizationChange: async () => {},
  });

  await identity.addMember({
    siteId: SITE_ID,
    email: 'target@example.test',
    roleSlug: 'editor',
    actorId: ACTOR_ID,
    requestId: 'test-request-123',
  });

  const events = pool.events;
  const lockIndex = events.findIndex(e =>
    e.sql.includes('FOR KEY SHARE') && e.inTransaction
  );
  const authCheckIndex = events.findIndex(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );

  assert.ok(lockIndex >= 0, 'Site lock must be acquired');
  assert.ok(authCheckIndex >= 0, 'Authorization check must occur');
  assert.ok(lockIndex < authCheckIndex, 'Site lock must be acquired before authorization check to maintain lock order');
});

test('removeMember uses FOR UPDATE lock on site (stronger than FOR KEY SHARE)', async () => {
  const pool = createRaceConditionPool({ operation: 'removeMember', actorRevokedInTransaction: false });
  const identity = createIdentityService({
    pool,
    env: {},
    onAuthorizationChange: async () => {},
  });

  await identity.removeMember({
    siteId: SITE_ID,
    userId: TARGET_USER_ID,
    actorId: ACTOR_ID,
    requestId: 'test-request-123',
  });

  const events = pool.events;
  const forUpdateLock = events.find(e =>
    e.sql.includes('FOR UPDATE') && e.inTransaction
  );
  const authCheckIndex = events.findIndex(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );

  assert.ok(forUpdateLock, 'removeMember must use FOR UPDATE lock on site for owner-removal serialization');
  assert.ok(authCheckIndex >= 0, 'Authorization check must still occur after site lock');
});

test('authorization check uses FOR SHARE locks on membership, role, and user rows', async () => {
  const pool = createRaceConditionPool({ operation: 'listMembers', actorRevokedInTransaction: false });
  const identity = createIdentityService({ pool, env: {} });

  await identity.listMembers({ siteId: SITE_ID, actorId: ACTOR_ID });

  const authCheckEvent = pool.events.find(e =>
    e.sql.includes('FOR SHARE OF m, r, u') && e.inTransaction
  );

  assert.ok(authCheckEvent, 'Authorization check must use FOR SHARE locks');
  assert.ok(authCheckEvent.sql.includes('site_memberships m'), 'Must lock membership row');
  assert.ok(authCheckEvent.sql.includes('JOIN roles r'), 'Must lock role row');
  assert.ok(authCheckEvent.sql.includes('JOIN users u'), 'Must lock user row');
  assert.ok(authCheckEvent.sql.includes("u.status='active'"), 'Must check user is active');
});
