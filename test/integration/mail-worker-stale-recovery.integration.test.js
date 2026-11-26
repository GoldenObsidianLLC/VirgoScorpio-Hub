'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { processBatch } = require('../../apps/worker/src/mail-worker');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

test(
  'PostgreSQL integration: mail worker recovers abandoned claims and terminalizes exhausted ones',
  { skip: !enabled },
  async t => {
    const databasePool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '4'
    });
    const client = await databasePool.connect();

    t.after(async () => {
      await client.query('DROP TABLE IF EXISTS pg_temp.mail_outbox').catch(() => {});
      client.release();
      await databasePool.end();
    });

    // Shadow the real outbox with a connection-local table so this worker
    // recovery scenario cannot claim or mutate mail belonging to other tests.
    // Keeping the worker on one checked-out connection preserves this temp table
    // through processBatch's transaction and its post-claim pool.query calls.
    await client.query(`CREATE TEMP TABLE mail_outbox (
      id uuid PRIMARY KEY,
      recipient text NOT NULL,
      template text NOT NULL,
      payload jsonb NOT NULL,
      status text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      available_at timestamptz NOT NULL DEFAULT now(),
      locked_at timestamptz,
      sent_at timestamptz,
      last_error_code text,
      created_at timestamptz NOT NULL DEFAULT now()
    ) ON COMMIT PRESERVE ROWS`);

    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await client.query(
      `INSERT INTO mail_outbox(
        id,recipient,template,payload,status,attempts,available_at,locked_at
      ) VALUES
        ($1,$4,'generic','{}'::jsonb,'processing',2,now(),now()-interval '6 minutes'),
        ($2,$5,'generic','{}'::jsonb,'processing',7,now(),now()-interval '6 minutes'),
        ($3,$6,'generic','{}'::jsonb,'processing',2,now(),now())`,
      [
        ...ids,
        `mail-recovery-retryable-${ids[0]}@example.test`,
        `mail-recovery-exhausted-${ids[1]}@example.test`,
        `mail-recovery-fresh-${ids[2]}@example.test`
      ]
    );

    const workerClient = {
      query: (sql, params) => client.query(sql, params),
      release() {}
    };
    const workerPool = {
      async connect() {
        return workerClient;
      },
      query: (sql, params) => client.query(sql, params)
    };

    const batch = await processBatch(workerPool, {
      limit: 10,
      logger: { log() {}, warn() {}, error() {} },
      env: { NODE_ENV: 'test', VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
    });

    assert.equal(batch.processed, 0, 'recovered rows must be delayed before another delivery attempt');
    const result = await client.query(
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
  }
);
