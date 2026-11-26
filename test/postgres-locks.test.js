'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { waitForDatabaseWriteLock } = require('./helpers/postgres-locks');

test('waitForDatabaseWriteLock observes a matching statement blocked by the supplied backend', async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql === 'SELECT pg_backend_pid() AS pid') return { rows: [{ pid: 4321 }] };
      return { rows: [{ '?column?': 1 }] };
    }
  };

  assert.equal(await waitForDatabaseWriteLock(client, 'FOR KEY SHARE'), true);
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /a.wait_event_type='Lock'/);
  assert.match(queries[1].sql, /\$1=ANY\(pg_blocking_pids\(a\.pid\)\)/);
  assert.match(queries[1].sql, /a\.state='active'/);
  assert.match(queries[1].sql, /a\.query ILIKE \$2/);
  assert.deepEqual(queries[1].values, [4321, '%for key share%']);
});

test('waitForDatabaseWriteLock can identify a blocked row lock by relation evidence', async () => {
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql === 'SELECT pg_backend_pid() AS pid') return { rows: [{ pid: 4321 }] };
      return { rows: [{ '?column?': 1 }] };
    }
  };

  assert.equal(await waitForDatabaseWriteLock(client, 'FOR KEY SHARE', 5000, { relationName: 'sites' }), true);
  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /relation_lock\.relation=to_regclass\(\$2\)/);
  assert.doesNotMatch(queries[1].sql, /a\.state='active'/);
  assert.match(queries[1].sql, /a\.wait_event_type='Lock'/);
  assert.match(queries[1].sql, /\$1=ANY\(pg_blocking_pids\(a\.pid\)\)/);
  assert.match(queries[1].sql, /relation_lock\.mode='RowShareLock'/);
  assert.match(queries[1].sql, /tuple_lock\.locktype='tuple'/);
  assert.match(queries[1].sql, /transaction_wait\.mode='ShareLock'/);
  assert.deepEqual(queries[1].values, [4321, 'sites']);
});

test('waitForDatabaseWriteLock ignores lock waits caused by another backend', async () => {
  const client = {
    async query(sql) {
      if (sql === 'SELECT pg_backend_pid() AS pid') return { rows: [{ pid: 4321 }] };
      return { rows: [] };
    }
  };

  assert.equal(await waitForDatabaseWriteLock(client, 'FOR KEY SHARE', 25), false);
});

test('waitForDatabaseWriteLock rejects invalid clients, fragments and deadlines', async () => {
  await assert.rejects(waitForDatabaseWriteLock(null, 'FOR UPDATE'), /query client/);
  await assert.rejects(waitForDatabaseWriteLock({ query() {} }, '  '), /SQL query fragment/);
  await assert.rejects(waitForDatabaseWriteLock({ query() {} }, 'FOR UPDATE', 5000, { relationName: 'sites;DROP' }), /relationName/);
  await assert.rejects(waitForDatabaseWriteLock({ query() {} }, 'FOR UPDATE', 0), /timeoutMs/);
  await assert.rejects(
    waitForDatabaseWriteLock({ query: async () => ({ rows: [] }) }, 'FOR UPDATE'),
    /valid blocking backend PID/
  );
});
