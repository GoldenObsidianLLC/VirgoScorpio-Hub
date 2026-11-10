'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  APPROVED_REDIS_IMAGE,
  validateRedisOutageTarget
} = require('./fixtures/redis-outage-container');

const CONTAINER_ID = 'a'.repeat(64);

test('Redis outage target accepts loopback endpoints on the CI port or an isolated local port', () => {
  for (const redisUrl of [
    'redis://127.0.0.1:6379/0',
    'redis://127.0.0.1:16379/0',
    'redis://[::1]:16379/0'
  ]) {
    const target = validateRedisOutageTarget({
      redisUrl,
      containerId: CONTAINER_ID
    });
    assert.equal(target.redisUrl, redisUrl);
    assert.equal(target.containerId, CONTAINER_ID);
  }
  assert.equal(APPROVED_REDIS_IMAGE, 'redis:7.4-alpine');
});

test('Redis outage target rejects remote, credential-bearing, nonstandard and malformed targets', () => {
  for (const redisUrl of [
    'redis://redis.internal:6379',
    'redis://user:secret@127.0.0.1:16379',
    'redis://127.0.0.1:0',
    'redis://127.0.0.1:65536',
    'redis://127.0.0.1:16379?tls=true',
    'http://127.0.0.1:6379',
    'not-a-url'
  ]) {
    assert.throws(() => validateRedisOutageTarget({
      redisUrl,
      containerId: CONTAINER_ID
    }));
  }
  for (const containerId of [
    '',
    'a'.repeat(12),
    'g'.repeat(64),
    'a'.repeat(65),
    '--all'
  ]) {
    assert.throws(() => validateRedisOutageTarget({
      redisUrl: 'redis://127.0.0.1:6379',
      containerId
    }));
  }
});
