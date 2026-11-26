'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

test('OIDC state allocation enforces a global cap to prevent unbounded resource consumption', async t => {
  const MAX_ACTIVE_OIDC_STATES = 10_000;

  await t.test('rejects new state allocation when the global cap is reached', async () => {
    const queries = [];
    const pool = {
      async query() {
        throw new Error('State creation must use a dedicated transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            queries.push({ sql, values });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('DELETE FROM auth_oidc_states')) {
              // Simulate cleanup removing no rows (all states are still active)
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT count(*)::int AS total FROM auth_oidc_states')) {
              // Simulate the table being at the cap
              return { rowCount: 1, rows: [{ total: MAX_ACTIVE_OIDC_STATES }] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });

    await assert.rejects(
      identity.createOidcState({
        state: 'a'.repeat(43),
        nonce: 'test-nonce',
        verifier: 'test-verifier',
        issuer: 'https://idp.example.test',
      }),
      error => error.statusCode === 429 && error.code === 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT'
    );

    // Verify the transaction was rolled back and no INSERT occurred
    const insertQuery = queries.find(q => q.sql.includes('INSERT INTO auth_oidc_states'));
    assert.equal(insertQuery, undefined, 'INSERT must not occur when the cap is reached');
    assert.ok(queries.some(q => q.sql === 'ROLLBACK'), 'transaction must be rolled back');
  });

  await t.test('allows state allocation when below the global cap', async () => {
    const queries = [];
    const pool = {
      async query() {
        throw new Error('State creation must use a dedicated transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            queries.push({ sql, values });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('DELETE FROM auth_oidc_states')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT count(*)::int AS total FROM auth_oidc_states')) {
              // Simulate the table being below the cap
              return { rowCount: 1, rows: [{ total: MAX_ACTIVE_OIDC_STATES - 1 }] };
            }
            if (sql.includes('INSERT INTO auth_oidc_states')) {
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });

    const result = await identity.createOidcState({
      state: 'b'.repeat(43),
      nonce: 'test-nonce',
      verifier: 'test-verifier',
      issuer: 'https://idp.example.test',
    });

    assert.equal(result.expiresInSeconds, 600);
    assert.ok(queries.some(q => q.sql.includes('INSERT INTO auth_oidc_states')), 'INSERT must occur when below cap');
    assert.ok(queries.some(q => q.sql === 'COMMIT'), 'transaction must commit');
  });

  await t.test('acquires advisory lock to serialize allocation and prevent concurrent cap violations', async () => {
    const queries = [];
    const pool = {
      async query() {
        throw new Error('State creation must use a dedicated transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            queries.push({ sql, values });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              assert.deepEqual(values, ['auth_oidc_states_allocation'], 'advisory lock must use consistent key');
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('DELETE FROM auth_oidc_states')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT count(*)::int AS total FROM auth_oidc_states')) {
              return { rowCount: 1, rows: [{ total: 0 }] };
            }
            if (sql.includes('INSERT INTO auth_oidc_states')) {
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });

    await identity.createOidcState({
      state: 'c'.repeat(43),
      nonce: 'test-nonce',
      verifier: 'test-verifier',
      issuer: 'https://idp.example.test',
    });

    // Verify advisory lock is acquired before counting and inserting
    const lockIndex = queries.findIndex(q => q.sql.includes('pg_advisory_xact_lock'));
    const countIndex = queries.findIndex(q => q.sql.includes('SELECT count(*)::int AS total'));
    const insertIndex = queries.findIndex(q => q.sql.includes('INSERT INTO auth_oidc_states'));

    assert.ok(lockIndex >= 0, 'advisory lock must be acquired');
    assert.ok(lockIndex < countIndex, 'lock must be acquired before counting');
    assert.ok(countIndex < insertIndex, 'count must occur before insert');
  });
});

test('OIDC state allocation reclaims expired and consumed rows before allocating new state', async () => {
  const queries = [];
  const pool = {
    async query() {
      throw new Error('State creation must use a dedicated transaction client.');
    },
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('pg_advisory_xact_lock')) {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('DELETE FROM auth_oidc_states WHERE expires_at<=now() OR consumed_at IS NOT NULL')) {
            // Simulate cleanup removing expired/consumed rows
            return { rowCount: 42, rows: [] };
          }
          if (sql.includes('SELECT count(*)::int AS total FROM auth_oidc_states')) {
            return { rowCount: 1, rows: [{ total: 100 }] };
          }
          if (sql.includes('INSERT INTO auth_oidc_states')) {
            return { rowCount: 1, rows: [] };
          }
          throw new Error('Unexpected query: ' + sql);
        },
        release() {},
      };
    },
  };

  const identity = createIdentityService({ pool, env: {} });

  await identity.createOidcState({
    state: 'd'.repeat(43),
    nonce: 'test-nonce',
    verifier: 'test-verifier',
    issuer: 'https://idp.example.test',
  });

  // Verify cleanup happens before counting
  const deleteIndex = queries.findIndex(q => q.sql.includes('DELETE FROM auth_oidc_states'));
  const countIndex = queries.findIndex(q => q.sql.includes('SELECT count(*)::int AS total'));

  assert.ok(deleteIndex >= 0, 'cleanup DELETE must occur');
  assert.ok(deleteIndex < countIndex, 'cleanup must occur before counting active states');
  assert.ok(queries.some(q => q.sql === 'COMMIT'), 'transaction must commit');
});

test('OIDC state consumption deletes the row instead of marking it consumed', async () => {
  const stateValue = 'e'.repeat(43);
  const queries = [];
  const pool = {
    async query() {
      throw new Error('State consumption must use a dedicated transaction client.');
    },
    async connect() {
      return {
        async query(sql, values = []) {
          queries.push({ sql, values });
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('SELECT id,nonce,code_verifier,issuer FROM auth_oidc_states')) {
            return {
              rowCount: 1,
              rows: [{
                id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                nonce: 'test-nonce',
                code_verifier: 'test-verifier',
                issuer: 'https://idp.example.test',
              }],
            };
          }
          if (sql.includes('DELETE FROM auth_oidc_states WHERE id=$1')) {
            assert.deepEqual(values, ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'], 'DELETE must target the correct row');
            return { rowCount: 1, rows: [] };
          }
          throw new Error('Unexpected query: ' + sql);
        },
        release() {},
      };
    },
  };

  const identity = createIdentityService({ pool, env: {} });

  const result = await identity.consumeOidcState({ state: stateValue });

  assert.equal(result.nonce, 'test-nonce');
  assert.equal(result.verifier, 'test-verifier');
  assert.equal(result.issuer, 'https://idp.example.test');

  // Verify DELETE is used instead of UPDATE
  const deleteQuery = queries.find(q => q.sql.includes('DELETE FROM auth_oidc_states WHERE id=$1'));
  const updateQuery = queries.find(q => q.sql.includes('UPDATE auth_oidc_states'));

  assert.ok(deleteQuery, 'consumption must DELETE the state row');
  assert.equal(updateQuery, undefined, 'consumption must not UPDATE the row');
  assert.ok(queries.some(q => q.sql === 'COMMIT'), 'transaction must commit');
});

test('OIDC state consumption rejects invalid or expired states', async () => {
  const pool = {
    async query() {
      throw new Error('State consumption must use a dedicated transaction client.');
    },
    async connect() {
      return {
        async query(sql) {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('SELECT id,nonce,code_verifier,issuer FROM auth_oidc_states')) {
            // Simulate no matching state found
            return { rowCount: 0, rows: [] };
          }
          throw new Error('Unexpected query: ' + sql);
        },
        release() {},
      };
    },
  };

  const identity = createIdentityService({ pool, env: {} });

  await assert.rejects(
    identity.consumeOidcState({ state: 'f'.repeat(43) }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );
});

test('OIDC state creation validates input parameters', async () => {
  const pool = {
    async query() {
      throw new Error('Validation must occur before database access.');
    },
    async connect() {
      throw new Error('Validation must occur before opening a transaction.');
    },
  };

  const identity = createIdentityService({ pool, env: {} });

  // Test missing state
  await assert.rejects(
    identity.createOidcState({
      state: '',
      nonce: 'test-nonce',
      verifier: 'test-verifier',
      issuer: 'https://idp.example.test',
    }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );

  // Test missing nonce
  await assert.rejects(
    identity.createOidcState({
      state: 'g'.repeat(43),
      nonce: '',
      verifier: 'test-verifier',
      issuer: 'https://idp.example.test',
    }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );

  // Test missing verifier
  await assert.rejects(
    identity.createOidcState({
      state: 'h'.repeat(43),
      nonce: 'test-nonce',
      verifier: '',
      issuer: 'https://idp.example.test',
    }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );

  // Test missing issuer
  await assert.rejects(
    identity.createOidcState({
      state: 'i'.repeat(43),
      nonce: 'test-nonce',
      verifier: 'test-verifier',
      issuer: '',
    }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );
});

test('OIDC state consumption validates state parameter', async () => {
  const pool = {
    async query() {
      throw new Error('Validation must occur before database access.');
    },
    async connect() {
      throw new Error('Validation must occur before opening a transaction.');
    },
  };

  const identity = createIdentityService({ pool, env: {} });

  // Test state too short
  await assert.rejects(
    identity.consumeOidcState({ state: 'short' }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );

  // Test state too long
  await assert.rejects(
    identity.consumeOidcState({ state: 'x'.repeat(300) }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );

  // Test non-string state
  await assert.rejects(
    identity.consumeOidcState({ state: null }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_OIDC_STATE_INVALID'
  );
});

test('OIDC state lifecycle prevents unbounded table growth from unauthenticated requests', async t => {
  await t.test('simulates sustained unauthenticated allocation attempts respecting the global cap', async () => {
    let activeStates = 9_998; // Start just below the cap
    const queries = [];
    const pool = {
      async query() {
        throw new Error('State creation must use a dedicated transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            queries.push({ sql, values });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('DELETE FROM auth_oidc_states')) {
              // Simulate no expired/consumed states to clean up
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT count(*)::int AS total FROM auth_oidc_states')) {
              return { rowCount: 1, rows: [{ total: activeStates }] };
            }
            if (sql.includes('INSERT INTO auth_oidc_states')) {
              activeStates++;
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });

    // First request should succeed (9,998 -> 9,999)
    await identity.createOidcState({
      state: 'j'.repeat(43),
      nonce: 'nonce-1',
      verifier: 'verifier-1',
      issuer: 'https://idp.example.test',
    });
    assert.equal(activeStates, 9_999);

    // Second request should succeed (9,999 -> 10,000)
    await identity.createOidcState({
      state: 'k'.repeat(43),
      nonce: 'nonce-2',
      verifier: 'verifier-2',
      issuer: 'https://idp.example.test',
    });
    assert.equal(activeStates, 10_000);

    // Third request should be rejected (at cap)
    await assert.rejects(
      identity.createOidcState({
        state: 'l'.repeat(43),
        nonce: 'nonce-3',
        verifier: 'verifier-3',
        issuer: 'https://idp.example.test',
      }),
      error => error.statusCode === 429 && error.code === 'ERR_VIRGOSCORPIO_HUB_RATE_LIMIT'
    );
    assert.equal(activeStates, 10_000, 'state count must not exceed cap');
  });

  await t.test('demonstrates cleanup reclaims space for new allocations', async () => {
    let activeStates = 10_000; // Start at the cap
    let cleanupCount = 0;
    const queries = [];
    const pool = {
      async query() {
        throw new Error('State creation must use a dedicated transaction client.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            queries.push({ sql, values });
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('DELETE FROM auth_oidc_states')) {
              // Simulate cleanup removing expired states
              const removed = cleanupCount === 0 ? 100 : 0;
              cleanupCount++;
              activeStates -= removed;
              return { rowCount: removed, rows: [] };
            }
            if (sql.includes('SELECT count(*)::int AS total FROM auth_oidc_states')) {
              return { rowCount: 1, rows: [{ total: activeStates }] };
            }
            if (sql.includes('INSERT INTO auth_oidc_states')) {
              activeStates++;
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });

    // First request at cap should clean up 100 expired states and succeed
    await identity.createOidcState({
      state: 'm'.repeat(43),
      nonce: 'nonce-cleanup',
      verifier: 'verifier-cleanup',
      issuer: 'https://idp.example.test',
    });
    assert.equal(activeStates, 9_901, 'cleanup should reclaim space: 10,000 - 100 + 1');

    // Verify cleanup occurred
    const deleteQueries = queries.filter(q => q.sql.includes('DELETE FROM auth_oidc_states'));
    assert.ok(deleteQueries.length > 0, 'cleanup DELETE must be executed');
  });
});
