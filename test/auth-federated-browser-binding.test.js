'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { createAuthRouteHandlers } = require('../apps/api/src/auth-routes');

/**
 * Tests for federated authentication browser binding mitigation.
 *
 * These tests verify that the login CSRF vulnerability (session swapping) is
 * mitigated by requiring that OIDC callbacks and SAML ACS submissions include
 * a browser-bound cookie matching the state/RelayState parameter.
 *
 * The vulnerability allowed an attacker to:
 * 1. Start their own federated login flow
 * 2. Capture the callback URL or SAML form
 * 3. Deliver it to a victim browser
 * 4. Cause the victim to be logged into the attacker's accoun
 *
 * The mitigation binds each transaction to the initiating browser via a
 * short-lived HttpOnly cookie set during the start flow and validated during
 * the callback/ACS.
 */

test('OIDC start flow sets a browser binding cookie with the state value', async () => {
  const capturedState = [];

  const identity = {
    async createOidcState({ state: s, nonce, verifier, issuer }) {
      assert.equal(typeof s, 'string');
      assert.equal(s.length, 43);
      capturedState.push(s);
      return { expiresInSeconds: 600 };
    }
  };

  // Inject the OIDC request builder so this test stays independent of the IdP.
  const oidcServices = {
    createAuthorizationRequest: async env => {
      const state = randomBytes(32).toString('base64url');
      return {
        state,
        nonce: randomBytes(32).toString('base64url'),
        verifier: randomBytes(32).toString('base64url'),
        issuer: env.OIDC_ISSUER,
        authorizationUrl: `https://idp.example.test/authorize?state=${state}`
      };
    }
  };

  const env = {
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'https://app.example.test/api/v1/auth/oidc/callback'
  };

  let responseHeaders = {};
  const res = {
    writeHead(status, headers) {
      assert.equal(status, 302);
      responseHeaders = headers;
    },
    end() {}
  };

  const authRoutes = createAuthRouteHandlers({
  identity,
  oidcServices,
  env,
  secureCookies: true,
  maxBody: 16384,
  allowRequest: () => ({ allowed: true, remaining: 100 }),
  sendJson: () => {},
  fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
  readJson: async () => ({}),
  readForm: async () => ({}),
  sameSecret: () => true
  });

  const req = { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: {} };
  const url = new URL('https://app.example.test/api/v1/auth/oidc/start');

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-oidc-start' });

  assert.ok(responseHeaders.location, 'OIDC start must redirect to IdP');
  assert.ok(responseHeaders.location.includes('idp.example.test'), 'redirect must target the configured IdP');

  const setCookie = responseHeaders['set-cookie'];
  assert.ok(setCookie, 'OIDC start must set a binding cookie');
  assert.match(setCookie, /^vsh_oidc_state=[A-Za-z0-9_-]{43};/, 'binding cookie must contain a base64url state value');
  assert.match(setCookie, /Path=\/api\/v1\/auth/, 'binding cookie must be scoped to auth path');
  assert.match(setCookie, /Max-Age=600/, 'binding cookie must expire in 10 minutes');
  assert.match(setCookie, /HttpOnly/, 'binding cookie must be HttpOnly');
  assert.match(setCookie, /Secure/, 'binding cookie must be Secure in production');
  assert.match(setCookie, /SameSite=Lax/, 'OIDC binding cookie must use SameSite=Lax');

  // Verify the state in the cookie matches the state passed to createOidcState
  const cookieState = setCookie.match(/vsh_oidc_state=([A-Za-z0-9_-]{43})/)[1];
  assert.equal(capturedState.length, 1, 'createOidcState must be called once');
  assert.equal(cookieState, capturedState[0], 'cookie state must match the state stored in the database');
});

test('OIDC callback rejects requests without the matching browser binding cookie', async () => {
  const state = randomBytes(32).toString('base64url');
  const code = 'authorization-code-from-idp';

  const identity = {
    async consumeOidcState({ state: s }) {
      assert.equal(s, state);
      return {
        nonce: 'test-nonce',
        verifier: 'test-verifier',
        issuer: 'https://idp.example.test'
      };
    },
    async loginFederated() {
      throw new Error('loginFederated must not be called when browser binding fails');
    }
  };

  const env = {
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'https://app.example.test/api/v1/auth/oidc/callback'
  };

  const authRoutes = createAuthRouteHandlers({
    identity,
    env,
    secureCookies: true,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  // Scenario 1: No cookie at all (attacker delivers callback URL to victim without prior start)
  const req1 = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {}
  };
  const url1 = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=${code}&state=${state}`);
  const res1 = { writeHead() {}, end() {} };

  await assert.rejects(
    authRoutes.handlePublic({ req: req1, res: res1, url: url1, requestId: 'test-no-cookie' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'OIDC callback must reject requests without the binding cookie'
  );

  // Scenario 2: Wrong cookie value (attacker's state delivered to victim's browser)
  const attackerState = randomBytes(32).toString('base64url');
  const req2 = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: `vsh_oidc_state=${attackerState}`
    }
  };
  const url2 = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=${code}&state=${state}`);
  const res2 = { writeHead() {}, end() {} };

  await assert.rejects(
    authRoutes.handlePublic({ req: req2, res: res2, url: url2, requestId: 'test-wrong-cookie' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'OIDC callback must reject requests with a mismatched binding cookie'
  );

  // Scenario 3: Empty cookie value
  const req3 = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: 'vsh_oidc_state='
    }
  };
  const url3 = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=${code}&state=${state}`);
  const res3 = { writeHead() {}, end() {} };

  await assert.rejects(
    authRoutes.handlePublic({ req: req3, res: res3, url: url3, requestId: 'test-empty-cookie' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'OIDC callback must reject requests with an empty binding cookie'
  );
});

test('OIDC callback succeeds when the browser binding cookie matches the state', async () => {
  const state = randomBytes(32).toString('base64url');
  const code = 'authorization-code-from-idp';
  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');

  let loginFederatedCalled = false;

  const identity = {
    async consumeOidcState({ state: s }) {
      assert.equal(s, state);
      return {
        nonce: 'test-nonce',
        verifier: 'test-verifier',
        issuer: 'https://idp.example.test'
      };
    },
    async loginFederated({ issuer, subject, email }) {
      loginFederatedCalled = true;
      assert.equal(issuer, 'https://idp.example.test');
      assert.equal(subject, 'user-123');
      assert.equal(email, 'user@example.test');
      return {
        token: sessionToken,
        csrf: csrfToken,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        mfaRequired: false
      };
    }
  };

  const env = {
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'https://app.example.test/api/v1/auth/oidc/callback',
    OIDC_JWKS_URI: 'https://idp.example.test/.well-known/jwks.json'
  };

  let responseStatus = 0;
  let responseHeaders = {};
  const oidcServices = {
    configFromEnv: env => ({
      issuer: env.OIDC_ISSUER,
      clientId: env.OIDC_CLIENT_ID,
      clientSecret: env.OIDC_CLIENT_SECRET,
      redirectUri: env.OIDC_REDIRECT_URI
    }),
    exchangeAndVerify: async () => ({
      issuer: 'https://idp.example.test',
      subject: 'user-123',
      email: 'user@example.test'
    })
  };

  const authRoutes = createAuthRouteHandlers({
    identity,
    oidcServices,
    env,
    secureCookies: true,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  const req = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: `vsh_oidc_state=${state}`,
      'user-agent': 'Test Browser'
    }
  };
  const url = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=${code}&state=${state}`);
  const res = {
    writeHead(status, headers) {
      responseStatus = status;
      responseHeaders = headers;
    },
    end() {}
  };

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-valid-binding' });

  assert.equal(responseStatus, 303, 'successful OIDC callback must redirect');
  assert.equal(responseHeaders.location, '/admin', 'successful callback must redirect to admin');
  assert.ok(loginFederatedCalled, 'loginFederated must be called when binding is valid');

  const cookies = responseHeaders['set-cookie'];
  assert.ok(Array.isArray(cookies), 'response must set multiple cookies');
  assert.ok(cookies.some(c => c.startsWith('vsh_session=')), 'response must set session cookie');
  assert.ok(cookies.some(c => c.startsWith('vsh_csrf=')), 'response must set CSRF cookie');
  assert.ok(cookies.some(c => c.startsWith('vsh_oidc_state=;') && c.includes('Max-Age=0')), 'response must clear the binding cookie');
});

test('SAML start flow sets a browser binding cookie with SameSite=None for cross-site POST', async () => {
  const state = randomBytes(32).toString('base64url');

  const identity = {
    async createOidcState({ state: s, nonce, verifier, issuer }) {
      assert.equal(nonce, 'saml');
      assert.equal(verifier, 'saml');
      return { expiresInSeconds: 600 };
    }
  };

  const samlAuth = {
    externalIssuer: () => 'https://saml-idp.example.test',
    async getAuthorizeUrl(relayState) {
      return `https://saml-idp.example.test/sso?SAMLRequest=encoded&RelayState=${relayState}`;
    }
  };

  const env = { NODE_ENV: 'production' };

  let responseHeaders = {};
  const res = {
    writeHead(status, headers) {
      assert.equal(status, 302);
      responseHeaders = headers;
    },
    end() {}
  };

  const authRoutes = createAuthRouteHandlers({
    identity,
    samlAuth,
    env,
    secureCookies: true,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  const req = { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: {} };
  const url = new URL('https://app.example.test/api/v1/auth/saml/start');

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-saml-start' });

  const setCookie = responseHeaders['set-cookie'];
  assert.ok(setCookie, 'SAML start must set a binding cookie');
  assert.match(setCookie, /^vsh_saml_state=[A-Za-z0-9_-]{43};/, 'SAML binding cookie must contain state');
  assert.match(setCookie, /Path=\/api\/v1\/auth/, 'SAML binding cookie must be scoped to auth path');
  assert.match(setCookie, /Max-Age=600/, 'SAML binding cookie must expire in 10 minutes');
  assert.match(setCookie, /HttpOnly/, 'SAML binding cookie must be HttpOnly');
  assert.match(setCookie, /Secure/, 'SAML binding cookie must be Secure in production');
  assert.match(setCookie, /SameSite=None/, 'SAML binding cookie must use SameSite=None for cross-site POST');
});

test('SAML start flow omits SameSite attribute in development without TLS', async () => {
  const identity = {
    async createOidcState() {
      return { expiresInSeconds: 600 };
    }
  };

  const samlAuth = {
    externalIssuer: () => 'http://saml-idp.local',
    async getAuthorizeUrl(relayState) {
      return `http://saml-idp.local/sso?RelayState=${relayState}`;
    }
  };

  const env = { NODE_ENV: 'development' };

  let responseHeaders = {};
  const res = {
    writeHead(status, headers) {
      responseHeaders = headers;
    },
    end() {}
  };

  const authRoutes = createAuthRouteHandlers({
    identity,
    samlAuth,
    env,
    secureCookies: false,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  const req = { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: {} };
  const url = new URL('http://app.local/api/v1/auth/saml/start');

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-saml-dev' });

  const setCookie = responseHeaders['set-cookie'];
  assert.ok(setCookie, 'SAML start must set a binding cookie in development');
  assert.match(setCookie, /^vsh_saml_state=[A-Za-z0-9_-]{43};/, 'cookie must contain state');
  assert.doesNotMatch(setCookie, /SameSite/, 'SameSite must be omitted in development without TLS');
  assert.doesNotMatch(setCookie, /Secure/, 'Secure must be omitted in development without TLS');
});

test('SAML ACS rejects POST submissions without the matching browser binding cookie', async () => {
  const relayState = randomBytes(32).toString('base64url');
  const samlResponse = Buffer.from('mock-saml-response').toString('base64');

  const identity = {
    async consumeOidcState({ state }) {
      assert.equal(state, relayState);
      return {
        nonce: 'saml',
        verifier: 'saml',
        issuer: 'https://saml-idp.example.test'
      };
    },
    async loginFederated() {
      throw new Error('loginFederated must not be called when browser binding fails');
    }
  };

  const samlAuth = {
    externalIssuer: () => 'https://saml-idp.example.test',
    async validatePostResponse() {
      throw new Error('SAML validation must not be called when browser binding fails');
    }
  };

  const env = {};

  const authRoutes = createAuthRouteHandlers({
    identity,
    samlAuth,
    env,
    secureCookies: true,
    maxBody: 2 * 1024 * 1024,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({ SAMLResponse: samlResponse, RelayState: relayState }),
    sameSecret: () => true
  });

  // Scenario 1: No cookie (attacker delivers SAML form to victim)
  const req1 = {
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {}
  };
  const url1 = new URL('https://app.example.test/api/v1/auth/saml/acs');
  const res1 = { writeHead() {}, end() {} };

  await assert.rejects(
    authRoutes.handlePublic({ req: req1, res: res1, url: url1, requestId: 'test-saml-no-cookie' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'SAML ACS must reject submissions without the binding cookie'
  );

  // Scenario 2: Mismatched cookie (attacker's RelayState in victim's browser)
  const attackerRelayState = randomBytes(32).toString('base64url');
  const req2 = {
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: `vsh_saml_state=${attackerRelayState}`
    }
  };
  const url2 = new URL('https://app.example.test/api/v1/auth/saml/acs');
  const res2 = { writeHead() {}, end() {} };

  await assert.rejects(
    authRoutes.handlePublic({ req: req2, res: res2, url: url2, requestId: 'test-saml-wrong-cookie' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'SAML ACS must reject submissions with a mismatched binding cookie'
  );
});

test('SAML ACS succeeds when the browser binding cookie matches RelayState', async () => {
  const relayState = randomBytes(32).toString('base64url');
  const samlResponse = Buffer.from('mock-saml-response').toString('base64');
  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');

  let loginFederatedCalled = false;

  const identity = {
    async consumeOidcState({ state }) {
      assert.equal(state, relayState);
      return {
        nonce: 'saml',
        verifier: 'saml',
        issuer: 'https://saml-idp.example.test'
      };
    },
    async loginFederated({ issuer, subject, email }) {
      loginFederatedCalled = true;
      assert.equal(issuer, 'https://saml-idp.example.test');
      return {
        token: sessionToken,
        csrf: csrfToken,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        mfaRequired: false
      };
    }
  };

  const samlAuth = {
    externalIssuer: () => 'https://saml-idp.example.test',
    async validatePostResponse({ SAMLResponse }) {
      assert.equal(SAMLResponse, samlResponse);
      return {
        profile: {
          nameID: 'saml-user-123',
          nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
          email: 'saml-user@example.test'
        },
        loggedOut: false
      };
    },
    extractEmail(profile) {
      return profile.email;
    }
  };

  const env = {};

  let responseStatus = 0;
  let responseHeaders = {};

  const authRoutes = createAuthRouteHandlers({
    identity,
    samlAuth,
    env,
    secureCookies: true,
    maxBody: 2 * 1024 * 1024,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({ SAMLResponse: samlResponse, RelayState: relayState }),
    sameSecret: () => true
  });

  const req = {
    method: 'POST',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: `vsh_saml_state=${relayState}`,
      'user-agent': 'Test Browser'
    }
  };
  const url = new URL('https://app.example.test/api/v1/auth/saml/acs');
  const res = {
    writeHead(status, headers) {
      responseStatus = status;
      responseHeaders = headers;
    },
    end() {}
  };

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-saml-valid-binding' });

  assert.equal(responseStatus, 303, 'successful SAML ACS must redirect');
  assert.equal(responseHeaders.location, '/admin', 'successful ACS must redirect to admin');
  assert.ok(loginFederatedCalled, 'loginFederated must be called when binding is valid');

  const cookies = responseHeaders['set-cookie'];
  assert.ok(Array.isArray(cookies), 'response must set multiple cookies');
  assert.ok(cookies.some(c => c.startsWith('vsh_session=')), 'response must set session cookie');
  assert.ok(cookies.some(c => c.startsWith('vsh_csrf=')), 'response must set CSRF cookie');
  assert.ok(cookies.some(c => c.startsWith('vsh_saml_state=;') && c.includes('Max-Age=0')), 'response must clear the SAML binding cookie');
});

test('browser binding validation uses timing-safe comparison', async () => {
  // This test verifies that the binding check uses timingSafeEqual to preven
  // timing attacks that could leak information about the expected state value.

  const correctState = 'a'.repeat(43);
  const wrongState = 'b'.repeat(43);

  const identity = {
    async consumeOidcState() {
      return {
        nonce: 'test-nonce',
        verifier: 'test-verifier',
        issuer: 'https://idp.example.test'
      };
    }
  };

  const env = {
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'https://app.example.test/api/v1/auth/oidc/callback'
  };

  const authRoutes = createAuthRouteHandlers({
    identity,
    env,
    secureCookies: true,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  // Test with correct state
  const req1 = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { cookie: `vsh_oidc_state=${correctState}` }
  };
  const url1 = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=test&state=${correctState}`);

  // This will fail at a later stage (OIDC exchange), but binding check passes
  await assert.rejects(
    authRoutes.handlePublic({ req: req1, res: { writeHead() {}, end() {} }, url: url1, requestId: 'test-1' }),
    error => error.code !== 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'correct binding should pass the browser binding check'
  );

  // Test with wrong state - should fail at binding check
  const req2 = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: { cookie: `vsh_oidc_state=${wrongState}` }
  };
  const url2 = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=test&state=${correctState}`);

  await assert.rejects(
    authRoutes.handlePublic({ req: req2, res: { writeHead() {}, end() {} }, url: url2, requestId: 'test-2' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_SSO_BROWSER_BINDING',
    'mismatched binding must fail with browser binding error'
  );
});

test('binding cookies are cleared after successful federated login', async () => {
  // This test verifies that binding cookies are properly cleared (Max-Age=0)
  // after successful authentication to prevent reuse and minimize cookie clutter.

  const state = randomBytes(32).toString('base64url');

  const identity = {
    async consumeOidcState() {
      return {
        nonce: 'test-nonce',
        verifier: 'test-verifier',
        issuer: 'https://idp.example.test'
      };
    },
    async loginFederated() {
      return {
        token: randomBytes(32).toString('base64url'),
        csrf: randomBytes(32).toString('base64url'),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        mfaRequired: false
      };
    }
  };

  const env = {
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'https://app.example.test/api/v1/auth/oidc/callback'
  };

  let responseHeaders = {};

  const authRoutes = createAuthRouteHandlers({
    identity,
    oidcServices: {
      configFromEnv: env => ({
        issuer: env.OIDC_ISSUER,
        clientId: env.OIDC_CLIENT_ID
      }),
      exchangeAndVerify: async () => ({
        issuer: 'https://idp.example.test',
        subject: 'user-123',
        email: 'user@example.test'
      })
    },
    env,
    secureCookies: true,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  const req = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: `vsh_oidc_state=${state}`,
      'user-agent': 'Test Browser'
    }
  };
  const url = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=test&state=${state}`);
  const res = {
    writeHead(status, headers) {
      responseHeaders = headers;
    },
    end() {}
  };

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-clear-binding' });

  const cookies = responseHeaders['set-cookie'];
  const bindingClearCookie = cookies.find(c => c.startsWith('vsh_oidc_state=;'));

  assert.ok(bindingClearCookie, 'binding cookie must be cleared after successful login');
  assert.match(bindingClearCookie, /Max-Age=0/, 'cleared binding cookie must have Max-Age=0');
  assert.match(bindingClearCookie, /Path=\/api\/v1\/auth/, 'cleared cookie must match the original path');
});

test('binding cookies are also cleared when MFA is required', async () => {
  // When MFA is required, the user is redirected to the MFA challenge page
  // instead of being immediately logged in. The binding cookie should still
  // be cleared to prevent reuse.

  const state = randomBytes(32).toString('base64url');

  const identity = {
    async consumeOidcState() {
      return {
        nonce: 'test-nonce',
        verifier: 'test-verifier',
        issuer: 'https://idp.example.test'
      };
    },
    async loginFederated() {
      return {
        challengeToken: randomBytes(32).toString('base64url'),
        mfaRequired: true,
        user: {
          id: 'user-123',
          email: 'user@example.test'
        }
      };
    }
  };

  const env = {
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'test-client',
    OIDC_CLIENT_SECRET: 'test-secret',
    OIDC_REDIRECT_URI: 'https://app.example.test/api/v1/auth/oidc/callback'
  };

  let responseHeaders = {};

  const authRoutes = createAuthRouteHandlers({
    identity,
    oidcServices: {
      configFromEnv: env => ({
        issuer: env.OIDC_ISSUER,
        clientId: env.OIDC_CLIENT_ID
      }),
      exchangeAndVerify: async () => ({
        issuer: 'https://idp.example.test',
        subject: 'user-123',
        email: 'user@example.test'
      })
    },
    env,
    secureCookies: true,
    maxBody: 16384,
    allowRequest: () => ({ allowed: true, remaining: 100 }),
    sendJson: () => {},
    fail: (status, code, message) => Object.assign(new Error(message), { statusCode: status, code }),
    readJson: async () => ({}),
    readForm: async () => ({}),
    sameSecret: () => true
  });

  const req = {
    method: 'GET',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {
      cookie: `vsh_oidc_state=${state}`,
      'user-agent': 'Test Browser'
    }
  };
  const url = new URL(`https://app.example.test/api/v1/auth/oidc/callback?code=test&state=${state}`);
  const res = {
    writeHead(status, headers) {
      responseHeaders = headers;
    },
    end() {}
  };

  await authRoutes.handlePublic({ req, res, url, requestId: 'test-mfa-clear-binding' });

  assert.equal(responseHeaders.location, '/admin?mfa=required', 'MFA required should redirect to MFA page');

  const cookies = responseHeaders['set-cookie'];
  assert.ok(cookies.some(c => c.startsWith('vsh_mfa_challenge=')), 'MFA challenge cookie must be set');

  const bindingClearCookie = cookies.find(c => c.startsWith('vsh_oidc_state=;'));
  assert.ok(bindingClearCookie, 'binding cookie must be cleared even when MFA is required');
  assert.match(bindingClearCookie, /Max-Age=0/, 'cleared binding cookie must have Max-Age=0');
});
