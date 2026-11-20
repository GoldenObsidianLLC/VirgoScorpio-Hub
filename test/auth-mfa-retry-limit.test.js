'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

/**
 * Security test: Account-wide MFA retry limit is bypassable through fresh challenge issuance
 *
 * This test verifies that the MFA retry limit is enforced account-wide across all challenges,
 * preventing an attacker from bypassing the limit by repeatedly authenticating with the first
 * factor (password or federated) to obtain fresh challenges.
 *
 * The vulnerability allowed an attacker who knows the password to:
 * 1. Authenticate with password (first factor) to get challenge C1
 * 2. Make 5 failed MFA attempts against C1
 * 3. Authenticate again with password to get challenge C2 (with fresh attempts counter)
 * 4. Make 5 more failed MFA attempts against C2
 * 5. Repeat indefinitely, effectively bypassing the intended 5-attempt limit
 *
 * The fix aggregates MFA failures across all challenges issued to the user within a time window,
 * and enforces an account-wide limit (10 failures in 15 minutes) that cannot be reset by
 * obtaining new challenges.
 */

test('MFA verification enforces account-wide failure limit across multiple challenges', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const challengeId2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const token1 = Buffer.alloc(32, 1).toString('base64url');
  const token2 = Buffer.alloc(32, 2).toString('base64url');
  const secretCiphertext = 'encrypted-secret-data';
  const now = Date.now();

  await t.test('rejects MFA verification when account-wide failure limit is reached', async () => {
    const events = [];
    const pool = {
      async query() {
        throw new Error('MFA verification must use a transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
              events.push('SELECT_CHALLENGE');
              // Return challenge C2 with only 2 attempts on this specific challenge
              return {
                rowCount: 1,
                rows: [{
                  challenge_id: challengeId2,
                  user_id: userId,
                  attempts: 2,
                  id: userId,
                  email: 'user@example.test',
                  display_name: 'Test User',
                  status: 'active',
                  mfa_enabled: true,
                }],
              };
            }
            if (sql.includes('SELECT pg_advisory_xact_lock')) {
              events.push('ACQUIRE_LOCK');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('SELECT COALESCE(SUM(attempts),0)::integer AS failures FROM auth_mfa_challenges')) {
              events.push('CHECK_ACCOUNT_FAILURES');
              // Return 10 total failures across all challenges (C1 had 5, C2 has 2, others have 3)
              // This simulates the scenario where the attacker has exhausted C1 and is now trying C2
              return { rowCount: 1, rows: [{ failures: 10 }] };
            }
            throw new Error('Unexpected MFA verification query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {}, clock: () => now });

    await assert.rejects(
      identity.completeMfaLogin({
        challengeToken: token2,
        code: '123456',
        ip: '203.0.113.42',
        userAgent: 'Test/1.0',
      }),
      error => {
        return error.statusCode === 429 &&
               error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_THROTTLED' &&
               error.message.includes('Too many failed MFA attempts') &&
               error.retryAfterSeconds === 15 * 60;
      }
    );

    assert.deepEqual(events, [
      'BEGIN',
      'SELECT_CHALLENGE',
      'ACQUIRE_LOCK',
      'CHECK_ACCOUNT_FAILURES',
      'ROLLBACK',
      'RELEASE',
    ]);
  });

  await t.test('allows MFA verification when account-wide failures are below the limit', async () => {
    const events = [];
    const pool = {
      async query() {
        throw new Error('MFA verification must use a transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
              events.push('SELECT_CHALLENGE');
              return {
                rowCount: 1,
                rows: [{
                  challenge_id: challengeId1,
                  user_id: userId,
                  attempts: 3,
                  id: userId,
                  email: 'user@example.test',
                  display_name: 'Test User',
                  status: 'active',
                  mfa_enabled: true,
                }],
              };
            }
            if (sql.includes('SELECT pg_advisory_xact_lock')) {
              events.push('ACQUIRE_LOCK');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('SELECT COALESCE(SUM(attempts),0)::integer AS failures FROM auth_mfa_challenges')) {
              events.push('CHECK_ACCOUNT_FAILURES');
              // Only 7 total failures - below the 10 failure limit
              return { rowCount: 1, rows: [{ failures: 7 }] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return {
                rowCount: 1,
                rows: [{
                  secret_ciphertext: secretCiphertext,
                  last_used_step: -1,
                  pending_secret: null,
                }],
              };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET attempts=attempts+1')) {
              events.push('INCREMENT_ATTEMPTS');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected MFA verification query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({
      pool,
      env: { VIRGOSCORPIO_HUB_MFA_SECRET_KEY: 'test-key-32-bytes-long-exactly!' },
      clock: () => now,
    });

    // This should fail due to invalid code, but NOT due to account-wide throttling
    await assert.rejects(
      identity.completeMfaLogin({
        challengeToken: token1,
        code: '999999',
        ip: '203.0.113.42',
        userAgent: 'Test/1.0',
      }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_INVALID'
    );

    // Verify that the account-wide check was performed and passed
    assert.ok(events.includes('CHECK_ACCOUNT_FAILURES'));
    assert.ok(events.includes('INCREMENT_ATTEMPTS'));
  });

  await t.test('acquires advisory lock to serialize concurrent MFA verifications for the same account', async () => {
    const events = [];
    const lockCalls = [];
    const pool = {
      async query() {
        throw new Error('MFA verification must use a transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
              events.push('SELECT_CHALLENGE');
              return {
                rowCount: 1,
                rows: [{
                  challenge_id: challengeId1,
                  user_id: userId,
                  attempts: 0,
                  id: userId,
                  email: 'user@example.test',
                  display_name: 'Test User',
                  status: 'active',
                  mfa_enabled: true,
                }],
              };
            }
            if (sql.includes('SELECT pg_advisory_xact_lock')) {
              events.push('ACQUIRE_LOCK');
              lockCalls.push(values);
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('SELECT COALESCE(SUM(attempts),0)::integer AS failures FROM auth_mfa_challenges')) {
              events.push('CHECK_ACCOUNT_FAILURES');
              return { rowCount: 1, rows: [{ failures: 0 }] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return {
                rowCount: 1,
                rows: [{
                  secret_ciphertext: secretCiphertext,
                  last_used_step: -1,
                  pending_secret: null,
                }],
              };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET attempts=attempts+1')) {
              events.push('INCREMENT_ATTEMPTS');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected MFA verification query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({
      pool,
      env: { VIRGOSCORPIO_HUB_MFA_SECRET_KEY: 'test-key-32-bytes-long-exactly!' },
      clock: () => now,
    });

    await assert.rejects(
      identity.completeMfaLogin({
        challengeToken: token1,
        code: '000000',
        ip: '203.0.113.42',
        userAgent: 'Test/1.0',
      }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_INVALID'
    );

    // Verify that advisory lock was acquired with the correct key
    assert.equal(lockCalls.length, 1);
    assert.equal(lockCalls[0][0], `virgoscorpio_hub-mfa-verify:${userId}`);
    
    // Verify lock is acquired before checking account failures
    const lockIndex = events.indexOf('ACQUIRE_LOCK');
    const checkIndex = events.indexOf('CHECK_ACCOUNT_FAILURES');
    assert.ok(lockIndex >= 0 && checkIndex >= 0 && lockIndex < checkIndex,
      'Advisory lock must be acquired before checking account-wide failures');
  });
});

test('MFA verification rejects challenges that have reached per-challenge attempt limit', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const token = Buffer.alloc(32, 1).toString('base64url');
  const now = Date.now();

  const events = [];
  const pool = {
    async query() {
      throw new Error('MFA verification must use a transaction client.');
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            events.push(sql);
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
            events.push('SELECT_CHALLENGE');
            // Challenge has reached its 5-attempt limit
            return {
              rowCount: 1,
              rows: [{
                challenge_id: challengeId,
                user_id: userId,
                attempts: 5,
                id: userId,
                email: 'user@example.test',
                display_name: 'Test User',
                status: 'active',
                mfa_enabled: true,
              }],
            };
          }
          throw new Error('Unexpected MFA verification query: ' + sql);
        },
        release() { events.push('RELEASE'); },
      };
    },
  };

  const identity = createIdentityService({ pool, env: {}, clock: () => now });

  await assert.rejects(
    identity.completeMfaLogin({
      challengeToken: token,
      code: '123456',
      ip: '203.0.113.42',
      userAgent: 'Test/1.0',
    }),
    error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_CHALLENGE_INVALID'
  );

  // Should reject immediately after selecting the challenge, before checking account-wide failures
  assert.deepEqual(events, [
    'BEGIN',
    'SELECT_CHALLENGE',
    'ROLLBACK',
    'RELEASE',
  ]);
  assert.equal(events.includes('ACQUIRE_LOCK'), false, 'Should not acquire lock for exhausted challenge');
  assert.equal(events.includes('CHECK_ACCOUNT_FAILURES'), false, 'Should not check account failures for exhausted challenge');
});

test('password login creates a new MFA challenge after successful first-factor authentication', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const email = 'user@example.test';
  const password = 'CorrectHorse9Battery';
  const ip = '203.0.113.42';
  const now = Date.now();

  const events = [];
  const challengeInserts = [];
  
  // Create a proper password hash for the test
  const { hashPassword } = require('../packages/auth/src/service');
  const passwordHash = await hashPassword(password);
  
  const pool = {
    async query(sql, values = []) {
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled,email_verified_at FROM users')) {
        events.push('SELECT_USER');
        return {
          rowCount: 1,
          rows: [{
            id: userId,
            email,
            display_name: 'Test User',
            password_hash: passwordHash,
            status: 'active',
            email_verified_at: new Date(),
            mfa_enabled: true,
          }],
        };
      }
      if (sql.includes('INSERT INTO auth_mfa_challenges(user_id,token_hash,expires_at)')) {
        events.push('INSERT_CHALLENGE');
        challengeInserts.push(values);
        return { rowCount: 1, rows: [] };
      }
      throw new Error('Unexpected password login query: ' + sql);
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => now,
  });

  // The login should return mfaRequired=true with a challenge token
  const result = await identity.login({ email, password, ip, userAgent: 'Test/1.0' });

  // Verify that a challenge was created
  assert.ok(events.includes('INSERT_CHALLENGE'), 'Password login should create MFA challenge for MFA-enabled users');
  assert.equal(challengeInserts.length, 1, 'Exactly one challenge should be created');
  assert.equal(challengeInserts[0][0], userId, 'Challenge should be associated with the user');
  assert.equal(result.mfaRequired, true, 'Login should indicate MFA is required');
  assert.ok(result.challengeToken, 'Login should return a challenge token');
});

test('MFA account-wide failure check aggregates attempts across all challenges within the time window', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const token = Buffer.alloc(32, 1).toString('base64url');
  const now = Date.now();

  const events = [];
  const failureQueries = [];
  const pool = {
    async query() {
      throw new Error('MFA verification must use a transaction client.');
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            events.push(sql);
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
            events.push('SELECT_CHALLENGE');
            return {
              rowCount: 1,
              rows: [{
                challenge_id: challengeId,
                user_id: userId,
                attempts: 2,
                id: userId,
                email: 'user@example.test',
                display_name: 'Test User',
                status: 'active',
                mfa_enabled: true,
              }],
            };
          }
          if (sql.includes('SELECT pg_advisory_xact_lock')) {
            events.push('ACQUIRE_LOCK');
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT COALESCE(SUM(attempts),0)::integer AS failures FROM auth_mfa_challenges')) {
            events.push('CHECK_ACCOUNT_FAILURES');
            failureQueries.push({ sql, values });
            return { rowCount: 1, rows: [{ failures: 8 }] };
          }
          if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
            events.push('SELECT_CREDENTIAL');
            return {
              rowCount: 1,
              rows: [{
                secret_ciphertext: 'encrypted-secret',
                last_used_step: -1,
                pending_secret: null,
              }],
            };
          }
          if (sql.includes('UPDATE auth_mfa_challenges SET attempts=attempts+1')) {
            events.push('INCREMENT_ATTEMPTS');
            return { rowCount: 1, rows: [] };
          }
          throw new Error('Unexpected MFA verification query: ' + sql);
        },
        release() { events.push('RELEASE'); },
      };
    },
  };

  const identity = createIdentityService({
    pool,
    env: { VIRGOSCORPIO_HUB_MFA_SECRET_KEY: 'test-key-32-bytes-long-exactly!' },
    clock: () => now,
  });

  await assert.rejects(
    identity.completeMfaLogin({
      challengeToken: token,
      code: '000000',
      ip: '203.0.113.42',
      userAgent: 'Test/1.0',
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_INVALID'
  );

  // Verify the failure check query
  assert.equal(failureQueries.length, 1);
  const query = failureQueries[0];
  
  // Verify it queries for the correct user
  assert.equal(query.values[0], userId);
  
  // Verify it uses the 15-minute window
  assert.equal(query.values[1], 15);
  
  // Verify the query aggregates SUM(attempts) across all challenges
  assert.ok(query.sql.includes('SUM(attempts)'));
  assert.ok(query.sql.includes('FROM auth_mfa_challenges'));
  assert.ok(query.sql.includes('WHERE user_id=$1'));
  assert.ok(query.sql.includes('created_at > now() - ($2::integer * interval \'1 minute\')'));
});

test('MFA verification returns 429 with retryAfterSeconds when account-wide limit is exceeded', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const token = Buffer.alloc(32, 1).toString('base64url');
  const now = Date.now();

  const pool = {
    async query() {
      throw new Error('MFA verification must use a transaction client.');
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
            return {
              rowCount: 1,
              rows: [{
                challenge_id: challengeId,
                user_id: userId,
                attempts: 0,
                id: userId,
                email: 'user@example.test',
                display_name: 'Test User',
                status: 'active',
                mfa_enabled: true,
              }],
            };
          }
          if (sql.includes('SELECT pg_advisory_xact_lock')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT COALESCE(SUM(attempts),0)::integer AS failures FROM auth_mfa_challenges')) {
            // Return exactly at the limit
            return { rowCount: 1, rows: [{ failures: 10 }] };
          }
          throw new Error('Unexpected MFA verification query: ' + sql);
        },
        release() {},
      };
    },
  };

  const identity = createIdentityService({ pool, env: {}, clock: () => now });

  await assert.rejects(
    identity.completeMfaLogin({
      challengeToken: token,
      code: '123456',
      ip: '203.0.113.42',
      userAgent: 'Test/1.0',
    }),
    error => {
      // Verify the error has the correct properties for rate limiting
      assert.equal(error.statusCode, 429);
      assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_MFA_THROTTLED');
      assert.ok(error.message.includes('Too many failed MFA attempts'));
      assert.equal(error.retryAfterSeconds, 15 * 60, 'retryAfterSeconds should be 15 minutes (900 seconds)');
      return true;
    }
  );
});

test('MFA verification does not increment attempts when account-wide limit is already exceeded', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const token = Buffer.alloc(32, 1).toString('base64url');
  const now = Date.now();

  const events = [];
  const pool = {
    async query() {
      throw new Error('MFA verification must use a transaction client.');
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            events.push(sql);
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
            events.push('SELECT_CHALLENGE');
            return {
              rowCount: 1,
              rows: [{
                challenge_id: challengeId,
                user_id: userId,
                attempts: 1,
                id: userId,
                email: 'user@example.test',
                display_name: 'Test User',
                status: 'active',
                mfa_enabled: true,
              }],
            };
          }
          if (sql.includes('SELECT pg_advisory_xact_lock')) {
            events.push('ACQUIRE_LOCK');
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT COALESCE(SUM(attempts),0)::integer AS failures FROM auth_mfa_challenges')) {
            events.push('CHECK_ACCOUNT_FAILURES');
            return { rowCount: 1, rows: [{ failures: 15 }] };
          }
          if (sql.includes('UPDATE auth_mfa_challenges SET attempts=attempts+1')) {
            events.push('INCREMENT_ATTEMPTS');
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('SELECT secret_ciphertext')) {
            events.push('SELECT_CREDENTIAL');
            return { rowCount: 1, rows: [] };
          }
          throw new Error('Unexpected MFA verification query: ' + sql);
        },
        release() { events.push('RELEASE'); },
      };
    },
  };

  const identity = createIdentityService({ pool, env: {}, clock: () => now });

  await assert.rejects(
    identity.completeMfaLogin({
      challengeToken: token,
      code: '123456',
      ip: '203.0.113.42',
      userAgent: 'Test/1.0',
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_THROTTLED'
  );

  // Verify that attempts were NOT incremented when the account-wide limit was exceeded
  assert.equal(events.includes('INCREMENT_ATTEMPTS'), false,
    'Should not increment challenge attempts when account-wide limit is exceeded');
  assert.equal(events.includes('SELECT_CREDENTIAL'), false,
    'Should not fetch credentials when account-wide limit is exceeded');
  
  // Verify the check happened before any credential operations
  const checkIndex = events.indexOf('CHECK_ACCOUNT_FAILURES');
  assert.ok(checkIndex >= 0, 'Account-wide failure check must be performed');
});
