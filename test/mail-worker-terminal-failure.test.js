'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { processBatch } = require('../apps/worker/src/mail-worker');

/**
 * Tests for mail-worker terminal failure mitigation.
 * 
 * Pentest finding: Terminal mail-outbox failures are requeued indefinitely, enabling queue exhaustion.
 * The worker's claim query selected rows with status IN ('pending','failed') without constraining
 * attempts or excluding terminal rows. Terminal failures (attempts >= 8 or permanent errors) were
 * written back as 'failed', making them eligible for reprocessing indefinitely.
 * 
 * Mitigation: The claim query now only selects rows with status='pending' AND attempts<8,
 * ensuring terminal failures are not reprocessed.
 */

function createMockPool(rows = []) {
  for (const row of rows) {
    if (row.template === 'password-reset' && !row.payload?.expiresAt) {
      row.payload = { ...(row.payload || {}), expiresAt: new Date(Date.now() + 60_000).toISOString() };
    }
  }
  const poolCalls = [];
  const clientCalls = [];
  let released = false;
  
  const client = {
    async query(sql, params) {
      clientCalls.push({ sql, params });
      
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'COMMIT') return { rows: [] };
      if (sql === 'ROLLBACK') return { rows: [] };
      
      // Claim query
      if (sql.includes('SELECT id,recipient,template,payload,attempts')) {
        return { rows: rows.filter(r => r.status === 'pending' && r.attempts < 8) };
      }
      
      // Update to processing
      if (sql.includes("UPDATE mail_outbox SET status='processing'")) {
        return { rows: [] };
      }
      
      return { rows: [] };
    },
    release() {
      released = true;
    }
  };
  
  const pool = {
    async connect() {
      return client;
    },
    async query(sql, params) {
      poolCalls.push({ sql, params });
      return { rows: [] };
    },
    poolCalls,
    clientCalls,
    isReleased: () => released
  };
  
  return pool;
}

test('mail worker claim query excludes rows with attempts >= 8', async () => {
  const rows = [
    { id: '1', recipient: 'user1@example.com', template: 'password-reset', payload: {}, attempts: 7, status: 'pending' },
    { id: '2', recipient: 'user2@example.com', template: 'password-reset', payload: {}, attempts: 8, status: 'pending' },
    { id: '3', recipient: 'user3@example.com', template: 'password-reset', payload: {}, attempts: 9, status: 'pending' }
  ];
  
  const pool = createMockPool(rows);
  
  await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // Find the claim query
  const claimQuery = pool.clientCalls.find(call => 
    call.sql.includes('SELECT id,recipient,template,payload,attempts')
  );
  
  assert.ok(claimQuery, 'Claim query should be executed');
  assert.match(claimQuery.sql, /attempts<8/, 'Claim query must exclude rows with attempts >= 8');
  assert.match(claimQuery.sql, /status='pending'/, 'Claim query must only select pending rows');
  assert.doesNotMatch(claimQuery.sql, /status IN \('pending','failed'\)/, 'Claim query must not select failed rows');
});

test('mail worker claim query only selects pending status, not failed', async () => {
  const rows = [
    { id: '1', recipient: 'user1@example.com', template: 'password-reset', payload: {}, attempts: 3, status: 'pending' },
    { id: '2', recipient: 'user2@example.com', template: 'password-reset', payload: {}, attempts: 3, status: 'failed' }
  ];
  
  const pool = createMockPool(rows);
  
  await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  const claimQuery = pool.clientCalls.find(call => 
    call.sql.includes('SELECT id,recipient,template,payload,attempts')
  );
  
  assert.ok(claimQuery, 'Claim query should be executed');
  assert.match(claimQuery.sql, /status='pending'/, 'Claim query must only select pending status');
  assert.doesNotMatch(claimQuery.sql, /status IN/, 'Claim query must not use IN clause for status');
});

test('mail worker does not reprocess terminal failures marked as failed', async () => {
  // Simulate a row that has been marked as failed after reaching terminal state
  const terminalRow = {
    id: 'terminal-1',
    recipient: 'user@example.com',
    template: 'password-reset',
    payload: {},
    attempts: 8,
    status: 'failed'
  };
  
  const pool = createMockPool([terminalRow]);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // The terminal row should not be processed
  assert.equal(result.processed, 0, 'Terminal failed rows should not be processed');
  assert.equal(result.results.length, 0, 'No results should be returned for terminal rows');
});

test('mail worker processes rows with attempts < 8 and status pending', async () => {
  const validRows = [
    { id: '1', recipient: 'user1@example.com', template: 'password-reset', payload: {}, attempts: 0, status: 'pending' },
    { id: '2', recipient: 'user2@example.com', template: 'password-reset', payload: {}, attempts: 7, status: 'pending' }
  ];
  
  const pool = createMockPool(validRows);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // Both rows should be attempted (though they will fail due to disabled provider)
  assert.equal(result.processed, 2, 'Should process both valid rows');
});

test('mail worker claim query structure prevents indefinite retry of terminal failures', async () => {
  const pool = createMockPool([]);
  
  await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  const claimQuery = pool.clientCalls.find(call => 
    call.sql.includes('SELECT id,recipient,template,payload,attempts')
  );
  
  assert.ok(claimQuery, 'Claim query should be executed');
  
  // Verify the query has all required constraints
  assert.match(claimQuery.sql, /status='pending'/, 'Must filter by pending status');
  assert.match(claimQuery.sql, /attempts<8/, 'Must exclude exhausted attempts');
  assert.match(claimQuery.sql, /available_at<=now\(\)/, 'Must respect backoff timing');
  assert.match(claimQuery.sql, /FOR UPDATE SKIP LOCKED/, 'Must use row-level locking');
  
  // Verify it does NOT have the vulnerable patterns
  assert.doesNotMatch(claimQuery.sql, /status IN \('pending','failed'\)/, 'Must not select failed rows');
  assert.doesNotMatch(claimQuery.sql, /status='failed'/, 'Must not select failed status');
});

test('mail worker terminal failure logic still marks failures correctly', async () => {
  const row = {
    id: 'test-1',
    recipient: 'user@example.com',
    template: 'password-reset',
    payload: {},
    attempts: 7,
    status: 'pending'
  };
  
  const pool = createMockPool([row]);
  
  // This will fail because provider is disabled
  await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // Find the update query that marks the row as failed
  const updateQuery = pool.poolCalls.find(call => 
    call.sql.includes('UPDATE mail_outbox SET status=')
  );
  
  assert.ok(updateQuery, 'Should update the row status');
  
  // The row should be marked as 'failed' (terminal) because attempts will be 8
  assert.equal(updateQuery.params[1], 'failed', 'Should mark as failed when reaching attempt 8');
  assert.equal(updateQuery.params[2], 8, 'Should increment attempts to 8');
});

test('mail worker does not process rows at exactly 8 attempts', async () => {
  const rows = [
    { id: '1', recipient: 'user@example.com', template: 'password-reset', payload: {}, attempts: 8, status: 'pending' }
  ];
  
  const pool = createMockPool(rows);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  assert.equal(result.processed, 0, 'Should not process rows with attempts=8');
});

test('mail worker processes rows at 7 attempts but not 8 or higher', async () => {
  const rows = [
    { id: '1', recipient: 'user1@example.com', template: 'password-reset', payload: {}, attempts: 6, status: 'pending' },
    { id: '2', recipient: 'user2@example.com', template: 'password-reset', payload: {}, attempts: 7, status: 'pending' },
    { id: '3', recipient: 'user3@example.com', template: 'password-reset', payload: {}, attempts: 8, status: 'pending' },
    { id: '4', recipient: 'user4@example.com', template: 'password-reset', payload: {}, attempts: 9, status: 'pending' }
  ];
  
  const pool = createMockPool(rows);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // Only rows with attempts 6 and 7 should be processed
  assert.equal(result.processed, 2, 'Should only process rows with attempts < 8');
});

test('mail worker claim query prevents queue exhaustion from terminal failures', async () => {
  // Simulate a scenario where many terminal failures exist
  const terminalFailures = Array.from({ length: 100 }, (_, i) => ({
    id: `terminal-${i}`,
    recipient: `user${i}@example.com`,
    template: 'password-reset',
    payload: {},
    attempts: 8 + (i % 5), // attempts 8-12
    status: 'failed'
  }));
  
  const validRows = [
    { id: 'valid-1', recipient: 'valid@example.com', template: 'password-reset', payload: {}, attempts: 3, status: 'pending' }
  ];
  
  const pool = createMockPool([...terminalFailures, ...validRows]);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // Only the valid row should be processed, terminal failures should be ignored
  assert.equal(result.processed, 1, 'Should only process valid pending rows, not terminal failures');
});

test('mail worker claim query uses correct parameter binding', async () => {
  const pool = createMockPool([]);
  
  await processBatch(pool, { 
    limit: 25,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  const claimQuery = pool.clientCalls.find(call => 
    call.sql.includes('SELECT id,recipient,template,payload,attempts')
  );
  
  assert.ok(claimQuery, 'Claim query should be executed');
  assert.equal(claimQuery.params[0], 25, 'Should pass limit parameter correctly');
  assert.match(claimQuery.sql, /LIMIT \$1/, 'Should use parameterized limit');
});

test('mail worker does not select failed status rows regardless of attempts', async () => {
  const rows = [
    { id: '1', recipient: 'user1@example.com', template: 'password-reset', payload: {}, attempts: 0, status: 'failed' },
    { id: '2', recipient: 'user2@example.com', template: 'password-reset', payload: {}, attempts: 3, status: 'failed' },
    { id: '3', recipient: 'user3@example.com', template: 'password-reset', payload: {}, attempts: 7, status: 'failed' }
  ];
  
  const pool = createMockPool(rows);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  assert.equal(result.processed, 0, 'Should not process any failed status rows');
});

test('mail worker terminal error codes still result in failed status', async () => {
  const row = {
    id: 'test-1',
    recipient: 'user@example.com',
    template: 'password-reset',
    payload: {},
    attempts: 3,
    status: 'pending'
  };
  
  const pool = createMockPool([row]);
  
  // Provider is disabled, which triggers ERR_VIRGOSCORPIO_HUB_MAIL_DISABLED
  await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  const updateQuery = pool.poolCalls.find(call => 
    call.sql.includes('UPDATE mail_outbox SET status=')
  );
  
  assert.ok(updateQuery, 'Should update the row');
  assert.equal(updateQuery.params[1], 'failed', 'Terminal error should result in failed status');
  assert.equal(updateQuery.params[4], 'ERR_VIRGOSCORPIO_HUB_MAIL_DISABLED', 'Should record the error code');
});

test('mail worker claim query prevents reprocessing of permanent mail errors', async () => {
  // Simulate rows that failed with permanent errors and were marked as failed
  const permanentFailures = [
    { id: '1', recipient: 'user1@example.com', template: 'password-reset', payload: {}, attempts: 3, status: 'failed', last_error_code: 'ERR_VIRGOSCORPIO_HUB_MAIL_REJECTED' },
    { id: '2', recipient: 'user2@example.com', template: 'password-reset', payload: {}, attempts: 2, status: 'failed', last_error_code: 'ERR_VIRGOSCORPIO_HUB_MAIL_CONFIG' },
    { id: '3', recipient: 'user3@example.com', template: 'password-reset', payload: {}, attempts: 1, status: 'failed', last_error_code: 'ERR_VIRGOSCORPIO_HUB_MAIL_DISABLED' }
  ];
  
  const pool = createMockPool(permanentFailures);
  
  const result = await processBatch(pool, { 
    limit: 10,
    logger: { log() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  
  // None of these should be reprocessed
  assert.equal(result.processed, 0, 'Permanent failures marked as failed should not be reprocessed');
});
