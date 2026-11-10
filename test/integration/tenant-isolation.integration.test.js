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

test(
  'tenant isolation: reject conflicting site selectors before cross-site community feed reads or writes',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const siteIds = [];
    const userIds = [];
    let roleId = null;
    let cloudRoleId = null;
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
    };
    // Ensure the development-token shortcut is not enabled in this API test.
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (server) {
        if (server.listening) {
          await new Promise(resolve => server.close(resolve));
        }
        await server.virgoScorpioHub.close().catch(() => {});
      }

      if (siteIds.length) {
        await pool.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      if (roleId) {
        await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
      }
      if (cloudRoleId) {
        await pool.query('DELETE FROM roles WHERE id = $1', [cloudRoleId]).catch(() => {});
      }
      await pool.end();
    });

    const siteAResult = await pool.query(
      'INSERT INTO sites(slug, name) VALUES($1, $2) RETURNING id',
      [`tenant-iso-a-${randomUUID().slice(0, 8)}`, 'Tenant Isolation Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug, name) VALUES($1, $2) RETURNING id',
      [`tenant-iso-b-${randomUUID().slice(0, 8)}`, 'Tenant Isolation Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const role = await pool.query(
      'INSERT INTO roles(slug, label, capabilities) VALUES($1, $2, $3::jsonb) RETURNING id',
      [`tenant-iso-${randomUUID().slice(0, 10)}`, 'Tenant Isolation Test Owner', JSON.stringify(['*'])]
    );
    roleId = role.rows[0].id;

    const password = 'Isolation-Password-2026';
    const actorResult = await pool.query(
      `INSERT INTO users(email, display_name, password_hash, status)
       VALUES($1, $2, $3, 'active') RETURNING id, email`,
      [`tenant-iso-actor-${randomUUID()}@example.test`, 'Tenant B Actor', await hashPassword(password)]
    );
    const actor = actorResult.rows[0];
    userIds.push(actor.id);

    const authorResult = await pool.query(
      `INSERT INTO users(email, display_name, status)
       VALUES($1, $2, 'active') RETURNING id`,
      [`tenant-iso-author-${randomUUID()}@example.test`, 'Tenant A Author']
    );
    const authorId = authorResult.rows[0].id;
    userIds.push(authorId);

    // The authenticated actor belongs only to site B. The fixture author belongs only to site A.
    await pool.query(
      'INSERT INTO site_memberships(site_id, user_id, role_id) VALUES($1, $2, $3), ($4, $5, $3)',
      [siteA, authorId, roleId, siteB, actor.id]
    );

    const privateMarker = `TENANT_A_PRIVATE_${randomUUID()}`;
    const writeMarker = `TENANT_A_WRITE_${randomUUID()}`;
    await pool.query(
      `INSERT INTO social_activities(site_id, actor_id, activity_type, body, visibility)
       VALUES($1, $2, 'status', $3, 'members')`,
      [siteA, authorId, privateMarker]
    );

    const session = await identity.login({ email: actor.email, password, ip: '127.0.0.1' });
    assert.equal(session.mfaRequired, false);

    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const authHeaders = { authorization: `Bearer ${session.token}` };

    const ordinaryForbidden = await fetch(`${base}/api/v1/sites/${siteA}/community/feed`, {
      headers: authHeaders,
    });
    assert.equal(ordinaryForbidden.status, 403, 'site A must reject an actor who belongs only to site B');
    const ordinaryForbiddenBody = await ordinaryForbidden.json();
    assert.equal(ordinaryForbiddenBody.code, 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN');
    assert.doesNotMatch(JSON.stringify(ordinaryForbiddenBody), new RegExp(privateMarker));

    // Duplicate selectors are rejected even when both values happen to agree.
    // This prevents callers and intermediaries from interpreting repeated query keys differently.
    const repeatedQuery = await fetch(
      `${base}/api/v1/sites/${siteB}/community/feed?siteId=${siteB}&siteId=${siteB}`,
      { headers: authHeaders }
    );
    assert.equal(repeatedQuery.status, 400);
    const repeatedQueryBody = await repeatedQuery.json();
    assert.equal(repeatedQueryBody.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    assert.doesNotMatch(JSON.stringify(repeatedQueryBody), new RegExp(privateMarker));

    // A malformed standalone selector must fail validation before any site lookup.
    const malformedQuery = await fetch(`${base}/api/v1/content-types?siteId=not-a-uuid`, {
      headers: authHeaders,
    });
    assert.equal(malformedQuery.status, 400);
    const malformedQueryBody = await malformedQuery.json();
    assert.equal(malformedQueryBody.code, 'ERR_VIRGOSCORPIO_HUB_INVALID_SITE_ID');
    assert.doesNotMatch(JSON.stringify(malformedQueryBody), new RegExp(privateMarker));

    const headerMismatch = await fetch(`${base}/api/v1/sites/${siteA}/community/feed`, {
      headers: { ...authHeaders, 'x-virgoscorpio-hub-site-id': siteB },
    });
    assert.equal(headerMismatch.status, 400, 'a site B header must not authorize a site A route');
    const headerMismatchBody = await headerMismatch.json();
    assert.equal(headerMismatchBody.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    assert.doesNotMatch(JSON.stringify(headerMismatchBody), new RegExp(privateMarker));

    const queryMismatch = await fetch(`${base}/api/v1/sites/${siteA}/community/feed?siteId=${siteB}`, {
      headers: authHeaders,
    });
    assert.equal(queryMismatch.status, 400, 'a site B query selector must not authorize a site A route');
    const queryMismatchBody = await queryMismatch.json();
    assert.equal(queryMismatchBody.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    assert.doesNotMatch(JSON.stringify(queryMismatchBody), new RegExp(privateMarker));

    const bodyMismatch = await fetch(`${base}/api/v1/sites/${siteA}/community/feed`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ siteId: siteB, body: writeMarker, visibility: 'members' }),
    });
    assert.equal(bodyMismatch.status, 400, 'a site B body selector must not authorize writes to a site A route');
    const bodyMismatchBody = await bodyMismatch.json();
    assert.equal(bodyMismatchBody.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    assert.doesNotMatch(JSON.stringify(bodyMismatchBody), new RegExp(privateMarker));

    const writeMismatch = await fetch(`${base}/api/v1/sites/${siteA}/community/feed`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json', 'x-virgoscorpio-hub-site-id': siteB },
      body: JSON.stringify({ body: writeMarker, visibility: 'members' }),
    });
    assert.equal(writeMismatch.status, 400, 'a site B header must not authorize writes to a site A route');
    const writeMismatchBody = await writeMismatch.json();
    assert.equal(writeMismatchBody.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    assert.doesNotMatch(JSON.stringify(writeMismatchBody), new RegExp(privateMarker));

    const malformedBodySelector = await fetch(`${base}/api/v1/sites/${siteA}/community/feed`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ siteId: 42, body: writeMarker, visibility: 'members' }),
    });
    assert.equal(malformedBodySelector.status, 400);
    const malformedBodySelectorBody = await malformedBodySelector.json();
    assert.equal(malformedBodySelectorBody.code, 'ERR_VIRGOSCORPIO_HUB_INVALID_SITE_ID');
    assert.doesNotMatch(JSON.stringify(malformedBodySelectorBody), new RegExp(privateMarker));

    const writtenAcrossSites = await pool.query(
      'SELECT id FROM social_activities WHERE site_id = $1 AND body = $2',
      [siteA, writeMarker]
    );
    assert.equal(writtenAcrossSites.rowCount, 0, 'the rejected request must not write activity into site A');

    const ownSite = await fetch(`${base}/api/v1/sites/${siteB}/community/feed`, {
      headers: authHeaders,
    });
    assert.equal(ownSite.status, 200, 'valid requests scoped to the actor\'s own site should still work');
    const ownSiteBody = await ownSite.json();
    assert.doesNotMatch(JSON.stringify(ownSiteBody), new RegExp(privateMarker));

    const matchingSelectors = await fetch(
      `${base}/api/v1/sites/${siteB}/community/feed?siteId=${siteB}`,
      { headers: { ...authHeaders, 'x-virgoscorpio-hub-site-id': siteB } }
    );
    assert.equal(matchingSelectors.status, 200, 'matching route, header, and query selectors should be accepted');
    const matchingSelectorsBody = await matchingSelectors.json();
    assert.doesNotMatch(JSON.stringify(matchingSelectorsBody), new RegExp(privateMarker));
    const relationshipHeaderMismatch = await fetch(base + '/api/v1/sites/' + siteB + '/relationships', {
      headers: { ...authHeaders, 'x-virgoscorpio-hub-site-id': siteA },
    });
    assert.equal(relationshipHeaderMismatch.status, 400, 'relationship routes must reject a conflicting site header');
    assert.equal(
      (await relationshipHeaderMismatch.json()).code,
      'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH'
    );

    const relationshipQueryMismatch = await fetch(
      base + '/api/v1/sites/' + siteB + '/relationships?siteId=' + siteA,
      { headers: authHeaders }
    );
    assert.equal(relationshipQueryMismatch.status, 400, 'relationship routes must reject a conflicting site query');
    assert.equal(
      (await relationshipQueryMismatch.json()).code,
      'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH'
    );

    const relationshipBodyMismatch = await fetch(base + '/api/v1/sites/' + siteB + '/relationships', {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        siteId: siteA,
        sourceId: randomUUID(),
        targetId: randomUUID(),
        kind: 'RELATED_TO',
      }),
    });
    assert.equal(relationshipBodyMismatch.status, 400, 'relationship writes must reject a conflicting body site');
    assert.equal(
      (await relationshipBodyMismatch.json()).code,
      'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH'
    );

    const relationshipDeleteMismatch = await fetch(
      base + '/api/v1/sites/' + siteB + '/relationships/' + randomUUID(),
      {
        method: 'DELETE',
        headers: { ...authHeaders, 'x-virgoscorpio-hub-site-id': siteA },
      }
    );
    assert.equal(relationshipDeleteMismatch.status, 400, 'relationship deletes must reject a conflicting site header');
    assert.equal(
      (await relationshipDeleteMismatch.json()).code,
      'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH'
    );
    const relationshipDuplicateQuery = await fetch(
      base + '/api/v1/sites/' + siteB + '/relationships?siteId=' + siteB + '&siteId=' + siteB,
      { headers: authHeaders }
    );
    assert.equal(relationshipDuplicateQuery.status, 400, 'relationship routes must reject repeated site selectors');
    assert.equal(
      (await relationshipDuplicateQuery.json()).code,
      'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH'
    );

    // Path-addressed site-configuration routes must reconcile selector context
    // before capability checks and tenant-scoped database operations.
    const configurationTables = ['site_design_systems','reusable_components','site_templates','navigation_menus','site_ai_policies'];
    async function configurationSnapshot() {
      const entries = await Promise.all(configurationTables.map(async table => {
        const result = await pool.query('SELECT site_id,count(*)::integer AS count FROM ' + table + ' WHERE site_id=ANY($1::uuid[]) GROUP BY site_id ORDER BY site_id', [[siteA, siteB]]);
        return [table, result.rows];
      }));
      return Object.fromEntries(entries);
    }
    const configurationBefore = await configurationSnapshot();
    const selectorMismatchScenarios = [
      { method: 'GET', path: '/api/v1/sites/' + siteB + '/design-system', headers: { 'x-virgoscorpio-hub-site-id': siteA } },
      { method: 'GET', path: '/api/v1/sites/' + siteB + '/design-system?siteId=' + siteA },
      { method: 'GET', path: '/api/v1/sites/' + siteB + '/reusable-components', headers: { 'x-virgoscorpio-hub-site-id': siteA } },
      { method: 'GET', path: '/api/v1/sites/' + siteB + '/templates?siteId=' + siteA },
      { method: 'GET', path: '/api/v1/sites/' + siteB + '/menus', headers: { 'x-virgoscorpio-hub-site-id': siteA } },
      { method: 'GET', path: '/api/v1/sites/' + siteB + '/ai-policy?siteId=' + siteA },
      { method: 'PUT', path: '/api/v1/sites/' + siteB + '/design-system', body: { siteId: siteA, tokens: {} } },
      { method: 'POST', path: '/api/v1/sites/' + siteB + '/reusable-components', body: { siteId: siteA } },
      { method: 'POST', path: '/api/v1/sites/' + siteB + '/templates', body: { siteId: siteA } },
      { method: 'POST', path: '/api/v1/sites/' + siteB + '/menus', body: { siteId: siteA } },
      { method: 'PUT', path: '/api/v1/sites/' + siteB + '/ai-policy', body: { siteId: siteA } },
      { method: 'DELETE', path: '/api/v1/sites/' + siteB + '/reusable-components/' + randomUUID(), headers: { 'x-virgoscorpio-hub-site-id': siteA } },
      { method: 'DELETE', path: '/api/v1/sites/' + siteB + '/templates/' + randomUUID(), headers: { 'x-virgoscorpio-hub-site-id': siteA } },
      { method: 'DELETE', path: '/api/v1/sites/' + siteB + '/menus/selector-probe', headers: { 'x-virgoscorpio-hub-site-id': siteA } },
    ];
    for (const scenario of selectorMismatchScenarios) {
      const response = await fetch(base + scenario.path, {
        method: scenario.method,
        headers: { ...authHeaders, ...(scenario.headers || {}), ...(scenario.body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(scenario.body === undefined ? {} : { body: JSON.stringify(scenario.body) }),
      });
      const payload = await response.json();
      assert.equal(response.status, 400, scenario.method + ' ' + scenario.path + ' must reject conflicting site selectors');
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    }
    assert.deepEqual(await configurationSnapshot(), configurationBefore, 'selector mismatches must not create or mutate tenant configuration records');

    await t.test('cloud connection IDs and selector conflicts remain tenant-scoped for a least-privilege cloud manager', async () => {
      const cloudRoleResult = await pool.query(
        'INSERT INTO roles(slug, label, capabilities) VALUES($1, $2, $3::jsonb) RETURNING id',
        [`tenant-cloud-${randomUUID().slice(0, 10)}`, 'Tenant Cloud Manager', JSON.stringify(['cloud:manage'])]
      );
      cloudRoleId = cloudRoleResult.rows[0].id;

      const cloudActorResult = await pool.query(
        `INSERT INTO users(email, display_name, password_hash, status)
         VALUES($1, $2, $3, 'active') RETURNING id, email`,
        [`tenant-cloud-actor-${randomUUID()}@example.test`, 'Site B Cloud Manager', await hashPassword(password)]
      );
      const cloudActor = cloudActorResult.rows[0];
      userIds.push(cloudActor.id);
      await pool.query(
        'INSERT INTO site_memberships(site_id, user_id, role_id) VALUES($1, $2, $3)',
        [siteB, cloudActor.id, cloudRoleId]
      );

      const cloudSession = await identity.login({
        email: cloudActor.email,
        password,
        ip: '127.0.0.1',
        userAgent: 'tenant-cloud-connection-isolation-test',
      });
      assert.equal(cloudSession.mfaRequired, false);

      const seedConnection = async ({ siteId, name, status, lastHealthCheckAt }) => {
        const result = await pool.query(
          `INSERT INTO cloud_connections(
             site_id, provider, name, config, credential_reference, status,
             last_health_check_at, created_at, updated_at
           )
           VALUES($1, 's3-compatible', $2, $3::jsonb, $4, $5, $6, $7, $7)
           RETURNING id`,
          [
            siteId,
            name,
            JSON.stringify({ bucket: name.toLowerCase().replace(/[^a-z0-9-]/g, '-') }),
            `vault://unresolved-test-reference/${siteId}`,
            status,
            lastHealthCheckAt,
            new Date('2026-11-09T12:30:00.000Z'),
          ]
        );
        return result.rows[0].id;
      };

      // Deliberately unresolved references ensure this regression test never
      // contacts an external provider, even for the positive Site B control.
      const siteAConnectionId = await seedConnection({
        siteId: siteA,
        name: 'Site A Private Cloud Connection',
        status: 'healthy',
        lastHealthCheckAt: new Date('2026-11-09T12:00:00.000Z'),
      });
      const siteBConnectionId = await seedConnection({
        siteId: siteB,
        name: 'Site B Own Cloud Connection',
        status: 'configured',
        lastHealthCheckAt: null,
      });

      const cloudHeaders = { authorization: `Bearer ${cloudSession.token}` };
      const snapshot = async (siteId, connectionId) => {
        const result = await pool.query(
          `SELECT id, site_id, provider, name, config, credential_reference,
                  status, last_health_check_at, created_at, updated_at
             FROM cloud_connections
            WHERE site_id = $1 AND id = $2`,
          [siteId, connectionId]
        );
        return result.rows[0] || null;
      };
      const siteABefore = await snapshot(siteA, siteAConnectionId);
      const siteBBefore = await snapshot(siteB, siteBConnectionId);
      assert.ok(siteABefore, 'Site A connection must exist before adversarial requests');
      assert.ok(siteBBefore, 'Site B positive-control connection must exist');

      const listing = await fetch(`${base}/api/v1/sites/${siteB}/cloud/connections`, {
        headers: cloudHeaders,
      });
      assert.equal(listing.status, 200);
      const listedConnections = (await listing.json()).connections;
      assert.deepEqual(listedConnections.map(connection => connection.id), [siteBConnectionId]);
      assert.equal(JSON.stringify(listedConnections).includes(siteABefore.name), false);
      assert.equal(JSON.stringify(listedConnections).includes(siteABefore.credential_reference), false);

      for (const action of ['test', 'disable']) {
        const response = await fetch(
          `${base}/api/v1/sites/${siteB}/cloud/connections/${siteAConnectionId}/${action}`,
          { method: 'POST', headers: cloudHeaders, body: '{}' }
        );
        const payload = await response.json();
        assert.equal(response.status, 404, `Site B must not ${action} a Site A connection ID`);
        assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CLOUD_CONNECTION_NOT_FOUND');
        assert.doesNotMatch(JSON.stringify(payload), /Site A Private Cloud Connection|vault:\/\//);
        assert.deepEqual(await snapshot(siteA, siteAConnectionId), siteABefore);
      }

      const selectorCases = [
        {
          name: 'header selector',
          url: `${base}/api/v1/sites/${siteB}/cloud/connections/${siteBConnectionId}/test`,
          headers: { 'x-virgoscorpio-hub-site-id': siteA },
          body: {},
        },
        {
          name: 'query selector',
          url: `${base}/api/v1/sites/${siteB}/cloud/connections/${siteBConnectionId}/test?siteId=${siteA}`,
          headers: {},
          body: {},
        },
        {
          name: 'body selector',
          url: `${base}/api/v1/sites/${siteB}/cloud/connections/${siteBConnectionId}/test`,
          headers: {},
          body: { siteId: siteA },
        },
        {
          name: 'duplicate query selectors',
          url: `${base}/api/v1/sites/${siteB}/cloud/connections/${siteBConnectionId}/test?siteId=${siteB}&siteId=${siteB}`,
          headers: {},
          body: {},
        },
      ];

      for (const scenario of selectorCases) {
        const response = await fetch(scenario.url, {
          method: 'POST',
          headers: {
            ...cloudHeaders,
            ...scenario.headers,
            'content-type': 'application/json',
          },
          body: JSON.stringify(scenario.body),
        });
        const payload = await response.json();
        assert.equal(response.status, 400, `${scenario.name} must be rejected before connection actions`);
        assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
        assert.deepEqual(await snapshot(siteA, siteAConnectionId), siteABefore);
        assert.deepEqual(await snapshot(siteB, siteBConnectionId), siteBBefore);
      }

      const ownTest = await fetch(
        `${base}/api/v1/sites/${siteB}/cloud/connections/${siteBConnectionId}/test`,
        { method: 'POST', headers: cloudHeaders, body: '{}' }
      );
      assert.equal(ownTest.status, 200, 'Site B can test its own connection');
      const ownTestPayload = await ownTest.json();
      assert.equal(ownTestPayload.test.credentialReferenceConfigured, false);
      assert.equal(ownTestPayload.test.credentialReferenceMode, 'unsupported');
      assert.equal(ownTestPayload.test.liveProbeAttempted, false);
      assert.equal(ownTestPayload.test.liveObjectStoreOperationPerformed, false);

      const siteBAfterTest = await snapshot(siteB, siteBConnectionId);
      assert.equal(siteBAfterTest.status, 'unhealthy');
      assert.ok(siteBAfterTest.last_health_check_at, 'a legitimate own-site test updates its health timestamp');

      const ownDisable = await fetch(
        `${base}/api/v1/sites/${siteB}/cloud/connections/${siteBConnectionId}/disable`,
        { method: 'POST', headers: cloudHeaders, body: '{}' }
      );
      assert.equal(ownDisable.status, 200, 'Site B can disable its own connection');
      assert.equal((await ownDisable.json()).connection.status, 'disabled');
      assert.equal((await snapshot(siteB, siteBConnectionId)).status, 'disabled');
      assert.deepEqual(await snapshot(siteA, siteAConnectionId), siteABefore);
    });
  }
);
