'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REDIS_RECONNECT_BASE_DELAY_MS,
  REDIS_RECONNECT_MAX_DELAY_MS,
  createRedisReconnectStrategy
} = require('../packages/realtime/src/redis-reconnect');

test('shared Redis reconnect strategy applies bounded exponential equal jitter', () => {
  const attempts = [];
  const strategy = createRedisReconnectStrategy({
    onAttempt: () => attempts.push(attempts.length + 1),
    random: () => 0
  });
  const retryCounts = [0, 1, 2, 5, 10, 11, 64];
  const expected = [50, 100, 200, 1_600, 2_500, 2_500, 2_500];
  assert.equal(REDIS_RECONNECT_BASE_DELAY_MS, 100);
  assert.equal(REDIS_RECONNECT_MAX_DELAY_MS, 5_000);
  assert.deepEqual(retryCounts.map(strategy), expected);
  assert.equal(attempts.length, retryCounts.length);
});

test('shared Redis reconnect strategy reaches upper jitter boundary and caps the delay', () => {
  const strategy = createRedisReconnectStrategy({ random: () => 1 });
  const retryCounts = [0, 1, 2, 5, 10, 11, 64];
  const expected = [100, 200, 400, 3_200, 5_000, 5_000, 5_000];
  assert.deepEqual(retryCounts.map(strategy), expected);
  assert.ok(expected.every(delay => delay >= 50 && delay <= REDIS_RECONNECT_MAX_DELAY_MS));
});

test('shared Redis reconnect strategy safely clamps invalid random samples', () => {
  const low = createRedisReconnectStrategy({ random: () => -10 });
  const high = createRedisReconnectStrategy({ random: () => 10 });
  const throwing = createRedisReconnectStrategy({ random: () => { throw new Error('random source failed'); } });
  assert.equal(low(0), 50);
  assert.equal(high(0), 100);
  assert.equal(throwing(0), 75);
});

test('shared Redis reconnect strategy stops only after explicit owner shutdown', () => {
  let closed = false;
  let attempts = 0;
  const strategy = createRedisReconnectStrategy({
    isClosed: () => closed,
    onAttempt: () => { attempts += 1; },
    random: () => 0.5,
    closedErrorMessage: 'test client is closed'
  });
  assert.equal(typeof strategy(64), 'number');
  assert.equal(attempts, 1);
  closed = true;
  const stop = strategy(65);
  assert.ok(stop instanceof Error);
  assert.equal(stop.message, 'test client is closed');
  assert.equal(attempts, 1);
});

test('shared Redis reconnect strategy validates injected dependencies', () => {
  assert.throws(() => createRedisReconnectStrategy({ isClosed: true }), /must be functions/);
  assert.throws(() => createRedisReconnectStrategy({ closedErrorMessage: '' }), /non-empty string/);
});
