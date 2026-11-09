'use strict';

const REDIS_RECONNECT_BASE_DELAY_MS = 100;
const REDIS_RECONNECT_MAX_DELAY_MS = 5_000;

/**
 * Create one bounded equal-jitter reconnect strategy for a Redis client.
 * The owner controls shutdown through isClosed; retry count alone never ends
 * recovery. onAttempt must remain low-cardinality and must not throw.
 */
function createRedisReconnectStrategy({
  isClosed = () => false,
  onAttempt = () => {},
  random = Math.random,
  closedErrorMessage = 'Redis client is closed.'
} = {}) {
  if (typeof isClosed !== 'function' || typeof onAttempt !== 'function' ||
      typeof random !== 'function') {
    throw new TypeError('isClosed, onAttempt, and random must be functions.');
  }
  if (typeof closedErrorMessage !== 'string' || !closedErrorMessage.trim()) {
    throw new TypeError('closedErrorMessage must be a non-empty string.');
  }

  return function reconnectStrategy(retries) {
    if (isClosed()) return new Error(closedErrorMessage);

    try { onAttempt(); } catch {}

    const attempt = Number.isSafeInteger(retries) && retries > 0 ? retries : 0;
    const windowMs = Math.min(
      REDIS_RECONNECT_MAX_DELAY_MS,
      REDIS_RECONNECT_BASE_DELAY_MS * (2 ** Math.min(attempt, 16))
    );
    let sample = 0.5;
    try {
      const value = random();
      if (Number.isFinite(value)) sample = Math.min(1, Math.max(0, value));
    } catch {}
    return Math.floor(windowMs * (0.5 + sample * 0.5));
  };
}

module.exports = {
  REDIS_RECONNECT_BASE_DELAY_MS,
  REDIS_RECONNECT_MAX_DELAY_MS,
  createRedisReconnectStrategy
};
