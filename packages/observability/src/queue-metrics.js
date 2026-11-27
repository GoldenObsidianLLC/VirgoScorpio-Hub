'use strict';

const DEFAULT_PASSWORD_RESET_QUEUE_SNAPSHOT_INTERVAL_MS = 30_000;

function createPasswordResetQueueMonitor({ intervalMs = DEFAULT_PASSWORD_RESET_QUEUE_SNAPSHOT_INTERVAL_MS, clock = () => Date.now() } = {}) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1_000 || intervalMs > 300_000) {
    throw new RangeError('Password-reset queue snapshot interval must be between 1000 and 300000 milliseconds.');
  }
  let lastEmittedAt = Number.NEGATIVE_INFINITY;

  async function sample({ pool, logger, env = process.env } = {}) {
    if (!pool || typeof pool.query !== 'function') throw new TypeError('Password-reset queue monitoring requires a PostgreSQL pool.');
    if (!logger || typeof logger.emit !== 'function') throw new TypeError('Password-reset queue monitoring requires a structured logger.');
    const sampledAt = clock();
    if (!Number.isFinite(sampledAt)) throw new TypeError('Password-reset queue monitoring clock must return a finite number.');
    if (sampledAt - lastEmittedAt < intervalMs) return null;
    lastEmittedAt = sampledAt;
    try {
      const result = await pool.query(
        "SELECT count(*) FILTER (WHERE status='pending')::integer AS pending, count(*) FILTER (WHERE status='processing')::integer AS processing, count(*) FILTER (WHERE status='failed' AND processed_at > now() - interval '24 hours')::integer AS failed_last_24h, COALESCE(FLOOR(EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE status='pending')))),0)::integer AS oldest_pending_age_seconds FROM password_reset_requests"
      );
      const row = result.rows?.[0] || {};
      const integer = value => Math.min(1_000_000, Math.max(0, Math.floor(Number(value) || 0)));
      const fields = {
        component: 'auth', operation: 'queue_snapshot', outcome: 'success',
        pending: integer(row.pending),
        processing: integer(row.processing),
        failedLast24h: integer(row.failed_last_24h),
        oldestPendingAgeSeconds: integer(row.oldest_pending_age_seconds)
      };
      const configured = env.VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING;
      const capacity = configured === undefined || configured === '' ? 5_000 : Number(configured);
      if (Number.isSafeInteger(capacity) && capacity >= 1 && capacity <= 100_000) fields.queueCapacity = capacity;
      logger.emit('info', 'virgoscorpio_hub.password_reset_queue.snapshot', fields);
      return Object.freeze({ ...fields });
    } catch (error) {
      const rawCode = typeof error?.code === 'string' ? error.code : 'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_SNAPSHOT_FAILED';
      const code = /^ERR_[A-Z0-9_.-]{1,96}$/.test(rawCode) ? rawCode : 'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_SNAPSHOT_FAILED';
      try { logger.emit('warn', 'virgoscorpio_hub.password_reset_queue.snapshot_failed', { component: 'auth', operation: 'queue_snapshot', code, outcome: 'degraded' }); } catch {}
      return null;
    }
  }

  return Object.freeze({ sample });
}

module.exports = { createPasswordResetQueueMonitor, DEFAULT_PASSWORD_RESET_QUEUE_SNAPSHOT_INTERVAL_MS };
