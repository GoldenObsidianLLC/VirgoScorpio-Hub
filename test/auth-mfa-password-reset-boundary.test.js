'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService, digest } = require('../packages/auth/src/service');

/**
 * Security test: verify that password reset invalidates pending MFA challenges
 * and prevents pre-reset challenges from creating post-reset sessions.
 *
 * Pentest finding: "Password reset does not invalidate pending MFA challenges"
 * A pre-reset MFA challenge remained valid after password reset and could be
 * exchanged for a new session, bypassing the reset's session-revocation boundary.
 *
 * Mitigation: Password reset now consumes all pending MFA challenges before
 * updating the password, and MFA completion creates sessions within the same
 * transaction that holds the challenge lock.
 */

test('password reset invalidates pending MFA challenges before updating password', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const resetToken = Buffer.alloc(32, 7).toString('base64url');
  const resetTokenHash = digest(resetToken);
  const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  await t.test('consumes pending MFA challenges in the password reset transaction', async () => {
    const events = [];
    const pool = {
      async query(sql, values = []) {
        assert.match(sql, /SELECT 1 FROM identity_action_tokens/);
        assert.deepEqual(values, [resetTokenHash]);
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM identity_action_tokens') && sql.includes('FOR UPDATE')) {
              events.push('SELECT_RESET_TOKEN');
              return {
                rowCount: 1,
                rows: [{ id: 'token-id-123', user_id: userId }],
              };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('INVALIDATE_MFA_CHALLENGES');
              assert.deepEqual(values, [userId]);
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE users SET password_hash=')) {
              events.push('UPDATE_PASSWORD');
              assert.equal(values[0], userId);
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE identity_action_tokens SET consumed_at=now()')) {
              events.push('CONSUME_RESET_TOKEN');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE auth_sessions SET revoked_at=now()')) {
              events.push('REVOKE_SESSIONS');
              assert.deepEqual(values, [userId]);
              return { rowCount: 2, rows: [] };
            }
            throw new Error('Unexpected password reset query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const result = await identity.resetPassword({ token: resetToken, password: 'NewSecure9Password' });

    assert.deepEqual(result, { reset: true });
    assert.deepEqual(events, [
      'BEGIN',
      'SELECT_RESET_TOKEN',
      'INVALIDATE_MFA_CHALLENGES',
      'UPDATE_PASSWORD',
      'CONSUME_RESET_TOKEN',
      'REVOKE_SESSIONS',
      'COMMIT',
      'RELEASE',
    ]);

    // Verify that MFA challenge invalidation happens before password update
    const invalidateIndex = events.indexOf('INVALIDATE_MFA_CHALLENGES');
    const updatePasswordIndex = events.indexOf('UPDATE_PASSWORD');
    assert.ok(invalidateIndex < updatePasswordIndex, 'MFA challenges must be invalidated before password update');
  });

  await t.test('rejects consumed MFA challenges after password reset', async () => {
    const challengeToken = Buffer.alloc(32, 9).toString('base64url');
    const challengeTokenHash = digest(challengeToken);
    const events = [];

    const pool = {
      async query() {
        throw new Error('MFA completion must use a dedicated transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
              events.push('SELECT_MFA_CHALLENGE');
              // Simulate a challenge that was consumed by password reset
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected MFA completion query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.completeMfaLogin({
        challengeToken,
        code: '123456',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_CHALLENGE_INVALID'
    );

    assert.deepEqual(events, ['BEGIN', 'SELECT_MFA_CHALLENGE', 'ROLLBACK', 'RELEASE']);
  });
});

test('MFA completion creates session within transaction holding challenge lock', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const challengeToken = Buffer.alloc(32, 5).toString('base64url');
  const challengeTokenHash = digest(challengeToken);

  await t.test('session creation uses the same transaction client as challenge consumption', async () => {
    const events = [];
    const transactionQueries = [];
    let transactionClient = null;

    const pool = {
      async query() {
        throw new Error('MFA completion must not use pool-level queries.');
      },
      async connect() {
        transactionClient = {
          async query(sql, values = []) {
            transactionQueries.push({ sql, values });
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
                  attempts: 0,
                  id: userId,
                  email: 'user@example.test',
                  display_name: 'Test User',
                  status: 'active',
                  mfa_enabled: true,
                }],
              };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              assert.deepEqual(values, ['virgoscorpio_hub-mfa-verify:' + userId]);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('COALESCE(SUM(attempts),0)::integer AS failures')) {
              assert.deepEqual(values, [userId, 15]);
              return { rowCount: 1, rows: [{ failures: 0 }] };
            }
            if (sql.includes('FROM user_mfa_credentials') && sql.includes('FOR UPDATE')) {
              events.push('SELECT_CREDENTIAL');
              // Return a credential with encrypted secret (we'll simulate verification success)
              return {
                rowCount: 1,
                rows: [{
                  secret_ciphertext: 'encrypted-secret',
                  last_used_step: 100,
                  pending_secret: null,
                }],
              };
            }
            if (sql.includes('UPDATE user_mfa_credentials SET last_used_step=')) {
              events.push('UPDATE_CREDENTIAL_STEP');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('CONSUME_CHALLENGE');
              assert.deepEqual(values, [challengeId]);
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO auth_sessions')) {
              events.push('CREATE_SESSION');
              // Verify this is using the transaction client, not pool
              assert.equal(this, transactionClient, 'Session creation must use transaction client');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected MFA completion query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
        return transactionClient;
      },
    };

    // Mock the TOTP verification to succeed
    const mockEnv = {
      MFA_ENCRYPTION_KEY: 'a'.repeat(64),
    };

    const identity = createIdentityService({
      pool,
      env: mockEnv,
      clock: () => Date.now(),
    });

    // We need to mock the TOTP verification since we can't easily decrypt in tests
    // Instead, we'll use a recovery code path which is simpler to test
    const recoveryCode = 'RECOVERY-CODE-123';
    const recoveryCodeHash = digest(recoveryCode.toUpperCase());

    const poolWithRecovery = {
      async query() {
        throw new Error('MFA completion must not use pool-level queries.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            transactionQueries.push({ sql, values });
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
                  attempts: 0,
                  id: userId,
                  email: 'user@example.test',
                  display_name: 'Test User',
                  status: 'active',
                  mfa_enabled: true,
                }],
              };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              assert.deepEqual(values, ['virgoscorpio_hub-mfa-verify:' + userId]);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('COALESCE(SUM(attempts),0)::integer AS failures')) {
              assert.deepEqual(values, [userId, 15]);
              return { rowCount: 1, rows: [{ failures: 0 }] };
            }
            if (sql.includes('FROM user_mfa_credentials') && sql.includes('FOR UPDATE')) {
              events.push('SELECT_CREDENTIAL');
              return {
                rowCount: 1,
                rows: [{
                  secret_ciphertext: 'encrypted-secret',
                  last_used_step: 100,
                  pending_secret: null,
                }],
              };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes SET consumed_at=now()')) {
              events.push('CONSUME_RECOVERY_CODE');
              return { rowCount: 1, rows: [{ id: 'recovery-id' }] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('CONSUME_CHALLENGE');
              assert.deepEqual(values, [challengeId]);
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO auth_sessions')) {
              events.push('CREATE_SESSION');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected MFA completion query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identityWithRecovery = createIdentityService({
      pool: poolWithRecovery,
      env: mockEnv,
    });

    const result = await identityWithRecovery.completeMfaLogin({
      challengeToken,
      code: recoveryCode,
      ip: '127.0.0.1',
      userAgent: 'test-agent',
    });

    assert.equal(result.mfaRequired, false);
    assert.equal(result.user.id, userId);

    // Verify the order: challenge consumption happens before session creation, both in same transaction
    const consumeIndex = events.indexOf('CONSUME_CHALLENGE');
    const createSessionIndex = events.indexOf('CREATE_SESSION');
    const commitIndex = events.indexOf('COMMIT');

    assert.ok(consumeIndex > -1, 'Challenge must be consumed');
    assert.ok(createSessionIndex > -1, 'Session must be created');
    assert.ok(consumeIndex < createSessionIndex, 'Challenge consumption must precede session creation');
    assert.ok(createSessionIndex < commitIndex, 'Session creation must happen before commit');
  });
});

test('concurrent password reset and MFA completion are serialized by lock ordering', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const resetToken = Buffer.alloc(32, 3).toString('base64url');

  await t.test('password reset acquires challenge lock before user update', async () => {
    const events = [];
    const pool = {
      async query(sql, values = []) {
        assert.match(sql, /SELECT 1 FROM identity_action_tokens/);
        assert.deepEqual(values, [digest(resetToken)]);
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM identity_action_tokens') && sql.includes('FOR UPDATE')) {
              events.push('LOCK_RESET_TOKEN');
              return {
                rowCount: 1,
                rows: [{ id: 'token-id', user_id: userId }],
              };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('LOCK_AND_INVALIDATE_CHALLENGES');
              // This implicitly acquires locks on challenge rows
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE users SET password_hash=')) {
              events.push('UPDATE_USER');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE identity_action_tokens SET consumed_at=now()')) {
              events.push('CONSUME_TOKEN');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE auth_sessions SET revoked_at=now()')) {
              events.push('REVOKE_SESSIONS');
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await identity.resetPassword({
      token: resetToken,
      password: 'NewSecure9Password',
    });

    // Verify lock ordering: challenges are locked/invalidated before user update
    const challengeLockIndex = events.indexOf('LOCK_AND_INVALIDATE_CHALLENGES');
    const userUpdateIndex = events.indexOf('UPDATE_USER');
    assert.ok(challengeLockIndex < userUpdateIndex, 'Challenge locks must be acquired before user update');
  });

  await t.test('MFA completion acquires challenge lock before user query', async () => {
    const events = [];
    const challengeToken = Buffer.alloc(32, 4).toString('base64url');

    const pool = {
      async query() {
        throw new Error('MFA completion must use transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
              events.push('LOCK_CHALLENGE_AND_READ_USER');
              // The FOR UPDATE OF c clause locks the challenge row
              // The join reads user data but doesn't lock the user row
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
            if (sql.includes('pg_advisory_xact_lock')) {
              assert.deepEqual(values, ['virgoscorpio_hub-mfa-verify:' + userId]);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('COALESCE(SUM(attempts),0)::integer AS failures')) {
              assert.deepEqual(values, [userId, 15]);
              return { rowCount: 1, rows: [{ failures: 0 }] };
            }
            if (sql.includes('FROM user_mfa_credentials') && sql.includes('FOR UPDATE')) {
              events.push('LOCK_CREDENTIAL');
              return {
                rowCount: 1,
                rows: [{
                  secret_ciphertext: 'encrypted',
                  last_used_step: 100,
                  pending_secret: null,
                }],
              };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes')) {
              events.push('CONSUME_RECOVERY');
              return { rowCount: 1, rows: [{ id: 'recovery' }] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('CONSUME_CHALLENGE');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO auth_sessions')) {
              events.push('CREATE_SESSION');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: { MFA_ENCRYPTION_KEY: 'a'.repeat(64) } });
    await identity.completeMfaLogin({
      challengeToken,
      code: 'RECOVERY-CODE',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    // Verify that challenge lock is acquired first
    const challengeLockIndex = events.indexOf('LOCK_CHALLENGE_AND_READ_USER');
    assert.equal(challengeLockIndex, 1, 'Challenge lock must be acquired immediately after BEGIN');
  });
});

test('pre-reset MFA challenge cannot create post-reset session', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const challengeToken = Buffer.alloc(32, 6).toString('base64url');

  await t.test('challenge consumed by password reset is rejected by MFA completion', async () => {
    const events = [];

    // Simulate the scenario where:
    // 1. User logs in with MFA, gets a challenge
    // 2. Password is reset (which consumes the challenge)
    // 3. Attacker tries to complete MFA with the old challenge

    const pool = {
      async query() {
        throw new Error('Must use transaction client.');
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
              // Challenge was consumed by password reset, so it's not found
              // (consumed_at IS NULL filter excludes it)
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });

    await assert.rejects(
      identity.completeMfaLogin({
        challengeToken,
        code: '123456',
        ip: '127.0.0.1',
        userAgent: 'attacker-agent',
      }),
      error => {
        assert.equal(error.statusCode, 401);
        assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_MFA_CHALLENGE_INVALID');
        assert.match(error.message, /invalid or expired/i);
        return true;
      }
    );

    assert.deepEqual(events, ['BEGIN', 'SELECT_CHALLENGE', 'ROLLBACK', 'RELEASE']);
  });

  await t.test('password reset invalidates all unconsumed challenges for the user', async () => {
    const events = [];
    const resetToken = Buffer.alloc(32, 8).toString('base64url');

    const pool = {
      async query(sql, values = []) {
        assert.match(sql, /SELECT 1 FROM identity_action_tokens/);
        assert.deepEqual(values, [digest(resetToken)]);
        return { rowCount: 1, rows: [{ '?column?': 1 }] };
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM identity_action_tokens') && sql.includes('FOR UPDATE')) {
              events.push('SELECT_RESET_TOKEN');
              return {
                rowCount: 1,
                rows: [{ id: 'token-id', user_id: userId }],
              };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('INVALIDATE_CHALLENGES');
              // Verify it targets the correct user and only unconsumed challenges
              assert.equal(values[0], userId);
              assert.ok(sql.includes('consumed_at IS NULL'), 'Must only target unconsumed challenges');
              // Simulate multiple challenges being invalidated
              return { rowCount: 3, rows: [] };
            }
            if (sql.includes('UPDATE users SET password_hash=')) {
              events.push('UPDATE_PASSWORD');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE identity_action_tokens SET consumed_at=now()')) {
              events.push('CONSUME_TOKEN');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE auth_sessions SET revoked_at=now()')) {
              events.push('REVOKE_SESSIONS');
              return { rowCount: 2, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const result = await identity.resetPassword({
      token: resetToken,
      password: 'NewSecure9Password',
    });

    assert.deepEqual(result, { reset: true });
    assert.ok(events.includes('INVALIDATE_CHALLENGES'), 'Must invalidate MFA challenges');

    // Verify the invalidation happens in the correct order
    const invalidateIndex = events.indexOf('INVALIDATE_CHALLENGES');
    const updatePasswordIndex = events.indexOf('UPDATE_PASSWORD');
    const commitIndex = events.indexOf('COMMIT');

    assert.ok(invalidateIndex < updatePasswordIndex, 'Challenges invalidated before password update');
    assert.ok(updatePasswordIndex < commitIndex, 'Password updated before commit');
  });
});

test('session creation within MFA transaction prevents race with password reset', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  await t.test('session is created before MFA transaction commits', async () => {
    const events = [];
    const challengeToken = Buffer.alloc(32, 10).toString('base64url');

    const pool = {
      async query() {
        throw new Error('Must use transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u') && sql.includes('FOR UPDATE OF c')) {
              events.push('LOCK_CHALLENGE');
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
            if (sql.includes('pg_advisory_xact_lock')) {
              assert.deepEqual(values, ['virgoscorpio_hub-mfa-verify:' + userId]);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('COALESCE(SUM(attempts),0)::integer AS failures')) {
              assert.deepEqual(values, [userId, 15]);
              return { rowCount: 1, rows: [{ failures: 0 }] };
            }
            if (sql.includes('FROM user_mfa_credentials') && sql.includes('FOR UPDATE')) {
              events.push('LOCK_CREDENTIAL');
              return {
                rowCount: 1,
                rows: [{
                  secret_ciphertext: 'encrypted',
                  last_used_step: 100,
                  pending_secret: null,
                }],
              };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes')) {
              events.push('CONSUME_RECOVERY');
              return { rowCount: 1, rows: [{ id: 'recovery' }] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at=now()')) {
              events.push('CONSUME_CHALLENGE');
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO auth_sessions')) {
              events.push('CREATE_SESSION');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: { MFA_ENCRYPTION_KEY: 'a'.repeat(64) } });
    await identity.completeMfaLogin({
      challengeToken,
      code: 'RECOVERY-CODE',
      ip: '127.0.0.1',
      userAgent: 'test',
    });

    // Verify session creation happens before commit
    const createSessionIndex = events.indexOf('CREATE_SESSION');
    const commitIndex = events.indexOf('COMMIT');
    assert.ok(createSessionIndex > -1 && commitIndex > -1, 'Both session creation and commit must occur');
    assert.ok(createSessionIndex < commitIndex, 'Session must be created before transaction commits');

    // Verify the complete order
    assert.deepEqual(events, [
      'BEGIN',
      'LOCK_CHALLENGE',
      'LOCK_CREDENTIAL',
      'CONSUME_RECOVERY',
      'CONSUME_CHALLENGE',
      'CREATE_SESSION',
      'COMMIT',
      'RELEASE',
    ]);
  });
});
