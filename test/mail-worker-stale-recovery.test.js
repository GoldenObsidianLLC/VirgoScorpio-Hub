'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
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

const postgresIntegrationEnabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

// This database-backed scenario is registered only in the live integration job.
// Service-less Node matrix jobs must not count unavailable PostgreSQL cases as skips.
if (postgresIntegrationEnabled) {
  test('mail worker recovers abandoned claims and terminalizes exhausted ones in PostgreSQL', async t => {
    const { createPostgresPool } = require('../packages/db/src/postgres-store');
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '4'
    });
    const ids = [];

    t.after(async () => {
      if (ids.length) {
        await pool.query('DELETE FROM mail_outbox WHERE id = ANY($1::uuid[])', [ids]);
      }
      await pool.end();
    });

    const inserted = await pool.query(
      `INSERT INTO mail_outbox(
        recipient,template,payload,status,attempts,available_at,locked_at
      ) VALUES
        ($1,'generic','{}'::jsonb,'processing',2,now(),now()-interval '6 minutes'),
        ($2,'generic','{}'::jsonb,'processing',7,now(),now()-interval '6 minutes'),
        ($3,'generic','{}'::jsonb,'processing',2,now(),now())
      RETURNING id`,
      [
        `mail-recovery-retryable-${randomUUID()}@example.test`,
        `mail-recovery-exhausted-${randomUUID()}@example.test`,
        `mail-recovery-fresh-${randomUUID()}@example.test`
      ]
    );
    ids.push(...inserted.rows.map(row => row.id));

    const batch = await processBatch(pool, {
      limit: 10,
      logger: { log() {}, warn() {}, error() {} },
      env: { NODE_ENV: 'test', VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
    });

    assert.equal(batch.processed, 0);
    const result = await pool.query(
      'SELECT id,status,attempts,available_at,locked_at,last_error_code FROM mail_outbox WHERE id=ANY($1::uuid[])',
      [ids]
    );
    const rows = new Map(result.rows.map(row => [row.id, row]));

    const retryable = rows.get(ids[0]);
    assert.equal(retryable.status, 'pending');
    assert.equal(Number(retryable.attempts), 3);
    assert.equal(retryable.locked_at, null);
    assert.equal(
      retryable.last_error_code,
      'ERR_VIRGOSCORPIO_HUB_MAIL_WORKER_INTERRUPTED'
    );
    assert.ok(new Date(retryable.available_at).getTime() > Date.now());

    const exhausted = rows.get(ids[1]);
    assert.equal(exhausted.status, 'failed');
    assert.equal(Number(exhausted.attempts), 8);
    assert.equal(exhausted.locked_at, null);
    assert.equal(
      exhausted.last_error_code,
      'ERR_VIRGOSCORPIO_HUB_MAIL_WORKER_INTERRUPTED'
    );

    const fresh = rows.get(ids[2]);
    assert.equal(fresh.status, 'processing');
    assert.equal(Number(fresh.attempts), 2);
    assert.ok(fresh.locked_at);
  });
}
