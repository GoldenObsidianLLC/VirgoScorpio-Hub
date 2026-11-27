'use strict';

const { loadEnvFile } = require('../../../scripts/load-env');
const { createPostgresPool } = require('../../../packages/db/src/postgres-store');
const { createIdentityService } = require('../../../packages/auth/src/service');
const { sendEmail } = require('../../../packages/notifications/src/mailer');
const { initializeTracing } = require('../../../packages/observability/src/tracing');
const { initializeLogExport } = require('../../../packages/observability/src/otel-logs');
const { createStructuredLogger } = require('../../../packages/observability/src/structured-logger');

const MAIL_OUTBOX_MAX_ATTEMPTS = 8;
const MAIL_OUTBOX_LOCK_TIMEOUT_MINUTES = 5;
const MAIL_OUTBOX_INTERRUPTED_ERROR = 'ERR_VIRGOSCORPIO_HUB_MAIL_WORKER_INTERRUPTED';

async function processBatch(pool, {
  limit = 10,
  logger = console,
  structuredLogger = null,
  clock = () => Date.now(),
  env = process.env
} = {}) {
  const log = structuredLogger || createStructuredLogger({
    logger,
    service: 'virgoscorpio_hub-mail-worker',
    environment: env.NODE_ENV || 'development'
  });
  const started = clock();
  const client = await pool.connect(); let rows = [];
  try {
    await client.query('BEGIN');
    // Provider requests time out after 10 seconds and the worker sends its default
    // 10-row batch serially, so five minutes is beyond a healthy batch lifetime.
    // Recovery is intentionally at-least-once: a crash after provider acceptance
    // but before the sent-state update can cause the same persisted email to be resent.
    const stale = await client.query(`SELECT id,attempts FROM mail_outbox
      WHERE status='processing'
        AND locked_at <= now() - interval '${MAIL_OUTBOX_LOCK_TIMEOUT_MINUTES} minutes'
      ORDER BY locked_at,created_at FOR UPDATE SKIP LOCKED LIMIT $1`, [limit]);
    for (const row of stale.rows) {
      const attempts = Number(row.attempts || 0) + 1;
      const terminal = attempts >= MAIL_OUTBOX_MAX_ATTEMPTS;
      const delayMs = terminal
        ? 0
        : Math.min(6 * 60 * 60_000, 1_000 * (2 ** Math.min(attempts, 14)));
      await client.query(
        `UPDATE mail_outbox SET status=$2,attempts=$3,
          available_at=CASE WHEN $2='pending' THEN now()+($4 * interval '1 millisecond') ELSE available_at END,
          last_error_code=$5,locked_at=NULL WHERE id=$1`,
        [row.id, terminal ? 'failed' : 'pending', attempts, delayMs, MAIL_OUTBOX_INTERRUPTED_ERROR]
      );
      log.emit('warn', 'virgoscorpio_hub.mail.interrupted_claim_recovered', {
        component: 'mail',
        operation: 'claim_recovery',
        code: MAIL_OUTBOX_INTERRUPTED_ERROR,
        attempts,
        terminal,
        outcome: terminal ? 'failed' : 'retry'
      });
    }
    const result = await client.query(`SELECT id,recipient,template,payload,attempts
      FROM mail_outbox WHERE status='pending' AND attempts<${MAIL_OUTBOX_MAX_ATTEMPTS} AND available_at<=now()
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1`, [limit]);
    rows = result.rows;
    if (rows.length) await client.query("UPDATE mail_outbox SET status='processing',locked_at=now() WHERE id=ANY($1::uuid[])", [rows.map(row => row.id)]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }

  const results = [];
  for (const row of rows) {
    try {
      await sendEmail({ recipient: row.recipient, template: row.template, payload: row.payload }, env);
      await pool.query("UPDATE mail_outbox SET status='sent',sent_at=now(),payload='{}'::jsonb,last_error_code=NULL,locked_at=NULL WHERE id=$1", [row.id]);
      results.push({ id: row.id, status: 'sent' });
    } catch (error) {
      const attempts = Number(row.attempts || 0) + 1;
      const terminal = attempts >= MAIL_OUTBOX_MAX_ATTEMPTS ||
        error.code === 'ERR_VIRGOSCORPIO_HUB_MAIL_REJECTED' ||
        error.code === 'ERR_VIRGOSCORPIO_HUB_MAIL_PROVIDER' ||
        error.code === 'ERR_VIRGOSCORPIO_HUB_MAIL_CONFIG' ||
        error.code === 'ERR_VIRGOSCORPIO_HUB_MAIL_DISABLED';
      const delayMs = Math.min(6 * 60 * 60_000, 1_000 * (2 ** Math.min(attempts, 14)));
      const errorCode = error.code || 'ERR_VIRGOSCORPIO_HUB_MAIL_FAILED';
      await pool.query(
        "UPDATE mail_outbox SET status=$2,attempts=$3,available_at=now()+($4 * interval '1 millisecond'),last_error_code=$5,locked_at=NULL WHERE id=$1",
        [row.id, terminal ? 'failed' : 'pending', attempts, delayMs, errorCode]
      );
      log.emit('error', 'virgoscorpio_hub.mail.delivery_failure', {
        component: 'mail',
        operation: 'delivery',
        code: errorCode,
        attempts,
        terminal,
        outcome: terminal ? 'failed' : 'retry'
      });
      results.push({ id: row.id, status: terminal ? 'failed' : 'retry' });
    }
  }
  return { processed: results.length, results, durationMs: Math.max(0, clock() - started) };
}

const PASSWORD_RESET_REQUEST_INTERRUPTED_ERROR = 'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_WORKER_INTERRUPTED';

async function processPasswordResetRequestBatch(pool, { identity, limit = 10, logger = console, structuredLogger = null, clock = () => Date.now() } = {}) {
  if (!pool || typeof pool.connect !== 'function' || typeof pool.query !== 'function') throw new TypeError('Password-reset queue processing requires a PostgreSQL pool.');
  if (!identity || typeof identity.processPasswordResetRequest !== 'function') throw new TypeError('Password-reset queue processing requires identity.processPasswordResetRequest().');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError('Password-reset queue batch limit must be between 1 and 100.');
  const log = structuredLogger || createStructuredLogger({ logger, service: 'virgoscorpio_hub-mail-worker', environment: process.env.NODE_ENV || 'development' });
  const started = clock();
  const client = await pool.connect();
  let rows = [];
  let recoveredCount = 0;
  try {
    await client.query('BEGIN');
    const stale = await client.query(
      "SELECT id,attempts FROM password_reset_requests WHERE status='processing' AND locked_at <= now() - interval '" + MAIL_OUTBOX_LOCK_TIMEOUT_MINUTES + " minutes' ORDER BY locked_at,created_at FOR UPDATE SKIP LOCKED LIMIT $1",
      [limit]
    );
    for (const row of stale.rows) {
      const attempts = Number(row.attempts || 0);
      const terminal = attempts >= MAIL_OUTBOX_MAX_ATTEMPTS;
      const delayMs = Math.min(6 * 60 * 60_000, 1_000 * (2 ** Math.min(attempts, 14)));
      await client.query(
        "UPDATE password_reset_requests SET status=$2,available_at=CASE WHEN $2='pending' THEN now()+($3 * interval '1 millisecond') ELSE available_at END,processed_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,locked_at=NULL,last_error_code=$4,target_email=CASE WHEN $2='failed' AND created_at <= now() - interval '120 seconds' THEN NULL ELSE target_email END WHERE id=$1 AND status='processing'",
        [row.id, terminal ? 'failed' : 'pending', delayMs, PASSWORD_RESET_REQUEST_INTERRUPTED_ERROR]
      );
      recoveredCount += 1;
    }
    await client.query("UPDATE password_reset_requests SET target_email=NULL WHERE status IN ('completed','failed') AND target_email IS NOT NULL AND created_at <= now() - interval '120 seconds'");
    await client.query("DELETE FROM password_reset_requests WHERE status IN ('completed','failed') AND processed_at <= now() - interval '24 hours'");
    const claimed = await client.query(
      "WITH picked AS (SELECT id FROM password_reset_requests WHERE status='pending' AND attempts < " + MAIL_OUTBOX_MAX_ATTEMPTS + " AND available_at <= now() ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE password_reset_requests AS request SET status='processing',locked_at=now(),attempts=request.attempts+1 FROM picked WHERE request.id=picked.id RETURNING request.id,request.attempts",
      [limit]
    );
    rows = claimed.rows;
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  if (recoveredCount) log.emit('warn', 'virgoscorpio_hub.password_reset_queue.claims_recovered', { component: 'auth', operation: 'queue_recovery', attempts: recoveredCount, outcome: 'recovered' });
  const results = [];
  for (const row of rows) {
    try {
      const processed = await identity.processPasswordResetRequest({ id: row.id });
      results.push({ id: row.id, status: processed?.processed ? 'completed' : 'skipped' });
    } catch (error) {
      const attempts = Number(row.attempts || 0);
      const terminal = attempts >= MAIL_OUTBOX_MAX_ATTEMPTS;
      const delayMs = Math.min(6 * 60 * 60_000, 1_000 * (2 ** Math.min(attempts, 14)));
      const rawCode = typeof error?.code === 'string' ? error.code : 'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_WORKER_FAILED';
      const errorCode = /^[A-Za-z0-9_.:-]{1,100}$/.test(rawCode) ? rawCode : 'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_WORKER_FAILED';
      await pool.query(
        "UPDATE password_reset_requests SET status=$2,available_at=CASE WHEN $2='pending' THEN now()+($3 * interval '1 millisecond') ELSE available_at END,processed_at=CASE WHEN $2='failed' THEN now() ELSE NULL END,locked_at=NULL,last_error_code=$4,target_email=CASE WHEN $2='failed' AND created_at <= now() - interval '120 seconds' THEN NULL ELSE target_email END WHERE id=$1 AND status='processing'",
        [row.id, terminal ? 'failed' : 'pending', delayMs, errorCode]
      );
      log.emit('error', 'virgoscorpio_hub.password_reset_queue.processing_failed', { component: 'auth', operation: 'queue_delivery', code: errorCode, attempts, terminal, outcome: terminal ? 'failed' : 'retry' });
      results.push({ id: row.id, status: terminal ? 'failed' : 'retry' });
    }
  }
  return { processed: results.length, results, recovered: recoveredCount, durationMs: Math.max(0, clock() - started) };
}

async function main() {
  loadEnvFile('.env');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const serviceVersion = require('../../../package.json').version;
  const tracingRuntime = initializeTracing({
    env: process.env,
    serviceName: 'virgoscorpio_hub-mail-worker',
    serviceVersion
  });
  let logRuntime;
  try {
    logRuntime = initializeLogExport({
      env: process.env,
      serviceName: 'virgoscorpio_hub-mail-worker',
      serviceVersion
    });
  } catch (error) {
    await tracingRuntime.shutdown().catch(() => {});
    throw error;
  }
  const structuredLogger = createStructuredLogger({
    logger: console,
    otelLogger: logRuntime.logger,
    service: 'virgoscorpio_hub-mail-worker',
    environment: process.env.NODE_ENV || 'development'
  });
  let pool = null;
  try {
    pool = createPostgresPool(process.env);
    const identity = createIdentityService({ pool, env: process.env });
    let stopping = false;
    const run = async () => {
      while (!stopping) {
        const resetBatch = await processPasswordResetRequestBatch(pool, { identity, structuredLogger });
        const batch = await processBatch(pool, { structuredLogger });
        if (!resetBatch.processed && !batch.processed) await new Promise(resolve => setTimeout(resolve, 2_000));
      }
    };
    const shutdown = () => { stopping = true; };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    structuredLogger.emit('info', 'virgoscorpio_hub.mail_worker.started', {
      component: 'mail', operation: 'startup', outcome: 'success'
    });
    await run();
  } finally {
    try {
      if (pool) await pool.end();
    } finally {
      await Promise.all([
        tracingRuntime.shutdown().catch(() => {}),
        logRuntime.shutdown().catch(() => {})
      ]);
    }
  }
}

if (require.main === module) void main().catch(error => {
  const bootstrapLogger = createStructuredLogger({
    service: 'virgoscorpio_hub-mail-worker',
    environment: process.env.NODE_ENV || 'development'
  });
  bootstrapLogger.emit('error', 'virgoscorpio_hub.mail_worker.start_failed', {
    component: 'mail',
    operation: 'startup',
    outcome: 'failure',
    code: error?.code,
    errorType: error?.name || 'Error'
  });
  process.exitCode = 1;
});

module.exports = { processBatch, processPasswordResetRequestBatch, main };
