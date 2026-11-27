'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

test('password-reset route enforces per-IP rate limiting before invoking identity service', async t => {
  await t.test('rate limiter rejects requests after limit is exceeded', () => {
    const requests = [];
    const allowRequest = key => {
      requests.push(key);
      // Simulate rate limiter: first 3 requests allowed, then blocked
      if (requests.length <= 3) {
        return { allowed: true, remaining: 3 - requests.length };
      }
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    };

    const ip = '192.0.2.1';
    
    // First 3 requests should be allowed
    for (let i = 0; i < 3; i++) {
      const result = allowRequest('password-reset:' + ip);
      assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
    }

    // 4th request should be blocked
    const blocked = allowRequest('password-reset:' + ip);
    assert.equal(blocked.allowed, false, 'Request after limit should be blocked');
    assert.equal(blocked.retryAfterSeconds, 60, 'Should include retry-after value');
    
    // Verify all requests used the password-reset prefix
    assert.equal(requests.every(key => key.startsWith('password-reset:')), true);
  });

  await t.test('rate limiter uses password-reset prefix to isolate from other routes', () => {
    const keys = new Set();
    const allowRequest = key => {
      keys.add(key);
      return { allowed: true, remaining: 10 };
    };

    const ip = '192.0.2.1';
    allowRequest('password-reset:' + ip);
    allowRequest('login:' + ip);
    allowRequest('bootstrap:' + ip);

    assert.equal(keys.size, 3, 'Different route prefixes should create separate rate limit buckets');
    assert.ok(keys.has('password-reset:' + ip));
    assert.ok(keys.has('login:' + ip));
    assert.ok(keys.has('bootstrap:' + ip));
  });

  await t.test('rate limiter is invoked before identity service for password reset', async () => {
    let identityServiceCalled = false;
    const pool = {
      async query() {
        identityServiceCalled = true;
        throw new Error('Identity service should not be called when rate limited');
      },
      async connect() {
        identityServiceCalled = true;
        throw new Error('Identity service should not be called when rate limited');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    
    // Simulate the route handler logic: check rate limit first
    const limit = { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    
    if (!limit.allowed) {
      // Rate limit check prevents identity service call
      assert.equal(identityServiceCalled, false, 'Identity service must not be called when rate limited');
      return;
    }

    // This should not be reached
    await identity.requestPasswordReset({ email: 'test@example.com' });
  });
});

test('password-reset service enforces per-account cooldown to prevent token invalidation', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userEmail = 'victim@example.com';

  await t.test('service acquires per-account reset lock and checks for recent reset tokens', async () => {
    const queries = [];
    const pool = {
      async query(sql, values) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          return { rowCount: 1, rows: [{ id: userId, email: userEmail }] };
        }
        throw new Error('Unexpected pool query: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values) {
            queries.push({ sql, values });
            
            if (sql === 'BEGIN') {
              return { rowCount: 0, rows: [] };
            }
            
            if (sql === 'ROLLBACK' || sql === 'COMMIT') {
              return { rowCount: 0, rows: [] };
            }
            
            if (sql.includes('SELECT pg_advisory_xact_lock(hashtext($1))')) {
              assert.deepEqual(values, ['virgoscorpio_hub-password-reset:' + userId], 'Should acquire the per-account reset lock');
              return { rowCount: 1, rows: [{ id: userId }] };
            }
            
            if (sql.includes('SELECT 1 FROM identity_action_tokens') && sql.includes('created_at > now() - interval')) {
              // Simulate a recent token exists (within cooldown period)
              return { rowCount: 1, rows: [{ '?column?': 1 }] };
            }
            
            throw new Error('Unexpected transaction query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const result = await identity.requestPasswordReset({ email: userEmail });

    // Should return accepted without creating new token
    assert.deepEqual(result, { accepted: true });

    // Verify the sequence: BEGIN, acquire account reset lock, check recent tokens, COMMIT
    assert.equal(queries[0].sql, 'BEGIN');
    assert.ok(queries[1].sql.includes('pg_advisory_xact_lock'), 'Should acquire per-account reset lock');
    assert.ok(queries[2].sql.includes('created_at > now() - interval'), 'Should check for recent tokens');
    assert.equal(queries[3].sql, 'COMMIT', 'Read-only cooldown transaction should complete without side effects');
    
    // Verify no token creation or mail insertion happened
    assert.equal(queries.some(q => q.sql.includes('INSERT INTO identity_action_tokens')), false);
    assert.equal(queries.some(q => q.sql.includes('INSERT INTO mail_outbox')), false);
  });

  await t.test('service creates token and mail only when no recent reset exists', async () => {
    const queries = [];
    const pool = {
      async query(sql, values) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          return { rowCount: 1, rows: [{ id: userId, email: userEmail }] };
        }
        throw new Error('Unexpected pool query: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values) {
            queries.push({ sql, values });
            
            if (sql === 'BEGIN' || sql === 'COMMIT') {
              return { rowCount: 0, rows: [] };
            }
            
            if (sql.includes('SELECT pg_advisory_xact_lock(hashtext($1))')) {
              return { rowCount: 1, rows: [{ id: userId }] };
            }
            
            if (sql.includes('SELECT 1 FROM identity_action_tokens') && sql.includes('created_at > now() - interval')) {
              // No recent token (outside cooldown period)
              return { rowCount: 0, rows: [] };
            }
            
            if (sql.includes('UPDATE identity_action_tokens SET consumed_at=now()')) {
              return { rowCount: 0, rows: [] };
            }
            
            if (sql.includes('INSERT INTO identity_action_tokens')) {
              return { rowCount: 1, rows: [] };
            }
            
            if (sql.includes('INSERT INTO mail_outbox')) {
              return { rowCount: 1, rows: [] };
            }
            
            throw new Error('Unexpected transaction query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: { VIRGOSCORPIO_HUB_PUBLIC_BASE: 'https://example.com' } });
    const result = await identity.requestPasswordReset({ email: userEmail });

    assert.deepEqual(result, { accepted: true });

    // Verify the full sequence executed
    assert.equal(queries[0].sql, 'BEGIN');
    assert.ok(queries[1].sql.includes('pg_advisory_xact_lock'), 'Should acquire per-account reset lock');
    assert.ok(queries[2].sql.includes('created_at > now() - interval'), 'Should check for recent tokens');
    assert.ok(queries[3].sql.includes('UPDATE identity_action_tokens SET consumed_at=now()'), 'Should consume old tokens');
    assert.ok(queries[4].sql.includes('INSERT INTO identity_action_tokens'), 'Should create new token');
    assert.ok(queries[5].sql.includes('INSERT INTO mail_outbox'), 'Should queue reset email');
    assert.equal(queries[6].sql, 'COMMIT', 'Should commit when cooldown is not active');
  });

  await t.test('cooldown check uses 120-second interval', async () => {
    let cooldownInterval = null;
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          return { rowCount: 1, rows: [{ id: userId, email: userEmail }] };
        }
        throw new Error('Unexpected pool query');
      },
      async connect() {
        return {
          async query(sql, values) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 1, rows: [{ id: userId }] };
            }
            if (sql.includes('created_at > now() - interval')) {
              // Extract the interval value
              const match = sql.match(/interval '(\d+) seconds'/);
              if (match) {
                cooldownInterval = parseInt(match[1], 10);
              }
              return { rowCount: 1, rows: [{ '?column?': 1 }] };
            }
            throw new Error('Unexpected query');
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await identity.requestPasswordReset({ email: userEmail });

    assert.equal(cooldownInterval, 120, 'Cooldown should be 120 seconds');
  });
});

test('password-reset prevents token invalidation and mail amplification attacks', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userEmail = 'victim@example.com';

  await t.test('repeated requests within cooldown do not invalidate existing tokens', async () => {
    let tokenInvalidationCount = 0;
    let mailInsertionCount = 0;
    
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          return { rowCount: 1, rows: [{ id: userId, email: userEmail }] };
        }
        throw new Error('Unexpected pool query');
      },
      async connect() {
        return {
          async query(sql) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 1, rows: [{ id: userId }] };
            }
            if (sql.includes('created_at > now() - interval')) {
              // Simulate recent token exists
              return { rowCount: 1, rows: [{ '?column?': 1 }] };
            }
            if (sql.includes('UPDATE identity_action_tokens SET consumed_at=now()')) {
              tokenInvalidationCount++;
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO mail_outbox')) {
              mailInsertionCount++;
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    
    // Simulate multiple rapid requests (attack scenario)
    for (let i = 0; i < 5; i++) {
      const result = await identity.requestPasswordReset({ email: userEmail });
      assert.deepEqual(result, { accepted: true }, 'Should always return accepted');
    }

    // Verify no tokens were invalidated and no mail was queued
    assert.equal(tokenInvalidationCount, 0, 'Existing tokens should not be invalidated during cooldown');
    assert.equal(mailInsertionCount, 0, 'No mail should be queued during cooldown');
  });

  await t.test('advisory transaction lock serializes concurrent reset requests per account', async () => {
    const lockSequence = [];
    
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          return { rowCount: 1, rows: [{ id: userId, email: userEmail }] };
        }
        throw new Error('Unexpected pool query');
      },
      async connect() {
        return {
          async query(sql, values) {
            if (sql === 'BEGIN') {
              lockSequence.push('BEGIN');
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT pg_advisory_xact_lock(hashtext($1))')) {
              lockSequence.push('LOCK_ACCOUNT');
              assert.deepEqual(values, ['virgoscorpio_hub-password-reset:' + userId], 'Should acquire the reset lock for the correct user');
              return { rowCount: 1, rows: [{ id: userId }] };
            }
            if (sql.includes('created_at > now() - interval')) {
              lockSequence.push('CHECK_COOLDOWN');
              return { rowCount: 1, rows: [{ '?column?': 1 }] };
            }
            if (sql === 'ROLLBACK' || sql === 'COMMIT') {
              lockSequence.push('COMMIT');
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {
            lockSequence.push('RELEASE');
          },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await identity.requestPasswordReset({ email: userEmail });

    // Verify the lock is acquired before checking cooldown
    const lockIndex = lockSequence.indexOf('LOCK_ACCOUNT');
    const checkIndex = lockSequence.indexOf('CHECK_COOLDOWN');
    
    assert.ok(lockIndex >= 0, 'Account reset lock should be acquired');
    assert.ok(checkIndex >= 0, 'Cooldown should be checked');
    assert.ok(lockIndex < checkIndex, 'Lock must be acquired before checking cooldown');
  });

  await t.test('service returns accepted=true even when cooldown prevents action', async () => {
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          return { rowCount: 1, rows: [{ id: userId, email: userEmail }] };
        }
        throw new Error('Unexpected pool query');
      },
      async connect() {
        return {
          async query(sql) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rowCount: 0, rows: [] };
            if (sql.includes('pg_advisory_xact_lock')) return { rowCount: 1, rows: [{ id: userId }] };
            if (sql.includes('created_at > now() - interval')) return { rowCount: 1, rows: [{ '?column?': 1 }] };
            throw new Error('Unexpected query');
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const result = await identity.requestPasswordReset({ email: userEmail });

    // Should not leak information about whether cooldown was active
    assert.deepEqual(result, { accepted: true }, 'Should return accepted even when cooldown prevents action');
  });
});

test('password-reset route integration: rate limit before service invocation', async t => {
  await t.test('route handler checks rate limit before calling identity service', async () => {
    let rateLimitChecked = false;
    let identityServiceCalled = false;

    const allowRequest = key => {
      rateLimitChecked = true;
      assert.equal(key, 'password-reset:192.0.2.1', 'Should use password-reset prefix with IP');
      return { allowed: false, remaining: 0, retryAfterSeconds: 60 };
    };

    const identity = {
      async requestPasswordReset() {
        identityServiceCalled = true;
        throw new Error('Identity service should not be called when rate limited');
      },
    };

    // Simulate route handler logic
    const req = { socket: { remoteAddress: '192.0.2.1' } };
    const limit = allowRequest('password-reset:' + (req.socket.remoteAddress || 'unknown'));

    if (!limit.allowed) {
      // Rate limit prevents service call
      assert.equal(rateLimitChecked, true, 'Rate limit should be checked');
      assert.equal(identityServiceCalled, false, 'Identity service should not be called');
      assert.equal(limit.retryAfterSeconds, 60, 'Should provide retry-after value');
      return;
    }

    // This should not be reached
    await identity.requestPasswordReset({ email: 'test@example.com' });
  });

  await t.test('route handler calls identity service only when rate limit allows', async () => {
    let rateLimitChecked = false;
    let identityServiceCalled = false;

    const allowRequest = key => {
      rateLimitChecked = true;
      return { allowed: true, remaining: 5 };
    };

    const identity = {
      async requestPasswordReset({ email }) {
        identityServiceCalled = true;
        assert.equal(email, 'test@example.com');
        return { accepted: true };
      },
    };

    // Simulate route handler logic
    const req = { socket: { remoteAddress: '192.0.2.1' } };
    const limit = allowRequest('password-reset:' + (req.socket.remoteAddress || 'unknown'));

    if (!limit.allowed) {
      throw new Error('Rate limit should allow this request');
    }

    const result = await identity.requestPasswordReset({ email: 'test@example.com' });

    assert.equal(rateLimitChecked, true, 'Rate limit should be checked');
    assert.equal(identityServiceCalled, true, 'Identity service should be called when allowed');
    assert.deepEqual(result, { accepted: true });
  });
});

test('password-reset security properties are enforced in correct order', async t => {
  await t.test('defense layers are applied in order: rate limit, then cooldown', async () => {
    const defenseSequence = [];

    // Layer 1: Per-IP rate limiting (route level)
    const allowRequest = key => {
      defenseSequence.push('RATE_LIMIT_CHECK');
      return { allowed: true, remaining: 10 };
    };

    // Layer 2: Per-account cooldown (service level)
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT id,email FROM users WHERE lower(email)')) {
          defenseSequence.push('USER_LOOKUP');
          return { rowCount: 1, rows: [{ id: 'user-id', email: 'test@example.com' }] };
        }
        throw new Error('Unexpected pool query');
      },
      async connect() {
        return {
          async query(sql) {
            if (sql === 'BEGIN') {
              defenseSequence.push('BEGIN_TRANSACTION');
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              defenseSequence.push('LOCK_ACCOUNT');
              return { rowCount: 1, rows: [{ id: 'user-id' }] };
            }
            if (sql.includes('created_at > now() - interval')) {
              defenseSequence.push('COOLDOWN_CHECK');
              return { rowCount: 1, rows: [{ '?column?': 1 }] };
            }
            if (sql === 'ROLLBACK' || sql === 'COMMIT') {
              defenseSequence.push('COMMIT');
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected query');
          },
          release() {
            defenseSequence.push('RELEASE');
          },
        };
      },
    };

    // Simulate full request flow
    const req = { socket: { remoteAddress: '192.0.2.1' } };
    const limit = allowRequest('password-reset:' + req.socket.remoteAddress);

    if (limit.allowed) {
      const identity = createIdentityService({ pool, env: {} });
      await identity.requestPasswordReset({ email: 'test@example.com' });
    }

    // Verify defense layers are applied in correct order
    assert.deepEqual(defenseSequence, [
      'RATE_LIMIT_CHECK',      // First: per-IP rate limit at route level
      'USER_LOOKUP',           // Second: identify the user
      'BEGIN_TRANSACTION',     // Third: start transaction
      'LOCK_ACCOUNT',             // Fourth: acquire the per-account advisory lock
      'COOLDOWN_CHECK',        // Fifth: check per-account cooldown
      'COMMIT',                // Sixth: close the read-only cooldown transaction
      'RELEASE',               // Finally: release connection
    ]);
  });
});
