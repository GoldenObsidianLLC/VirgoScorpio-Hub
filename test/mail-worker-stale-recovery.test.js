'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { processBatch } = require('../apps/worker/src/mail-worker');

function createPool({ staleRows = [] } = {}) {
  const clientCalls = [];
  const poolCalls = [];
  let released = false;

  const client = {
    async query(sql, params = []) {
      clientCalls.push({ sql, params });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('SELECT id,attempts FROM mail_outbox')) {
        return { rows: staleRows };
      }
      if (sql.startsWith('UPDATE mail_outbox SET status=$2')) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('SELECT id,recipient,template,payload,attempts')) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      released = true;
    }
  };

  const pool = {
    clientCalls,
    poolCalls,
    isReleased: () => released,
    async connect() {
      return client;
    },
    async query(sql, params = []) {
      poolCalls.push({ sql, params });
      return { rows: [], rowCount: 0 };
    }
  };
  return pool;
}

test('mail worker reclaims stale processing rows with bounded retries before claiming pending mail', async () => {
  const pool = createPool({
    staleRows: [
      { id: 'retryable-stale', attempts: 2 },
      { id: 'exhausted-stale', attempts: 7 }
    ]
  });

  const result = await processBatch(pool, {
    limit: 10,
    logger: { log() {}, warn() {}, error() {} },
    env: { VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });

  const recoveryQuery = pool.clientCalls.find(call =>
    call.sql.includes('SELECT id,attempts FROM mail_outbox')
  );
  assert.ok(
    recoveryQuery,
    'worker must inspect interrupted processing claims before claiming new mail'
  );
  assert.match(recoveryQuery.sql, /status='processing'/);
  assert.match(recoveryQuery.sql, /locked_at\s*<=\s*now\(\)\s*-\s*interval '5 minutes'/);
  assert.match(recoveryQuery.sql, /FOR UPDATE SKIP LOCKED/);
  assert.equal(recoveryQuery.params[0], 10);

  const recoveries = pool.clientCalls.filter(call =>
    call.sql.startsWith('UPDATE mail_outbox SET status=$2')
  );
  assert.equal(recoveries.length, 2);
  assert.deepEqual(
    recoveries.map(({ params }) => params),
    [
      [
        'retryable-stale',
        'pending',
        3,
        8_000,
        'ERR_VIRGOSCORPIO_HUB_MAIL_WORKER_INTERRUPTED'
      ],
      [
        'exhausted-stale',
        'failed',
        8,
        0,
        'ERR_VIRGOSCORPIO_HUB_MAIL_WORKER_INTERRUPTED'
      ]
    ]
  );

  const claimIndex = pool.clientCalls.findIndex(call =>
    call.sql.includes('SELECT id,recipient,template,payload,attempts')
  );
  const recoveryIndex = pool.clientCalls.indexOf(recoveryQuery);
  assert.ok(claimIndex > recoveryIndex, 'stale-claim recovery must precede new claims');
  assert.equal(result.processed, 0, 'recovered rows are delayed before another delivery attempt');
  assert.equal(pool.isReleased(), true);
});
