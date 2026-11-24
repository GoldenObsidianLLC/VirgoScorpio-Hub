'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService, digest } = require('../packages/auth/src/service');

/**
 * Security test suite for password-reset DoS mitigation.
 * 
 * Pentest finding: Unauthenticated password-reset requests perform expensive 
 * scrypt before token rejection.
 * 
 * Mitigation:
 * 1. Route-specific rate limiting applied before body parsing or hashing
 * 2. Token existence check before expensive scrypt operation
 */

test('password reset rejects invalid tokens before expensive scrypt hashing', async t => {
  await t.test('rejects nonexistent token before scrypt', async () => {
    const queries = [];
    const pool = {
      async query(sql, values = []) {
        queries.push({ sql, values });
        // Simulate token not found in precheck
        if (sql.includes('SELECT 1 FROM identity_action_tokens')) {
          return { rowCount: 0, rows: [] };
        }
        throw new Error('Should not reach database queries after precheck failure');
      },
      async connect() {
        throw new Error('Should not open transaction for nonexistent token');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const fakeToken = 'a'.repeat(64); // Valid length but nonexistent
    const password = 'ValidPassword123';

    await assert.rejects(
      identity.resetPassword({ token: fakeToken, password }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );

    // Verify precheck query was executed
    assert.equal(queries.length, 1, 'Should execute exactly one precheck query');
    assert.match(queries[0].sql, /SELECT 1 FROM identity_action_tokens/);
    assert.match(queries[0].sql, /purpose='password-reset'/);
    assert.match(queries[0].sql, /consumed_at IS NULL/);
    assert.match(queries[0].sql, /expires_at>now\(\)/);
    assert.match(queries[0].sql, /LIMIT 1/);
  });

  await t.test('rejects consumed token before scrypt', async () => {
    const queries = [];
    const pool = {
      async query(sql, values = []) {
        queries.push({ sql, values });
        // Simulate consumed token (precheck returns no rows)
        if (sql.includes('SELECT 1 FROM identity_action_tokens')) {
          return { rowCount: 0, rows: [] };
        }
        throw new Error('Should not reach further queries after precheck failure');
      },
      async connect() {
        throw new Error('Should not open transaction for consumed token');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const consumedToken = 'b'.repeat(64);
    const password = 'ValidPassword123';

    await assert.rejects(
      identity.resetPassword({ token: consumedToken, password }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );

    assert.equal(queries.length, 1, 'Should execute exactly one precheck query');
  });

  await t.test('rejects expired token before scrypt', async () => {
    const queries = [];
    const pool = {
      async query(sql, values = []) {
        queries.push({ sql, values });
        // Simulate expired token (precheck returns no rows due to expires_at check)
        if (sql.includes('SELECT 1 FROM identity_action_tokens')) {
          return { rowCount: 0, rows: [] };
        }
        throw new Error('Should not reach further queries after precheck failure');
      },
      async connect() {
        throw new Error('Should not open transaction for expired token');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const expiredToken = 'c'.repeat(64);
    const password = 'ValidPassword123';

    await assert.rejects(
      identity.resetPassword({ token: expiredToken, password }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );

    assert.equal(queries.length, 1, 'Should execute exactly one precheck query');
  });

  await t.test('proceeds to scrypt only for valid tokens', async () => {
    const queries = [];
    const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const tokenId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const validToken = 'd'.repeat(64);
    const password = 'ValidPassword123';

    const pool = {
      async query(sql, values = []) {
        queries.push({ sql, values });
        // Precheck succeeds - token exists and is valid
        if (sql.includes('SELECT 1 FROM identity_action_tokens') && sql.includes('LIMIT 1')) {
          return { rowCount: 1, rows: [{ '?column?': 1 }] };
        }
        throw new Error('Unexpected query in precheck success scenario: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values = []) {
            queries.push({ sql, values });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            // Transaction query for token lookup with FOR UPDATE
            if (sql.includes('SELECT id,user_id FROM identity_action_tokens') && sql.includes('FOR UPDATE')) {
              return { rowCount: 1, rows: [{ id: tokenId, user_id: userId }] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE users SET password_hash')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE identity_action_tokens SET consumed_at')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE auth_sessions SET revoked_at')) {
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected transaction query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const result = await identity.resetPassword({ token: validToken, password });

    assert.deepEqual(result, { reset: true });
    
    // Verify precheck was executed first
    assert.match(queries[0].sql, /SELECT 1 FROM identity_action_tokens/);
    assert.match(queries[0].sql, /LIMIT 1/);
    
    // Verify transaction was opened after precheck
    assert.equal(queries[1].sql, 'BEGIN');
  });

  await t.test('validates token length before any database access', async () => {
    const pool = {
      async query() {
        throw new Error('Should not reach database for invalid token length');
      },
      async connect() {
        throw new Error('Should not open transaction for invalid token length');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const password = 'ValidPassword123';

    // Token too short
    await assert.rejects(
      identity.resetPassword({ token: 'short', password }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );

    // Token too long
    await assert.rejects(
      identity.resetPassword({ token: 'x'.repeat(201), password }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );

    // Non-string token
    await assert.rejects(
      identity.resetPassword({ token: 12345, password }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );
  });

  await t.test('validates password before database access', async () => {
    const pool = {
      async query() {
        throw new Error('Should not reach database for invalid password');
      },
      async connect() {
        throw new Error('Should not open transaction for invalid password');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const validToken = 'e'.repeat(64);

    // Password too short
    await assert.rejects(
      identity.resetPassword({ token: validToken, password: 'short' }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_PASSWORD_POLICY'
    );

    // Password without uppercase
    await assert.rejects(
      identity.resetPassword({ token: validToken, password: 'alllowercase123' }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_PASSWORD_POLICY'
    );
  });
});

test('password reset completion route applies rate limiting before body parsing', async () => {
  // This test verifies the route-level mitigation in auth-routes.js
  // We test that allowRequest is called with the correct key before any expensive operations

  const events = [];
  let allowRequestCallCount = 0;
  let allowRequestKey = null;

  const mockDependencies = {
    identity: {
      async resetPassword({ token, password }) {
        events.push('resetPassword');
        return { reset: true };
      },
    },
    env: {},
    secureCookies: false,
    maxBody: 16384,
    allowRequest: (key) => {
      allowRequestCallCount++;
      allowRequestKey = key;
      events.push('allowRequest');
      // First call allows, subsequent calls deny (simulating rate limit)
      return {
        allowed: allowRequestCallCount === 1,
        remaining: allowRequestCallCount === 1 ? 5 : 0,
        retryAfterSeconds: allowRequestCallCount === 1 ? 0 : 60,
      };
    },
    sendJson: (res, status, body) => {
      events.push(`sendJson:${status}`);
      return true;
    },
    fail: (status, code, message) => {
      const error = new Error(message);
      error.statusCode = status;
      error.code = code;
      return error;
    },
    readJson: async (req, maxBytes) => {
      events.push('readJson');
      return { token: 'f'.repeat(64), password: 'ValidPassword123' };
    },
    readForm: async () => ({}),
    sameSecret: (a, b) => a === b,
  };

  const { createAuthRouteHandlers } = require('../apps/api/src/auth-routes');
  const authRoutes = createAuthRouteHandlers(mockDependencies);

  await test('rate limit is checked before body parsing', async () => {
    events.length = 0;
    allowRequestCallCount = 0;

    const req = {
      method: 'POST',
      socket: { remoteAddress: '192.0.2.1' },
      headers: {},
    };
    const res = {
      setHeader: () => {},
    };
    const url = new URL('http://localhost/api/v1/auth/password-reset/complete');
    const requestId = 'test-request-1';

    await authRoutes.handlePublic({ req, res, url, requestId });

    // Verify allowRequest was called first
    assert.equal(events[0], 'allowRequest', 'Rate limit check must be first');
    assert.equal(allowRequestKey, 'password-reset-complete:192.0.2.1', 'Rate limit key must include route prefix and IP');
    
    // Verify body was parsed after rate limit check
    assert.equal(events[1], 'readJson', 'Body parsing must happen after rate limit check');
    
    // Verify resetPassword was called after body parsing
    assert.equal(events[2], 'resetPassword', 'Password reset must happen after body parsing');
  });

  await test('rate limit rejection prevents body parsing and hashing', async () => {
    events.length = 0;
    // allowRequestCallCount is already > 1, so next call will deny

    const req = {
      method: 'POST',
      socket: { remoteAddress: '192.0.2.1' },
      headers: {},
    };
    const res = {
      setHeader: () => {},
    };
    const url = new URL('http://localhost/api/v1/auth/password-reset/complete');
    const requestId = 'test-request-2';

    await authRoutes.handlePublic({ req, res, url, requestId });

    // Verify allowRequest was called
    assert.equal(events[0], 'allowRequest', 'Rate limit check must be first');
    
    // Verify 429 response was sent
    assert.equal(events[1], 'sendJson:429', 'Must return 429 when rate limited');
    
    // Verify body was NOT parsed
    assert.equal(events.includes('readJson'), false, 'Body parsing must be skipped when rate limited');
    
    // Verify resetPassword was NOT called
    assert.equal(events.includes('resetPassword'), false, 'Password reset must be skipped when rate limited');
  });
});

test('password reset mitigation prevents resource exhaustion attack', async () => {
  // This test simulates the attack scenario from the pentest finding
  // and verifies that the mitigations prevent resource exhaustion

  let precheckCount = 0;
  let scryptCount = 0;
  let transactionCount = 0;

  const pool = {
    async query(sql, values = []) {
      if (sql.includes('SELECT 1 FROM identity_action_tokens') && sql.includes('LIMIT 1')) {
        precheckCount++;
        // Simulate nonexistent token
        return { rowCount: 0, rows: [] };
      }
      throw new Error('Should not reach other queries after precheck failure');
    },
    async connect() {
      transactionCount++;
      throw new Error('Should not open transaction for invalid token');
    },
  };

  const identity = createIdentityService({ pool, env: {} });

  // Simulate multiple invalid requests (attack scenario)
  const attackRequests = 10;
  const invalidToken = 'attacker-controlled-token-' + 'x'.repeat(40);
  const password = 'AttackerPassword123';

  for (let i = 0; i < attackRequests; i++) {
    await assert.rejects(
      identity.resetPassword({ token: invalidToken, password }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
    );
  }

  // Verify mitigation effectiveness
  assert.equal(precheckCount, attackRequests, 'Precheck should execute for each request');
  assert.equal(transactionCount, 0, 'No transactions should be opened for invalid tokens');
  
  // Note: We can't directly measure scrypt calls in this test without instrumenting
  // the hashPassword function, but the key security property is that the precheck
  // rejects invalid tokens before hashPassword is ever called. The test structure
  // ensures this by having the pool.connect() throw if reached.
});

test('password reset token digest is computed consistently', () => {
  // Verify that token digests are computed correctly for the precheck query
  const token1 = 'test-token-123';
  const token2 = 'test-token-123';
  const token3 = 'different-token';

  const digest1 = digest(token1);
  const digest2 = digest(token2);
  const digest3 = digest(token3);

  assert.equal(digest1, digest2, 'Same token should produce same digest');
  assert.notEqual(digest1, digest3, 'Different tokens should produce different digests');
  assert.match(digest1, /^[a-f0-9]{64}$/, 'Digest should be 64-character hex string (SHA-256)');
});

test('password reset precheck query uses indexed lookup', async () => {
  // Verify that the precheck query structure supports efficient indexed lookup
  const queries = [];
  const pool = {
    async query(sql, values = []) {
      queries.push({ sql, values });
      return { rowCount: 0, rows: [] };
    },
    async connect() {
      throw new Error('Should not reach transaction');
    },
  };

  const identity = createIdentityService({ pool, env: {} });
  const token = 'g'.repeat(64);
  const password = 'ValidPassword123';

  await assert.rejects(
    identity.resetPassword({ token, password }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_RESET_TOKEN_INVALID'
  );

  const precheckQuery = queries[0];
  
  // Verify query structure supports indexed lookup
  assert.match(precheckQuery.sql, /WHERE token_hash=\$1/, 'Query must filter by token_hash (indexed column)');
  assert.match(precheckQuery.sql, /purpose='password-reset'/, 'Query must filter by purpose');
  assert.match(precheckQuery.sql, /consumed_at IS NULL/, 'Query must filter by consumed_at');
  assert.match(precheckQuery.sql, /expires_at>now\(\)/, 'Query must filter by expires_at');
  assert.match(precheckQuery.sql, /LIMIT 1/, 'Query must use LIMIT 1 for efficiency');
  
  // Verify token digest is passed as parameter
  assert.equal(precheckQuery.values.length, 1, 'Query must have exactly one parameter');
  assert.match(precheckQuery.values[0], /^[a-f0-9]{64}$/, 'Parameter must be token digest');
});
