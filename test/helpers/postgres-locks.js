'use strict';

/**
 * Wait until another PostgreSQL backend reports a lock wait for a query
 * containing the supplied SQL fragment.
 *
 * The caller should hold the blocking row/table lock on a separate client.
 * Returns false when the wait is not observed before the bounded deadline.
 *
 * @param {{ query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ wait_event_type: string | null }> }> }} client
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

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const activity = await client.query(
      `SELECT wait_event_type
         FROM pg_stat_activity
        WHERE datname = current_database()
          AND pid <> pg_backend_pid()
          AND query ILIKE $1
        ORDER BY query_start DESC
        LIMIT 1`,
      [`%${queryFragment.toLowerCase()}%`]
    );
    if (activity.rows[0]?.wait_event_type === 'Lock') return true;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return false;
}

module.exports = { waitForDatabaseWriteLock };
