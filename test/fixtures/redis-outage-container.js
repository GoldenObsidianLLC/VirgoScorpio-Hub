'use strict';

const { spawnSync } = require('node:child_process');

const APPROVED_REDIS_IMAGE = 'redis:7.4-alpine';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function validateRedisOutageTarget({ redisUrl, containerId } = {}) {
  if (typeof redisUrl !== 'string' || !redisUrl) {
    throw new Error('A dedicated loopback Redis URL is required for outage testing.');
  }
  let parsed;
  try { parsed = new URL(redisUrl); } catch {
    throw new Error('The Redis outage test URL is invalid.');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!['redis:', 'rediss:'].includes(parsed.protocol) ||
      !LOOPBACK_HOSTS.has(hostname) ||
      parsed.username || parsed.password || parsed.search || parsed.hash ||
      (parsed.pathname && !/^\/(?:0|[1-9]\d*)$/.test(parsed.pathname))) {
    throw new Error('Redis outage tests require a credential-free loopback URL on a valid port.');
  }
  const port = parsed.port ? Number(parsed.port) : 6379;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('Redis outage tests require a valid TCP port.');
  }
  if (typeof containerId !== 'string' || !/^[a-f0-9]{64}$/i.test(containerId)) {
    throw new Error('Redis outage tests require the exact full 64-character disposable container ID.');
  }
  return Object.freeze({ redisUrl, containerId: containerId.toLowerCase() });
}

function docker(args, { timeout = 15_000 } = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    const code = result.error?.code || ('EXIT_' + (result.status ?? 'UNKNOWN'));
    throw new Error('Approved Redis test-container Docker operation failed (' + code + ').');
  }
  return String(result.stdout || '').trim();
}

function inspectRedisOutageTarget(target) {
  const approved = validateRedisOutageTarget(target);
  const output = docker([
    'inspect',
    '--format',
    '{{.Id}}|{{.Config.Image}}|{{.State.Running}}',
    approved.containerId
  ]);
  const [fullId, image, runningText] = output.split('|');
  if (fullId?.toLowerCase() !== approved.containerId || image !== APPROVED_REDIS_IMAGE ||
      !['true', 'false'].includes(runningText)) {
    throw new Error('The exact Redis container identity did not match the approved test image.');
  }
  return Object.freeze({
    ...approved,
    image,
    running: runningText === 'true'
  });
}

function stopRedisOutageTarget(target) {
  const inspected = inspectRedisOutageTarget(target);
  if (!inspected.running) throw new Error('Refusing to stop a Redis test container that is not running.');
  docker(['stop', '--time', '1', inspected.containerId]);
  const stopped = inspectRedisOutageTarget(inspected);
  if (stopped.running) throw new Error('The approved Redis test container did not stop.');
  return stopped;
}

function startRedisOutageTarget(target) {
  const inspected = inspectRedisOutageTarget(target);
  if (!inspected.running) docker(['start', inspected.containerId]);
  const started = inspectRedisOutageTarget(inspected);
  if (!started.running) throw new Error('The approved Redis test container did not restart.');
  return started;
}

module.exports = {
  APPROVED_REDIS_IMAGE,
  validateRedisOutageTarget,
  inspectRedisOutageTarget,
  stopRedisOutageTarget,
  startRedisOutageTarget
};
