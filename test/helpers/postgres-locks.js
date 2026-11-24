'use strict';

/**
 * Wait until another PostgreSQL backend is blocked by the caller's backend on a
 * query containing the supplied SQL fragment.
 *
 * The caller must hold the blocking row/table lock on the same client. Matching
 * pg_blocking_pids() to that backend prevents unrelated concurrent tests from
 * producing false positives or hiding the intended wait behind newer queries.
 * Returns false when the wait is not observed before the bounded deadline.
 *
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ pid?: number }> }> }} client
 * @param {string} queryFragment
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForDatabaseWriteLock(client, queryFragment, timeoutMs = 5000) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A PostgreSQL query client is required.');
  }
  if (typeof queryFragment !== 'string' || !queryFragment.trim()) {
    throw new TypeError('A non-empty SQL query fragment is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw new RangeError('timeoutMs must be an integer between 1 and 30000.');
  }

  const backend = await client.query('SELECT pg_backend_pid() AS pid');
  const blockerPid = Number(backend.rows?.[0]?.pid);
  if (!Number.isSafeInteger(blockerPid) || blockerPid < 1) {
    throw new Error('PostgreSQL did not return a valid blocking backend PID.');
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const activity = await client.query(
      `SELECT 1
         FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> $1
          AND state = 'active'
          AND wait_event_type = 'Lock'
          AND $1 = ANY(pg_blocking_pids(pid))
          AND query ILIKE $2
        LIMIT 1`,
      [blockerPid, `%${queryFragment.toLowerCase()}%`]
    );
    if (activity.rows.length > 0) return true;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return false;
}

module.exports = { waitForDatabaseWriteLock };