'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool, createPostgresStore } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');
const { waitForDatabaseWriteLock } = require('../helpers/postgres-locks');

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
    let aiPolicyRoleId = null;
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
      AI_ALLOWED_PROVIDERS: 'mock',
      AI_ALLOW_EXTERNAL_CONTENT: 'false',
      // This fixture intentionally exercises many tenant/audit routes through
      // one test server; keep its in-memory limiter above the scenario volume.
      RATE_LIMIT_MAX_REQUESTS: '500',
    };
    // Ensure the development-token shortcut is not enabled in this API test.
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });
    let authorizeSiteInterceptor = null;
    // Intercept only request-time site capability checks so the real HTTP handler
    // can be paused after authorization while a concurrent role revocation commits.
    const apiIdentity = {
      ...identity,
      authorizeSite: async (...args) => {
        const allowed = await identity.authorizeSite(...args);
        if (authorizeSiteInterceptor) await authorizeSiteInterceptor(args, allowed);
        return allowed;
      },
    };

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
      if (aiPolicyRoleId) {
        await pool.query('DELETE FROM roles WHERE id = $1', [aiPolicyRoleId]).catch(() => {});
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

    server = createApiServer({ env, pool, identityService: apiIdentity, logger: { error() {} } });
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
        // A route-level regression must fail promptly rather than consume the
        // full per-file integration timeout while the HTTP response is pending.
        signal: AbortSignal.timeout(15_000),
      }).catch(error => {
        throw new Error('Active cloud-connection listing did not complete within 15 seconds: ' + error.message);
      });
      assert.equal(listing.status, 200);
      const listedConnections = (await listing.json()).connections;
      assert.deepEqual(listedConnections.map(connection => connection.id), [siteBConnectionId]);
      assert.equal(JSON.stringify(listedConnections).includes(siteABefore.name), false);
      assert.equal(JSON.stringify(listedConnections).includes(siteABefore.credential_reference), false);

      await t.test('cloud connection listing revalidates cloud:manage before disclosing provider configuration and credential references', async () => {
        const originalCapabilitiesResult = await pool.query('SELECT capabilities FROM roles WHERE id=$1', [cloudRoleId]);
        const originalCapabilities = originalCapabilitiesResult.rows[0].capabilities;
        assert.ok(originalCapabilities.includes('cloud:manage'), 'the Site B cloud-manager role starts authorized');

        const revocationClient = await pool.connect();
        let revocationOpen = false;
        let connectionsPromise;
        let connectionsOutcome;
        let preflightCompleted;
        let resumePreflight;
        let preflightIntercepted = false;
        const preflight = new Promise(resolve => { preflightCompleted = resolve; });
        const preflightBarrier = new Promise(resolve => { resumePreflight = resolve; });
        authorizeSiteInterceptor = async (args, allowed) => {
          if (!preflightIntercepted && allowed && args[0] === cloudActor.id && args[1] === siteB && args[2] === 'cloud:manage') {
            preflightIntercepted = true;
            preflightCompleted();
            await preflightBarrier;
          }
        };

        try {
          await revocationClient.query('BEGIN');
          revocationOpen = true;
          // Preserve the established transaction-time authorization lock order.
          await revocationClient.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [siteB]);
          await revocationClient.query('SELECT id FROM roles WHERE id=$1 FOR UPDATE', [cloudRoleId]);
          await revocationClient.query("UPDATE roles SET capabilities=capabilities-'cloud:manage' WHERE id=$1", [cloudRoleId]);

          connectionsPromise = fetch(`${base}/api/v1/sites/${siteB}/cloud/connections`, {
            headers: cloudHeaders,
            signal: AbortSignal.timeout(15_000),
          }).then(async response => ({ status: response.status, payload: await response.json() }))
            .catch(error => {
              throw new Error('Revocation-race cloud-connection listing did not complete within 15 seconds: ' + error.message);
            });
          const preflightObserved = await Promise.race([
            preflight.then(() => true),
            new Promise(resolve => setTimeout(() => resolve(false), 5000)),
          ]);
          assert.equal(preflightObserved, true, 'cloud connection-list request must pass request-time cloud:manage authorization before revocation');

          // Resume the real HTTP handler while revocation still holds the Site B and role row locks.
          resumePreflight();
          const earlyOutcome = await Promise.race([
            connectionsPromise,
            new Promise(resolve => setTimeout(() => resolve(null), 100)),
          ]);
          const lockObserved = earlyOutcome
            ? false
            : await waitForDatabaseWriteLock(revocationClient, 'FOR KEY SHARE', 5000, { relationName: 'sites' });

          await revocationClient.query('COMMIT');
          revocationOpen = false;
          connectionsOutcome = earlyOutcome || await connectionsPromise;

          assert.equal(earlyOutcome, null, 'cloud configuration and credential references must not be returned before capability revocation commits');
          assert.equal(lockObserved, true, 'cloud connection listing must serialize against site-scoped cloud:manage revocation');
          assert.equal(connectionsOutcome.status, 403, 'a revoked cloud manager must not list retained cloud connections');
          assert.equal(connectionsOutcome.payload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
          assert.equal(Object.hasOwn(connectionsOutcome.payload, 'connections'), false, 'the denied response must not include a connection collection');
          const deniedPayload = JSON.stringify(connectionsOutcome.payload);
          for (const marker of [siteBConnectionId, siteBBefore.name, siteBBefore.credential_reference, siteBBefore.config.bucket]) {
            assert.equal(deniedPayload.includes(String(marker)), false, 'the denied response must not disclose cloud-connection marker: ' + marker);
          }

          const revokedCapabilities = await pool.query('SELECT capabilities FROM roles WHERE id=$1', [cloudRoleId]);
          assert.equal(revokedCapabilities.rows[0].capabilities.includes('cloud:manage'), false, 'cloud:manage remains revoked until cleanup');
          assert.deepEqual(await snapshot(siteA, siteAConnectionId), siteABefore, 'Site A cloud connection must remain unchanged');
          assert.deepEqual(await snapshot(siteB, siteBConnectionId), siteBBefore, 'Site B cloud connection must remain unchanged');
        } finally {
          resumePreflight();
          authorizeSiteInterceptor = null;
          if (revocationOpen) await revocationClient.query('ROLLBACK').catch(() => {});
          if (connectionsPromise && !connectionsOutcome) connectionsOutcome = await connectionsPromise.catch(() => null);
          revocationClient.release();
          await pool.query('UPDATE roles SET capabilities=$2::jsonb WHERE id=$1', [cloudRoleId, JSON.stringify(originalCapabilities)]).catch(() => {});
        }
      });

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

      const cloudAuditRequestIds = {
        createFailure: randomUUID(),
        createRetry: randomUUID(),
        disableFailure: randomUUID(),
        disableRetry: randomUUID(),
        testFailure: randomUUID(),
        testRetry: randomUUID(),
      };
      const cloudAuditBody = {
        provider: 's3-compatible',
        name: 'F1.42 Audit Connection ' + randomUUID(),
        credentialReference: 'env://VSH_F1_42_TEST_MISSING_SECRET',
        config: { bucket: 'f1-42-audit-test-bucket' },
      };
      const cloudAuditRequest = (route, requestId, body = {}) => fetch(base + route, {
        method: 'POST',
        headers: { ...cloudHeaders, 'content-type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify(body),
      });
      const cloudAuditRows = (action, requestId) => pool.query(
        'SELECT site_id,actor_id,action,target_type,target_id,result,request_id,details FROM audit_events WHERE site_id=$1 AND action=$2 AND request_id=$3',
        [siteB, action, requestId],
      );
      const withCloudAuditFailure = async (action, work) => {
        const suffix = randomUUID().replace(/-/g, '');
        const functionName = 'f142_cloud_audit_fn_' + suffix;
        const triggerName = 'f142_cloud_audit_tr_' + suffix;
        const escapedAction = action.replace(/'/g, "''");
        const functionSql = [
          'CREATE FUNCTION "' + functionName + '"() RETURNS trigger LANGUAGE plpgsql AS $audit$',
          'BEGIN',
          "  IF NEW.action = '" + escapedAction + "' AND NEW.site_id = '" + siteB + "'::uuid THEN",
          "    RAISE EXCEPTION 'F1.42 injected cloud audit failure' USING ERRCODE = 'P0001';",
          '  END IF;',
          '  RETURN NEW;',
          'END;',
          '$audit$',
        ].join('\n');
        await pool.query(functionSql);
        await pool.query(
          'CREATE TRIGGER "' + triggerName + '" BEFORE INSERT ON audit_events ' +
          'FOR EACH ROW EXECUTE FUNCTION "' + functionName + '"()',
        );
        try {
          return await work();
        } finally {
          await pool.query('DROP TRIGGER IF EXISTS "' + triggerName + '" ON audit_events').catch(() => {});
          await pool.query('DROP FUNCTION IF EXISTS "' + functionName + '"()').catch(() => {});
        }
      };

      // Create: an audit insert failure must roll back the new connection.
      const createFailure = await withCloudAuditFailure('cloud.connection_created', () =>
        cloudAuditRequest(
          '/api/v1/sites/' + siteB + '/cloud/connections',
          cloudAuditRequestIds.createFailure,
          cloudAuditBody,
        ),
      );
      assert.equal(createFailure.status, 500);
      await createFailure.json();
      const failedCreate = await pool.query(
        'SELECT id FROM cloud_connections WHERE site_id=$1 AND name=$2',
        [siteB, cloudAuditBody.name],
      );
      assert.equal(failedCreate.rowCount, 0, 'failed create must roll back the cloud connection insert');
      assert.equal((await cloudAuditRows('cloud.connection_created', cloudAuditRequestIds.createFailure)).rowCount, 0);

      const createRetry = await cloudAuditRequest(
        '/api/v1/sites/' + siteB + '/cloud/connections',
        cloudAuditRequestIds.createRetry,
        cloudAuditBody,
      );
      assert.equal(createRetry.status, 201);
      const createdCloudConnection = (await createRetry.json()).connection;
      assert.ok(createdCloudConnection.id);
      const createAudit = await cloudAuditRows('cloud.connection_created', cloudAuditRequestIds.createRetry);
      assert.equal(createAudit.rowCount, 1);
      assert.equal(createAudit.rows[0].actor_id, cloudActor.id);
      assert.equal(createAudit.rows[0].target_type, 'cloud-connection');
      assert.equal(createAudit.rows[0].target_id, createdCloudConnection.id);
      assert.equal(createAudit.rows[0].request_id, cloudAuditRequestIds.createRetry);
      assert.deepEqual(createAudit.rows[0].details, { provider: 's3-compatible', status: 'configured' });
      assert.doesNotMatch(JSON.stringify(createAudit.rows[0].details), /f1-42-audit-test-bucket|VSH_F1_42/);

      // Disable: status and updated_at must roll back with an audit failure.
      const disableConnectionId = await seedConnection({
        siteId: siteB,
        name: 'F1.42 Disable Audit Connection',
        status: 'configured',
        lastHealthCheckAt: null,
      });
      const disableBefore = await snapshot(siteB, disableConnectionId);
      const disableFailure = await withCloudAuditFailure('cloud.connection_disabled', () =>
        cloudAuditRequest(
          '/api/v1/sites/' + siteB + '/cloud/connections/' + disableConnectionId + '/disable',
          cloudAuditRequestIds.disableFailure,
        ),
      );
      assert.equal(disableFailure.status, 500);
      await disableFailure.json();
      assert.deepEqual(await snapshot(siteB, disableConnectionId), disableBefore);
      assert.equal((await cloudAuditRows('cloud.connection_disabled', cloudAuditRequestIds.disableFailure)).rowCount, 0);

      const disableRetry = await cloudAuditRequest(
        '/api/v1/sites/' + siteB + '/cloud/connections/' + disableConnectionId + '/disable',
        cloudAuditRequestIds.disableRetry,
      );
      assert.equal(disableRetry.status, 200);
      assert.equal((await disableRetry.json()).connection.status, 'disabled');
      const disableAudit = await cloudAuditRows('cloud.connection_disabled', cloudAuditRequestIds.disableRetry);
      assert.equal(disableAudit.rowCount, 1);
      assert.equal(disableAudit.rows[0].actor_id, cloudActor.id);
      assert.equal(disableAudit.rows[0].target_id, disableConnectionId);
      assert.equal(disableAudit.rows[0].request_id, cloudAuditRequestIds.disableRetry);
      assert.deepEqual(disableAudit.rows[0].details, { provider: 's3-compatible', status: 'disabled' });

      // Health check: unresolved references stay provider-free; only the local
      // outcome/timestamp and audit share the rollback/retry transaction.
      const testConnectionId = await seedConnection({
        siteId: siteB,
        name: 'F1.42 Health Audit Connection',
        status: 'configured',
        lastHealthCheckAt: null,
      });
      const testBefore = await snapshot(siteB, testConnectionId);
      const testFailure = await withCloudAuditFailure('cloud.connection_tested', () =>
        cloudAuditRequest(
          '/api/v1/sites/' + siteB + '/cloud/connections/' + testConnectionId + '/test',
          cloudAuditRequestIds.testFailure,
        ),
      );
      assert.equal(testFailure.status, 500);
      await testFailure.json();
      assert.deepEqual(await snapshot(siteB, testConnectionId), testBefore);
      assert.equal((await cloudAuditRows('cloud.connection_tested', cloudAuditRequestIds.testFailure)).rowCount, 0);

      const testRetry = await cloudAuditRequest(
        '/api/v1/sites/' + siteB + '/cloud/connections/' + testConnectionId + '/test',
        cloudAuditRequestIds.testRetry,
      );
      assert.equal(testRetry.status, 200);
      const testRetryPayload = await testRetry.json();
      assert.equal(testRetryPayload.test.status, 'unhealthy');
      assert.equal(testRetryPayload.test.liveProbeAttempted, false);
      assert.equal(testRetryPayload.test.liveObjectStoreOperationPerformed, false);
      const testAfter = await snapshot(siteB, testConnectionId);
      assert.equal(testAfter.status, 'unhealthy');
      assert.ok(testAfter.last_health_check_at);
      const testAudit = await cloudAuditRows('cloud.connection_tested', cloudAuditRequestIds.testRetry);
      assert.equal(testAudit.rowCount, 1);
      assert.equal(testAudit.rows[0].actor_id, cloudActor.id);
      assert.equal(testAudit.rows[0].target_id, testConnectionId);
      assert.equal(testAudit.rows[0].request_id, cloudAuditRequestIds.testRetry);
      assert.deepEqual(testAudit.rows[0].details, {
        provider: 's3-compatible',
        probeStatus: 'unhealthy',
        connectionStatus: 'unhealthy',
        credentialReferenceMode: 'unsupported',
        liveProbeAttempted: false,
        liveObjectStoreOperationPerformed: false,
      });

      await pool.query(
        'DELETE FROM audit_events WHERE site_id=$1 AND request_id=ANY($2::text[])',
        [siteB, Object.values(cloudAuditRequestIds)],
      );

    });

    await t.test('site AI policy update and correlated audit commit or roll back together', async () => {
      const suffix = randomUUID().replace(/-/g, '');
      const requestIds = Object.fromEntries(
        ['siteMismatch', 'forbidden', 'invalid', 'providerBlocked', 'externalBlocked', 'auditFailure', 'retry']
          .map(kind => [kind, 'ai-policy-' + kind + '-' + suffix.slice(0, 16)]),
      );
      const policyBody = {
        enabled: false,
        allowExternalContent: false,
        allowedProviders: ['mock'],
        maxDataClassification: 'confidential',
        dailyRequestLimit: 250,
        dailyInputCharsLimit: 500000,
        requireHumanReview: true,
      };
      const seedPolicy = async ({ siteId, enabled, classification, dailyRequests, dailyChars, updatedBy }) => {
        await pool.query(
          `INSERT INTO site_ai_policies(
             site_id,enabled,allow_external_content,allowed_providers,
             max_data_classification,daily_request_limit,daily_input_chars_limit,
             require_human_review,updated_by
           ) VALUES($1,$2,false,'["mock"]'::jsonb,$3,$4,$5,true,$6)`,
          [siteId, enabled, classification, dailyRequests, dailyChars, updatedBy],
        );
      };
      const policySnapshot = async siteId => {
        const result = await pool.query(
          `SELECT site_id,enabled,allow_external_content,allowed_providers,
                  max_data_classification,daily_request_limit,daily_input_chars_limit,
                  require_human_review,updated_by,updated_at
             FROM site_ai_policies
            WHERE site_id=$1`,
          [siteId],
        );
        return result.rows[0] || null;
      };
      const auditFor = async requestId => pool.query(
        `SELECT site_id,actor_id,action,target_type,target_id,result,request_id,details
           FROM audit_events
          WHERE site_id=$1 AND action='ai.policy_updated' AND request_id=$2`,
        [siteB, requestId],
      );
      const putPolicy = (requestId, body, headers = authHeaders) => fetch(
        base + '/api/v1/sites/' + siteB + '/ai-policy',
        {
          method: 'PUT',
          headers: { ...headers, 'content-type': 'application/json', 'x-request-id': requestId },
          body: JSON.stringify(body),
        },
      );

      await seedPolicy({
        siteId: siteA,
        enabled: true,
        classification: 'public',
        dailyRequests: 40,
        dailyChars: 6000,
        updatedBy: authorId,
      });
      await seedPolicy({
        siteId: siteB,
        enabled: true,
        classification: 'internal',
        dailyRequests: 20,
        dailyChars: 3000,
        updatedBy: actor.id,
      });
      const siteAControl = await policySnapshot(siteA);
      const siteBBaseline = await policySnapshot(siteB);
      assert.ok(siteAControl);
      assert.ok(siteBBaseline);

      const limitedRole = await pool.query(
        'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
        ['tenant-ai-policy-read-' + suffix.slice(0, 10), 'Tenant AI Policy Read Only', JSON.stringify(['content:read'])],
      );
      aiPolicyRoleId = limitedRole.rows[0].id;
      const limitedActorResult = await pool.query(
        `INSERT INTO users(email,display_name,password_hash,status)
         VALUES($1,$2,$3,'active') RETURNING id,email`,
        ['tenant-ai-policy-read-' + suffix + '@example.test', 'Tenant AI Policy Read Only', await hashPassword(password)],
      );
      const limitedActor = limitedActorResult.rows[0];
      userIds.push(limitedActor.id);
      await pool.query(
        'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
        [siteB, limitedActor.id, aiPolicyRoleId],
      );
      const limitedSession = await identity.login({
        email: limitedActor.email,
        password,
        ip: '127.0.0.1',
        userAgent: 'tenant-ai-policy-read-only-test',
      });
      assert.equal(limitedSession.mfaRequired, false);

      try {
        const siteMismatch = await putPolicy(requestIds.siteMismatch, { ...policyBody, siteId: siteA });
        assert.equal(siteMismatch.status, 400);
        assert.equal((await siteMismatch.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');

        const forbidden = await putPolicy(requestIds.forbidden, policyBody, {
          authorization: 'Bearer ' + limitedSession.token,
        });
        assert.equal(forbidden.status, 403, 'a site member without site:manage cannot update AI governance');

        const invalid = await putPolicy(requestIds.invalid, { ...policyBody, dailyRequestLimit: 0 });
        assert.equal(invalid.status, 400);
        assert.equal((await invalid.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_POLICY_INVALID');

        const providerBlocked = await putPolicy(requestIds.providerBlocked, {
          ...policyBody,
          allowedProviders: ['openai-responses'],
        });
        assert.equal(providerBlocked.status, 409);
        assert.equal((await providerBlocked.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_PROVIDER_GLOBAL_POLICY');

        const externalBlocked = await putPolicy(requestIds.externalBlocked, {
          ...policyBody,
          allowExternalContent: true,
        });
        assert.equal(externalBlocked.status, 409);
        assert.equal((await externalBlocked.json()).code, 'ERR_VIRGOSCORPIO_HUB_AI_EXTERNAL_APPROVAL_REQUIRED');

        assert.deepEqual(await policySnapshot(siteB), siteBBaseline, 'rejected policy updates must preserve the Site B policy');
        assert.deepEqual(await policySnapshot(siteA), siteAControl, 'rejected Site B policy updates must preserve the Site A control');
        const rejectedAudit = await pool.query(
          "SELECT request_id FROM audit_events WHERE site_id=$1 AND action='ai.policy_updated' AND request_id=ANY($2::text[])",
          [siteB, [requestIds.siteMismatch, requestIds.forbidden, requestIds.invalid, requestIds.providerBlocked, requestIds.externalBlocked]],
        );
        assert.equal(rejectedAudit.rowCount, 0, 'rejected policy updates must not create audit events');

        const functionName = 'test_ai_policy_audit_fn_' + suffix;
        const triggerName = 'test_ai_policy_audit_tr_' + suffix;
        try {
          await pool.query(
            `CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $audit$
             BEGIN
               IF NEW.action = 'ai.policy_updated' AND NEW.site_id = '${siteB}'::uuid THEN
                 RAISE EXCEPTION 'simulated AI policy audit persistence failure';
               END IF;
               RETURN NEW;
             END;
             $audit$`,
          );
          await pool.query(
            `CREATE TRIGGER "${triggerName}" BEFORE INSERT ON audit_events
             FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
          );

          const failed = await putPolicy(requestIds.auditFailure, policyBody);
          assert.equal(failed.status, 500);
          await failed.json();
          assert.deepEqual(
            await policySnapshot(siteB),
            siteBBaseline,
            'failed ai.policy_updated persistence must roll back the Site B policy upsert',
          );
          assert.deepEqual(
            await policySnapshot(siteA),
            siteAControl,
            'Site A policy must remain unchanged during Site B audit failure injection',
          );
          assert.equal((await auditFor(requestIds.auditFailure)).rowCount, 0);
        } finally {
          await pool.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON audit_events`).catch(() => {});
          await pool.query(`DROP FUNCTION IF EXISTS "${functionName}"()`).catch(() => {});
        }

        const retried = await putPolicy(requestIds.retry, policyBody);
        assert.equal(retried.status, 200);
        const responsePolicy = (await retried.json()).policy;
        assert.equal(responsePolicy.site_id, siteB);
        assert.equal(responsePolicy.enabled, false);
        assert.equal(responsePolicy.allow_external_content, false);
        assert.deepEqual(responsePolicy.allowed_providers, ['mock']);
        assert.equal(responsePolicy.max_data_classification, 'confidential');
        assert.equal(responsePolicy.daily_request_limit, 250);
        assert.equal(responsePolicy.daily_input_chars_limit, 500000);
        assert.equal(responsePolicy.require_human_review, true);
        assert.equal(responsePolicy.updated_by, actor.id);

        const retryAudit = await auditFor(requestIds.retry);
        assert.equal(retryAudit.rowCount, 1);
        assert.equal(retryAudit.rows[0].site_id, siteB);
        assert.equal(retryAudit.rows[0].actor_id, actor.id);
        assert.equal(retryAudit.rows[0].action, 'ai.policy_updated');
        assert.equal(retryAudit.rows[0].target_type, 'ai-policy');
        assert.equal(retryAudit.rows[0].target_id, null);
        assert.equal(retryAudit.rows[0].request_id, requestIds.retry);
        assert.deepEqual(retryAudit.rows[0].details, {
          enabled: false,
          allowedProviders: ['mock'],
          maxDataClassification: 'confidential',
        });

        assert.deepEqual(await policySnapshot(siteA), siteAControl, 'successful Site B policy update must not mutate Site A');
      } finally {
        await pool.query(
          "DELETE FROM audit_events WHERE site_id=ANY($1::uuid[]) AND request_id=ANY($2::text[])",
          [[siteA, siteB], Object.values(requestIds)],
        );
      }
    });

    await t.test('editorial workflow transition and correlated audit commit or roll back together', async t => {
      const store = createPostgresStore({ pool });
      const suffix = randomUUID().replace(/-/g, '');
      const siteAContent = await store.saveDraft({
        siteId: siteA,
        title: 'Site A editorial control',
        slug: 'site-a-editorial-' + suffix.slice(0, 12),
        locale: 'en',
        contentType: 'page',
        authorId,
        document: { schemaVersion: 1, documentId: randomUUID(), type: 'page', title: 'Site A editorial control', children: [{ id: 'site-a-heading', type: 'widget.heading', props: { text: 'Site A control' }, children: [] }] },
        note: 'F1.34 cross-site control fixture',
      });
      const siteBContent = await store.saveDraft({
        siteId: siteB,
        title: 'Site B editorial candidate',
        slug: 'site-b-editorial-' + suffix.slice(0, 12),
        locale: 'en',
        contentType: 'page',
        authorId: actor.id,
        document: { schemaVersion: 1, documentId: randomUUID(), type: 'page', title: 'Site B editorial candidate', children: [{ id: 'site-b-heading', type: 'widget.heading', props: { text: 'Site B candidate' }, children: [] }] },
        note: 'F1.34 transactional audit fixture',
      });
      const failureRequestId = 'content-workflow-failure-' + suffix.slice(0, 12);
      const retryRequestId = 'content-workflow-retry-' + suffix.slice(0, 12);
      t.after(async () => {
        await pool.query(
          "DELETE FROM audit_events WHERE site_id=ANY($1::uuid[]) AND request_id=ANY($2::text[])",
          [[siteA, siteB], [failureRequestId, retryRequestId]],
        );
        await pool.query(
          "DELETE FROM outbox_events WHERE aggregate_type='content' AND aggregate_id=ANY($1::uuid[])",
          [[siteAContent.id, siteBContent.id]],
        );
      });
      const contentSnapshot = async (siteId, contentId) => {
        const [content, workflow, outbox] = await Promise.all([
          pool.query('SELECT id,site_id,status,version,lock_version FROM content_items WHERE site_id=$1 AND id=$2', [siteId, contentId]),
          pool.query('SELECT count(*)::integer AS count FROM workflow_events WHERE site_id=$1 AND content_id=$2', [siteId, contentId]),
          pool.query("SELECT count(*)::integer AS count FROM outbox_events WHERE site_id=$1 AND aggregate_type='content' AND aggregate_id=$2", [siteId, contentId]),
        ]);
        return {
          content: content.rows[0] || null,
          workflowCount: workflow.rows[0].count,
          outboxCount: outbox.rows[0].count,
        };
      };
      const auditFor = requestId => pool.query(
        "SELECT site_id,actor_id,action,target_type,target_id,result,request_id,details FROM audit_events WHERE site_id=$1 AND action='content.submit-review' AND request_id=$2",
        [siteB, requestId],
      );
      const transitionRequest = requestId => fetch(
        base + '/api/v1/pages/' + siteBContent.id + '/submit-review',
        {
          method: 'POST',
          headers: { ...authHeaders, 'content-type': 'application/json', 'x-virgoscorpio-hub-site-id': siteB, 'x-request-id': requestId },
          body: JSON.stringify({ expectedVersion: 1, note: 'F1.34 review submission' }),
        },
      );

      const siteBBaseline = await contentSnapshot(siteB, siteBContent.id);
      const siteAControl = await contentSnapshot(siteA, siteAContent.id);
      assert.equal(siteBBaseline.content.status, 'draft');
      assert.equal(siteAControl.content.status, 'draft');

      const functionName = 'test_content_workflow_audit_fn_' + suffix;
      const triggerName = 'test_content_workflow_audit_tr_' + suffix;
      try {
        await pool.query(
          `CREATE FUNCTION "${functionName}"() RETURNS trigger LANGUAGE plpgsql AS $audit$
           BEGIN
             IF NEW.action = 'content.submit-review' AND NEW.site_id = '${siteB}'::uuid THEN
               RAISE EXCEPTION 'simulated editorial workflow audit persistence failure';
             END IF;
             RETURN NEW;
           END;
           $audit$`,
        );
        await pool.query(
          `CREATE TRIGGER "${triggerName}" BEFORE INSERT ON audit_events
           FOR EACH ROW EXECUTE FUNCTION "${functionName}"()`,
        );

        const failed = await transitionRequest(failureRequestId);
        assert.equal(failed.status, 500);
        await failed.json();
        assert.deepEqual(await contentSnapshot(siteB, siteBContent.id), siteBBaseline,
          'audit failure must roll back content state, workflow event and outbox event');
        assert.deepEqual(await contentSnapshot(siteA, siteAContent.id), siteAControl,
          'Site A control state must remain unchanged during Site B audit failure');
        assert.equal((await auditFor(failureRequestId)).rowCount, 0);
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS "${triggerName}" ON audit_events`).catch(() => {});
        await pool.query(`DROP FUNCTION IF EXISTS "${functionName}"()`).catch(() => {});
      }

      const retried = await transitionRequest(retryRequestId);
      assert.equal(retried.status, 200);
      const payload = await retried.json();
      assert.equal(payload.status, 'in_review');
      assert.equal(payload.content.status, 'in_review');
      const afterRetry = await contentSnapshot(siteB, siteBContent.id);
      assert.equal(afterRetry.content.status, 'in_review');
      assert.equal(afterRetry.content.version, 1);
      assert.equal(afterRetry.content.lock_version, siteBBaseline.content.lock_version + 1);
      assert.equal(afterRetry.workflowCount, siteBBaseline.workflowCount + 1);
      assert.equal(afterRetry.outboxCount, siteBBaseline.outboxCount + 1);
      assert.deepEqual(await contentSnapshot(siteA, siteAContent.id), siteAControl,
        'a successful Site B retry must not mutate Site A');
      const retryAudit = await auditFor(retryRequestId);
      assert.equal(retryAudit.rowCount, 1);
      assert.equal(retryAudit.rows[0].site_id, siteB);
      assert.equal(retryAudit.rows[0].actor_id, actor.id);
      assert.equal(retryAudit.rows[0].action, 'content.submit-review');
      assert.equal(retryAudit.rows[0].target_type, 'content');
      assert.equal(retryAudit.rows[0].target_id, siteBContent.id);
      assert.equal(retryAudit.rows[0].request_id, retryRequestId);
      assert.deepEqual(retryAudit.rows[0].details, { version: 1, status: 'in_review' });

      await pool.query(
        "DELETE FROM audit_events WHERE site_id=ANY($1::uuid[]) AND request_id=ANY($2::text[])",
        [[siteA, siteB], [failureRequestId, retryRequestId]],
      );
      await pool.query("DELETE FROM outbox_events WHERE aggregate_type='content' AND aggregate_id=ANY($1::uuid[])", [[siteAContent.id, siteBContent.id]]);
    });


  }
);
