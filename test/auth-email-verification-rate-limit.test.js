'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAuthRouteHandlers } = require('../apps/api/src/auth-routes');

const EMAIL_CONFIRM_URL = 'http://localhost/api/v1/auth/email-verification/confirm';
const MAX_AUTH_BODY_BYTES = 16_384;

function createHarness({
  allowRequest = () => ({ allowed: true, remaining: 4 }),
  identity,
  readBody = { token: 'verification-token-1234567890' },
  maxBody = 64_000
} = {}) {
  const events = [];
  const rateLimitKeys = [];
  const verifiedTokens = [];
  const response = { status: null, headers: {}, payload: null, maxBody: null };

  const identityService = identity === undefined
    ? {
      async verifyEmail({ token }) {
        events.push('verify-email');
        verifiedTokens.push(token);
        return { verified: true };
      }
    }
    : identity;

  const handlers = createAuthRouteHandlers({
    identity: identityService,
    env: {},
    secureCookies: false,
    maxBody,
    allowRequest(key) {
      rateLimitKeys.push(key);
      events.push('allow-request');
      return allowRequest(key);
    },
    sendJson(_res, status, payload) {
      events.push('send-json');
      response.status = status;
      response.payload = payload;
      return true;
    },
    fail(status, code, message) {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    async readJson(_req, limit) {
      events.push('read-json');
      response.maxBody = limit;
      return readBody;
    },
    async readForm() {
      return {};
    },
    sameSecret() {
      return false;
    }
  });

  const res = {
    setHeader(name, value) {
      events.push('set-header');
      response.headers[name.toLowerCase()] = String(value);
    },
    writeHead() {},
    end() {}
  };

  async function handle(remoteAddress = '192.0.2.10', requestId = 'test-request') {
    return handlers.handlePublic({
      req: {
        method: 'POST',
        socket: { remoteAddress },
        headers: {}
      },
      res,
      url: new URL(EMAIL_CONFIRM_URL),
      requestId
    });
  }

  return { events, rateLimitKeys, response, verifiedTokens, handle };
}

test('email verification rejects rate-limited requests before reading the body or reaching identity storage', async () => {
  const harness = createHarness({
    allowRequest: () => ({ allowed: false, remaining: 0, retryAfterSeconds: 45 })
  });

  await harness.handle('192.0.2.10', 'limited-request');

  assert.deepEqual(harness.events, ['allow-request', 'set-header', 'send-json']);
  assert.deepEqual(harness.rateLimitKeys, ['email-verify:192.0.2.10']);
  assert.equal(harness.response.status, 429);
  assert.equal(harness.response.headers['retry-after'], '45');
  assert.equal(harness.response.payload.code, 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT');
  assert.equal(harness.response.payload.requestId, 'limited-request');
  assert.deepEqual(harness.verifiedTokens, []);
});

test('email verification rate-limit keys are scoped by remote IP with a safe fallback', async () => {
  const harness = createHarness();

  await harness.handle('192.0.2.10', 'request-one');
  await harness.handle('2001:db8::10', 'request-two');
  await harness.handle(null, 'request-three');

  assert.deepEqual(harness.rateLimitKeys, [
    'email-verify:192.0.2.10',
    'email-verify:2001:db8::10',
    'email-verify:unknown'
  ]);
  assert.equal(harness.verifiedTokens.length, 3);
});

test('allowed email-verification requests read a bounded body only after rate-limit admission', async () => {
  const harness = createHarness();

  await harness.handle('192.0.2.15', 'allowed-request');

  assert.deepEqual(harness.events, ['allow-request', 'read-json', 'verify-email', 'send-json']);
  assert.equal(harness.response.maxBody, MAX_AUTH_BODY_BYTES);
  assert.deepEqual(harness.verifiedTokens, ['verification-token-1234567890']);
  assert.equal(harness.response.status, 200);
  assert.equal(harness.response.payload.verified, true);
  assert.equal(harness.response.payload.requestId, 'allowed-request');
});

test('email verification rate limiting bounds repeated requests from a single IP', async () => {
  const allowedPerWindow = 5;
  let requestCount = 0;
  const harness = createHarness({
    allowRequest: () => {
      requestCount += 1;
      return requestCount <= allowedPerWindow
        ? { allowed: true, remaining: allowedPerWindow - requestCount }
        : { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    }
  });

  for (let index = 0; index < 20; index += 1) {
    await harness.handle('192.0.2.99', 'burst-' + index);
  }

  assert.equal(harness.rateLimitKeys.length, 20);
  assert.equal(harness.response.status, 429);
  assert.equal(harness.verifiedTokens.length, allowedPerWindow);
  assert.equal(harness.events.filter(event => event === 'read-json').length, allowedPerWindow);
  assert.equal(harness.events.filter(event => event === 'verify-email').length, allowedPerWindow);
  assert.equal(harness.events.filter(event => event === 'send-json').length, 20);
});

test('email verification preserves the disabled-identity response without consuming the body', async () => {
  const harness = createHarness({ identity: null });

  await harness.handle('192.0.2.20', 'disabled-identity');

  assert.deepEqual(harness.events, ['allow-request', 'send-json']);
  assert.equal(harness.response.status, 503);
  assert.equal(harness.response.payload.code, 'ERR_VIRGOSCORPIO_HUB_IDENTITY_DISABLED');
});
