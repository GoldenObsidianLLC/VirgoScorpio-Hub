'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  reconcileExpiredStripeCheckouts,
  validateBatchSize
} = require('../packages/billing/src/checkout-reconciliation');

const candidate = { order_id: 'order-1', site_id: 'site-1', provider_session_id: 'cs_test_123' };

function response(session, { ok = true, status = 200, raw } = {}) {
  return { ok, status, async text() { return raw ?? JSON.stringify(session); } };
}

function fakePool({ candidateRows = [candidate], orderRow = { ...candidate, status: 'pending_payment' }, commitFails = false } = {}) {
  const state = { calls: [], connects: 0, commits: 0, rollbacks: 0, releases: 0, reservationsCommitted: 0, deferred: 0 };
  const pool = {
    state,
    async query(sql, values) {
      state.calls.push({ surface: 'pool', sql, values });
      if (/FROM commerce_orders/.test(sql)) return { rows: candidateRows };
      if (/UPDATE commerce_stock_reservations/.test(sql)) {
        state.deferred += 1;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unexpected pool SQL in test double: ${sql}`);
    },
    async connect() {
      state.connects += 1;
      return {
        async query(sql, values) {
          state.calls.push({ surface: 'client', sql, values });
          if (sql === 'BEGIN') return { rows: [] };
          if (sql === 'COMMIT') { state.commits += 1; if (commitFails) throw new Error('database commit failed'); return { rows: [] }; }
          if (sql === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
          if (/SELECT id,site_id,status,provider_session_id/.test(sql)) return { rows: [orderRow] };
          if (/UPDATE commerce_orders SET status='failed'/.test(sql)) return { rows: [{ id: candidate.order_id }] };
          if (/UPDATE commerce_orders SET status='paid'/.test(sql)) return { rows: [{ id: candidate.order_id }] };
          if (/WITH released AS/.test(sql)) { state.releases += 1; return { rows: [{ released_count: 1 }] }; }
          if (/UPDATE commerce_stock_reservations SET status='committed'/.test(sql)) {
            state.reservationsCommitted += 1;
            return { rows: [{ id: 'reservation-1' }] };
          }
          throw new Error(`Unexpected SQL in test double: ${sql}`);
        },
        release() { state.releaseClient = true; }
      };
    }
  };
  return pool;
}

function fetchSession(session, optionsSeen = []) {
  return async (url, options) => {
    optionsSeen.push({ url, options });
    return response(session);
  };
}

const TEST_STRIPE_SECRET_KEY = ['sk', 'test', 'fixture_not_real'].join('_');

test('reconciliation batch size is bounded', () => {
  assert.equal(validateBatchSize(1), 1);
  assert.equal(validateBatchSize(1_000), 1_000);
  for (const value of [0, -1, 1.5, 1_001, '10', NaN]) {
    assert.throws(() => validateBatchSize(value), error => error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_RECONCILIATION_BATCH');
  }
});

test('unresolved provider outcomes extend the reservation retry window without releasing stock', async () => {
  const pool = fakePool();
  const fetchImpl = async () => { throw new TypeError('network error'); };
  const result = await reconcileExpiredStripeCheckouts(pool, { secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl });
  assert.equal(result.held, 1);
  assert.equal(pool.state.deferred, 1);
  assert.equal(pool.state.connects, 0);
  assert.equal(pool.state.releases, 0);
  const retry = pool.state.calls.find(call => /UPDATE commerce_stock_reservations/.test(call.sql));
  assert.ok(retry);
  assert.deepEqual(retry.values, [candidate.site_id, candidate.order_id, 15]);
  assert.match(retry.sql, /GREATEST\(expires_at, now\(\) \+ \(\$3::integer \* INTERVAL '1 minute'\)\)/);
});

test('expired Stripe session transitions pending order to failed and releases the stock exactly once', async () => {
  const pool = fakePool();
  const requests = [];
  const result = await reconcileExpiredStripeCheckouts(pool, {
    secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl: fetchSession({ id: candidate.provider_session_id, status: 'expired', payment_status: 'unpaid' }, requests)
  });
  assert.deepEqual(result, { skipped: false, checked: 1, expired: 1, paid: 0, held: 0, errors: 0, unlinked: 0 });
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.reservationsCommitted, 0);
  assert.equal(pool.state.commits, 1);
  assert.equal(requests[0].url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_123');
  assert.equal(requests[0].options.method, 'GET');
  assert.equal(requests[0].options.headers.Authorization, `Bearer ${TEST_STRIPE_SECRET_KEY}`);
});

test('checkout reconciliation rolls back the order and inventory transition when commit fails', async () => {
  const pool = fakePool({ commitFails: true });
  await assert.rejects(
    reconcileExpiredStripeCheckouts(pool, {
      secretKey: TEST_STRIPE_SECRET_KEY,
      fetchImpl: fetchSession({ id: candidate.provider_session_id, status: 'expired', payment_status: 'unpaid' })
    }),
    /database commit failed/
  );
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releaseClient, true);
});

test('complete paid Stripe session reconciles pending order and commits the reservation', async () => {
  const pool = fakePool();
  const result = await reconcileExpiredStripeCheckouts(pool, {
    secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl: fetchSession({ id: candidate.provider_session_id, status: 'complete', payment_status: 'paid', payment_intent: 'pi_test_123' })
  });
  assert.equal(result.paid, 1);
  assert.equal(result.expired, 0);
  assert.equal(pool.state.reservationsCommitted, 1);
  assert.equal(pool.state.releases, 0);
});

test('open or unpaid-complete sessions retain reservations', async () => {
  for (const session of [
    { id: candidate.provider_session_id, status: 'open', payment_status: 'unpaid' },
    { id: candidate.provider_session_id, status: 'complete', payment_status: 'unpaid' }
  ]) {
    const pool = fakePool();
    const result = await reconcileExpiredStripeCheckouts(pool, { secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl: fetchSession(session) });
    assert.equal(result.held, 1);
    assert.equal(pool.state.connects, 0);
    assert.equal(pool.state.releases, 0);
  }
});

test('open sessions past the hold period are expired at Stripe and the stock is released', async () => {
  const pool = fakePool();
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method });
    return response({ id: candidate.provider_session_id, status: options.method === 'POST' ? 'expired' : 'open', payment_status: 'unpaid' });
  };
  const result = await reconcileExpiredStripeCheckouts(pool, { secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl });
  assert.equal(result.expired, 1);
  assert.equal(result.held, 0);
  assert.equal(pool.state.releases, 1);
  assert.deepEqual(requests.map(r => r.method), ['GET', 'POST']);
  assert.equal(requests[1].url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_123/expire');
});

test('provider errors and sessions that remain open preserve inventory after 24 hours', async () => {
  const failing = async () => { throw new TypeError('socket reset'); };
  const old = fakePool({ candidateRows: [{ ...candidate, overdue_seconds: String(25 * 60 * 60) }] });
  const failedLookup = await reconcileExpiredStripeCheckouts(old, { secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl: failing });
  assert.equal(failedLookup.errors, 1);
  assert.equal(failedLookup.held, 1);
  assert.equal(old.state.connects, 0);
  assert.equal(old.state.releases, 0);

  const stuckOpen = fakePool({ candidateRows: [{ ...candidate, overdue_seconds: String(25 * 60 * 60) }] });
  const methods = [];
  const stillOpen = async (_url, options) => {
    methods.push(options.method);
    return response({ id: candidate.provider_session_id, status: 'open', payment_status: 'unpaid' });
  };
  const openResult = await reconcileExpiredStripeCheckouts(stuckOpen, {
    secretKey: TEST_STRIPE_SECRET_KEY,
    fetchImpl: stillOpen
  });
  assert.equal(openResult.held, 1);
  assert.deepEqual(methods, ['GET', 'POST']);
  assert.equal(stuckOpen.state.connects, 0);
  assert.equal(stuckOpen.state.releases, 0);
});

test('provider transport and response errors retain inventory and are reported', async () => {
  const cases = [
    async () => { throw new TypeError('socket reset'); },
    async () => ({ ok: false, status: 429, async text() { return 'rate limited'; } }),
    async () => ({ ok: false, status: 503, async text() { return 'temporarily unavailable'; } }),
    async () => ({ ok: true, status: 200, async text() { return '{bad json'; } }),
    async () => response({ id: 'cs_other', status: 'expired', payment_status: 'unpaid' }),
    async () => response({ id: candidate.provider_session_id, status: 'expired' })
  ];
  for (const fetchImpl of cases) {
    const pool = fakePool({ candidateRows: [{ ...candidate, overdue_seconds: String(25 * 60 * 60) }] });
    const result = await reconcileExpiredStripeCheckouts(pool, { secretKey: TEST_STRIPE_SECRET_KEY, fetchImpl });
    assert.equal(result.errors, 1);
    assert.equal(result.held, 1);
    assert.equal(pool.state.releases, 0);
    assert.equal(pool.state.connects, 0);
  }
});

test('missing provider credentials skip reconciliation without releasing holds', async () => {
  const pool = fakePool();
  const result = await reconcileExpiredStripeCheckouts(pool, { secretKey: '', fetchImpl: async () => { throw new Error('must not be called'); } });
  assert.equal(result.skipped, true);
  assert.equal(pool.state.connects, 0);
  assert.equal(pool.state.releases, 0);
});

test('orders without a Stripe session ID are retained for manual or idempotent recovery', async () => {
  const pool = fakePool({ candidateRows: [{ order_id: 'order-2', site_id: 'site-1', provider_session_id: null }] });
  const result = await reconcileExpiredStripeCheckouts(pool, { secretKey: TEST_STRIPE_SECRET_KEY });
  assert.equal(result.unlinked, 1);
  assert.equal(result.held, 1);
  assert.equal(pool.state.connects, 0);
});

test('reconciliation validates the database pool before querying', async () => {
  await assert.rejects(reconcileExpiredStripeCheckouts(null), /PostgreSQL-compatible pool/);
  await assert.rejects(reconcileExpiredStripeCheckouts(fakePool(), { batchSize: 0 }), error => error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_RECONCILIATION_BATCH');
});

// ============================================================================
// Security Tests: Verify mitigation of indefinite inventory hold vulnerability
// ============================================================================

test('SECURITY: repeated Stripe lookup failures never release inventory based on elapsed time', async () => {
  const failingFetch = async () => { throw new TypeError('network error'); };
  const old = fakePool({ candidateRows: [{ ...candidate, overdue_seconds: String(48 * 60 * 60) }] });
  const result = await reconcileExpiredStripeCheckouts(old, {
    secretKey: TEST_STRIPE_SECRET_KEY,
    fetchImpl: failingFetch
  });
  assert.equal(result.errors, 1);
  assert.equal(result.expired, 0);
  assert.equal(result.held, 1);
  assert.equal(old.state.releases, 0);
  assert.equal(old.state.commits, 0);
  assert.equal(old.state.connects, 0);
});

test('SECURITY: nonterminal open sessions past hold period are actively expired', async () => {
  // Simulates the pentest scenario where open sessions remained held indefinitely.
  // The fix actively calls Stripe's /expire endpoint to transition the session.
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method });
    // First call (GET) returns open, second call (POST /expire) returns expired
    return response({ 
      id: candidate.provider_session_id, 
      status: options.method === 'POST' ? 'expired' : 'open', 
      payment_status: 'unpaid' 
    });
  };
  
  const pool = fakePool();
  const result = await reconcileExpiredStripeCheckouts(pool, { 
    secretKey: TEST_STRIPE_SECRET_KEY, 
    fetchImpl 
  });
  
  assert.equal(result.expired, 1, 'Open session should be expired');
  assert.equal(result.held, 0, 'Open session should not be held');
  assert.equal(pool.state.releases, 1, 'Stock should be released');
  assert.equal(requests.length, 2, 'Should make two API calls');
  assert.equal(requests[0].method, 'GET', 'First call should be GET');
  assert.equal(requests[1].method, 'POST', 'Second call should be POST');
  assert.match(requests[1].url, /\/expire$/, 'Second call should be to /expire endpoint');
});

test('SECURITY: an open session remains held when Stripe does not confirm expiry', async () => {
  const pool = fakePool({ candidateRows: [{ ...candidate, overdue_seconds: String(48 * 60 * 60) }] });
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, method: options.method });
    return response({ id: candidate.provider_session_id, status: 'open', payment_status: 'unpaid' });
  };

  const result = await reconcileExpiredStripeCheckouts(pool, {
    secretKey: TEST_STRIPE_SECRET_KEY,
    fetchImpl
  });

  assert.equal(result.expired, 0);
  assert.equal(result.held, 1);
  assert.equal(pool.state.connects, 0);
  assert.equal(pool.state.releases, 0);
  assert.deepEqual(requests.map(request => request.method), ['GET', 'POST']);
});

test('SECURITY: multiple abandoned checkouts retain inventory when provider state is unavailable', async () => {
  const abandonedCheckouts = [
    { order_id: 'order-1', site_id: 'site-1', provider_session_id: 'cs_test_1', overdue_seconds: String(25 * 60 * 60) },
    { order_id: 'order-2', site_id: 'site-1', provider_session_id: 'cs_test_2', overdue_seconds: String(48 * 60 * 60) },
    { order_id: 'order-3', site_id: 'site-1', provider_session_id: 'cs_test_3', overdue_seconds: String(72 * 60 * 60) }
  ];

  let totalHeld = 0;
  for (const checkout of abandonedCheckouts) {
    const pool = fakePool({ candidateRows: [checkout] });
    const failingFetch = async () => { throw new TypeError('provider unavailable'); };
    const result = await reconcileExpiredStripeCheckouts(pool, {
      secretKey: TEST_STRIPE_SECRET_KEY,
      fetchImpl: failingFetch
    });
    assert.equal(result.expired, 0, `Checkout ${checkout.order_id} must not be expired without provider confirmation`);
    assert.equal(result.held, 1, `Checkout ${checkout.order_id} must retain its inventory`);
    assert.equal(pool.state.releases, 0, `Checkout ${checkout.order_id} must not release stock`);
    totalHeld += result.held;
  }

  assert.equal(totalHeld, 3, 'Every unresolved checkout remains held until provider state is known');
});

test('SECURITY: unpaid complete sessions retain holds until a definitive provider outcome', async () => {
  const oldUnpaid = fakePool({ candidateRows: [{ ...candidate, overdue_seconds: String(72 * 60 * 60) }] });
  const result = await reconcileExpiredStripeCheckouts(oldUnpaid, {
    secretKey: TEST_STRIPE_SECRET_KEY,
    fetchImpl: fetchSession({ id: candidate.provider_session_id, status: 'complete', payment_status: 'unpaid' })
  });

  assert.equal(result.held, 1, 'An unpaid completed session may still settle asynchronously');
  assert.equal(result.expired, 0);
  assert.equal(oldUnpaid.state.connects, 0);
  assert.equal(oldUnpaid.state.releases, 0);
});

test('SECURITY: reconciliation processes expired holds in order preventing starvation', async () => {
  // Verifies that reconciliation processes orders by creation time, preventing
  // newer abandoned checkouts from starving older ones from being released.
  const pool = fakePool();
  
  // The SQL query includes ORDER BY o.created_at,o.id
  // This test verifies the query is called (implementation detail check)
  await reconcileExpiredStripeCheckouts(pool, { 
    secretKey: TEST_STRIPE_SECRET_KEY, 
    fetchImpl: fetchSession({ id: candidate.provider_session_id, status: 'expired', payment_status: 'unpaid' })
  });
  
  const candidateQuery = pool.state.calls.find(c => c.surface === 'pool');
  assert.ok(candidateQuery, 'Should query for candidates');
  assert.match(candidateQuery.sql, /ORDER BY o\.created_at,o\.id/, 'Should order by creation time');
});
