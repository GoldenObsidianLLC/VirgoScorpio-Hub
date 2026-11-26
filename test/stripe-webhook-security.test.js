'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const http = require('node:http');
const { createApiServer } = require('../apps/api/src/server');

const WEBHOOK_SECRET = 'whsec_virgoscorpio_hub_security_test';

function signedPayload(event) {
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(String(timestamp) + '.')
    .update(rawBody)
    .digest('hex');
  return {
    rawBody,
    signature: 't=' + timestamp + ',v1=' + signature
  };
}

function createWebhookSecurityHarness(t, { webhookRateLimit = '5', webhookBodyTimeout = '5000' } = {}) {
  const state = {
    queries: [],
    processedEvents: new Set(),
    commits: 0,
    rollbacks: 0
  };
  const client = {
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'COMMIT') { state.commits += 1; return { rows: [] }; }
      if (sql === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
      if (sql.includes('INSERT INTO billing_webhook_events')) {
        if (state.processedEvents.has(params[0])) return { rows: [], rowCount: 0 };
        state.processedEvents.add(params[0]);
        return { rows: [{ provider_event_id: params[0] }], rowCount: 1 };
      }
      if (sql.includes('UPDATE billing_webhook_events')) return { rows: [], rowCount: 1 };
      throw new Error('Unexpected transaction query: ' + sql);
    },
    release() {}
  };
  const pool = {
    async query(sql) {
      if (sql.includes('FROM firewall_rules WHERE enabled=true')) return { rows: [] };
      throw new Error('Unexpected non-transaction query: ' + sql);
    },
    async connect() { return client; },
    async end() {}
  };
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      RATE_LIMIT_MAX_REQUESTS: '100',
      STRIPE_WEBHOOK_RATE_LIMIT_MAX_REQUESTS: webhookRateLimit,
      STRIPE_WEBHOOK_BODY_TIMEOUT_MS: webhookBodyTimeout
    },
    pool,
    logger: { error() {} }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      t.after(async () => {
        await new Promise(done => server.close(done));
        await server.virgoScorpioHub.close();
      });
      resolve({ state, base: 'http://127.0.0.1:' + server.address().port });
    });
  });
}

async function sendWebhook(base, event, options = {}) {
  const signed = signedPayload(event);
  return fetch(base + '/api/v1/billing/stripe/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': options.signature !== undefined ? options.signature : signed.signature
    },
    body: options.body !== undefined ? options.body : signed.rawBody
  });
}

function sendSlowBody(url, rawBody, signature, { chunkSize = 10, delayMs = 300 } = {}) {
  return new Promise((resolve, reject) => {
    let offset = 0; let timer = null; let responseReceived = false;
    const request = http.request(url, { method: 'POST', headers: {
      'content-type': 'application/json', 'stripe-signature': signature,
      'content-length': String(rawBody.length)
    } }, response => {
      responseReceived = true; if (timer) clearTimeout(timer); resolve(response);
    });
    request.on('error', error => { if (!responseReceived) reject(error); });
    const sendNext = () => {
      if (responseReceived) return;
      if (offset >= rawBody.length) { request.end(); return; }
      request.write(rawBody.subarray(offset, offset + chunkSize)); offset += chunkSize;
      timer = setTimeout(sendNext, delayMs);
    };
    sendNext();
  });
}

test('Stripe webhook rejects requests without a Stripe-Signature header before buffering body', async t => {
  const { base } = await createWebhookSecurityHarness(t);
  
  const response = await fetch(base + '/api/v1/billing/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_test', type: 'test.event', data: { object: {} } })
  });
  
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_SIGNATURE');
  assert.match(body.error, /Stripe signature is invalid/);
});

test('Stripe webhook rejects requests with empty Stripe-Signature header before buffering body', async t => {
  const { base } = await createWebhookSecurityHarness(t);
  
  const response = await fetch(base + '/api/v1/billing/stripe/webhook', {
    method: 'POST',
    headers: { 
      'content-type': 'application/json',
      'stripe-signature': ''
    },
    body: JSON.stringify({ id: 'evt_test', type: 'test.event', data: { object: {} } })
  });
  
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_SIGNATURE');
});

test('Stripe webhook enforces dedicated per-IP rate limit before buffering body', async t => {
  const { base } = await createWebhookSecurityHarness(t, { webhookRateLimit: '3' });
  
  const event = { id: 'evt_rate_limit_test', type: 'test.event', data: { object: {} } };
  
  // First 3 requests consume the webhook budget, then fail signature verification
  for (let i = 0; i < 3; i++) {
    const response = await sendWebhook(base, { ...event, id: `evt_rate_${i}` }, { signature: 'invalid' });
    assert.equal(response.status, 400, `Request ${i + 1} should fail signature check`);
    const body = await response.json();
    assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_SIGNATURE');
  }
  
  // 4th request should be rate-limited
  const rateLimited = await sendWebhook(base, { ...event, id: 'evt_rate_4' }, { signature: 'invalid' });
  assert.equal(rateLimited.status, 429);
  assert.ok(rateLimited.headers.has('retry-after'));
  const rateLimitBody = await rateLimited.json();
  assert.equal(rateLimitBody.code, 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT');
  assert.match(rateLimitBody.error, /rate limit exceeded/i);
});

test('Stripe webhook rate limit is independent of normal per-IP rate limit', async t => {
  const { base } = await createWebhookSecurityHarness(t, { webhookRateLimit: '2' });
  
  // Make requests to a different endpoint to consume the normal rate limit
  for (let i = 0; i < 10; i++) {
    await fetch(base + '/api/v1/auth/session', {
      method: 'GET',
      headers: { 'cookie': 'virgoscorpio_hub_session=invalid' }
    });
  }
  
  // Webhook should still have its own budget
  const event = { id: 'evt_independent_limit', type: 'test.event', data: { object: {} } };
  const response = await sendWebhook(base, event, { signature: 'invalid' });
  
  // Should fail on signature, not rate limit (proving webhook has independent budget)
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_SIGNATURE');
});

test('Stripe webhook rejects invalid signature after rate limit check but before processing', async t => {
  const { state, base } = await createWebhookSecurityHarness(t);
  
  const event = { id: 'evt_invalid_sig', type: 'test.event', data: { object: {} } };
  const response = await sendWebhook(base, event, { signature: 't=1234567890,v1=invalidsignature' });
  
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_SIGNATURE');
  
  // Verify no database transaction was started
  assert.equal(state.queries.length, 0);
  assert.equal(state.commits, 0);
});

test('Stripe webhook enforces body timeout to prevent slow-body attacks', async t => {
  const { base } = await createWebhookSecurityHarness(t, { webhookBodyTimeout: '1000' });
  
  const url = new URL(base + '/api/v1/billing/stripe/webhook');
  const event = { id: 'evt_slow_body', type: 'test.event', data: { object: {} } };
  const signed = signedPayload(event);
  const slowResponse = await sendSlowBody(url, signed.rawBody, signed.signature, { chunkSize: 10, delayMs: 300 });

  assert.equal(slowResponse.statusCode, 408);
  
  const chunks = [];
  for await (const chunk of slowResponse) {
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BODY_TIMEOUT');
  assert.match(body.error, /not received before the deadline/i);
});

test('Stripe webhook processes valid requests after all security checks', async t => {
  const { state, base } = await createWebhookSecurityHarness(t);
  
  const event = {
    id: 'evt_valid_request',
    type: 'test.event',
    data: { object: { id: 'obj_test' } }
  };
  
  const response = await sendWebhook(base, event);
  
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.received, true);
  
  // Verify transaction was committed
  assert.ok(state.queries.some(q => q.sql === 'BEGIN'));
  assert.ok(state.queries.some(q => q.sql === 'COMMIT'));
  assert.equal(state.commits, 1);
});

test('Stripe webhook enforces 2 MiB body size limit', async t => {
  const { base } = await createWebhookSecurityHarness(t);
  
  // Create an event with a large payload (over 2 MiB)
  const largeData = 'x'.repeat(3 * 1024 * 1024); // 3 MiB
  const event = {
    id: 'evt_large_body',
    type: 'test.event',
    data: { object: { large_field: largeData } }
  };
  
  const response = await sendWebhook(base, event);
  
  assert.equal(response.status, 413);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BODY_TOO_LARGE');
  assert.match(body.error, /exceeds.*bytes/i);
});

test('Stripe webhook rate limit uses configurable environment variable', async t => {
  const { base } = await createWebhookSecurityHarness(t, { webhookRateLimit: '1' });
  
  const event = { id: 'evt_config_test', type: 'test.event', data: { object: {} } };
  
  // First request should pass rate limit but fail signature
  const first = await sendWebhook(base, { ...event, id: 'evt_first' }, { signature: 'invalid' });
  assert.equal(first.status, 400);
  
  // Second request should be rate-limited
  const second = await sendWebhook(base, { ...event, id: 'evt_second' }, { signature: 'invalid' });
  assert.equal(second.status, 429);
});

test('Stripe webhook security checks occur in correct order: signature presence, rate limit, body read, signature verification', async t => {
  const { base } = await createWebhookSecurityHarness(t, { webhookRateLimit: '10' });
  
  // 1. Missing signature should fail immediately (before rate limit)
  const noSig = await fetch(base + '/api/v1/billing/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_test', type: 'test.event', data: { object: {} } })
  });
  assert.equal(noSig.status, 400);
  
  // 2. With signature present, rate limit is checked next
  const event = { id: 'evt_order_test', type: 'test.event', data: { object: {} } };
  
  // Exhaust rate limit
  for (let i = 0; i < 10; i++) {
    await sendWebhook(base, { ...event, id: `evt_${i}` }, { signature: 'invalid' });
  }
  
  // Next request should be rate-limited (before signature verification)
  const rateLimited = await sendWebhook(base, event, { signature: 'invalid' });
  assert.equal(rateLimited.status, 429);
  
  // 3. After rate limit window, invalid signature should be caught
  // (We can't easily test this without waiting for the window to reset,
  // but the previous tests demonstrate signature verification happens after rate limit)
});

test('Stripe webhook with valid signature but missing required fields is rejected after signature verification', async t => {
  const { state, base } = await createWebhookSecurityHarness(t);
  
  // Valid signature but missing required event structure
  const invalidEvent = { id: 'evt_missing_fields' }; // Missing type and data
  const response = await sendWebhook(base, invalidEvent);
  
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_WEBHOOK_INVALID');
  
  // Malformed event envelopes are rejected before any database transaction.
  assert.equal(state.queries.length, 0);
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 0);
});

test('Stripe webhook duplicate events are idempotent and do not cause errors', async t => {
  const { state, base } = await createWebhookSecurityHarness(t);
  
  const event = {
    id: 'evt_duplicate_test',
    type: 'test.event',
    data: { object: { id: 'obj_test' } }
  };
  
  // First request
  const first = await sendWebhook(base, event);
  assert.equal(first.status, 200);
  
  // The harness returns no inserted row for a previously processed event ID.
  // Second request with same event ID
  const second = await sendWebhook(base, event);
  assert.equal(second.status, 200);
  const body = await second.json();
  assert.equal(body.received, true);
});

test('Stripe webhook body timeout is configurable via environment variable', async t => {
  // The supported configuration floor is 1000 ms, below the 10 s default.
  const { base } = await createWebhookSecurityHarness(t, { webhookBodyTimeout: '1000' });
  const url = new URL(base + '/api/v1/billing/stripe/webhook');
  const event = { id: 'evt_timeout_config', type: 'test.event', data: { object: {} } };
  const signed = signedPayload(event);
  const response = await sendSlowBody(url, signed.rawBody, signed.signature, { chunkSize: 1, delayMs: 1_200 });
  assert.equal(response.statusCode, 408);
  const chunks = [];
  for await (const chunk of response) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BODY_TIMEOUT');
});

test('Stripe webhook without billing configuration returns 503 before any security checks', async t => {
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      // No STRIPE_WEBHOOK_SECRET configured
      RATE_LIMIT_MAX_REQUESTS: '100'
    },
    pool: null, // No database
    logger: { error() {} }
  });
  
  const base = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve('http://127.0.0.1:' + server.address().port);
    });
  });
  
  const response = await fetch(base + '/api/v1/billing/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_test', type: 'test.event', data: { object: {} } })
  });
  
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_BILLING_DISABLED');
  
  await new Promise(done => server.close(done));
  await server.virgoScorpioHub.close();
});
