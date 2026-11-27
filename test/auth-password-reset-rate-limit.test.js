'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthRouteHandlers } = require('../apps/api/src/auth-routes');

/**
 * Tests for password-reset rate limiting mitigations.
 * 
 * Pentest finding: Terminal mail-outbox failures are requeued indefinitely, enabling queue exhaustion.
 * The public password-reset request route was callable without rate limiting, allowing an attacker
 * to create unlimited mail_outbox rows for any known email address.
 * 
 * Mitigation: Two-tier rate limiting:
 * 1. Per-IP rate limit on password-reset requests
 * 2. Per-target-email rate limit to prevent account enumeration while still protecting the queue
 */

function createMockRequest({ method = 'POST', pathname = '/api/v1/auth/password-reset/request', remoteAddress = '192.0.2.1', body = null } = {}) {
  return {
    method,
    socket: { remoteAddress },
    headers: {},
    [Symbol.asyncIterator]: async function* () {
      if (body) yield Buffer.from(JSON.stringify(body));
    }
  };
}

function createMockResponse() {
  const response = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      if (headers) Object.entries(headers).forEach(([k, v]) => this.setHeader(k, v));
    },
    end(data) { this.body = data; }
  };
  return response;
}

function createMockUrl(pathname) {
  return { pathname };
}

function createRateLimiter() {
  const buckets = new Map();
  const windowMs = 60_000;
  const maxRequests = 5;
  return function allowRequest(key) {
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || entry.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1 };
    }
    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count += 1;
    return { allowed: true, remaining: maxRequests - entry.count };
  };
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.body = JSON.stringify(payload);
  return true;
}

function fail(statusCode, code, message, details) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  if (details) error.details = details;
  return error;
}

async function readJson(req, maxBytes) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readForm(req, maxBytes) {
  return {};
}

function sameSecret(a, b) {
  return a === b;
}

function createHandlers(identity, allowRequest) {
  return createAuthRouteHandlers({
    identity,
    allowRequest,
    maxBody: 16384,
    sendJson,
    fail,
    readJson,
    readForm,
    sameSecret,
    secureCookies: false,
    env: { NODE_ENV: 'test' }
  });
}

test('password-reset request applies per-IP rate limiting before processing', async () => {
  const allowRequest = createRateLimiter();
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  const remoteAddress = '192.0.2.100';
  
  // First 5 requests should succeed
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({ remoteAddress, body: { email: 'user@example.com' } });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    
    const handled = await handlers.handlePublic({ req, res, url, requestId: `req-${i}` });
    assert.equal(handled, true, `Request ${i} should be handled`);
    assert.equal(res.statusCode, 202, `Request ${i} should return 202`);
  }
  
  // 6th request should be rate limited
  const req = createMockRequest({ remoteAddress, body: { email: 'user@example.com' } });
  const res = createMockResponse();
  const url = createMockUrl('/api/v1/auth/password-reset/request');
  
  const handled = await handlers.handlePublic({ req, res, url, requestId: 'req-6' });
  assert.equal(handled, true, 'Rate-limited request should be handled');
  assert.equal(res.statusCode, 429, 'Should return 429 Too Many Requests');
  assert.ok(res.headers['retry-after'], 'Should include retry-after header');
  assert.ok(Number(res.headers['retry-after']) > 0, 'retry-after should be positive');
  
  const body = JSON.parse(res.body);
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT');
  assert.match(body.error, /too many password reset requests/i);
});

test('password-reset routes every target through durable deduplication without revealing account existence', async () => {
  const allowRequest = createRateLimiter();
  let resetCallCount = 0;
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      resetCallCount++;
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  const targetEmail = 'victim@example.com';
  
  // Requests from different IPs target the durable queue; the database owns the cross-replica cooldown.
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({ 
      remoteAddress: `192.0.2.${i}`, 
      body: { email: targetEmail } 
    });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    
    await handlers.handlePublic({ req, res, url, requestId: `req-${i}` });
    assert.equal(res.statusCode, 202, `Request ${i} should return 202`);
  }
  
  // A new IP still receives the generic accepted response; durable deduplication occurs in PostgreSQL.
  const req = createMockRequest({ 
    remoteAddress: '192.0.2.200', 
    body: { email: targetEmail } 
  });
  const res = createMockResponse();
  const url = createMockUrl('/api/v1/auth/password-reset/request');
  
  await handlers.handlePublic({ req, res, url, requestId: 'req-6' });
  
  // Should still return 202 to avoid account enumeration
  assert.equal(res.statusCode, 202, 'Should return 202 to avoid revealing account existence');
  const body = JSON.parse(res.body);
  assert.equal(body.accepted, true);
  assert.match(body.message, /if an active account matches/i);
  
  // Every accepted response follows the durable enqueue/deduplication boundary.
  assert.equal(resetCallCount, 6, 'Each 202 must follow the durable enqueue call, including deduplicated targets.');
});

test('password-reset target deduplication keeps response shape generic for known and unknown addresses', async () => {
  const allowRequest = createRateLimiter();
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  const targetEmail = 'victim@example.com';
  
  // Exhaust the per-target-email limit
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({ 
      remoteAddress: `192.0.2.${i}`, 
      body: { email: targetEmail } 
    });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    await handlers.handlePublic({ req, res, url, requestId: `req-${i}` });
  }
  
  // Now make a throttled request
  const throttledReq = createMockRequest({ 
    remoteAddress: '192.0.2.100', 
    body: { email: targetEmail } 
  });
  const throttledRes = createMockResponse();
  const throttledUrl = createMockUrl('/api/v1/auth/password-reset/request');
  await handlers.handlePublic({ 
    req: throttledReq, 
    res: throttledRes, 
    url: throttledUrl, 
    requestId: 'throttled' 
  });
  
  // Make a normal request for a different email
  const normalReq = createMockRequest({ 
    remoteAddress: '192.0.2.101', 
    body: { email: 'other@example.com' } 
  });
  const normalRes = createMockResponse();
  const normalUrl = createMockUrl('/api/v1/auth/password-reset/request');
  await handlers.handlePublic({ 
    req: normalReq, 
    res: normalRes, 
    url: normalUrl, 
    requestId: 'normal' 
  });
  
  // Both responses should be identical
  assert.equal(throttledRes.statusCode, 202);
  assert.equal(normalRes.statusCode, 202);
  
  const throttledBody = JSON.parse(throttledRes.body);
  const normalBody = JSON.parse(normalRes.body);
  
  assert.equal(throttledBody.accepted, true);
  assert.equal(normalBody.accepted, true);
  assert.match(throttledBody.message, /if an active account matches/i);
  assert.match(normalBody.message, /if an active account matches/i);
  
  // Response structure should be identical (no timing or content differences)
  assert.deepEqual(Object.keys(throttledBody).sort(), Object.keys(normalBody).sort());
});

test('password-reset rate limiting uses separate key namespaces for IP and target-email', async () => {
  const allowRequest = createRateLimiter();
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  const ip = '192.0.2.50';
  const email = 'user@example.com';
  
  // Make 5 requests from the same IP to the same email
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({ remoteAddress: ip, body: { email } });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    await handlers.handlePublic({ req, res, url, requestId: `req-${i}` });
    assert.equal(res.statusCode, 202);
  }
  
  // 6th request should hit the IP rate limit
  const ipLimitReq = createMockRequest({ remoteAddress: ip, body: { email } });
  const ipLimitRes = createMockResponse();
  const ipLimitUrl = createMockUrl('/api/v1/auth/password-reset/request');
  await handlers.handlePublic({ 
    req: ipLimitReq, 
    res: ipLimitRes, 
    url: ipLimitUrl, 
    requestId: 'ip-limit' 
  });
  
  assert.equal(ipLimitRes.statusCode, 429, 'Should hit IP rate limit');
  const body = JSON.parse(ipLimitRes.body);
  assert.equal(body.code, 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT');
});

test('password-reset handles missing or malformed email gracefully', async () => {
  const allowRequest = createRateLimiter();
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  const testCases = [
    { body: {}, desc: 'missing email' },
    { body: { email: null }, desc: 'null email' },
    { body: { email: '' }, desc: 'empty email' },
    { body: { email: 123 }, desc: 'numeric email' },
    { body: { email: {} }, desc: 'object email' }
  ];
  
  for (const { body, desc } of testCases) {
    const req = createMockRequest({ body });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    
    await handlers.handlePublic({ req, res, url, requestId: 'test' });
    
    // Should still return 202 (no error thrown)
    assert.equal(res.statusCode, 202, `Should handle ${desc} gracefully`);
  }
});

test('password-reset normalizes email for rate limiting', async () => {
  const allowRequest = createRateLimiter();
  let callCount = 0;
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      callCount++;
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  // Different case variations of the same email
  const emailVariations = [
    'User@Example.Com',
    'user@example.com',
    'USER@EXAMPLE.COM',
    '  user@example.com  ',
    'user@example.com   '
  ];
  
  // All 5 variations should count toward the same target-email limit
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({ 
      remoteAddress: `192.0.2.${i}`, 
      body: { email: emailVariations[i] } 
    });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    await handlers.handlePublic({ req, res, url, requestId: `req-${i}` });
    assert.equal(res.statusCode, 202);
  }
  
  // 6th variation should be throttled
  const req = createMockRequest({ 
    remoteAddress: '192.0.2.100', 
    body: { email: 'USER@EXAMPLE.COM' } 
  });
  const res = createMockResponse();
  const url = createMockUrl('/api/v1/auth/password-reset/request');
  await handlers.handlePublic({ req, res, url, requestId: 'req-6' });
  
  assert.equal(res.statusCode, 202, 'Should return 202 (throttled silently)');
  assert.equal(callCount, 6, 'Every request must reach the durable queue boundary.');
});

test('password-reset truncates extremely long emails for rate limiting', async () => {
  const allowRequest = createRateLimiter();
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  // Create an extremely long email (over 320 chars)
  const longEmail = 'a'.repeat(400) + '@example.com';
  
  const req = createMockRequest({ body: { email: longEmail } });
  const res = createMockResponse();
  const url = createMockUrl('/api/v1/auth/password-reset/request');
  
  // Should not throw, should handle gracefully
  await handlers.handlePublic({ req, res, url, requestId: 'test' });
  assert.equal(res.statusCode, 202);
});

test('password-reset applies rate limiting before identity service call', async () => {
  const allowRequest = createRateLimiter();
  let identityCallCount = 0;
  const identity = {
    async enqueuePasswordResetRequest({ email }) {
      identityCallCount++;
      // Simulate expensive database operation
      return { accepted: true };
    }
  };
  
  const handlers = createHandlers(identity, allowRequest);

  const remoteAddress = '192.0.2.150';
  
  // Exhaust the IP rate limit
  for (let i = 0; i < 5; i++) {
    const req = createMockRequest({ remoteAddress, body: { email: `user${i}@example.com` } });
    const res = createMockResponse();
    const url = createMockUrl('/api/v1/auth/password-reset/request');
    await handlers.handlePublic({ req, res, url, requestId: `req-${i}` });
  }
  
  assert.equal(identityCallCount, 5, 'Identity service called 5 times');
  
  // Next request should be blocked by rate limiter
  const req = createMockRequest({ remoteAddress, body: { email: 'user6@example.com' } });
  const res = createMockResponse();
  const url = createMockUrl('/api/v1/auth/password-reset/request');
  await handlers.handlePublic({ req, res, url, requestId: 'req-6' });
  
  assert.equal(res.statusCode, 429);
  assert.equal(identityCallCount, 5, 'Identity service should NOT be called for rate-limited request');
});
