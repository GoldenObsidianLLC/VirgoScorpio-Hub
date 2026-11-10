'use strict';

const DEFAULT_REDIS_CLOSE_TIMEOUT_MS = 1_000;
const MAX_REDIS_CLOSE_TIMEOUT_MS = 10_000;

function notifyError(onError, error) {
  try { onError(error); } catch {}
}

function destroyRedisClient(client, onError) {
  const destroy = typeof client?.destroy === 'function'
    ? client.destroy.bind(client)
    : typeof client?.disconnect === 'function'
      ? client.disconnect.bind(client)
      : null;
  if (!destroy) return;
  try {
    const result = destroy();
    if (result && typeof result.catch === 'function') {
      result.catch(error => notifyError(onError, error));
    }
  } catch (error) {
    notifyError(onError, error);
  }
}

/**
 * Close an owned Redis client without allowing reconnect-time QUIT to stall
 * application shutdown indefinitely. `isReady`, not merely `isOpen`, is the
 * graceful-QUIT boundary for node-redis clients that remain open while
 * reconnecting. Older/compatibility clients without `isReady` fall back to
 * `isOpen`. The forced path uses destroy()/disconnect() and never queues QUIT.
 *
 * @returns {Promise<'noop' | 'quit' | 'destroyed'>}
 */
async function closeRedisClient(client, {
  timeoutMs = DEFAULT_REDIS_CLOSE_TIMEOUT_MS,
  onError = () => {}
} = {}) {
  if (typeof onError !== 'function') {
    throw new TypeError('onError must be a function.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_REDIS_CLOSE_TIMEOUT_MS) {
    throw new RangeError(`timeoutMs must be an integer between 1 and ${MAX_REDIS_CLOSE_TIMEOUT_MS}.`);
  }
  if (!client || (typeof client !== 'object' && typeof client !== 'function')) return 'noop';

  const isOpen = typeof client.isOpen === 'boolean' ? client.isOpen : true;
  if (!isOpen) return 'noop';

  const isReady = typeof client.isReady === 'boolean' ? client.isReady : isOpen;
  if (!isReady || typeof client.quit !== 'function') {
    destroyRedisClient(client, onError);
    return 'destroyed';
  }

  let timer;
  const gracefulQuit = Promise.resolve()
    .then(() => client.quit())
    .then(() => 'quit');
  const boundedFallback = new Promise(resolve => {
    timer = setTimeout(() => {
      const error = new Error('Redis graceful shutdown exceeded its deadline.');
      error.code = 'ERR_REDIS_CLOSE_TIMEOUT';
      notifyError(onError, error);
      destroyRedisClient(client, onError);
      resolve('destroyed');
    }, timeoutMs);
  });

  try {
    return await Promise.race([gracefulQuit, boundedFallback]);
  } catch (error) {
    notifyError(onError, error);
    destroyRedisClient(client, onError);
    return 'destroyed';
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  DEFAULT_REDIS_CLOSE_TIMEOUT_MS,
  MAX_REDIS_CLOSE_TIMEOUT_MS,
  closeRedisClient
};
