'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_REDIS_CLOSE_TIMEOUT_MS,
  MAX_REDIS_CLOSE_TIMEOUT_MS,
  closeRedisClient
} = require('../packages/realtime/src/redis-client-lifecycle');

function fakeClient({ isOpen = true, isReady = true, quit = async () => 'OK' } = {}) {
  return {
    isOpen,
    isReady,
    quitCalls: 0,
    destroyCalls: 0,
    quit() {
      this.quitCalls += 1;
      return quit();
    },
    destroy() {
      this.destroyCalls += 1;
      this.isOpen = false;
      this.isReady = false;
    }
  };
}

test('Redis shutdown does not enqueue QUIT for an open but reconnecting client', async () => {
  const client = fakeClient({
    isOpen: true,
    isReady: false,
    quit: () => new Promise(() => {})
  });

  const result = await closeRedisClient(client);

  assert.equal(result, 'destroyed');
  assert.equal(client.quitCalls, 0);
  assert.equal(client.destroyCalls, 1);
});

test('Redis shutdown gracefully quits a ready client', async () => {
  const client = fakeClient();

  const result = await closeRedisClient(client);

  assert.equal(result, 'quit');
  assert.equal(client.quitCalls, 1);
  assert.equal(client.destroyCalls, 0);
});

test('Redis shutdown destroys a client when graceful QUIT rejects', async () => {
  const failure = Object.assign(new Error('transport unavailable'), { code: 'ECONNRESET' });
  const client = fakeClient({ quit: async () => { throw failure; } });
  const reported = [];

  const result = await closeRedisClient(client, { onError: error => reported.push(error) });

  assert.equal(result, 'destroyed');
  assert.equal(client.quitCalls, 1);
  assert.equal(client.destroyCalls, 1);
  assert.deepEqual(reported, [failure]);
});

test('Redis shutdown bounds a QUIT that never settles and forcibly destroys the client', async () => {
  const client = fakeClient({ quit: () => new Promise(() => {}) });
  const reported = [];

  const startedAt = Date.now();
  const result = await closeRedisClient(client, {
    timeoutMs: 20,
    onError: error => reported.push(error)
  });
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result, 'destroyed');
  assert.equal(client.quitCalls, 1);
  assert.equal(client.destroyCalls, 1);
  assert.ok(elapsedMs < 500, `shutdown should remain bounded; observed ${elapsedMs}ms`);
  assert.equal(reported.length, 1);
  assert.equal(reported[0].code, 'ERR_REDIS_CLOSE_TIMEOUT');
});

test('Redis shutdown is a no-op for an already closed client', async () => {
  const client = fakeClient({ isOpen: false, isReady: false });

  const result = await closeRedisClient(client);

  assert.equal(result, 'noop');
  assert.equal(client.quitCalls, 0);
  assert.equal(client.destroyCalls, 0);
});

test('Redis shutdown preserves compatibility with clients that expose isOpen but not isReady', async () => {
  const client = {
    isOpen: true,
    quitCalls: 0,
    async quit() { this.quitCalls += 1; this.isOpen = false; }
  };

  const result = await closeRedisClient(client);

  assert.equal(result, 'quit');
  assert.equal(client.quitCalls, 1);
});

test('Redis shutdown validates its timeout and error callback', async () => {
  assert.equal(DEFAULT_REDIS_CLOSE_TIMEOUT_MS, 1_000);
  assert.equal(MAX_REDIS_CLOSE_TIMEOUT_MS, 10_000);
  await assert.rejects(() => closeRedisClient(fakeClient(), { timeoutMs: 0 }), /timeoutMs/);
  await assert.rejects(() => closeRedisClient(fakeClient(), { timeoutMs: 10_001 }), /timeoutMs/);
  await assert.rejects(() => closeRedisClient(fakeClient(), { onError: true }), /onError/);
});
