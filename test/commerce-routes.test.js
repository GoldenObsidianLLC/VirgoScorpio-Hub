'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleCommerceRoute } = require('../apps/api/src/commerce-routes');
const { assertSiteCapabilityInTransaction } = require('../packages/community/src/workflows');

const siteId = '11111111-1111-4111-8111-111111111111';
const productId = '22222222-2222-4222-8222-222222222222';
const requestId = 'req-commerce-test-01';

function fail(statusCode, code, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function createContext({ path = '/api/v1/unmatched', method = 'GET', body = {}, pool, events = [] } = {}) {
  const res = { statusCode: 0, payload: null };
  return {
    req: { method, headers: {}, socket: { remoteAddress: '127.0.0.1' } },
    res,
    url: new URL(`http://localhost${path}`),
    actor: { user: { id: '33333333-3333-4333-8333-333333333333', email: 'buyer@example.test' } },
    requestId,
    localPool: pool || {
      async query(sql, values) {
        events.push({ type: 'query', sql, values });
        return { rows: [] };
      },
      async connect() { throw new Error('Unexpected pool.connect()'); }
    },
    env: {},
    identity: null,
    maxBody: 1_000_000,
    async siteIdFor(input) {
      events.push({ type: 'site', siteId: input.routeSiteId || input.body?.siteId || null });
      return input.routeSiteId;
    },
    async requireCapability(_actor, targetSiteId, capability) {
      events.push({ type: 'capability', siteId: targetSiteId, capability });
    },
    async readJson() {
      events.push({ type: 'readJson' });
      return body;
    },
    sendJson(response, statusCode, payload) {
      response.statusCode = statusCode;
      response.payload = payload;
      events.push({ type: 'sendJson', statusCode });
      return true;
    },
    fail
  };
}

test('commerce router declines paths outside its route family without touching dependencies', async () => {
  const events = [];
  const ctx = createContext({ events });

  assert.equal(await handleCommerceRoute(ctx), false);
  assert.deepEqual(events, []);
  assert.equal(ctx.res.statusCode, 0);
});

test('product listing establishes site and capability scope before a site-filtered read', async () => {
  const events = [];
  const product = { id: productId, site_id: siteId, slug: 'starter', status: 'published' };
  const pool = {
    async query(sql, values) {
      events.push({ type: 'query', sql, values });
      return { rows: [product] };
    },
    async connect() { throw new Error('Unexpected pool.connect()'); }
  };
  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/products?status=published&limit=20`,
    method: 'GET',
    pool,
    events
  });

  assert.equal(await handleCommerceRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 200);
  assert.deepEqual(ctx.res.payload.products, [product]);
  assert.equal(ctx.res.payload.requestId, requestId);
  assert.deepEqual(events.map(event => event.type), ['site', 'capability', 'query', 'sendJson']);
  assert.equal(events[0].siteId, siteId);
  assert.equal(events[1].capability, 'commerce:read');
  assert.match(events[2].sql, /FROM commerce_products WHERE site_id=\$1/);
  assert.equal(events[2].values[0], siteId);
});

test('commerce order listing revalidates commerce:read transactionally before reading customer details', async () => {
  const events = [];
  const transactionQueries = [];
  const order = {
    id: '44444444-4444-4444-8444-444444444444',
    order_number: 'ORD-1004',
    customer_id: '55555555-5555-4555-8555-555555555555',
    email: 'site-b-customer@example.test',
    status: 'paid',
    currency: 'USD',
    subtotal_minor: '2599',
    discount_minor: '0',
    tax_minor: '0',
    shipping_minor: '0',
    total_minor: '2599',
    provider: 'stripe',
    provider_session_id: 'cs_test_site_b',
    created_at: '2026-11-27T12:00:00.000Z',
    updated_at: '2026-11-27T12:00:00.000Z'
  };
  const pool = {
    async query(sql, values) {
      events.push({ type: 'pool-query', sql, values });
      throw new Error('Order details must be read through the capability transaction.');
    },
    async connect() {
      return {
        async query(sql, values) {
          transactionQueries.push({ sql, values });
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql.trim().toUpperCase())) return { rows: [] };
          if (sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) {
            assert.deepEqual(values, [siteId]);
            return { rows: [{ id: siteId }] };
          }
          if (sql.includes('SELECT r.capabilities FROM users u JOIN site_memberships m')) {
            assert.deepEqual(values, [siteId, '33333333-3333-4333-8333-333333333333', 'active']);
            return { rows: [{ capabilities: ['commerce:read'] }] };
          }
          if (sql.includes('FROM commerce_orders WHERE site_id=$1 ORDER BY created_at DESC LIMIT $2')) {
            assert.deepEqual(values, [siteId, 2]);
            return { rows: [order] };
          }
          throw new Error('Unexpected order-list transaction query: ' + sql);
        },
        release() {}
      };
    }
  };
  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/orders?limit=2`,
    method: 'GET',
    pool,
    events
  });
  ctx.assertSiteCapabilityInTransaction = assertSiteCapabilityInTransaction;

  assert.equal(await handleCommerceRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 200);
  assert.deepEqual(ctx.res.payload.orders, [order]);
  assert.equal(ctx.res.payload.requestId, requestId);
  assert.deepEqual(events.map(event => event.type), ['site', 'capability', 'sendJson']);
  assert.equal(events[0].siteId, siteId);
  assert.equal(events[1].capability, 'commerce:read');
  assert.equal(events.some(event => event.type === 'pool-query'), false, 'order rows must not be selected outside the authorization transaction');

  const siteLockIndex = transactionQueries.findIndex(query => query.sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE'));
  const capabilityIndex = transactionQueries.findIndex(query => query.sql.includes('SELECT r.capabilities FROM users u JOIN site_memberships m'));
  const ordersIndex = transactionQueries.findIndex(query => query.sql.includes('FROM commerce_orders WHERE site_id=$1 ORDER BY created_at DESC LIMIT $2'));
  assert.ok(
    siteLockIndex >= 0 && siteLockIndex < capabilityIndex && capabilityIndex < ordersIndex,
    'site and role capability locks must precede the order/customer detail SELECT',
  );
});

test('invalid product writes are rejected before any database mutation', async () => {
  const events = [];
  const pool = {
    async query(sql, values) {
      events.push({ type: 'query', sql, values });
      throw new Error('Invalid product must not reach PostgreSQL');
    },
    async connect() { throw new Error('Invalid product must not acquire a client'); }
  };
  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/products`,
    method: 'POST',
    body: { slug: 'bad slug', name: '', currency: 'USD', priceMinor: -1 },
    pool,
    events
  });

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => error.statusCode === 422 && error.code === 'ERR_VIRGOSCORPIO_HUB_PRODUCT_INVALID'
  );
  assert.deepEqual(events.map(event => event.type), ['readJson', 'site', 'capability']);
  assert.equal(events.some(event => event.type === 'query'), false);
});

test('cross-site rejection happens before commerce capabilities or database access', async () => {
  const events = [];
  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/orders`,
    method: 'GET',
    events
  });
  ctx.siteIdFor = async input => {
    events.push({ type: 'site-reject', siteId: input.routeSiteId });
    throw fail(403, 'ERR_VIRGOSCORPIO_HUB_SITE_SCOPE_MISMATCH', 'Site scope mismatch.');
  };

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_SITE_SCOPE_MISMATCH'
  );
  assert.deepEqual(events.map(event => event.type), ['site-reject']);
});

test('platform route module preserves its productInput export after commerce extraction', () => {
  const { productInput: platformProductInput } = require('../apps/api/src/platform-routes');
  const { productInput: commerceProductInput } = require('../apps/api/src/commerce-routes');
  const body = { slug: 'starter', name: 'Starter', priceMinor: 500, currency: 'USD' };

  assert.equal(platformProductInput, commerceProductInput);
  assert.deepEqual(platformProductInput(body), {
    slug: 'starter',
    name: 'Starter',
    description: '',
    productType: 'simple',
    status: 'draft',
    currency: 'USD',
    priceMinor: 500,
    compareAtPriceMinor: null,
    sku: null,
    inventoryQuantity: null,
    stockStatus: 'in_stock',
    requiresShipping: false,
    weightGrams: null,
    images: [],
    attributes: {},
    metadata: {}
  });
});

test('checkout enforces per-customer pending checkout limit to prevent inventory exhaustion', async () => {
  const events = [];
  const customerId = '33333333-3333-4333-8333-333333333333';
  const email = 'buyer@example.test';
  let advisoryLockCalled = false;
  let pendingCheckoutQueryCalled = false;

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          events.push({ type: 'query', sql, values });

          // BEGIN transaction
          if (sql === 'BEGIN') {
            return { rows: [] };
          }

          // Product lookup with FOR UPDATE - return a valid product with inventory
          if (sql.includes('SELECT * FROM commerce_products') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: productId,
                site_id: siteId,
                slug: 'widget',
                name: 'Widget',
                status: 'published',
                currency: 'USD',
                price_minor: 1000,
                inventory_quantity: 100,
                stock_status: 'in_stock'
              }]
            };
          }

          // Advisory lock for serializing concurrent checkouts
          if (sql.includes('pg_advisory_xact_lock')) {
            advisoryLockCalled = true;
            return { rows: [] };
          }

          // Check for existing pending checkouts
          if (sql.includes('SELECT count(DISTINCT o.id)::int AS count') && sql.includes('pending_payment')) {
            pendingCheckoutQueryCalled = true;
            // Simulate 3 existing pending checkouts (default limit)
            return { rows: [{ count: 3 }] };
          }

          return { rows: [] };
        },
        async release() {}
      };
    },
    async query() { return { rows: [] }; }
  };

  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/checkout`,
    method: 'POST',
    body: {
      items: [{ productId, quantity: 10 }],
      email
    },
    pool,
    events
  });
  ctx.actor = { user: { id: customerId, email } };
  ctx.env = { COMMERCE_MAX_PENDING_CHECKOUTS: 101 };

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => {
      return error.statusCode === 429 &&
             error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_PENDING_LIMIT' &&
             error.message.includes('Too many unpaid checkouts hold inventory');
    }
  );

  assert.equal(advisoryLockCalled, true, 'Advisory lock should be acquired');
  assert.equal(pendingCheckoutQueryCalled, true, 'Pending checkout count should be checked');
});

test('checkout enforces per-product held units limit to prevent single-product exhaustion', async () => {
  const events = [];
  const customerId = '33333333-3333-4333-8333-333333333333';
  const email = 'buyer@example.test';
  let heldUnitsQueryCalled = false;

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          events.push({ type: 'query', sql, values });

          // Advisory lock
          if (sql.includes('pg_advisory_xact_lock')) {
            return { rows: [] };
          }

          // BEGIN transaction
          if (sql === 'BEGIN') {
            return { rows: [] };
          }

          // Product lookup with FOR UPDATE
          if (sql.includes('SELECT * FROM commerce_products') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: productId,
                site_id: siteId,
                slug: 'widget',
                name: 'Widget',
                status: 'published',
                currency: 'USD',
                price_minor: 1000,
                inventory_quantity: 100,
                stock_status: 'in_stock'
              }]
            };
          }

          // Check for existing pending checkouts (pass this check)
          if (sql.includes('SELECT count(DISTINCT o.id)::int AS count') && sql.includes('pending_payment')) {
            return { rows: [{ count: 0 }] };
          }

          // Check for held units for this product
          if (sql.includes('SELECT COALESCE(SUM(r.quantity),0)::int AS units') && sql.includes('commerce_stock_reservations')) {
            heldUnitsQueryCalled = true;
            // Simulate 20 units already held, requesting 10 more would exceed limit of 25
            return { rows: [{ units: 20 }] };
          }

          return { rows: [] };
        },
        async release() {}
      };
    },
    async query() { return { rows: [] }; }
  };

  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/checkout`,
    method: 'POST',
    body: {
      items: [{ productId, quantity: 10 }],
      email
    },
    pool,
    events
  });
  ctx.actor = { user: { id: customerId, email } };
  ctx.env = {
    COMMERCE_MAX_PENDING_CHECKOUTS: 3,
    COMMERCE_MAX_HELD_UNITS_PER_PRODUCT: 1_001
  };

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => {
      return error.statusCode === 429 &&
             error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_RESERVATION_LIMIT' &&
             error.message.includes('per-customer limit for unpaid inventory reservations');
    }
  );

  assert.equal(heldUnitsQueryCalled, true, 'Held units check should be performed');
});

test('checkout allows valid request within both pending checkout and held units limits', async () => {
  const events = [];
  const customerId = '33333333-3333-4333-8333-333333333333';
  const email = 'buyer@example.test';
  const orderId = '44444444-4444-4444-8444-444444444444';
  let inventoryDecremented = false;
  let orderInserted = false;
  let reservationInserted = false;
  let stripeSessionCreated = false;

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          events.push({ type: 'query', sql, values });

          // Advisory lock
          if (sql.includes('pg_advisory_xact_lock')) {
            return { rows: [] };
          }

          // BEGIN transaction
          if (sql === 'BEGIN') {
            return { rows: [] };
          }

          // Product lookup with FOR UPDATE
          if (sql.includes('SELECT * FROM commerce_products') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id: productId,
                site_id: siteId,
                slug: 'widget',
                name: 'Widget',
                status: 'published',
                currency: 'USD',
                price_minor: 1000,
                inventory_quantity: 100,
                stock_status: 'in_stock',
                sku: 'WDG-001'
              }]
            };
          }

          // Check for existing pending checkouts (within limit)
          if (sql.includes('SELECT count(DISTINCT o.id)::int AS count') && sql.includes('pending_payment')) {
            return { rows: [{ count: 1 }] };
          }

          // Check for held units (within limit)
          if (sql.includes('SELECT COALESCE(SUM(r.quantity),0)::int AS units')) {
            return { rows: [{ units: 10 }] };
          }

          // Inventory decrement
          if (sql.includes('UPDATE commerce_products SET inventory_quantity=inventory_quantity-')) {
            inventoryDecremented = true;
            return { rows: [{ id: productId }] };
          }

          // Order insertion
          if (sql.includes('INSERT INTO commerce_orders')) {
            orderInserted = true;
            return {
              rows: [{
                id: orderId,
                site_id: siteId,
                customer_id: customerId,
                email,
                order_number: 'ORD-001',
                status: 'pending_payment',
                currency: 'USD',
                total_minor: 5000,
                provider_session_id: null,
                metadata: {},
                created_at: new Date()
              }]
            };
          }

          // Order items insertion
          if (sql.includes('INSERT INTO commerce_order_items')) {
            return { rows: [] };
          }

          // Stock reservation insertion
          if (sql.includes('INSERT INTO commerce_stock_reservations')) {
            reservationInserted = true;
            return { rows: [] };
          }

          // COMMIT
          if (sql === 'COMMIT') {
            return { rows: [] };
          }

          return { rows: [] };
        },
        async release() {}
      };
    },
    async query(sql) {
      // Check for existing order by idempotency key
      if (sql.includes('SELECT id,order_number,status,customer_id,email')) {
        return { rows: [] };
      }
      return { rows: [] };
    }
  };

  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/checkout`,
    method: 'POST',
    body: {
      items: [{ productId, quantity: 5 }],
      email,
      idempotencyKey: 'test-checkout-key-001'
    },
    pool,
    events
  });
  ctx.actor = { user: { id: customerId, email } };
  ctx.env = {
    COMMERCE_MAX_PENDING_CHECKOUTS: 3,
    COMMERCE_MAX_HELD_UNITS_PER_PRODUCT: 25,
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_CHECKOUT_SUCCESS_URL: 'https://example.test/success',
    STRIPE_CHECKOUT_CANCEL_URL: 'https://example.test/cancel'
  };

  // The test should proceed through security checks and reach Stripe creation
  // We expect it to fail at Stripe creation (which is fine for security testing)
  // The important part is that security checks passed and inventory was decremented
  try {
    await handleCommerceRoute(ctx);
  } catch (error) {
    // Expected to fail at Stripe or other downstream step
    // The important part is that security checks passed
  }

  assert.equal(inventoryDecremented, true, 'Inventory should be decremented after passing limits');
  assert.equal(orderInserted, true, 'Order should be inserted after passing limits');
  assert.equal(reservationInserted, true, 'Reservation should be created after passing limits');
});

test('checkout uses advisory lock to serialize concurrent requests from same customer', async () => {
  const events = [];
  const customerId = '33333333-3333-4333-8333-333333333333';
  const email = 'buyer@example.test';
  let lockKey = null;

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          events.push({ type: 'query', sql, values });

          // Capture advisory lock key
          if (sql.includes('pg_advisory_xact_lock')) {
            lockKey = values[0];
            assert.ok(lockKey.includes(`commerce-checkout:${siteId}:${customerId}`),
              'Lock key should include site and customer ID');
            return { rows: [] };
          }

          // BEGIN transaction
          if (sql === 'BEGIN') {
            return { rows: [] };
          }

          // Product lookup
          if (sql.includes('SELECT * FROM commerce_products')) {
            return {
              rows: [{
                id: productId,
                site_id: siteId,
                slug: 'widget',
                name: 'Widget',
                status: 'published',
                currency: 'USD',
                price_minor: 1000,
                inventory_quantity: 50,
                stock_status: 'in_stock'
              }]
            };
          }

          // Pending checkout check - simulate at limit
          if (sql.includes('SELECT count(DISTINCT o.id)::int AS count')) {
            return { rows: [{ count: 3 }] };
          }

          return { rows: [] };
        },
        async release() {}
      };
    },
    async query() { return { rows: [] }; }
  };

  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/checkout`,
    method: 'POST',
    body: {
      items: [{ productId, quantity: 5 }],
      email
    },
    pool,
    events
  });
  ctx.actor = { user: { id: customerId, email } };
  ctx.env = { COMMERCE_MAX_PENDING_CHECKOUTS: 3 };

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_PENDING_LIMIT'
  );

  assert.ok(lockKey !== null, 'Advisory lock should be acquired');
  assert.ok(lockKey.includes(siteId), 'Lock key should include site ID');
  assert.ok(lockKey.includes(customerId), 'Lock key should include customer ID');
});

test('checkout limits apply per-customer using customer_id for authenticated users', async () => {
  const events = [];
  const customerId = '33333333-3333-4333-8333-333333333333';
  const email = 'buyer@example.test';
  let queryUsedCustomerId = false;

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          events.push({ type: 'query', sql, values });

          if (sql.includes('pg_advisory_xact_lock')) {
            return { rows: [] };
          }

          if (sql === 'BEGIN') {
            return { rows: [] };
          }

          if (sql.includes('SELECT * FROM commerce_products')) {
            return {
              rows: [{
                id: productId,
                site_id: siteId,
                slug: 'widget',
                name: 'Widget',
                status: 'published',
                currency: 'USD',
                price_minor: 1000,
                inventory_quantity: 50,
                stock_status: 'in_stock'
              }]
            };
          }

          // Verify customer_id is used in the query
          if (sql.includes('SELECT count(DISTINCT o.id)::int AS count') && sql.includes('pending_payment')) {
            queryUsedCustomerId = values[1] === customerId && values[2] === email.toLowerCase() && sql.includes('o.customer_id::text=$2::text');
            return { rows: [{ count: 3 }] };
          }

          return { rows: [] };
        },
        async release() {}
      };
    },
    async query() { return { rows: [] }; }
  };

  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/checkout`,
    method: 'POST',
    body: {
      items: [{ productId, quantity: 5 }],
      email
    },
    pool,
    events
  });
  ctx.actor = { user: { id: customerId, email } };
  ctx.env = { COMMERCE_MAX_PENDING_CHECKOUTS: 3 };

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_PENDING_LIMIT'
  );

  assert.equal(queryUsedCustomerId, true, 'Query should use customer_id for authenticated users');
});

test('checkout limits apply per-email for unauthenticated/guest checkouts', async () => {
  const events = [];
  const email = 'guest@example.test';
  let queryUsedEmail = false;

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          events.push({ type: 'query', sql, values });

          if (sql.includes('pg_advisory_xact_lock')) {
            // Lock key should use email when no customer ID
            assert.ok(values[0].includes(email.toLowerCase()), 'Lock should use email for guest');
            return { rows: [] };
          }

          if (sql === 'BEGIN') {
            return { rows: [] };
          }

          if (sql.includes('SELECT * FROM commerce_products')) {
            return {
              rows: [{
                id: productId,
                site_id: siteId,
                slug: 'widget',
                name: 'Widget',
                status: 'published',
                currency: 'USD',
                price_minor: 1000,
                inventory_quantity: 50,
                stock_status: 'in_stock'
              }]
            };
          }

          // Verify email is used in the query when customer_id is null
          if (sql.includes('SELECT count(DISTINCT o.id)::int AS count') && sql.includes('pending_payment')) {
            queryUsedEmail = values[1] === null && values[2] === email.toLowerCase() && sql.includes('lower(o.email)=$3::text');
            return { rows: [{ count: 3 }] };
          }

          return { rows: [] };
        },
        async release() {}
      };
    },
    async query() { return { rows: [] }; }
  };

  const ctx = createContext({
    path: `/api/v1/sites/${siteId}/commerce/checkout`,
    method: 'POST',
    body: {
      items: [{ productId, quantity: 5 }],
      email
    },
    pool,
    events
  });
  ctx.actor = { user: { id: null, email: null } }; // Guest checkout
  ctx.env = { COMMERCE_MAX_PENDING_CHECKOUTS: 3 };

  await assert.rejects(
    handleCommerceRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_CHECKOUT_PENDING_LIMIT'
  );

  assert.equal(queryUsedEmail, true, 'Query should use email for guest checkouts');
});
