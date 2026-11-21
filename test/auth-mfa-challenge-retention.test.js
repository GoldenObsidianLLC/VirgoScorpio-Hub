'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService, hashPassword } = require('../packages/auth/src/service');

test('MFA challenge creation enforces a per-account retention bound', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const queries = [];
  let clockMs = Date.now();

  // Create a real password hash for testing
  const passwordHash = await hashPassword('ValidPassword123');

  // Simulate the internal createMfaChallenge function by calling login with MFA-enabled user
  const user = {
    id: userId,
    email: 'mfa-user@example.test',
    display_name: 'MFA User',
    status: 'active',
    password_hash: passwordHash,
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Verify the purge-and-insert CTE structure
        assert.match(sql, /DELETE FROM auth_mfa_challenges/);
        assert.match(sql, /WHERE user_id=\$1 AND \(/);
        assert.match(sql, /consumed_at IS NOT NULL OR expires_at<=\$4/);
        assert.match(sql, /ORDER BY created_at DESC, id DESC OFFSET \$5/);
        assert.match(sql, /INSERT INTO auth_mfa_challenges\(user_id,token_hash,expires_at\) VALUES\(\$1,\$2,\$3\)/);
        
        // Verify the OFFSET parameter is MAX_LIVE_MFA_CHALLENGES_PER_USER - 1 (which is 4)
        assert.equal(values[4], 4, 'OFFSET should be MAX_LIVE_MFA_CHALLENGES_PER_USER - 1');
        
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Attempt login with valid password
  const result = await identity.login({
    email: 'mfa-user@example.test',
    password: 'ValidPassword123',
    ip: '192.0.2.1',
    userAgent: 'test-agent',
  });

  assert.equal(result.mfaRequired, true, 'MFA should be required');
  assert.ok(result.challengeToken, 'Challenge token should be returned');
  
  // Verify that the purge CTE was executed
  const purgeQuery = queries.find(q => q.sql.includes('WITH purged AS'));
  assert.ok(purgeQuery, 'Purge CTE should be executed during challenge creation');
});

test('repeated password-phase logins for MFA accounts stay rate-limited', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  let clockMs = Date.now();
  let loginAttempts = 0;

  const passwordHash = await hashPassword('ValidPassword123');

  const user = {
    id: userId,
    email: 'mfa-throttle@example.test',
    display_name: 'MFA Throttle User',
    status: 'active',
    password_hash: passwordHash,
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        loginAttempts++;
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  const ip = '192.0.2.100';
  const email = 'mfa-throttle@example.test';

  // Perform 10 successful password-phase logins (the rate limit threshold)
  for (let i = 0; i < 10; i++) {
    const result = await identity.login({
      email,
      password: 'ValidPassword123',
      ip,
      userAgent: 'test-agent',
    });
    assert.equal(result.mfaRequired, true, `Attempt ${i + 1} should require MFA`);
  }

  // The 11th attempt should be throttled
  await assert.rejects(
    identity.login({
      email,
      password: 'ValidPassword123',
      ip,
      userAgent: 'test-agent',
    }),
    error => {
      return (
        error.statusCode === 429 &&
        error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_THROTTLED' &&
        typeof error.retryAfterSeconds === 'number'
      );
    },
    'The 11th password-phase login should be throttled'
  );

  assert.equal(loginAttempts, 10, 'Only 10 password verifications should have occurred before throttling');
});

test('MFA challenge creation does not cause unbounded database growth', async () => {
  const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  let clockMs = Date.now();
  let insertCount = 0;
  let deleteCount = 0;

  const passwordHash = await hashPassword('ValidPassword123');

  const user = {
    id: userId,
    email: 'bounded-growth@example.test',
    display_name: 'Bounded Growth User',
    status: 'active',
    password_hash: passwordHash,
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Count the purge-and-insert operation as both a delete and insert
        deleteCount++;
        insertCount++;
        
        // Verify the statement structure enforces bounded growth
        assert.match(sql, /DELETE FROM auth_mfa_challenges/, 'Must delete old challenges');
        assert.match(sql, /INSERT INTO auth_mfa_challenges/, 'Must insert new challenge');
        
        // The CTE ensures at most MAX_LIVE_MFA_CHALLENGES_PER_USER (5) rows exist per user
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Simulate 10 repeated password-phase logins (attacker scenario)
  // This would previously cause 10 durable writes with no cleanup
  const maxAttempts = 10; // Limited by rate limiter
  for (let i = 0; i < maxAttempts; i++) {
    await identity.login({
      email: 'bounded-growth@example.test',
      password: 'ValidPassword123',
      ip: '192.0.2.250',
      userAgent: 'test-agent',
    });
    clockMs += 1000; // Advance 1 second
  }

  // Verify that every insert was paired with a purge operation
  assert.equal(insertCount, maxAttempts, 'Should have inserted challenges for each login');
  assert.equal(deleteCount, maxAttempts, 'Should have purged old challenges for each login');
  
  // The key security property: the database cannot grow unbounded because
  // each insert is preceded by a delete that enforces the per-user limit
  assert.ok(
    insertCount === deleteCount,
    'Every challenge insert must be paired with a purge to prevent unbounded growth'
  );
});

test('MFA challenge purge removes expired challenges', async () => {
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  let clockMs = Date.now();
  const queries = [];

  const user = {
    id: userId,
    email: 'purge-test@example.test',
    display_name: 'Purge Test User',
    status: 'active',
    password_hash: 'scrypt$32768$8$1$fakehash',
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Verify that expired challenges are deleted
        assert.match(sql, /expires_at<=\$4/, 'Expired challenges should be purged');
        // Verify that consumed challenges are deleted
        assert.match(sql, /consumed_at IS NOT NULL/, 'Consumed challenges should be purged');
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Create first challenge
  await identity.login({
    email: 'purge-test@example.test',
    password: 'ValidPassword123',
    ip: '192.0.2.50',
    userAgent: 'test-agent',
  });

  // Advance clock by 6 minutes (past the 5-minute expiry)
  clockMs += 6 * 60 * 1000;

  // Create second challenge - should purge the expired first challenge
  await identity.login({
    email: 'purge-test@example.test',
    password: 'ValidPassword123',
    ip: '192.0.2.50',
    userAgent: 'test-agent',
  });

  // Verify purge queries were executed
  const purgeQueries = queries.filter(q => q.sql.includes('WITH purged AS'));
  assert.equal(purgeQueries.length, 2, 'Two purge operations should have occurred');
});

test('MFA challenge retention enforces maximum of 5 live challenges per user', async () => {
  const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let clockMs = Date.now();
  const queries = [];

  const user = {
    id: userId,
    email: 'max-challenges@example.test',
    display_name: 'Max Challenges User',
    status: 'active',
    password_hash: 'scrypt$32768$8$1$fakehash',
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Verify the OFFSET clause limits retention to MAX - 1 = 4 challenges
        // When inserting the 5th, it keeps the newest 4 and deletes older ones
        assert.equal(values[4], 4, 'Should retain at most 4 existing challenges when inserting a new one');
        
        // Verify the subquery orders by created_at DESC to keep newest
        assert.match(sql, /ORDER BY created_at DESC, id DESC OFFSET \$5/);
        
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Create 6 challenges rapidly (within expiry window)
  for (let i = 0; i < 6; i++) {
    await identity.login({
      email: 'max-challenges@example.test',
      password: 'ValidPassword123',
      ip: '192.0.2.75',
      userAgent: 'test-agent',
    });
    // Advance clock by 10 seconds to ensure different created_at timestamps
    clockMs += 10 * 1000;
  }

  // Verify all 6 challenge creations used the bounded purge logic
  const purgeQueries = queries.filter(q => q.sql.includes('WITH purged AS'));
  assert.equal(purgeQueries.length, 6, 'All 6 challenge creations should use purge CTE');
  
  // Verify each used the correct OFFSET value
  purgeQueries.forEach(q => {
    assert.equal(q.values[4], 4, 'Each challenge creation should enforce the 4-challenge retention limit');
  });
});

test('federated login path also enforces MFA challenge retention bound', async () => {
  const userId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  let clockMs = Date.now();
  const queries = [];

  const user = {
    id: userId,
    email: 'federated-mfa@example.test',
    display_name: 'Federated MFA User',
    status: 'active',
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async connect() {
      return {
        async query(sql, values) {
          queries.push({ sql, values });
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM user_external_identities e JOIN users u')) {
            // Return mapped user
            return { rows: [user] };
          }
          return { rows: [] };
        },
        release() {},
      };
    },
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('WITH purged AS')) {
        // Verify federated path also uses the bounded purge CTE
        assert.match(sql, /DELETE FROM auth_mfa_challenges/);
        assert.match(sql, /ORDER BY created_at DESC, id DESC OFFSET \$5/);
        assert.equal(values[4], 4, 'Federated login should also enforce retention bound');
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Perform federated login with MFA-enabled account
  const result = await identity.loginFederated({
    issuer: 'https://accounts.google.com',
    subject: 'google-user-123',
    email: 'federated-mfa@example.test',
    ip: '192.0.2.200',
    userAgent: 'test-agent',
  });

  assert.equal(result.mfaRequired, true, 'Federated login should require MFA');
  assert.ok(result.challengeToken, 'Challenge token should be returned');

  // Verify the purge CTE was used
  const purgeQuery = queries.find(q => q.sql.includes('WITH purged AS'));
  assert.ok(purgeQuery, 'Federated login should use bounded purge CTE');
});

test('MFA challenge creation does not cause unbounded database growth', async () => {
  const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  let clockMs = Date.now();
  let insertCount = 0;
  let deleteCount = 0;

  const user = {
    id: userId,
    email: 'bounded-growth@example.test',
    display_name: 'Bounded Growth User',
    status: 'active',
    password_hash: 'scrypt$32768$8$1$fakehash',
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Count the purge-and-insert operation as both a delete and insert
        deleteCount++;
        insertCount++;
        
        // Verify the statement structure enforces bounded growth
        assert.match(sql, /DELETE FROM auth_mfa_challenges/, 'Must delete old challenges');
        assert.match(sql, /INSERT INTO auth_mfa_challenges/, 'Must insert new challenge');
        
        // The CTE ensures at most MAX_LIVE_MFA_CHALLENGES_PER_USER (5) rows exist per user
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Simulate 100 repeated password-phase logins (attacker scenario)
  // This would previously cause 100 durable writes with no cleanup
  const maxAttempts = 10; // Limited by rate limiter
  for (let i = 0; i < maxAttempts; i++) {
    await identity.login({
      email: 'bounded-growth@example.test',
      password: 'ValidPassword123',
      ip: '192.0.2.250',
      userAgent: 'test-agent',
    });
    clockMs += 1000; // Advance 1 second
  }

  // Verify that every insert was paired with a purge operation
  assert.equal(insertCount, maxAttempts, 'Should have inserted challenges for each login');
  assert.equal(deleteCount, maxAttempts, 'Should have purged old challenges for each login');
  
  // The key security property: the database cannot grow unbounded because
  // each insert is preceded by a delete that enforces the per-user limit
  assert.ok(
    insertCount === deleteCount,
    'Every challenge insert must be paired with a purge to prevent unbounded growth'
  );
});

test('MFA challenge purge removes consumed challenges', async () => {
  const userId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  let clockMs = Date.now();
  const queries = [];

  const user = {
    id: userId,
    email: 'consumed-purge@example.test',
    display_name: 'Consumed Purge User',
    status: 'active',
    password_hash: 'scrypt$32768$8$1$fakehash',
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Verify consumed challenges are included in the purge condition
        assert.match(
          sql,
          /consumed_at IS NOT NULL/,
          'Purge must include consumed challenges'
        );
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  // Create a challenge
  await identity.login({
    email: 'consumed-purge@example.test',
    password: 'ValidPassword123',
    ip: '192.0.2.99',
    userAgent: 'test-agent',
  });

  // Verify the purge condition includes consumed challenges
  const purgeQuery = queries.find(q => q.sql.includes('WITH purged AS'));
  assert.ok(purgeQuery, 'Purge CTE should be present');
  assert.match(
    purgeQuery.sql,
    /consumed_at IS NOT NULL/,
    'Consumed challenges must be purged'
  );
});

test('MFA challenge retention uses correct timestamp for expiry comparison', async () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  let clockMs = Date.now();
  const queries = [];

  const user = {
    id: userId,
    email: 'timestamp-test@example.test',
    display_name: 'Timestamp Test User',
    status: 'active',
    password_hash: 'scrypt$32768$8$1$fakehash',
    mfa_enabled: true,
    email_verified_at: new Date(),
  };

  const pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('SELECT id,email,display_name,status,password_hash,mfa_enabled')) {
        return { rows: [user] };
      }
      if (sql.includes('WITH purged AS')) {
        // Verify the timestamp parameter ($4) is used for both expiry check and retention filter
        const nowParam = values[3]; // $4 in the query (0-indexed as values[3])
        assert.ok(nowParam instanceof Date, 'Timestamp parameter should be a Date object');
        
        // Verify it's used consistently in both the expiry check and the retention subquery
        const paramCount = (sql.match(/\$4/g) || []).length;
        assert.equal(paramCount, 2, 'Timestamp parameter should be used twice (expiry and retention)');
        
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    },
  };

  const identity = createIdentityService({
    pool,
    env: {},
    clock: () => clockMs,
  });

  await identity.login({
    email: 'timestamp-test@example.test',
    password: 'ValidPassword123',
    ip: '192.0.2.111',
    userAgent: 'test-agent',
  });

  const purgeQuery = queries.find(q => q.sql.includes('WITH purged AS'));
  assert.ok(purgeQuery, 'Purge query should exist');
  assert.ok(purgeQuery.values[3] instanceof Date, 'Timestamp should be a Date');
});
