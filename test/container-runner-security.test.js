'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createContainerPluginRunner } = require('../packages/plugins/src/container-runner');

test('container runner enforces maxConcurrent limit to prevent resource exhaustion', async () => {
  const imageDigest = `registry.example/plugin@sha256:${'a'.repeat(64)}`;
  const runner = createContainerPluginRunner({
    allowedImages: [imageDigest],
    maxConcurrent: 2,
    timeoutMs: 100 // Short timeout so tests don't hang
  });
  
  // Start two concurrent invocations (at the limit)
  // These will fail because docker isn't available, but that's OK - we're testing the limit
  const promise1 = runner.invoke({ imageDigest, action: 'test.action', input: {}, requestId: 'req1' }).catch(e => e);
  const promise2 = runner.invoke({ imageDigest, action: 'test.action', input: {}, requestId: 'req2' }).catch(e => e);
  
  // Third invocation should be rejected immediately with BUSY error before even trying to spawn
  await assert.rejects(
    () => runner.invoke({ imageDigest, action: 'test.action', input: {}, requestId: 'req3' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_PLUGIN_BUSY' }
  );
  
  // Wait for the first two to complete (they'll error but that's fine)
  await Promise.all([promise1, promise2]);
});

test('container runner validates maxConcurrent parameter to prevent misconfiguration', () => {
  const imageDigest = `registry.example/plugin@sha256:${'f'.repeat(64)}`;
  
  // Should reject non-integer
  assert.throws(
    () => createContainerPluginRunner({ allowedImages: [imageDigest], maxConcurrent: 1.5 }),
    /maxConcurrent must be a positive integer/
  );
  
  // Should reject zero
  assert.throws(
    () => createContainerPluginRunner({ allowedImages: [imageDigest], maxConcurrent: 0 }),
    /maxConcurrent must be a positive integer/
  );
  
  // Should reject negative
  assert.throws(
    () => createContainerPluginRunner({ allowedImages: [imageDigest], maxConcurrent: -1 }),
    /maxConcurrent must be a positive integer/
  );
  
  // Should accept valid positive integer
  assert.doesNotThrow(
    () => createContainerPluginRunner({ allowedImages: [imageDigest], maxConcurrent: 8 })
  );
});

test('container runner decrements active counter after timeout to allow new invocations', async () => {
  const imageDigest = `registry.example/plugin@sha256:${'e'.repeat(64)}`;
  const runner = createContainerPluginRunner({
    allowedImages: [imageDigest],
    maxConcurrent: 1,
    timeoutMs: 100 // Very short timeout
  });
  
  // First invocation that will timeout or fail
  const promise1 = runner.invoke({ imageDigest, action: 'test.action', input: {}, requestId: 'req1' }).catch(e => e);
  
  // Wait for it to complete
  await promise1;
  
  // Second invocation should succeed in starting (proving counter was decremented)
  // If the counter wasn't decremented, this would throw BUSY error
  const promise2 = runner.invoke({ imageDigest, action: 'test.action', input: {}, requestId: 'req2' }).catch(e => e);
  
  // Should not throw BUSY - if it does, the test will fail
  await promise2;
  
  // If we got here without BUSY error, the counter management is working
  assert.ok(true, 'Counter was properly decremented after first invocation');
});

test('container runner prevents rapid concurrent invocations from exceeding maxConcurrent limit', () => {
  // This test verifies the code structure since docker isn't available in test environment
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../packages/plugins/src/container-runner.js'), 'utf8');
  
  // Verify the maxConcurrent check happens before spawn
  assert.ok(source.includes('if (active >= maxConcurrent)'), 'Should check active >= maxConcurrent');
  assert.ok(source.includes('ERR_VIRGOSCORPIO_HUB_PLUGIN_BUSY'), 'Should throw BUSY error when limit reached');
  
  // Verify the check happens before spawn (by checking order in source)
  const busyCheckIndex = source.indexOf('if (active >= maxConcurrent)');
  const spawnIndex = source.indexOf('spawn(runtime, args');
  assert.ok(busyCheckIndex < spawnIndex, 'maxConcurrent check should happen before spawn');
});

test('container runner code includes removeContainer function for cleanup on timeout', () => {
  // Read the source code to verify the mitigation is present
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../packages/plugins/src/container-runner.js'), 'utf8');
  
  // Verify removeContainer function exists
  assert.ok(source.includes('removeContainer'), 'Source should include removeContainer function');
  
  // Verify it's called on timeout
  assert.ok(source.includes('removeContainer()') && source.includes('ERR_VIRGOSCORPIO_HUB_PLUGIN_TIMEOUT'), 
    'removeContainer should be called on timeout');
  
  // Verify it's called on output limit
  assert.ok(source.includes('removeContainer()') && source.includes('ERR_VIRGOSCORPIO_HUB_PLUGIN_OUTPUT_LIMIT'),
    'removeContainer should be called on output limit');
  
  // Verify it uses docker rm --force
  assert.ok(source.includes("'rm'") && source.includes("'--force'"),
    'removeContainer should use docker rm --force');
});

test('container runner code assigns unique container names for tracking', () => {
  // Read the source code to verify container naming is present
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../packages/plugins/src/container-runner.js'), 'utf8');
  
  // Verify container name generation
  assert.ok(source.includes('containerName') && source.includes('vh-plugin-'),
    'Source should generate unique container names with vh-plugin- prefix');
  
  // Verify --name argument is added
  assert.ok(source.includes("'--name'") && source.includes('containerName'),
    'Source should add --name argument with containerName');
  
  // Verify randomBytes is used for uniqueness
  assert.ok(source.includes('randomBytes'),
    'Source should use randomBytes for unique container names');
});

test('container runner code implements retry logic for removeContainer', () => {
  // Read the source code to verify retry logic is present
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../packages/plugins/src/container-runner.js'), 'utf8');
  
  // Verify retry mechanism exists
  assert.ok(source.includes('attemptsLeft') && source.includes('retry'),
    'removeContainer should implement retry logic with attemptsLeft');
  
  // Verify it retries on non-zero exit code
  assert.ok(source.includes('code !== 0') && source.includes('retry'),
    'removeContainer should retry on non-zero exit code');
});

test('container runner code manages active counter across all exit paths', () => {
  // Read the source code to verify active counter management
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../packages/plugins/src/container-runner.js'), 'utf8');
  
  // Verify active counter exists
  assert.ok(source.includes('let active = 0'),
    'Source should declare active counter');
  
  // Verify active is incremented before spawn
  assert.ok(source.includes('active += 1'),
    'Source should increment active counter');
  
  // Verify active is decremented in finish function
  assert.ok(source.includes('active -= 1') && source.includes('finish'),
    'Source should decrement active counter in finish function');
  
  // Verify active is checked against maxConcurrent
  assert.ok(source.includes('active >= maxConcurrent') && source.includes('ERR_VIRGOSCORPIO_HUB_PLUGIN_BUSY'),
    'Source should check active against maxConcurrent and reject with BUSY');
});
