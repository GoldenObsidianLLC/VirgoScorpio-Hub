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
  'tenant isolation: commerce product IDs and order collections stay scoped to the selected site',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '6',
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
    let authorizeSiteInterceptor = null;
    // Intercept only request-time capability checks so the integration test can
    // pause the real handler after authorization and reproduce a role-revocation race.
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
      [`tenant-commerce-a-${randomUUID().slice(0, 8)}`, 'Tenant Commerce Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-commerce-b-${randomUUID().slice(0, 8)}`, 'Tenant Commerce Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [`tenant-commerce-${randomUUID().slice(0, 10)}`, 'Tenant Commerce Test Administrator', JSON.stringify(['*'])]
    );
    roleId = roleResult.rows[0].id;

    const password = 'Isolation-Password-2026';
    const actorResult = await pool.query(
      `INSERT INTO users(email,display_name,password_hash,status)
       VALUES($1,$2,$3,'active') RETURNING id,email`,
      [`tenant-commerce-actor-${randomUUID()}@example.test`, 'Site B Commerce Actor', await hashPassword(password)]
    );
    const actor = actorResult.rows[0];
    userIds.push(actor.id);

    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteB, actor.id, roleId]
    );

    const productAResult = await pool.query(
      `INSERT INTO commerce_products(site_id,slug,name,status,currency,price_minor)
       VALUES($1,$2,$3,'published','USD',1799) RETURNING id,version,status,name`,
      [siteA, `private-product-a-${randomUUID().slice(0, 8)}`, 'PRIVATE_SITE_A_PRODUCT_MARKER']
    );
    const productA = productAResult.rows[0];

    const productBResult = await pool.query(
      `INSERT INTO commerce_products(site_id,slug,name,status,currency,price_minor,created_by)
       VALUES($1,$2,$3,'published','USD',2599,$4) RETURNING id,version,status,name`,
      [siteB, `site-b-product-${randomUUID().slice(0, 8)}`, 'Site B Product Control', actor.id]
    );
    const productB = productBResult.rows[0];

    const orderAResult = await pool.query(
      `INSERT INTO commerce_orders(site_id,email,status,currency,subtotal_minor,total_minor,idempotency_key)
       VALUES($1,$2,'paid','USD',1799,1799,$3) RETURNING id,status,total_minor,email`,
      [siteA, `private-site-a-order-${randomUUID()}@example.test`, `site-a-${randomUUID()}`]
    );
    const orderA = orderAResult.rows[0];

    const orderBResult = await pool.query(
      `INSERT INTO commerce_orders(site_id,customer_id,email,status,currency,subtotal_minor,total_minor,idempotency_key)
       VALUES($1,$2,$3,'paid','USD',2599,2599,$4) RETURNING id,status,total_minor,email`,
      [siteB, actor.id, `site-b-order-${randomUUID()}@example.test`, `site-b-${randomUUID()}`]
    );
    const orderB = orderBResult.rows[0];

    const session = await identity.login({
      email: actor.email,
      password,
      ip: '127.0.0.1',
      userAgent: 'tenant-commerce-isolation-test',
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
    const headers = {
      authorization: `Bearer ${session.token}`,
      'x-virgoscorpio-hub-site-id': siteB,
    };

    const productBefore = await pool.query(
      'SELECT id,site_id,status,version,name,price_minor FROM commerce_products WHERE site_id=$1 AND id=$2',
      [siteA, productA.id]
    );
    const orderBefore = await pool.query(
      'SELECT id,site_id,status,total_minor,email,provider_session_id FROM commerce_orders WHERE site_id=$1 AND id=$2',
      [siteA, orderA.id]
    );
    assert.equal(productBefore.rows.length, 1);
    assert.equal(orderBefore.rows.length, 1);

    await t.test('foreign product detail is indistinguishable from a missing site B product', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/products/${productA.id}`, { headers });
      const payload = await response.json();
      assert.equal(response.status, 404);
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_PRODUCT_NOT_FOUND');
      assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_SITE_A_PRODUCT_MARKER/);
    });

    await t.test('site B product listing contains only site B products', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/products`, { headers });
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.ok(payload.products.some(item => item.id === productB.id));
      assert.equal(payload.products.some(item => item.id === productA.id), false);
      assert.equal(payload.products.some(item => item.name === productA.name), false);
    });

    await t.test('foreign product delete cannot mutate site A inventory', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/products/${productA.id}`, {
        method: 'DELETE',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: productA.version }),
      });
      const payload = await response.json();
      assert.equal(response.status, 409);
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT');
      const after = await pool.query(
        'SELECT id,site_id,status,version,name,price_minor FROM commerce_products WHERE site_id=$1 AND id=$2',
        [siteA, productA.id]
      );
      assert.deepEqual(after.rows, productBefore.rows);
    });

    await t.test('site B order collection does not disclose site A orders or customer email', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteB}/commerce/orders`, { headers });
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.ok(payload.orders.some(item => item.id === orderB.id));
      assert.equal(payload.orders.some(item => item.id === orderA.id), false);
      assert.equal(payload.orders.some(item => item.email === orderA.email), false);
    });

    await t.test('commerce order listing revalidates commerce:read before disclosing customer details', async () => {
      const originalCapabilitiesResult = await pool.query('SELECT capabilities FROM roles WHERE id=$1', [roleId]);
      const originalCapabilities = originalCapabilitiesResult.rows[0].capabilities;
      const activeCapabilities = ['content:read', 'commerce:read'];
      await pool.query('UPDATE roles SET capabilities=$2::jsonb WHERE id=$1', [roleId, JSON.stringify(activeCapabilities)]);
      const capabilitiesBefore = await pool.query('SELECT capabilities FROM roles WHERE id=$1', [roleId]);
      assert.deepEqual(capabilitiesBefore.rows[0].capabilities, activeCapabilities);

      const activeResponse = await fetch(`${base}/api/v1/sites/${siteB}/commerce/orders`, { headers });
      assert.equal(activeResponse.status, 200, 'an active commerce:read member must retain order-list access');
      const activePayload = await activeResponse.json();
      const activeOrder = activePayload.orders.find(item => item.id === orderB.id);
      assert.ok(activeOrder, 'the active-member control must include the Site B order');
      assert.equal(activeOrder.email, orderB.email, 'the existing order-list response keeps customer email for authorized readers');

      const orderSnapshot = async siteId => {
        const result = await pool.query(
          'SELECT id,site_id,customer_id,email,status,currency,subtotal_minor,discount_minor,tax_minor,shipping_minor,total_minor,provider,provider_session_id,created_at,updated_at FROM commerce_orders WHERE site_id=$1 ORDER BY id',
          [siteId],
        );
        return result.rows;
      };
      const siteABefore = await orderSnapshot(siteA);
      const siteBBefore = await orderSnapshot(siteB);
      const revocationClient = await pool.connect();
      let revocationOpen = false;
      let ordersPromise;
      let ordersOutcome;
      let preflightCompleted;
      let resumePreflight;
      let preflightIntercepted = false;
      const preflight = new Promise(resolve => { preflightCompleted = resolve; });
      const preflightBarrier = new Promise(resolve => { resumePreflight = resolve; });
      authorizeSiteInterceptor = async (args, allowed) => {
        if (!preflightIntercepted && allowed && args[0] === actor.id && args[1] === siteB && args[2] === 'commerce:read') {
          preflightIntercepted = true;
          preflightCompleted();
          await preflightBarrier;
        }
      };

      try {
        await revocationClient.query('BEGIN');
        revocationOpen = true;
        // Preserve the shared site -> role lock order used by transaction-time authorization.
        await revocationClient.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [siteB]);
        await revocationClient.query('SELECT id FROM roles WHERE id=$1 FOR UPDATE', [roleId]);
        await revocationClient.query("UPDATE roles SET capabilities=capabilities-'commerce:read' WHERE id=$1", [roleId]);

        ordersPromise = fetch(`${base}/api/v1/sites/${siteB}/commerce/orders`, { headers })
          .then(async response => ({ status: response.status, payload: await response.json() }));
        const preflightObserved = await Promise.race([
          preflight.then(() => true),
          new Promise(resolve => setTimeout(() => resolve(false), 5000)),
        ]);
        assert.equal(preflightObserved, true, 'order-list request must pass request-time commerce:read authorization before the revocation race');

        // Resume the actual handler while the role-revocation transaction still holds the Site B locks.
        resumePreflight();
        const earlyOutcome = await Promise.race([
          ordersPromise,
          new Promise(resolve => setTimeout(() => resolve(null), 100)),
        ]);
        const lockObserved = earlyOutcome
          ? false
          : await waitForDatabaseWriteLock(revocationClient, 'FOR KEY SHARE', 5000, { relationName: 'sites' });

        await revocationClient.query('COMMIT');
        revocationOpen = false;
        ordersOutcome = earlyOutcome || await ordersPromise;

        assert.equal(earlyOutcome, null, 'order and customer details must not be returned before capability revocation commits');
        assert.equal(lockObserved, true, 'order-list reads must serialize against site-scoped role-capability revocation');
        assert.equal(ordersOutcome.status, 403, 'a revoked commerce:read member must not list site orders');
        assert.equal(ordersOutcome.payload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
        assert.equal(Object.hasOwn(ordersOutcome.payload, 'orders'), false, 'the denied response must not contain an order collection');
        const deniedPayload = JSON.stringify(ordersOutcome.payload);
        for (const marker of [orderB.id, orderB.email, String(orderB.total_minor)]) {
          assert.equal(deniedPayload.includes(marker), false, 'the denied response must not disclose order/customer marker: ' + marker);
        }
        const revokedCapabilities = await pool.query('SELECT capabilities FROM roles WHERE id=$1', [roleId]);
        assert.equal(revokedCapabilities.rows[0].capabilities.includes('commerce:read'), false, 'the role remains revoked until cleanup');
        assert.deepEqual(await orderSnapshot(siteA), siteABefore, 'Site A order/customer data must remain unchanged');
        assert.deepEqual(await orderSnapshot(siteB), siteBBefore, 'Site B order/customer data must remain unchanged');
      } finally {
        resumePreflight();
        authorizeSiteInterceptor = null;
        if (revocationOpen) await revocationClient.query('ROLLBACK').catch(() => {});
        if (ordersPromise && !ordersOutcome) ordersOutcome = await ordersPromise.catch(() => null);
        revocationClient.release();
        await pool.query('UPDATE roles SET capabilities=$2::jsonb WHERE id=$1', [roleId, JSON.stringify(originalCapabilities)]).catch(() => {});
      }
    });

    const orderAfter = await pool.query(
      'SELECT id,site_id,status,total_minor,email,provider_session_id FROM commerce_orders WHERE site_id=$1 AND id=$2',
      [siteA, orderA.id]
    );
    assert.deepEqual(orderAfter.rows, orderBefore.rows);
  }
);
