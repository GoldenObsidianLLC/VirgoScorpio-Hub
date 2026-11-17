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
  'PostgreSQL integration: Stripe refund provider response and correlated audit roll back and retry atomically',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8'
    });
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
      AI_ALLOWED_PROVIDERS: 'mock',
      STRIPE_SECRET_KEY: 'sk_test_f1_41_fixture_not_real'
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });
    const siteId = randomUUID();
    const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
    const siteSlug = 'f1-41-refund-' + suffix;
    const roleSlug = 'f1-41-refund-manager-' + suffix;
    const actorId = randomUUID();
    const actorEmail = 'f1-41-refund-' + suffix + '@example.test';
    const password = 'F1-41-Refund-Atomicity-2026';
    const paymentIntentId = 'pi_' + suffix;
    const refundRequestKey = 'refund-request-' + suffix;
    const refundAmountMinor = 10_000;
    const providerRefundId = 're_f141' + suffix;
    const requestIds = {
      failure: 'f1-41-failure-' + randomUUID(),
      retry: 'f1-41-retry-' + randomUUID(),
      terminalReplay: 'f1-41-terminal-replay-' + randomUUID()
    };

    let roleId = null;
    let orderId = null;
    let refundId = null;
    let server = null;
    let activeTrigger = null;
    const originalFetch = global.fetch;
    const providerCalls = [];
    const stripeIdempotencyKey = () => 'vsh_refund_' + refundId;

    async function removeAuditFailure() {
      if (!activeTrigger) return;
      await pool.query(
        'DROP TRIGGER IF EXISTS "' + activeTrigger.triggerName + '" ON audit_events'
      );
      await pool.query(
        'DROP FUNCTION IF EXISTS "' + activeTrigger.functionName + '"()'
      );
      activeTrigger = null;
    }

    async function installAuditFailure() {
      await removeAuditFailure();
      const triggerSuffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_fail_refund_audit_' + triggerSuffix;
      const triggerName = 'test_fail_refund_audit_tr_' + triggerSuffix;
      await pool.query(
        'CREATE FUNCTION "' + functionName + '"() RETURNS trigger LANGUAGE plpgsql AS $audit$ ' +
        'BEGIN ' +
        "IF NEW.site_id = '" + siteId + "'::uuid AND NEW.action = 'commerce.refund_requested' THEN " +
        "RAISE EXCEPTION 'simulated Stripe refund audit failure' USING ERRCODE = '23505'; " +
        'END IF; RETURN NEW; END; $audit$'
      );
      await pool.query(
        'CREATE TRIGGER "' + triggerName + '" BEFORE INSERT ON audit_events ' +
        'FOR EACH ROW EXECUTE FUNCTION "' + functionName + '"()'
      );
      activeTrigger = { triggerName, functionName };
    }

    function refundRequest(requestId) {
      return fetch(
        'http://127.0.0.1:' + server.address().port +
          '/api/v1/sites/' + siteId + '/commerce/orders/' + orderId + '/refunds',
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer ' + session.token,
            'content-type': 'application/json',
            'x-virgoscorpio-hub-site-id': siteId,
            'x-request-id': requestId
          },
          body: JSON.stringify({
            amountMinor: refundAmountMinor,
            reason: 'requested_by_customer',
            idempotencyKey: refundRequestKey
          })
        }
      );
    }

    async function refundSnapshot() {
      const result = await pool.query(
        'SELECT id,site_id,order_id,provider,provider_refund_id,amount_minor,currency,reason,status,idempotency_key ' +
        'FROM commerce_refunds WHERE site_id=$1 AND order_id=$2 AND idempotency_key=$3',
        [siteId, orderId, refundRequestKey]
      );
      const row = result.rows[0] || null;
      if (row) refundId = row.id;
      return row;
    }

    async function orderSnapshot() {
      const result = await pool.query(
        'SELECT id,site_id,status,total_minor,provider,provider_payment_id ' +
        'FROM commerce_orders WHERE site_id=$1 AND id=$2',
        [siteId, orderId]
      );
      return result.rows[0] || null;
    }

    async function auditSnapshot() {
      return pool.query(
        "SELECT id,site_id,actor_id,action,target_type,target_id,result,request_id,details " +
        "FROM audit_events WHERE site_id=$1 AND action='commerce.refund_requested' " +
        "AND target_type='commerce-refund' AND target_id=$2 ORDER BY created_at,id",
        [siteId, refundId]
      );
    }

    t.after(async () => {
      global.fetch = originalFetch;
      await removeAuditFailure().catch(() => {});
      if (server?.listening) await new Promise(resolve => server.close(resolve));
      if (server?.virgoScorpioHub) await server.virgoScorpioHub.close().catch(() => {});
      await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [actorId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => {});
      if (roleId) await pool.query('DELETE FROM roles WHERE id=$1', [roleId]).catch(() => {});
      await pool.end();
    });

    await pool.query(
      'INSERT INTO sites(id,slug,name) VALUES($1,$2,$3)',
      [siteId, siteSlug, 'F1.41 Stripe Refund Atomicity']
    );
    const role = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [roleSlug, 'F1.41 Refund Manager', JSON.stringify(['commerce:manage'])]
    );
    roleId = role.rows[0].id;

    await pool.query(
      "INSERT INTO users(id,email,display_name,password_hash,status) VALUES($1,$2,'F1.41 Refund Actor',$3,'active')",
      [actorId, actorEmail, await hashPassword(password)]
    );
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteId, actorId, roleId]
    );
    const session = await identity.login({
      email: actorEmail,
      password,
      ip: '127.0.0.1',
      userAgent: 'f1-41-stripe-refund-audit-atomicity'
    });
    assert.equal(session.mfaRequired, false);

    const order = await pool.query(
      'INSERT INTO commerce_orders(site_id,customer_id,email,status,currency,subtotal_minor,total_minor,' +
        'provider,provider_payment_id,idempotency_key) ' +
        "VALUES($1,$2,$3,'paid','USD',$4,$4,'stripe',$5,$6) RETURNING id",
      [siteId, actorId, actorEmail, refundAmountMinor, paymentIntentId, 'f1-41-order-' + suffix]
    );
    orderId = order.rows[0].id;

    global.fetch = async (input, options = {}) => {
      if (String(input) !== 'https://api.stripe.com/v1/refunds') {
        return originalFetch(input, options);
      }
      const form = new URLSearchParams(options.body || '');
      providerCalls.push({
        idempotencyKey: options.headers?.['idempotency-key'],
        paymentIntentId: form.get('payment_intent'),
        amountMinor: Number(form.get('amount')),
        reason: form.get('reason'),
        siteId: form.get('metadata[site_id]'),
        orderId: form.get('metadata[order_id]'),
        refundId: form.get('metadata[refund_id]')
      });
      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({
            id: providerRefundId,
            payment_intent: paymentIntentId,
            amount: refundAmountMinor,
            currency: 'usd',
            reason: 'requested_by_customer',
            status: 'succeeded'
          });
        }
      };
    };

    server = createApiServer({
      env,
      pool,
      identityService: identity,
      logger: { error() {} }
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    await t.test('audit failure rolls back local provider binding, refund status and full-order transition', async () => {
      await installAuditFailure();
      try {
        const failed = await refundRequest(requestIds.failure);
        assert.equal(failed.status, 500);
        await failed.json();

        const refund = await refundSnapshot();
        assert.ok(refund, 'the original idempotency reservation remains durable');
        assert.equal(providerCalls.length, 1, 'Stripe accepted one refund before local audit failure');
        assert.deepEqual(providerCalls[0], {
          idempotencyKey: stripeIdempotencyKey(),
          paymentIntentId,
          amountMinor: refundAmountMinor,
          reason: 'requested_by_customer',
          siteId,
          orderId,
          refundId: refund.id
        });
        assert.equal(refund.status, 'requested');
        assert.equal(refund.provider_refund_id, null);
        assert.equal((await orderSnapshot()).status, 'paid');
        assert.equal((await auditSnapshot()).rowCount, 0);
      } finally {
        await removeAuditFailure();
      }
    });

    await t.test('same idempotency key recovers the provider refund and commits exactly one audit event', async () => {
      const retried = await refundRequest(requestIds.retry);
      assert.equal(retried.status, 200);
      const payload = await retried.json();
      assert.equal(payload.refund.status, 'succeeded');
      assert.equal(payload.refund.providerRefundId, providerRefundId);
      assert.equal(payload.idempotentReplay, true);

      assert.equal(providerCalls.length, 2);
      assert.deepEqual(
        providerCalls.map(call => call.idempotencyKey),
        [stripeIdempotencyKey(), stripeIdempotencyKey()],
        'the provider retry must reuse the refund-specific Stripe idempotency key'
      );
      assert.deepEqual(
        providerCalls.map(call => call.refundId),
        [payload.refund.id, payload.refund.id]
      );

      const refund = await refundSnapshot();
      assert.equal(refund.status, 'succeeded');
      assert.equal(refund.provider_refund_id, providerRefundId);
      assert.equal((await orderSnapshot()).status, 'refunded');

      const audits = await auditSnapshot();
      assert.equal(audits.rowCount, 1);
      assert.equal(audits.rows[0].actor_id, actorId);
      assert.equal(audits.rows[0].target_id, payload.refund.id);
      assert.equal(audits.rows[0].request_id, requestIds.retry);
      assert.deepEqual(audits.rows[0].details, {
        amountMinor: refundAmountMinor,
        currency: 'USD',
        status: 'succeeded'
      });
    });

    await t.test('terminal idempotent replay does not call Stripe again or duplicate the audit', async () => {
      const replay = await refundRequest(requestIds.terminalReplay);
      assert.equal(replay.status, 200);
      const payload = await replay.json();
      assert.equal(payload.idempotentReplay, true);
      assert.equal(payload.refund.providerRefundId, providerRefundId);
      assert.equal(providerCalls.length, 2);
      assert.equal((await auditSnapshot()).rowCount, 1);
      assert.equal((await orderSnapshot()).status, 'refunded');
    });
  }
);
