'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

const SITE_A = '11111111-1111-4111-8111-111111111111';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

test('site-addressed route families deny a member without the required capability before data access', async t => {
  const authorizationCalls = [];
  const protectedDataAccess = [];
  const identity = {
    async authenticate(token) {
      assert.equal(token, 'site-a-member-session');
      return {
        mode: 'session',
        sessionToken: token,
        sessionId: SESSION_A,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: USER_A, email: 'site-a-member@example.test', displayName: 'Site A Member', status: 'active' },
        memberships: [{ siteId: SITE_A }]
      };
    },
    async authorizeSite(userId, siteId, capability) {
      authorizationCalls.push({ userId, siteId, capability });
      return false;
    },
    async isSessionActive() { return true; }
  };
  const pool = {
    async query(sql, params) {
      // The request firewall loads its shared rules before route authorization.
      // Allow that single, global policy read; deny access to all tenant data.
      if (sql.includes('FROM firewall_rules WHERE enabled=true')) return { rows: [] };
      protectedDataAccess.push({ kind: 'query', sql, params });
      throw new Error('Tenant data access must not occur before site capability authorization.');
    },
    async connect(...args) {
      protectedDataAccess.push({ kind: 'connect', args });
      throw new Error('Tenant data transaction must not occur before site capability authorization.');
    },
    async end() {}
  };
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '200'
    },
    pool,
    identityService: identity,
    contentStore: {
      async getById() { throw new Error('Content access must not occur before authorization.'); }
    },
    logger: { error() {} }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port;
  // Prime the five-second shared firewall cache so only the required global
  // policy read occurs before the first route-specific authorization check.
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);

  const routes = [
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/design-system', capability: 'content:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/reusable-components', capability: 'content:read' },
    { method: 'POST', path: '/api/v1/sites/' + SITE_A + '/reusable-components', capability: 'content:edit', body: { document: {} } },
    { method: 'PUT', path: '/api/v1/sites/' + SITE_A + '/reusable-components/cccccccc-cccc-4ccc-8ccc-cccccccccccc', capability: 'content:edit', body: { document: {} } },
    { method: 'DELETE', path: '/api/v1/sites/' + SITE_A + '/reusable-components/cccccccc-cccc-4ccc-8ccc-cccccccccccc', capability: 'content:edit' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/templates', capability: 'content:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/terms', capability: 'content:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/relationships', capability: 'content:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/menus', capability: 'content:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/ai-policy', capability: 'site:manage' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/members', capability: 'site:manage' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/library/items', capability: 'library:manage' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/products', capability: 'commerce:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/commerce/orders', capability: 'commerce:read' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/memberships', capability: 'memberships:manage' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/community/groups/cccccccc-cccc-4ccc-8ccc-cccccccccccc/members', capability: 'community:moderate' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/security/firewall-rules', capability: 'security:manage' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/cloud/connections', capability: 'cloud:manage' },
    { method: 'GET', path: '/api/v1/sites/' + SITE_A + '/mega-menus', capability: 'content:read' }
  ];

  for (const route of routes) {
    await t.test(route.path, async () => {
      const beforeAuthorization = authorizationCalls.length;
      const beforeDataAccess = protectedDataAccess.length;
      const response = await fetch(base + route.path, {
        method: route.method,
        headers: {
          authorization: 'Bearer site-a-member-session',
          ...(route.body ? { 'content-type': 'application/json' } : {})
        },
        ...(route.body ? { body: JSON.stringify(route.body) } : {})
      });
      const payload = await response.json();

      assert.equal(response.status, 403, 'missing route capability must be denied');
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.ok(
        authorizationCalls.slice(beforeAuthorization).some(call =>
          call.userId === USER_A && call.siteId === SITE_A && call.capability === route.capability
        ),
        'the route must check the expected capability for the path site'
      );
      assert.equal(protectedDataAccess.length, beforeDataAccess, 'denied route must not query or connect to tenant data stores');
    });
  }
});


test('community group member listing is reachable only with the site moderation capability', async t => {
  const GROUP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const authorizationCalls = [];
  const dataQueries = [];
  const transactionQueries = [];
  const identity = {
    async authenticate(token) {
      assert.equal(token, 'site-a-moderator-session');
      return {
        mode: 'session',
        sessionToken: token,
        sessionId: SESSION_A,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: USER_A, email: 'site-a-moderator@example.test', displayName: 'Site A Moderator', status: 'active' },
        memberships: [{ siteId: SITE_A }]
      };
    },
    async authorizeSite(userId, siteId, capability) {
      authorizationCalls.push({ userId, siteId, capability });
      return userId === USER_A && siteId === SITE_A &&
        ['content:read', 'community:moderate'].includes(capability);
    }
  };
  const expectedMembers = [{
    id: USER_A,
    display_name: 'Site A Moderator',
    email: 'site-a-moderator@example.test',
    role: 'moderator',
    status: 'active'
  }];
  const pool = {
    async query(sql) {
      if (sql.includes('FROM firewall_rules WHERE enabled=true')) return { rows: [] };
      throw new Error('Unexpected pool-level query: ' + sql);
    },
    async connect() {
      return {
        async query(sql, params) {
          transactionQueries.push({ sql, params });
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql.trim().toUpperCase())) return { rows: [] };
          if (sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) {
            assert.deepEqual(params, [SITE_A], 'site authorization lock must use the route site');
            return { rows: [{ id: SITE_A }] };
          }
          if (sql.includes('SELECT r.capabilities FROM users u')) {
            assert.deepEqual(params, [SITE_A, USER_A, 'active'], 'current role lookup must bind site, actor, and active status');
            return { rows: [{ capabilities: ['content:read', 'community:moderate'] }] };
          }
          if (sql.includes('FROM social_group_memberships gm JOIN users u')) {
            dataQueries.push({ sql, params });
            assert.deepEqual(params, [SITE_A, GROUP_ID], 'member listing query must be constrained by both site and group');
            return { rows: expectedMembers };
          }
          throw new Error('Unexpected transaction query: ' + sql);
        },
        release() {}
      };
    },
    async end() {}
  };
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100'
    },
    pool,
    identityService: identity,
    logger: { error() {} }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/health')).status, 200);
  const response = await fetch(base + '/api/v1/sites/' + SITE_A + '/community/groups/' + GROUP_ID + '/members', {
    headers: { authorization: 'Bearer site-a-moderator-session' }
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).members, expectedMembers);
  assert.ok(authorizationCalls.some(call => call.siteId === SITE_A && call.capability === 'community:moderate'));
  assert.equal(dataQueries.length, 1);
  const capabilityQueryIndex = transactionQueries.findIndex(query => query.sql.includes('SELECT r.capabilities FROM users u'));
  const memberQueryIndex = transactionQueries.findIndex(query => query.sql.includes('FROM social_group_memberships gm JOIN users u'));
  assert.ok(capabilityQueryIndex >= 0 && capabilityQueryIndex < memberQueryIndex, 'the current site capability must be locked before member details are selected');
});

test('community profile listing revalidates active site membership before reading profile fields', async t => {
  const authorizationCalls = [];
  const transactionQueries = [];
  let profileRows = [{
    display_name: 'Site A Profile',
    bio: 'Private profile biography',
    avatar_asset_id: null,
    website_url: 'https://site-a-profile.example.test',
    visibility: 'members',
    metadata: { source: 'route-unit-test' },
    version: 3,
    updated_at: '2026-11-27T12:00:00.000Z'
  }];
  let profileQueryCount = 0;
  const identity = {
    async authenticate(token) {
      assert.equal(token, 'site-a-profile-session');
      return {
        mode: 'session',
        sessionToken: token,
        sessionId: SESSION_A,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: USER_A, email: 'site-a-profile@example.test', displayName: 'Site A Profile User', status: 'active' },
        memberships: [{ siteId: SITE_A }]
      };
    },
    async authorizeSite(userId, siteId, capability) {
      authorizationCalls.push({ userId, siteId, capability });
      return userId === USER_A && siteId === SITE_A && capability === 'content:read';
    },
    async isSessionActive() { return true; }
  };
  const expectedProfile = profileRows[0];
  const pool = {
    async query(sql) {
      if (sql.includes('FROM firewall_rules WHERE enabled=true')) return { rows: [] };
      throw new Error('Profile data must use the membership-authorization transaction: ' + sql);
    },
    async connect() {
      return {
        async query(sql, params) {
          transactionQueries.push({ sql, params });
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql.trim().toUpperCase())) return { rows: [] };
          if (sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) {
            assert.deepEqual(params, [SITE_A], 'site lock must be bound to the route site');
            return { rows: [{ id: SITE_A }] };
          }
          if (sql.includes('SELECT r.capabilities FROM users u JOIN site_memberships m')) {
            assert.deepEqual(params, [SITE_A, USER_A, 'active'], 'membership validation must bind site, actor and active status');
            return { rows: [{ capabilities: ['content:read'] }] };
          }
          if (sql.includes('FROM social_profiles WHERE site_id=$1 AND user_id=$2')) {
            profileQueryCount += 1;
            assert.deepEqual(params, [SITE_A, USER_A], 'profile query must remain constrained by site and authenticated actor');
            return { rows: profileRows };
          }
          throw new Error('Unexpected profile transaction query: ' + sql);
        },
        release() {}
      };
    },
    async end() {}
  };
  const server = createApiServer({
    env: { NODE_ENV: 'test', AI_PROVIDER: 'mock', RATE_LIMIT_MAX_REQUESTS: '100' },
    pool,
    identityService: identity,
    logger: { error() {} }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  });

  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/health')).status, 200);
  const headers = { authorization: 'Bearer site-a-profile-session' };
  const response = await fetch(base + '/api/v1/sites/' + SITE_A + '/community/profile', { headers });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).profile, expectedProfile);
  assert.ok(authorizationCalls.some(call => call.userId === USER_A && call.siteId === SITE_A && call.capability === 'content:read'));

  const firstRead = transactionQueries.slice();
  const siteLockIndex = firstRead.findIndex(query => query.sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE'));
  const membershipIndex = firstRead.findIndex(query => query.sql.includes('SELECT r.capabilities FROM users u JOIN site_memberships m'));
  const profileIndex = firstRead.findIndex(query => query.sql.includes('FROM social_profiles WHERE site_id=$1 AND user_id=$2'));
  assert.ok(
    siteLockIndex >= 0 && siteLockIndex < membershipIndex && membershipIndex < profileIndex,
    'site and current membership locks must precede the profile-detail SELECT',
  );

  profileRows = [];
  const absentResponse = await fetch(base + '/api/v1/sites/' + SITE_A + '/community/profile', { headers });
  assert.equal(absentResponse.status, 200);
  assert.equal((await absentResponse.json()).profile, null, 'an active member without a saved profile must still receive profile:null');
  assert.equal(profileQueryCount, 2, 'each profile read must execute its SELECT once within the transaction');
});
