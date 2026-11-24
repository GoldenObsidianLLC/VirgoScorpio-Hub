'use strict';

const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { validatePinnedImageDigest } = require('./manifest');

const MAX_INPUT_BYTES = 256 * 1024;
const MAX_OUTPUT_BYTES = 1024 * 1024;

function createContainerPluginRunner({ runtime = process.env.VIRGOSCORPIO_HUB_CONTAINER_RUNTIME || 'docker', timeoutMs = 5000, memory = '128m', cpus = '0.50', pidsLimit = 32, allowedImages = [], maxConcurrent = 8, spawnProcess = spawn } = {}) {
  const allowlist = new Set(allowedImages);
  let active = 0;
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new TypeError('Plugin maxConcurrent must be a positive integer.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) throw new TypeError('Plugin timeout must be 100–30000 ms.');
  return Object.freeze({
    async invoke({ imageDigest, action, input, requestId }) {
      if (!validatePinnedImageDigest(imageDigest)) {
        const error = new Error('Plugin runtime requires an immutable image reference pinned by SHA-256 digest.');
        error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_IMAGE_NOT_PINNED'; throw error;
      }
      if (!allowlist.has(imageDigest)) { const error = new Error('Plugin image is not on the runner allowlist.'); error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_IMAGE_NOT_ALLOWED'; throw error; }
      if (typeof action !== 'string' || !/^[a-z][a-z0-9_.:-]{1,99}$/.test(action)) throw new TypeError('Invalid plugin action.');
      const envelope = Buffer.from(JSON.stringify({ protocol: 1, action, input, requestId: String(requestId || '').slice(0, 100) }));
      if (envelope.length > MAX_INPUT_BYTES) { const error = new Error('Plugin input exceeds the allowed limit.'); error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_INPUT_LIMIT'; throw error; }
      const args = [
        'run', '--rm', '--interactive', '--network=none', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--pids-limit', String(pidsLimit), '--memory', memory,
        '--cpus', cpus, '--memory-swap', memory, '--ulimit', 'nofile=64:64', '--ulimit', 'nproc=32:32', '--user', '65532:65532', '--pull=never', '--log-driver=none', '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=16m',
        '--env', 'VIRGOSCORPIO_HUB_PLUGIN_PROTOCOL=1', imageDigest
      ];
      if (active >= maxConcurrent) { const error = new Error('Plugin runner is at its concurrent execution limit.'); error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_BUSY'; throw error; }
      const containerName = `vh-plugin-${randomBytes(16).toString('hex')}`;
      args.splice(1, 0, '--name', containerName);
      const spawnEnv = { PATH: process.env.PATH || '/usr/bin:/bin', VIRGOSCORPIO_HUB_PLUGIN_PROTOCOL: '1' };
      // Killing the attached CLI client does not stop a daemon-managed container, so force-remove it explicitly.
      const removeContainer = async (attemptsLeft = 5) => {
        const removed = await new Promise(resolve => {
          let rm;
          try {
            rm = spawnProcess(runtime, ['rm', '--force', containerName], { shell: false, stdio: 'ignore', env: spawnEnv });
          } catch {
            resolve(false);
            return;
          }
          let settled = false;
          const settle = value => {
            if (settled) return;
            settled = true;
            clearTimeout(removalTimer);
            resolve(value);
          };
          const removalTimer = setTimeout(() => {
            try { rm.kill('SIGKILL'); } catch {}
            settle(false);
          }, 2000);
          rm.once('error', () => settle(false));
          rm.once('close', code => settle(code === 0));
        });
        if (removed) return true;
        if (attemptsLeft <= 1) return false;
        await new Promise(resolve => setTimeout(resolve, 100));
        return removeContainer(attemptsLeft - 1);
      };
      active += 1;
      return new Promise((resolve, reject) => {
        let child;
        try {
          child = spawnProcess(runtime, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'], env: spawnEnv });
        } catch (error) { active -= 1; error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_RUNTIME'; reject(error); return; }
        const out = []; const err = []; let outSize = 0; let errSize = 0; let settled = false; let terminating = false;
        const finish = (fn, value) => { if (!settled) { settled = true; active -= 1; clearTimeout(timer); fn(value); } };
        const terminate = error => {
          if (settled || terminating) return;
          terminating = true;
          try { child.kill('SIGKILL'); } catch {}
          void removeContainer().then(removed => {
            if (!removed) {
              error.originalCode = error.code;
              error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_CLEANUP_FAILED';
              error.message = 'Plugin execution stopped, but forced container removal could not be confirmed.';
            }
            finish(reject, error);
          });
        };
        const timer = setTimeout(() => {
          const error = new Error('Plugin execution exceeded its time limit.');
          error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_TIMEOUT';
          terminate(error);
        }, timeoutMs);
        timer.unref?.();
        child.stdout.on('data', chunk => {
          if (settled || terminating) return;
          outSize += chunk.length;
          if (outSize > MAX_OUTPUT_BYTES) {
            const error = new Error('Plugin output exceeded its limit.');
            error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_OUTPUT_LIMIT';
            terminate(error);
          } else out.push(chunk);
        });
        child.stderr.on('data', chunk => { if (!terminating && errSize + chunk.length <= 8192) { errSize += chunk.length; err.push(chunk); } });
        child.on('error', error => {
          if (terminating) return;
          error.code = error.code === 'ENOENT' ? 'ERR_VIRGOSCORPIO_HUB_PLUGIN_RUNTIME_MISSING' : 'ERR_VIRGOSCORPIO_HUB_PLUGIN_RUNTIME';
          finish(reject, error);
        });
        child.on('close', code => {
          if (settled || terminating) return;
          if (code !== 0) { const error = new Error(`Plugin sandbox exited with code ${code}.`); error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_FAILED'; error.diagnostic = Buffer.concat(err).toString('utf8').slice(0, 2000); finish(reject, error); return; }
          try {
            const response = JSON.parse(Buffer.concat(out).toString('utf8'));
            if (!response || response.protocol !== 1 || response.ok !== true || !Object.hasOwn(response, 'result')) throw new Error('Plugin response does not match protocol v1.');
            finish(resolve, response.result);
          } catch (error) { error.code = 'ERR_VIRGOSCORPIO_HUB_PLUGIN_PROTOCOL'; finish(reject, error); }
        });
        child.stdin.end(envelope);
      });
    }
  });
}

module.exports = { createContainerPluginRunner, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES };
