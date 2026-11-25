'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

/**
 * Bootstrap security regression tests for the pentest finding:
 * "Bootstrap secret remains valid after provisioning when all users are disabled"
 *
 * The vulnerability allowed an attacker with the bootstrap secret to create a new
 * site-owner account after all existing users were disabled, because the closure
 * check only counted non-disabled users.
 *
 * The mitigation changes the closure check to count ALL users regardless of status,
 * ensuring bootstrap is truly one-time and cannot be reopened by disabling accounts.
 */

test('bootstrap closes permanently once any user exists, regardless of status', async t => {
  await t.test('bootstrap succeeds when no users exist', async () => {
    const events = [];
    const pool = {
      async query(sql) {
        // Early check before password hash
        if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
          events.push('EARLY_CHECK_ALL_USERS');
          return { rows: [{ count: 0 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              events.push('LOCK');
              return { rowCount: 0, rows: [] };
            }
            // The critical security check under lock
            if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
              events.push('LOCKED_CHECK_ALL_USERS');
              return { rows: [{ count: 0 }] };
            }
            if (sql.includes('INSERT INTO sites')) {
              events.push('INSERT_SITE');
              return { rows: [{ id: 'site-1', slug: 'main', name: 'Main Site', default_locale: 'en' }] };
            }
            if (sql.includes('INSERT INTO users')) {
              events.push('INSERT_USER');
              return { rows: [{ id: 'user-1', email: 'owner@example.test', display_name: 'Owner', status: 'active' }] };
            }
            if (sql.includes("SELECT id FROM roles WHERE slug='site-owner'")) {
              events.push('SELECT_OWNER_ROLE');
              return { rows: [{ id: 'role-1' }] };
            }
            if (sql.includes('INSERT INTO site_memberships')) {
              events.push('INSERT_MEMBERSHIP');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected transaction query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const result = await identity.bootstrapOwner({
      email: 'owner@example.test',
      password: 'SecurePassword123',
      displayName: 'Owner',
      siteSlug: 'main',
      siteName: 'Main Site',
    });

    assert.equal(result.user.email, 'owner@example.test');
    assert.equal(result.site.slug, 'main');
    assert.deepEqual(events, [
      'EARLY_CHECK_ALL_USERS',
      'BEGIN',
      'LOCK',
      'LOCKED_CHECK_ALL_USERS',
      'INSERT_SITE',
      'INSERT_USER',
      'SELECT_OWNER_ROLE',
      'INSERT_MEMBERSHIP',
      'COMMIT',
      'RELEASE',
    ]);
  });

  await t.test('bootstrap rejects when an active user exists', async () => {
    const events = [];
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
          events.push('EARLY_CHECK_ALL_USERS');
          return { rows: [{ count: 1 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        throw new Error('Bootstrap must reject before opening a transaction when users exist.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'attacker@example.test',
        password: 'SecurePassword123',
        displayName: 'Attacker',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => {
        return error.statusCode === 409 &&
               error.code === 'ERR_VIRGOSCORPIO_HUB_BOOTSTRAP_CLOSED' &&
               error.message.includes('Bootstrap is only allowed before any user account exists');
      }
    );

    assert.deepEqual(events, ['EARLY_CHECK_ALL_USERS']);
  });

  await t.test('bootstrap rejects when a disabled user exists (exploit scenario)', async () => {
    const events = [];
    const pool = {
      async query(sql) {
        // Early check counts ALL users, not just active ones
        if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
          events.push('EARLY_CHECK_ALL_USERS');
          // Simulate one disabled user exists
          return { rows: [{ count: 1 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        throw new Error('Bootstrap must reject before opening a transaction when any user exists.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'attacker@example.test',
        password: 'SecurePassword123',
        displayName: 'Attacker',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => {
        return error.statusCode === 409 &&
               error.code === 'ERR_VIRGOSCORPIO_HUB_BOOTSTRAP_CLOSED' &&
               error.message.includes('Bootstrap is only allowed before any user account exists');
      }
    );

    assert.deepEqual(events, ['EARLY_CHECK_ALL_USERS']);
  });

  await t.test('bootstrap rejects when multiple disabled users exist', async () => {
    const events = [];
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
          events.push('EARLY_CHECK_ALL_USERS');
          // Simulate multiple disabled users
          return { rows: [{ count: 5 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        throw new Error('Bootstrap must reject before opening a transaction when any user exists.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'attacker@example.test',
        password: 'SecurePassword123',
        displayName: 'Attacker',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => {
        return error.statusCode === 409 &&
               error.code === 'ERR_VIRGOSCORPIO_HUB_BOOTSTRAP_CLOSED';
      }
    );

    assert.deepEqual(events, ['EARLY_CHECK_ALL_USERS']);
  });

  await t.test('bootstrap double-checks under advisory lock', async () => {
    const events = [];
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
          events.push('EARLY_CHECK_ALL_USERS');
          return { rows: [{ count: 0 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              events.push('LOCK');
              return { rowCount: 0, rows: [] };
            }
            // Race condition: another process created a user between early check and lock
            if (sql.includes('SELECT count(*)::integer AS count FROM users') && !sql.includes('WHERE')) {
              events.push('LOCKED_CHECK_ALL_USERS');
              return { rows: [{ count: 1 }] };
            }
            throw new Error('Unexpected transaction query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'racer@example.test',
        password: 'SecurePassword123',
        displayName: 'Racer',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => {
        return error.statusCode === 409 &&
               error.code === 'ERR_VIRGOSCORPIO_HUB_BOOTSTRAP_CLOSED';
      }
    );

    assert.deepEqual(events, [
      'EARLY_CHECK_ALL_USERS',
      'BEGIN',
      'LOCK',
      'LOCKED_CHECK_ALL_USERS',
      'ROLLBACK',
      'RELEASE',
    ]);
  });
});

test('bootstrap closure check does not filter by user status', async t => {
  await t.test('the SQL query counts all users without a WHERE clause', async () => {
    const queries = [];
    const pool = {
      async query(sql) {
        queries.push(sql);
        if (sql.includes('SELECT count(*)::integer AS count FROM users')) {
          // Verify the query does NOT filter by status
          assert.equal(sql.includes('WHERE'), false, 'Bootstrap closure check must not filter users by status');
          assert.equal(sql.includes('status'), false, 'Bootstrap closure check must not reference status column');
          return { rows: [{ count: 0 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        return {
          async query(sql) {
            queries.push(sql);
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('pg_advisory_xact_lock')) {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT count(*)::integer AS count FROM users')) {
              // Verify the locked check also does NOT filter by status
              assert.equal(sql.includes('WHERE'), false, 'Locked bootstrap check must not filter users by status');
              assert.equal(sql.includes('status'), false, 'Locked bootstrap check must not reference status column');
              return { rows: [{ count: 0 }] };
            }
            if (sql.includes('INSERT INTO sites')) {
              return { rows: [{ id: 'site-1', slug: 'main', name: 'Main Site', default_locale: 'en' }] };
            }
            if (sql.includes('INSERT INTO users')) {
              return { rows: [{ id: 'user-1', email: 'owner@example.test', display_name: 'Owner', status: 'active' }] };
            }
            if (sql.includes("SELECT id FROM roles WHERE slug='site-owner'")) {
              return { rows: [{ id: 'role-1' }] };
            }
            if (sql.includes('INSERT INTO site_memberships')) {
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected transaction query: ' + sql);
          },
          release() {},
        };
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await identity.bootstrapOwner({
      email: 'owner@example.test',
      password: 'SecurePassword123',
      displayName: 'Owner',
      siteSlug: 'main',
      siteName: 'Main Site',
    });

    // Verify both checks were performed
    const userCountQueries = queries.filter(q => q.includes('SELECT count(*)::integer AS count FROM users'));
    assert.equal(userCountQueries.length, 2, 'Bootstrap must perform both early and locked user count checks');
  });
});

test('bootstrap security properties are enforced before side effects', async t => {
  await t.test('bootstrap rejects invalid email before checking user count', async () => {
    const pool = {
      async query() {
        throw new Error('Bootstrap must validate email before database access.');
      },
      async connect() {
        throw new Error('Bootstrap must validate email before opening a transaction.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'not-an-email',
        password: 'SecurePassword123',
        displayName: 'Invalid',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_INVALID_EMAIL'
    );
  });

  await t.test('bootstrap rejects weak password before checking user count', async () => {
    const pool = {
      async query() {
        throw new Error('Bootstrap must validate password before database access.');
      },
      async connect() {
        throw new Error('Bootstrap must validate password before opening a transaction.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'owner@example.test',
        password: 'weak',
        displayName: 'Invalid',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_PASSWORD_POLICY'
    );
  });

  await t.test('bootstrap rejects invalid site slug before checking user count', async () => {
    const pool = {
      async query() {
        throw new Error('Bootstrap must validate site slug before database access.');
      },
      async connect() {
        throw new Error('Bootstrap must validate site slug before opening a transaction.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'owner@example.test',
        password: 'SecurePassword123',
        displayName: 'Invalid',
        siteSlug: 'INVALID SLUG!',
        siteName: 'Main Site',
      }),
      error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_INVALID_SITE_SLUG'
    );
  });

  await t.test('bootstrap checks user count before expensive password hash', async () => {
    const events = [];
    const pool = {
      async query(sql) {
        if (sql.includes('SELECT count(*)::integer AS count FROM users')) {
          events.push('CHECK_USER_COUNT');
          return { rows: [{ count: 1 }] };
        }
        throw new Error('Unexpected pool-level query: ' + sql);
      },
      async connect() {
        throw new Error('Bootstrap must reject before opening a transaction.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.bootstrapOwner({
        email: 'owner@example.test',
        password: 'SecurePassword123',
        displayName: 'Owner',
        siteSlug: 'main',
        siteName: 'Main Site',
      }),
      error => error.statusCode === 409 && error.code === 'ERR_VIRGOSCORPIO_HUB_BOOTSTRAP_CLOSED'
    );
    const duration = Date.now() - startTime;

    // Password hashing with scrypt takes ~100ms; rejection should be much faster
    assert.ok(duration < 50, 'Bootstrap rejection should be fast (no password hash)');
    assert.deepEqual(events, ['CHECK_USER_COUNT']);
  });
});

test('bootstrap error messages do not leak sensitive information', async t => {
  await t.test('closure error message does not reveal user count or status', async () => {
    const pool = {
      async query() {
        return { rows: [{ count: 1 }] };
      },
      async connect() {
        throw new Error('Should not reach transaction.');
      },
    };

    const identity = createIdentityService({ pool, env: {} });
    try {
      await identity.bootstrapOwner({
        email: 'attacker@example.test',
        password: 'SecurePassword123',
        displayName: 'Attacker',
        siteSlug: 'main',
        siteName: 'Main Site',
      });
      assert.fail('Bootstrap should have been rejected');
    } catch (error) {
      // Error message should be generic and not reveal whether users are active or disabled
      assert.equal(error.message, 'Bootstrap is only allowed before any user account exists.');
      assert.equal(error.message.includes('disabled'), false);
      assert.equal(error.message.includes('active'), false);
      // Check that the message doesn't reveal the actual count (e.g., "1 user" or "count: 5")
      assert.equal(/\d+\s+(user|account)/.test(error.message), false);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_BOOTSTRAP_CLOSED');
    }
  });
});
