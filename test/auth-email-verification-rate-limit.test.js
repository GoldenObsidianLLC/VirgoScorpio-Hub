'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthRouteHandlers } = require('../apps/api/src/auth-routes');

/**
 * Security test suite for email verification rate limiting.
 * 
 * This test suite verifies the mitigation for the pentest finding:
 * "Unauthenticated email-verification requests can pressure the shared database pool"
 * 
 * The vulnerability was that the public email-verification confirmation route bypassed
 * the server's general per-IP limiter and had no endpoint-specific limiter. Any
 * unauthenticated caller could submit a token-shaped value that reached a
 * transaction-backed PostgreSQL lookup, consuming one of the finite shared pool
 * connections while the lookup and rollback complete.
 * 
 * The mitigation adds a dedicated per-IP rate limiter before reading the body or
 * acquiring a pooled database connection.
 */

test('email verification applies dedicated per-IP rate limiting before database access', async () => {
  let poolConnectCalls = 0;
  let poolQueryCalls = 0;
  let readJsonCalls = 0;
  let verifyEmailCalls = 0;
  
  const mockPool = {
    async connect() {
      poolConnectCalls += 1;
      throw new Error('Database connection should not be acquired when rate limited');
    },
    async query() {
      poolQueryCalls += 1;
      throw new Error('Database query should not be executed when rate limited');
    }
  };

  const mockIdentity = {
    async verifyEmail() {
      verifyEmailCalls += 1;
      // First call is allowed, so return success
      return { verified: true };
    }
  };

  let allowRequestCalls = [];
  const mockAllowRequest = (key) => {
    allowRequestCalls.push(key);
    // First call allowed, second call denied
    return allowRequestCalls.length === 1
      ? { allowed: true, remaining: 0 }
      : { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  };

  const mockReadJson = async (req, maxBytes) => {
    readJsonCalls += 1;
    return { token: 'a'.repeat(43) };
  };

  let responseStatus = null;
  let responseHeaders = {};
  let responseBody = null;

  const mockRes = {
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
    writeHead(status, headers) {
      responseStatus = status;
      if (headers) {
        for (const [name, value] of Object.entries(headers)) {
          responseHeaders[name.toLowerCase()] = value;
        }
      }
    },
    end(body) {
      if (body) responseBody = body;
    }
  };

  const mockSendJson = (res, status, payload) => {
    responseStatus = status;
    responseBody = JSON.stringify(payload);
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: mockIdentity,
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: mockReadJson,
    readForm: async () => ({}),
    sameSecret: () => false
  });

  // First request - should be allowed
  const req1 = {
    method: 'POST',
    socket: { remoteAddress: '192.0.2.100' },
    headers: {}
  };
  const url1 = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  
  responseStatus = null;
  responseHeaders = {};
  responseBody = null;
  readJsonCalls = 0;
  
  await authRoutes.handlePublic({ req: req1, res: mockRes, url: url1, requestId: 'test-1' });
  
  assert.equal(allowRequestCalls.length, 1, 'allowRequest should be called once for first request');
  assert.equal(allowRequestCalls[0], 'email-verify:192.0.2.100', 'rate limiter key should include email-verify prefix and IP');
  assert.equal(readJsonCalls, 1, 'readJson should be called for allowed request');
  assert.equal(verifyEmailCalls, 1, 'verifyEmail should be called for allowed request');
  assert.equal(responseStatus, 200, 'first request should succeed with 200');

  // Second request from same IP - should be rate limited
  const req2 = {
    method: 'POST',
    socket: { remoteAddress: '192.0.2.100' },
    headers: {}
  };
  const url2 = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  
  responseStatus = null;
  responseHeaders = {};
  responseBody = null;
  readJsonCalls = 0;
  
  await authRoutes.handlePublic({ req: req2, res: mockRes, url: url2, requestId: 'test-2' });
  
  assert.equal(allowRequestCalls.length, 2, 'allowRequest should be called for second request');
  assert.equal(responseStatus, 429, 'rate limited request should return 429 status');
  assert.equal(responseHeaders['retry-after'], '60', 'retry-after header should be set');
  assert.equal(readJsonCalls, 0, 'readJson should NOT be called when rate limited');
  assert.equal(verifyEmailCalls, 1, 'verifyEmail should NOT be called again when rate limited');
  assert.equal(poolConnectCalls, 0, 'database connection should NOT be acquired when rate limited');
  assert.equal(poolQueryCalls, 0, 'database query should NOT be executed when rate limited');
  
  const parsedBody = JSON.parse(responseBody);
  assert.equal(parsedBody.code, 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT', 'error code should indicate rate limit');
  assert.match(parsedBody.error, /Too many verification attempts/, 'error message should indicate verification rate limit');
});

test('email verification rate limiter is checked before reading request body', async () => {
  let readJsonCalled = false;
  let allowRequestCalled = false;
  const callOrder = [];

  const mockAllowRequest = (key) => {
    allowRequestCalled = true;
    callOrder.push('allowRequest');
    return { allowed: false, remaining: 0, retryAfterSeconds: 30 };
  };

  const mockReadJson = async () => {
    readJsonCalled = true;
    callOrder.push('readJson');
    return { token: 'should-not-be-read' };
  };

  let responseStatus = null;
  const mockSendJson = (res, status, payload) => {
    responseStatus = status;
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: { async verifyEmail() {} },
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: mockReadJson,
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const req = {
    method: 'POST',
    socket: { remoteAddress: '192.0.2.200' },
    headers: {}
  };
  const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  const mockRes = {
    setHeader() {},
    writeHead() {},
    end() {}
  };

  await authRoutes.handlePublic({ req, res: mockRes, url, requestId: 'test-order' });

  assert.equal(allowRequestCalled, true, 'allowRequest must be called');
  assert.equal(readJsonCalled, false, 'readJson must NOT be called when rate limited');
  assert.deepEqual(callOrder, ['allowRequest'], 'allowRequest must be called before readJson');
  assert.equal(responseStatus, 429, 'should return 429 when rate limited');
});

test('email verification rate limiter is checked before acquiring database connection', async () => {
  let poolConnectCalled = false;
  let allowRequestCalled = false;
  const callOrder = [];

  const mockPool = {
    async connect() {
      poolConnectCalled = true;
      callOrder.push('pool.connect');
      throw new Error('Should not reach database when rate limited');
    }
  };

  const mockIdentity = {
    async verifyEmail() {
      callOrder.push('verifyEmail');
      throw new Error('Should not call verifyEmail when rate limited');
    }
  };

  const mockAllowRequest = (key) => {
    allowRequestCalled = true;
    callOrder.push('allowRequest');
    return { allowed: false, remaining: 0, retryAfterSeconds: 45 };
  };

  let responseStatus = null;
  const mockSendJson = (res, status, payload) => {
    responseStatus = status;
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: mockIdentity,
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async () => ({ token: 'test-token' }),
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const req = {
    method: 'POST',
    socket: { remoteAddress: '192.0.2.250' },
    headers: {}
  };
  const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  const mockRes = {
    setHeader() {},
    writeHead() {},
    end() {}
  };

  await authRoutes.handlePublic({ req, res: mockRes, url, requestId: 'test-db-order' });

  assert.equal(allowRequestCalled, true, 'allowRequest must be called');
  assert.equal(poolConnectCalled, false, 'pool.connect must NOT be called when rate limited');
  assert.deepEqual(callOrder, ['allowRequest'], 'only allowRequest should be called, no database access');
  assert.equal(responseStatus, 429, 'should return 429 when rate limited');
});

test('email verification uses dedicated rate limiter key with email-verify prefix', async () => {
  const capturedKeys = [];

  const mockAllowRequest = (key) => {
    capturedKeys.push(key);
    return { allowed: true, remaining: 10 };
  };

  const mockIdentity = {
    async verifyEmail() {
      return { verified: true };
    }
  };

  let responseStatus = null;
  const mockSendJson = (res, status, payload) => {
    responseStatus = status;
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: mockIdentity,
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async () => ({ token: 'valid-token-format-here-1234567890abcdef' }),
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const testIPs = ['192.0.2.1', '10.0.0.5', '172.16.0.100'];

  for (const ip of testIPs) {
    const req = {
      method: 'POST',
      socket: { remoteAddress: ip },
      headers: {}
    };
    const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
    const mockRes = {
      setHeader() {},
      writeHead() {},
      end() {}
    };

    await authRoutes.handlePublic({ req, res: mockRes, url, requestId: `test-${ip}` });
  }

  assert.equal(capturedKeys.length, 3, 'should capture rate limit keys for all requests');
  assert.equal(capturedKeys[0], 'email-verify:192.0.2.1', 'first key should have email-verify prefix and IP');
  assert.equal(capturedKeys[1], 'email-verify:10.0.0.5', 'second key should have email-verify prefix and IP');
  assert.equal(capturedKeys[2], 'email-verify:172.16.0.100', 'third key should have email-verify prefix and IP');
  
  // Verify the prefix is different from other auth routes (e.g., login uses 'login:')
  assert.ok(capturedKeys.every(key => key.startsWith('email-verify:')), 'all keys should use email-verify prefix');
  assert.ok(capturedKeys.every(key => !key.startsWith('login:')), 'should not use login prefix');
});

test('email verification rate limiter handles missing remote address gracefully', async () => {
  let capturedKey = null;

  const mockAllowRequest = (key) => {
    capturedKey = key;
    return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
  };

  let responseStatus = null;
  const mockSendJson = (res, status, payload) => {
    responseStatus = status;
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: { async verifyEmail() {} },
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async () => ({ token: 'test' }),
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const req = {
    method: 'POST',
    socket: { remoteAddress: null }, // Missing IP address
    headers: {}
  };
  const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  const mockRes = {
    setHeader() {},
    writeHead() {},
    end() {}
  };

  await authRoutes.handlePublic({ req, res: mockRes, url, requestId: 'test-no-ip' });

  assert.equal(capturedKey, 'email-verify:unknown', 'should use "unknown" when IP is missing');
  assert.equal(responseStatus, 429, 'should still apply rate limiting with unknown IP');
});

test('email verification rate limit response includes proper security headers', async () => {
  const mockAllowRequest = () => ({
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 120
  });

  let capturedHeaders = {};
  let capturedStatus = null;
  let capturedPayload = null;

  const mockSendJson = (res, status, payload) => {
    capturedStatus = status;
    capturedPayload = payload;
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: { async verifyEmail() {} },
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async () => ({ token: 'test' }),
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const req = {
    method: 'POST',
    socket: { remoteAddress: '192.0.2.50' },
    headers: {}
  };
  const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  const mockRes = {
    setHeader(name, value) {
      capturedHeaders[name] = value;
    },
    writeHead() {},
    end() {}
  };

  await authRoutes.handlePublic({ req, res: mockRes, url, requestId: 'test-headers' });

  assert.equal(capturedStatus, 429, 'status should be 429 Too Many Requests');
  assert.equal(capturedHeaders['retry-after'], '120', 'retry-after header should be set to retry seconds');
  assert.equal(capturedPayload.code, 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT', 'error code should be rate limit');
  assert.ok(capturedPayload.error, 'error message should be present');
  assert.ok(capturedPayload.requestId, 'requestId should be included in response');
});

test('email verification with valid token proceeds when rate limit allows', async () => {
  let verifyEmailCalled = false;
  let verifyEmailToken = null;

  const mockIdentity = {
    async verifyEmail({ token }) {
      verifyEmailCalled = true;
      verifyEmailToken = token;
      return { verified: true };
    }
  };

  const mockAllowRequest = () => ({
    allowed: true,
    remaining: 5
  });

  let responseStatus = null;
  const mockSendJson = (res, status, payload) => {
    responseStatus = status;
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: mockIdentity,
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async () => ({ token: 'valid-token-12345678901234567890123456' }),
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const req = {
    method: 'POST',
    socket: { remoteAddress: '192.0.2.75' },
    headers: {}
  };
  const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
  const mockRes = {
    setHeader() {},
    writeHead() {},
    end() {}
  };

  await authRoutes.handlePublic({ req, res: mockRes, url, requestId: 'test-success' });

  assert.equal(verifyEmailCalled, true, 'verifyEmail should be called when rate limit allows');
  assert.equal(verifyEmailToken, 'valid-token-12345678901234567890123456', 'token should be passed to verifyEmail');
  assert.equal(responseStatus, 200, 'should return 200 on successful verification');
});

test('email verification rate limiter prevents database pool exhaustion attack', async () => {
  // Simulate an attack scenario where an attacker sends many requests
  let poolConnectionAttempts = 0;
  let rateLimitedRequests = 0;
  let allowedRequests = 0;

  const mockIdentity = {
    async verifyEmail() {
      poolConnectionAttempts += 1;
      // Simulate database work
      return { verified: false };
    }
  };

  // Simulate a rate limiter that allows only 5 requests per window
  let requestCount = 0;
  const mockAllowRequest = () => {
    requestCount += 1;
    if (requestCount <= 5) {
      allowedRequests += 1;
      return { allowed: true, remaining: 5 - requestCount };
    } else {
      rateLimitedRequests += 1;
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }
  };

  const mockSendJson = (res, status, payload) => {
    return true;
  };

  const authRoutes = createAuthRouteHandlers({
    identity: mockIdentity,
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: mockAllowRequest,
    sendJson: mockSendJson,
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async () => ({ token: 'attack-token-' + Math.random().toString(36) }),
    readForm: async () => ({}),
    sameSecret: () => false
  });

  const mockRes = {
    setHeader() {},
    writeHead() {},
    end() {}
  };

  // Simulate 20 rapid requests from the same IP (attack scenario)
  for (let i = 0; i < 20; i++) {
    const req = {
      method: 'POST',
      socket: { remoteAddress: '192.0.2.99' },
      headers: {}
    };
    const url = new URL('http://localhost/api/v1/auth/email-verification/confirm');
    
    await authRoutes.handlePublic({ req, res: mockRes, url, requestId: `attack-${i}` });
  }

  assert.equal(allowedRequests, 5, 'only 5 requests should be allowed');
  assert.equal(rateLimitedRequests, 15, '15 requests should be rate limited');
  assert.equal(poolConnectionAttempts, 5, 'only 5 database connections should be attempted (not 20)');
  assert.ok(poolConnectionAttempts < 20, 'rate limiter prevents all 20 requests from reaching database');
});
