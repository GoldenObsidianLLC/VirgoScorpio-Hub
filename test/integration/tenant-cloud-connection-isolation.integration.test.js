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
  'cloud connection listing revalidates cloud:manage in the provider-detail read transaction',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const siteIds = [];
    const userIds = [];
    let roleId = null;
    let server = null;
    let authorizeSiteInterceptor = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
      AI_ALLOWED_PROVIDERS: 'mock',
      AI_ALLOW_EXTERNAL_CONTENT: 'false',
      RATE_LIMIT_MAX_REQUESTS: '100',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });
    const apiIdentity = {
      ...identity,
      authorizeSite: async (...args) => {
        const allowed = await identity.authorizeSite(...args);
        if (authorizeSiteInterceptor) await authorizeSiteInterceptor(args, allowed);
        return allowed;
      },
    };

    t.after(async () => {
      authorizeSiteInterceptor = null;
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
      [`f188-cloud-a-${randomUUID().slice(0, 10)}`, 'F1.88 Cloud Site A'],
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`f188-cloud-b-${randomUUID().slice(0, 10)}`, 'F1.88 Cloud Site B'],
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const role = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [`f188-cloud-role-${randomUUID().slice(0, 10)}`, 'F1.88 Cloud Manager', JSON.stringify(['cloud:manage'])],
    );
    roleId = role.rows[0].id;

    const password = 'F1.88-Cloud-Integration-Password';
    const user = await pool.query(
      `INSERT INTO users(email,display_name,password_hash,status)
       VALUES($1,$2,$3,'active') RETURNING id,email`,
      [`f188-cloud-${randomUUID()}@example.test`, 'F1.88 Cloud Manager', await hashPassword(password)],
    );
    const actor = user.rows[0];
    userIds.push(actor.id);
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteB, actor.id, roleId],
    );

    const session = await identity.login({
      email: actor.email,
      password,
      ip: '127.0.0.1',
      userAgent: 'f1-88-cloud-list-integration',
    });
    assert.equal(session.mfaRequired, false);

    server = createApiServer({
      env,
      pool,
      identityService: apiIdentity,
      logger: { error() {} },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { authorization: `Bearer ${session.token}` };
    const boundedFetch = (url, init = {}) => fetch(url, {
      ...init,
      signal: init.signal || AbortSignal.timeout(15_000),
    });

    const seedConnection = async (siteId, name) => {
      const result = await pool.query(
        `INSERT INTO cloud_connections(
           site_id,provider,name,config,credential_reference,status,
           last_health_check_at,created_at,updated_at
         )
         VALUES($1,'s3-compatible',$2,$3::jsonb,$4,'configured',NULL,$5,$5)
         RETURNING id`,
        [
          siteId,
          name,
          JSON.stringify({ bucket: name.toLowerCase().replace(/[^a-z0-9-]/g, '-') }),
          `vault://f1-88-unresolved/${siteId}/${randomUUID()}`,
          new Date('2026-11-28T08:00:00.000Z'),
        ],
      );
      return result.rows[0].id;
    };
    const siteAConnectionId = await seedConnection(siteA, 'F1.88 Site A Private Connection');
    const siteBConnectionId = await seedConnection(siteB, 'F1.88 Site B Positive Control Connection');

    const snapshot = async (siteId, connectionId) => {
      const result = await pool.query(
        `SELECT id,site_id,provider,name,config,credential_reference,status,
                last_health_check_at,created_at,updated_at
           FROM cloud_connections WHERE site_id=$1 AND id=$2`,
        [siteId, connectionId],
      );
      return result.rows[0] || null;
    };
    const siteABefore = await snapshot(siteA, siteAConnectionId);
    const siteBBefore = await snapshot(siteB, siteBConnectionId);
    assert.ok(siteABefore);
    assert.ok(siteBBefore);

    const activeResponse = await boundedFetch(`${base}/api/v1/sites/${siteB}/cloud/connections`, { headers });
    assert.equal(activeResponse.status, 200, 'the active Site B cloud manager retains list access');
    const activeConnections = (await activeResponse.json()).connections;
    assert.deepEqual(activeConnections.map(connection => connection.id), [siteBConnectionId]);
    assert.equal(JSON.stringify(activeConnections).includes(siteAConnectionId), false);
    assert.equal(JSON.stringify(activeConnections).includes(siteABefore.credential_reference), false);

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
      if (!preflightIntercepted && allowed && args[0] === actor.id && args[1] === siteB && args[2] === 'cloud:manage') {
        preflightIntercepted = true;
        preflightCompleted();
        await preflightBarrier;
      }
    };

    try {
      await revocationClient.query('BEGIN');
      revocationOpen = true;
      await revocationClient.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [siteB]);
      await revocationClient.query('SELECT id FROM roles WHERE id=$1 FOR UPDATE', [roleId]);
      await revocationClient.query("UPDATE roles SET capabilities=capabilities-'cloud:manage' WHERE id=$1", [roleId]);

      connectionsPromise = boundedFetch(`${base}/api/v1/sites/${siteB}/cloud/connections`, { headers })
        .then(async response => ({ status: response.status, payload: await response.json() }))
        .catch(error => {
          throw new Error('Cloud connection-list revocation request exceeded 15 seconds: ' + error.message);
        });

      const preflightObserved = await Promise.race([
        preflight.then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), 5000)),
      ]);
      assert.equal(preflightObserved, true, 'the real request must pass request-time cloud:manage authorization before revocation');

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

      assert.equal(earlyOutcome, null, 'provider configuration and credential references must not be returned before capability revocation commits');
      assert.equal(lockObserved, true, 'cloud listing must serialize against the Site B membership/capability lock');
      assert.equal(connectionsOutcome.status, 403, 'a revoked cloud manager must not list retained cloud connections');
      assert.equal(connectionsOutcome.payload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.equal(Object.hasOwn(connectionsOutcome.payload, 'connections'), false);
      const denied = JSON.stringify(connectionsOutcome.payload);
      for (const marker of [
        siteBConnectionId,
        siteBBefore.name,
        siteBBefore.credential_reference,
        siteBBefore.config.bucket,
      ]) {
        assert.equal(denied.includes(String(marker)), false, 'denied response must not disclose marker: ' + marker);
      }

      const revokedRole = await pool.query('SELECT capabilities FROM roles WHERE id=$1', [roleId]);
      assert.equal(revokedRole.rows[0].capabilities.includes('cloud:manage'), false);
      assert.deepEqual(await snapshot(siteA, siteAConnectionId), siteABefore);
      assert.deepEqual(await snapshot(siteB, siteBConnectionId), siteBBefore);
    } finally {
      resumePreflight();
      authorizeSiteInterceptor = null;
      if (revocationOpen) await revocationClient.query('ROLLBACK').catch(() => {});
      if (connectionsPromise && !connectionsOutcome) await connectionsPromise.catch(() => null);
      revocationClient.release();
      await pool.query(
        'UPDATE roles SET capabilities=$2::jsonb WHERE id=$1',
        [roleId, JSON.stringify(['cloud:manage'])],
      ).catch(() => {});
    }

    const restored = await boundedFetch(`${base}/api/v1/sites/${siteB}/cloud/connections`, { headers });
    assert.equal(restored.status, 200, 'restored cloud:manage capability restores the positive control');
    assert.deepEqual((await restored.json()).connections.map(connection => connection.id), [siteBConnectionId]);
  },
);
