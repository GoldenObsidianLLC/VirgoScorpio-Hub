'use strict';

/**
 * Wait until another PostgreSQL backend is blocked by the caller's backend.
 *
 * By default, the wait must match the supplied SQL fragment. When `options`
 * includes `relationName`, the observer instead verifies the target relation's
 * RowShareLock, tuple-lock evidence, blocked transaction-ID ShareLock, and the
 * caller's PID in pg_blocking_pids(). This supports row-lock waits where
 * pg_stat_activity.query is stale or does not report the statement that acquired
 * the relation lock. Returns false when the bounded wait is not observed.
 *
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ pid?: number }> }> }} client
 * @param {string} queryFragment
 * @param {number} timeoutMs
 * @param {{ relationName?: string }} options
 * @returns {Promise<boolean>}
 */
async function waitForDatabaseWriteLock(client, queryFragment, timeoutMs = 5000, options = {}) {
  const { relationName = null } = options;
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A PostgreSQL query client is required.');
  }
  if (typeof queryFragment !== 'string' || !queryFragment.trim()) {
    throw new TypeError('A non-empty SQL query fragment is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new RangeError('timeoutMs must be an integer between 1 and 30000.');
  }
  if (relationName !== null && (
    typeof relationName !== 'string' ||
    !/^[a-z_][a-z0-9_$]*(?:\.[a-z_][a-z0-9_$]*)?$/i.test(relationName)
  )) {
    throw new TypeError('relationName must be a simple, optionally schema-qualified SQL identifier.');
  }

  const backend = await client.query('SELECT pg_backend_pid() AS pid');
  const blockerPid = Number(backend.rows?.[0]?.pid);
  if (!Number.isSafeInteger(blockerPid) || blockerPid < 1) {
    throw new Error('PostgreSQL did not return a valid blocking backend PID.');
  }

  // When query text is unreliable (for example, a backend retaining an earlier
  // statement in pg_stat_activity while waiting on a row transaction ID), the
  // caller may identify the requested row-lock target by its pg_locks evidence.
  const waitPredicate = relationName === null
    ? 'AND a.query ILIKE $2'
    : `AND EXISTS (
         SELECT 1 FROM pg_locks relation_lock
          WHERE relation_lock.pid=a.pid
            AND relation_lock.locktype='relation'
            AND relation_lock.relation=to_regclass($2)
            AND relation_lock.mode='RowShareLock'
            AND relation_lock.granted
       )
       AND EXISTS (
         SELECT 1 FROM pg_locks tuple_lock
          WHERE tuple_lock.pid=a.pid
            AND tuple_lock.locktype='tuple'
            AND tuple_lock.relation=to_regclass($2)
       )
       AND EXISTS (
         SELECT 1 FROM pg_locks transaction_wait
          WHERE transaction_wait.pid=a.pid
            AND transaction_wait.locktype='transactionid'
            AND transaction_wait.mode='ShareLock'
            AND NOT transaction_wait.granted
       )`;
  const values = relationName === null
    ? [blockerPid, `%${queryFragment.toLowerCase()}%`]
    : [blockerPid, relationName];

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const activity = await client.query(
      `SELECT 1
         FROM pg_stat_activity a
        WHERE a.datname=current_database()
          AND a.pid<>$1
          AND a.state='active'
          AND a.wait_event_type='Lock'
          AND $1=ANY(pg_blocking_pids(a.pid))
          ${waitPredicate}
        LIMIT 1`,
      values,
    );
    if (activity.rows.length > 0) return true;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return false;
}

module.exports = { waitForDatabaseWriteLock };