'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

// Security test: verify that the plugin registry API enforces pagination and per-site quota
// to prevent resource exhaustion attacks.
//
// The pentest finding identified that:
// 1. GET /api/v1/plugins returned all manifests without pagination
// 2. POST /api/v1/plugins/register had no cumulative site quota
// 3. An attacker could register many large plugins and exhaust resources
//
// Mitigations:
// 1. GET /api/v1/plugins now supports limit/offset pagination (default limit: 100, max: 100)
// 2. POST /api/v1/plugins/register enforces a 100-plugin per-site quota
// 3. Re-registration of existing plugin names doesn't count against quota

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

// Register database-backed tests only in the live integration job. The service-less
// Node matrix must not count intentionally unavailable database scenarios as skips.
if (enabled) test(
  'plugin registry enforces per-site quota and pagination',
  async t => {
    const { createPostgresPool } = require('../packages/db/src/postgres-store');
    const { createIdentityService, hashPassword } = require('../packages/auth/src/service');
    const { createApiServer } = require('../apps/api/src/server');

    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
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
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM plugin_installs WHERE site_id = ANY($1::uuid[])', [siteIds]).catch(() => {});
        await pool.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      if (roleId) await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
      await pool.end();
    });

    // Create test site
    const siteResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['plugin-quota-test-' + randomUUID().slice(0, 8), 'Plugin Quota Test Site']
    );
    const siteId = siteResult.rows[0].id;
    siteIds.push(siteId);

    // Create admin role with plugins:manage capability
    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      ['plugin-admin-' + randomUUID().slice(0, 10), 'Plugin Administrator', JSON.stringify(['*'])]
    );
    roleId = roleResult.rows[0].id;

    // Create test user
    const password = 'Plugin-Test-Password-2026';
    const passwordHash = await hashPassword(password);
    const userResult = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['plugin-admin-' + randomUUID() + '@example.test', 'Plugin Administrator', passwordHash]
    );
    const user = userResult.rows[0];
    userIds.push(user.id);

    // Assign user to site with admin role
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteId, user.id, roleId]
    );

    // Login and get session token
    const session = await identity.login({ email: user.email, password, ip: '127.0.0.1' });
    assert.equal(session.mfaRequired, false);

    // Start API server
    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = {
      authorization: 'Bearer ' + session.token,
      'x-virgoscorpio-hub-site-id': siteId,
      'content-type': 'application/json'
    };

    // Test 1: Verify pagination parameters are enforced
    const listResponse = await fetch(base + '/api/v1/plugins', { headers });
    assert.equal(listResponse.status, 200, 'List request should succeed');
    const listData = await listResponse.json();
    assert.ok('plugins' in listData, 'Response should contain plugins array');
    assert.ok('limit' in listData, 'Response should contain limit');
    assert.ok('offset' in listData, 'Response should contain offset');
    assert.ok('hasMore' in listData, 'Response should contain hasMore flag');
    assert.equal(listData.limit, 100, 'Default limit should preserve the 100-plugin site quota.');
    assert.equal(listData.offset, 0, 'Default offset should be 0');

    // Test 2: Verify custom pagination parameters work
    const customListResponse = await fetch(base + '/api/v1/plugins?limit=10&offset=5', { headers });
    assert.equal(customListResponse.status, 200, 'Custom pagination should succeed');
    const customListData = await customListResponse.json();
    assert.equal(customListData.limit, 10, 'Custom limit should be respected');
    assert.equal(customListData.offset, 5, 'Custom offset should be respected');

    // Test 3: Verify pagination limit bounds
    const tooLargeLimit = await fetch(base + '/api/v1/plugins?limit=101', { headers });
    assert.equal(tooLargeLimit.status, 400, 'Limit over 100 should be rejected');
    const tooLargeData = await tooLargeLimit.json();
    assert.equal(tooLargeData.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_PAGINATION_INVALID');

    const zeroLimit = await fetch(base + '/api/v1/plugins?limit=0', { headers });
    assert.equal(zeroLimit.status, 400, 'Limit of 0 should be rejected');

    const negativeOffset = await fetch(base + '/api/v1/plugins?offset=-1', { headers });
    assert.equal(negativeOffset.status, 400, 'Negative offset should be rejected');

    // Test 4: Register plugins up to the quota limit
    const validManifest = {
      apiVersion: 1,
      version: '1.0.0',
      title: 'Test Plugin',
      description: 'A test plugin',
      capabilities: ['render:widget']
    };

    // Register 100 plugins (the quota limit)
    const registeredPlugins = [];
    for (let i = 0; i < 100; i++) {
      const pluginName = `test-plugin-${i}-${randomUUID().slice(0, 8)}`;
      const manifest = { ...validManifest, name: pluginName };
      const imageDigest = `registry.example/plugin-${i}@sha256:${'a'.repeat(64)}`;

      const registerResponse = await fetch(base + '/api/v1/plugins/register', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          manifest,
          sourceType: 'oci-image',
          imageDigest
        })
      });

      assert.equal(registerResponse.status, 201, `Plugin ${i} should register successfully`);
      const registerData = await registerResponse.json();
      registeredPlugins.push(registerData.plugin);
    }

    // Test 5: Verify 101st plugin is rejected due to quota
    const quotaExceededManifest = {
      ...validManifest,
      name: `quota-exceeded-${randomUUID().slice(0, 8)}`
    };
    const quotaExceededDigest = `registry.example/quota-exceeded@sha256:${'b'.repeat(64)}`;

    const quotaExceededResponse = await fetch(base + '/api/v1/plugins/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        manifest: quotaExceededManifest,
        sourceType: 'oci-image',
        imageDigest: quotaExceededDigest
      })
    });

    assert.equal(quotaExceededResponse.status, 409, '101st plugin should be rejected');
    const quotaExceededData = await quotaExceededResponse.json();
    assert.equal(quotaExceededData.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_QUOTA_EXCEEDED');
    assert.ok(
      quotaExceededData.error.includes('100'),
      'Error message should mention the quota limit'
    );

    // Test 6: Verify re-registration of existing plugin doesn't count against quota
    const reregisterManifest = {
      ...validManifest,
      name: registeredPlugins[0].name,
      version: '2.0.0' // New version
    };
    const reregisterDigest = `registry.example/reregister@sha256:${'c'.repeat(64)}`;

    const reregisterResponse = await fetch(base + '/api/v1/plugins/register', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        manifest: reregisterManifest,
        sourceType: 'oci-image',
        imageDigest: reregisterDigest
      })
    });

    assert.equal(reregisterResponse.status, 201, 'Re-registration should succeed');
    const reregisterData = await reregisterResponse.json();
    assert.equal(reregisterData.plugin.version, '2.0.0', 'Version should be updated');

    // Test 7: Verify pagination works with many plugins
    const paginatedResponse = await fetch(base + '/api/v1/plugins?limit=25&offset=0', { headers });
    assert.equal(paginatedResponse.status, 200, 'Paginated list should succeed');
    const paginatedData = await paginatedResponse.json();
    assert.equal(paginatedData.plugins.length, 25, 'Should return exactly 25 plugins');
    assert.equal(paginatedData.hasMore, true, 'Should indicate more plugins available');

    const secondPageResponse = await fetch(base + '/api/v1/plugins?limit=25&offset=25', { headers });
    const secondPageData = await secondPageResponse.json();
    assert.equal(secondPageData.plugins.length, 25, 'Second page should also have 25 plugins');

    // Test 8: Verify last page handling
    const lastPageResponse = await fetch(base + '/api/v1/plugins?limit=50&offset=75', { headers });
    const lastPageData = await lastPageResponse.json();
    assert.equal(lastPageData.plugins.length, 25, 'Last page should have remaining 25 plugins');
    assert.equal(lastPageData.hasMore, false, 'Should indicate no more plugins');

    // Test 9: Verify offset beyond available plugins returns empty array
    const beyondResponse = await fetch(base + '/api/v1/plugins?limit=50&offset=200', { headers });
    const beyondData = await beyondResponse.json();
    assert.equal(beyondData.plugins.length, 0, 'Offset beyond available should return empty array');
    assert.equal(beyondData.hasMore, false, 'Should indicate no more plugins');
  }
);

if (enabled) test(
  'plugin registry quota is site-scoped',
  async t => {
    const { createPostgresPool } = require('../packages/db/src/postgres-store');
    const { createIdentityService, hashPassword } = require('../packages/auth/src/service');
    const { createApiServer } = require('../apps/api/src/server');

    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
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
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM plugin_installs WHERE site_id = ANY($1::uuid[])', [siteIds]).catch(() => {});
        await pool.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      if (roleId) await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
      await pool.end();
    });

    // Create two test sites
    const siteAResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['plugin-quota-a-' + randomUUID().slice(0, 8), 'Plugin Quota Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['plugin-quota-b-' + randomUUID().slice(0, 8), 'Plugin Quota Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    // Create admin role
    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      ['plugin-admin-' + randomUUID().slice(0, 10), 'Plugin Administrator', JSON.stringify(['*'])]
    );
    roleId = roleResult.rows[0].id;

    // Create test user
    const password = 'Plugin-Test-Password-2026';
    const passwordHash = await hashPassword(password);
    const userResult = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['plugin-admin-' + randomUUID() + '@example.test', 'Plugin Administrator', passwordHash]
    );
    const user = userResult.rows[0];
    userIds.push(user.id);

    // Assign user to both sites
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($4,$2,$3)',
      [siteA, user.id, roleId, siteB]
    );

    // Login
    const session = await identity.login({ email: user.email, password, ip: '127.0.0.1' });

    // Start API server
    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = 'http://127.0.0.1:' + server.address().port;
    const authHeader = { authorization: 'Bearer ' + session.token, 'content-type': 'application/json' };

    // Register 100 plugins on Site A
    for (let i = 0; i < 100; i++) {
      const manifest = {
        apiVersion: 1,
        name: `site-a-plugin-${i}-${randomUUID().slice(0, 8)}`,
        version: '1.0.0',
        title: 'Test Plugin',
        description: 'A test plugin',
        capabilities: ['render:widget']
      };
      const imageDigest = `registry.example/site-a-${i}@sha256:${'a'.repeat(64)}`;

      const response = await fetch(base + '/api/v1/plugins/register', {
        method: 'POST',
        headers: { ...authHeader, 'x-virgoscorpio-hub-site-id': siteA },
        body: JSON.stringify({ manifest, sourceType: 'oci-image', imageDigest })
      });

      assert.equal(response.status, 201, `Site A plugin ${i} should register`);
    }

    // Verify Site A is at quota
    const siteAExceeded = await fetch(base + '/api/v1/plugins/register', {
      method: 'POST',
      headers: { ...authHeader, 'x-virgoscorpio-hub-site-id': siteA },
      body: JSON.stringify({
        manifest: {
          apiVersion: 1,
          name: `site-a-exceeded-${randomUUID().slice(0, 8)}`,
          version: '1.0.0',
          title: 'Test',
          description: 'Test',
          capabilities: ['render:widget']
        },
        sourceType: 'oci-image',
        imageDigest: `registry.example/exceeded@sha256:${'b'.repeat(64)}`
      })
    });
    assert.equal(siteAExceeded.status, 409, 'Site A should be at quota');

    // Verify Site B can still register plugins (quota is site-scoped)
    const siteBPlugin = await fetch(base + '/api/v1/plugins/register', {
      method: 'POST',
      headers: { ...authHeader, 'x-virgoscorpio-hub-site-id': siteB },
      body: JSON.stringify({
        manifest: {
          apiVersion: 1,
          name: `site-b-plugin-${randomUUID().slice(0, 8)}`,
          version: '1.0.0',
          title: 'Test',
          description: 'Test',
          capabilities: ['render:widget']
        },
        sourceType: 'oci-image',
        imageDigest: `registry.example/site-b@sha256:${'c'.repeat(64)}`
      })
    });
    assert.equal(siteBPlugin.status, 201, 'Site B should be able to register plugins');

    // Verify Site A list doesn't include Site B plugins
    const siteAList = await fetch(base + '/api/v1/plugins', {
      headers: { ...authHeader, 'x-virgoscorpio-hub-site-id': siteA }
    });
    const siteAData = await siteAList.json();
    assert.ok(
      siteAData.plugins.every(p => p.name.startsWith('site-a-plugin-')),
      'Site A should only see its own plugins'
    );

    // Verify Site B list doesn't include Site A plugins
    const siteBList = await fetch(base + '/api/v1/plugins', {
      headers: { ...authHeader, 'x-virgoscorpio-hub-site-id': siteB }
    });
    const siteBData = await siteBList.json();
    assert.ok(
      siteBData.plugins.every(p => p.name.startsWith('site-b-plugin-')),
      'Site B should only see its own plugins'
    );
  }
);
