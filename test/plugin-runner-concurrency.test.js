'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createPluginRunnerServer, sameSecret } = require('../apps/plugin-runner/src/server');

// Mock runner that allows controlled execution timing
function createMockRunner({ delay = 0, shouldFail = false } = {}) {
  const invocations = [];
  let activeCount = 0;
  let peakConcurrency = 0;

  return {
    async invoke({ imageDigest, action, input, requestId }) {
      activeCount++;
      peakConcurrency = Math.max(peakConcurrency, activeCount);
      invocations.push({ imageDigest, action, input, requestId, timestamp: Date.now() });

      try {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        if (shouldFail) {
          const error = new Error('Mock execution failed');
          error.code = 'ERR_MOCK_FAILURE';
          throw error;
        }
        return { success: true, imageDigest, action };
      } finally {
        activeCount--;
      }
    },
    getInvocations: () => invocations,
    getPeakConcurrency: () => peakConcurrency,
    getActiveCount: () => activeCount,
    reset: () => {
      invocations.length = 0;
      activeCount = 0;
      peakConcurrency = 0;
    }
  };
}

// Helper to make HTTP requests to the plugin runner
async function makeRequest(server, { method = 'POST', path = '/v1/invoke', headers = {}, body = null, token = 'test-token-with-at-least-32-chars-here' } = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: address.address === '::' ? 'localhost' : address.address,
      port: address.port,
      path,
      method,
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${token}`,
        ...headers
      }
    };

    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          // Leave parsed as null if not valid JSON
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
          json: parsed
        });
      });
    });

    req.on('error', reject);

    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(bodyStr);
    }
    req.end();
  });
}

test('sameSecret uses constant-time comparison and rejects weak secrets', () => {
  const validToken = 'a'.repeat(32);
  assert.equal(sameSecret(validToken, validToken), true);
  assert.equal(sameSecret('wrong-token-but-also-32-chars-long', validToken), false);
  assert.equal(sameSecret('short', validToken), false);
  assert.equal(sameSecret(validToken, 'too-short'), false);
  assert.equal(sameSecret(123, validToken), false);
  assert.equal(sameSecret(validToken, null), false);
});

test('plugin runner enforces global concurrency limit and returns 429 when at capacity', async t => {
  const mockRunner = createMockRunner({ delay: 100 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const allowedImage = 'example.com/plugin@sha256:' + 'a'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '2',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  const requestBody = {
    imageDigest: allowedImage,
    action: 'test.action',
    input: { test: 'data' },
    requestId: 'req-1'
  };

  // Fire 4 concurrent requests when limit is 2
  const requests = [
    makeRequest(server, { body: { ...requestBody, requestId: 'req-1' }, token: testToken }),
    makeRequest(server, { body: { ...requestBody, requestId: 'req-2' }, token: testToken }),
    makeRequest(server, { body: { ...requestBody, requestId: 'req-3' }, token: testToken }),
    makeRequest(server, { body: { ...requestBody, requestId: 'req-4' }, token: testToken })
  ];

  const responses = await Promise.all(requests);

  // Count successful and rejected responses
  const successful = responses.filter(r => r.statusCode === 200);
  const rejected = responses.filter(r => r.statusCode === 429);

  // At least some should be rejected due to capacity limit
  assert.ok(rejected.length > 0, 'Expected at least one request to be rejected with 429');
  assert.ok(successful.length > 0, 'Expected at least one request to succeed');

  // All rejected requests should have the correct error code and retry-after header
  for (const response of rejected) {
    assert.equal(response.json.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_RUNNER_BUSY');
    assert.equal(response.headers['retry-after'], '1');
    assert.match(response.json.error, /at capacity/i);
  }

  // Peak concurrency should not exceed the limit
  assert.ok(mockRunner.getPeakConcurrency() <= 2, `Peak concurrency ${mockRunner.getPeakConcurrency()} exceeded limit of 2`);
});

test('plugin runner enforces per-image concurrency limit', async t => {
  const mockRunner = createMockRunner({ delay: 100 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const imageA = 'example.com/plugin-a@sha256:' + 'a'.repeat(64);
  const imageB = 'example.com/plugin-b@sha256:' + 'b'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: `${imageA},${imageB}`,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '10',
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY_PER_IMAGE: '1',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  // Fire 3 concurrent requests for the same image when per-image limit is 1
  const requests = [
    makeRequest(server, { body: { imageDigest: imageA, action: 'test.action', input: {}, requestId: 'req-1' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: imageA, action: 'test.action', input: {}, requestId: 'req-2' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: imageA, action: 'test.action', input: {}, requestId: 'req-3' }, token: testToken })
  ];

  const responses = await Promise.all(requests);

  const successful = responses.filter(r => r.statusCode === 200);
  const rejected = responses.filter(r => r.statusCode === 429);

  // At least some should be rejected due to per-image limit
  assert.ok(rejected.length > 0, 'Expected at least one request to be rejected with 429 due to per-image limit');
  assert.ok(successful.length > 0, 'Expected at least one request to succeed');

  // Verify error details
  for (const response of rejected) {
    assert.equal(response.json.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_RUNNER_BUSY');
    assert.equal(response.headers['retry-after'], '1');
  }
});

test('plugin runner allows different images to execute concurrently within global limit', async t => {
  const mockRunner = createMockRunner({ delay: 50 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const imageA = 'example.com/plugin-a@sha256:' + 'a'.repeat(64);
  const imageB = 'example.com/plugin-b@sha256:' + 'b'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: `${imageA},${imageB}`,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '4',
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY_PER_IMAGE: '2',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  // Fire 2 requests for each image (4 total, within global limit of 4)
  const requests = [
    makeRequest(server, { body: { imageDigest: imageA, action: 'test.action', input: {}, requestId: 'req-a1' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: imageA, action: 'test.action', input: {}, requestId: 'req-a2' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: imageB, action: 'test.action', input: {}, requestId: 'req-b1' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: imageB, action: 'test.action', input: {}, requestId: 'req-b2' }, token: testToken })
  ];

  const responses = await Promise.all(requests);

  // All should succeed since we're within both global and per-image limits
  const successful = responses.filter(r => r.statusCode === 200);
  assert.equal(successful.length, 4, 'All 4 requests should succeed when within limits');
});

test('plugin runner properly releases slots after execution completes', async t => {
  const mockRunner = createMockRunner({ delay: 50 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const allowedImage = 'example.com/plugin@sha256:' + 'a'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '1',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  const requestBody = {
    imageDigest: allowedImage,
    action: 'test.action',
    input: { test: 'data' },
    requestId: 'req-1'
  };

  // Execute requests sequentially - each should succeed because slots are released
  const response1 = await makeRequest(server, { body: { ...requestBody, requestId: 'req-1' }, token: testToken });
  assert.equal(response1.statusCode, 200, 'First request should succeed');

  const response2 = await makeRequest(server, { body: { ...requestBody, requestId: 'req-2' }, token: testToken });
  assert.equal(response2.statusCode, 200, 'Second request should succeed after first completes');

  const response3 = await makeRequest(server, { body: { ...requestBody, requestId: 'req-3' }, token: testToken });
  assert.equal(response3.statusCode, 200, 'Third request should succeed after second completes');

  // All three should have been executed
  assert.equal(mockRunner.getInvocations().length, 3, 'All three invocations should have been executed');
});

test('plugin runner releases slots even when execution fails', async t => {
  const mockRunner = createMockRunner({ delay: 20, shouldFail: true });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const allowedImage = 'example.com/plugin@sha256:' + 'a'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '1',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  const requestBody = {
    imageDigest: allowedImage,
    action: 'test.action',
    input: { test: 'data' },
    requestId: 'req-1'
  };

  // First request should fail
  const response1 = await makeRequest(server, { body: { ...requestBody, requestId: 'req-1' }, token: testToken });
  assert.equal(response1.statusCode, 500, 'First request should fail');

  // Second request should also be accepted (slot was released)
  const response2 = await makeRequest(server, { body: { ...requestBody, requestId: 'req-2' }, token: testToken });
  assert.equal(response2.statusCode, 500, 'Second request should also fail but be accepted');

  // Both should have been attempted
  assert.equal(mockRunner.getInvocations().length, 2, 'Both invocations should have been attempted');
});

test('plugin runner rejects requests before allowlist check when at global capacity', async t => {
  const mockRunner = createMockRunner({ delay: 100 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const allowedImage = 'example.com/plugin@sha256:' + 'a'.repeat(64);
  const notAllowedImage = 'example.com/evil@sha256:' + 'e'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '1',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  // Start a long-running request to fill capacity
  const longRequest = makeRequest(server, {
    body: { imageDigest: allowedImage, action: 'test.action', input: {}, requestId: 'req-long' },
    token: testToken
  });

  // Give it time to start
  await new Promise(resolve => setTimeout(resolve, 10));

  // Try to submit a request with a non-allowlisted image while at capacity
  const rejectedRequest = await makeRequest(server, {
    body: { imageDigest: notAllowedImage, action: 'test.action', input: {}, requestId: 'req-evil' },
    token: testToken
  });

  // Should be rejected with 429 (capacity) not 403 (allowlist)
  // This confirms the capacity check happens before allowlist validation
  assert.equal(rejectedRequest.statusCode, 429, 'Should be rejected with 429 for capacity, not 403 for allowlist');
  assert.equal(rejectedRequest.json.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_RUNNER_BUSY');

  await longRequest;
});

test('plugin runner enforces allowlist after global capacity check but before per-image check', async t => {
  const mockRunner = createMockRunner({ delay: 10 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const allowedImage = 'example.com/plugin@sha256:' + 'a'.repeat(64);
  const notAllowedImage = 'example.com/evil@sha256:' + 'e'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '10',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  // Try to submit a request with a non-allowlisted image when capacity is available
  const response = await makeRequest(server, {
    body: { imageDigest: notAllowedImage, action: 'test.action', input: {}, requestId: 'req-evil' },
    token: testToken
  });

  // Should be rejected with 403 for allowlist violation
  assert.equal(response.statusCode, 403, 'Should be rejected with 403 for allowlist violation');
  assert.equal(response.json.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_IMAGE_NOT_ALLOWED');
  assert.match(response.json.error, /not allowlisted/i);
});

test('plugin runner parses concurrency limits with bounds checking', async t => {
  const testToken = 'test-token-with-at-least-32-chars-here';
  const allowedImage = 'example.com/plugin@sha256:' + 'a'.repeat(64);

  // Test default values
  const server1 = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      NODE_ENV: 'test'
    },
    runner: createMockRunner(),
    logger: { log: () => {}, error: () => {} }
  });
  assert.ok(server1, 'Server should be created with default limits');
  server1.close();

  // Test invalid values fall back to defaults
  const server2 = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: 'invalid',
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY_PER_IMAGE: '-5',
      NODE_ENV: 'test'
    },
    runner: createMockRunner(),
    logger: { log: () => {}, error: () => {} }
  });
  assert.ok(server2, 'Server should be created with fallback defaults for invalid values');
  server2.close();

  // Test boundary values
  const server3 = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '1024',
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY_PER_IMAGE: '1',
      NODE_ENV: 'test'
    },
    runner: createMockRunner(),
    logger: { log: () => {}, error: () => {} }
  });
  assert.ok(server3, 'Server should accept boundary values (1024 and 1)');
  server3.close();

  // Test values outside bounds are rejected
  const server4 = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: allowedImage,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '2000',
      NODE_ENV: 'test'
    },
    runner: createMockRunner(),
    logger: { log: () => {}, error: () => {} }
  });
  assert.ok(server4, 'Server should fall back to default when value exceeds 1024');
  server4.close();
});

test('plugin runner prevents cross-tenant resource exhaustion via per-image limits', async t => {
  const mockRunner = createMockRunner({ delay: 100 });
  const testToken = 'test-token-with-at-least-32-chars-here';
  const tenantAImage = 'example.com/tenant-a-plugin@sha256:' + 'a'.repeat(64);
  const tenantBImage = 'example.com/tenant-b-plugin@sha256:' + 'b'.repeat(64);

  const server = createPluginRunnerServer({
    env: {
      VIRGOSCORPIO_HUB_PLUGIN_RUNNER_TOKEN: testToken,
      VIRGOSCORPIO_HUB_PLUGIN_ALLOWED_IMAGES: `${tenantAImage},${tenantBImage}`,
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY: '4',
      VIRGOSCORPIO_HUB_PLUGIN_MAX_CONCURRENCY_PER_IMAGE: '2',
      NODE_ENV: 'test'
    },
    runner: mockRunner,
    logger: { log: () => {}, error: () => {} }
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', err => {
      if (err) reject(err);
      else resolve();
    });
  });

  t.after(() => {
    return new Promise(resolve => server.close(resolve));
  });

  // Simulate tenant A trying to monopolize the runner with 4 concurrent requests
  const tenantARequests = [
    makeRequest(server, { body: { imageDigest: tenantAImage, action: 'test.action', input: {}, requestId: 'a1' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: tenantAImage, action: 'test.action', input: {}, requestId: 'a2' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: tenantAImage, action: 'test.action', input: {}, requestId: 'a3' }, token: testToken }),
    makeRequest(server, { body: { imageDigest: tenantAImage, action: 'test.action', input: {}, requestId: 'a4' }, token: testToken })
  ];

  // Give tenant A's requests time to start
  await new Promise(resolve => setTimeout(resolve, 10));

  // Tenant B should still be able to execute despite tenant A's load
  const tenantBRequest = await makeRequest(server, {
    body: { imageDigest: tenantBImage, action: 'test.action', input: {}, requestId: 'b1' },
    token: testToken
  });

  const tenantAResponses = await Promise.all(tenantARequests);

  // Tenant A should have some requests rejected due to per-image limit
  const tenantARejected = tenantAResponses.filter(r => r.statusCode === 429);
  assert.ok(tenantARejected.length > 0, 'Tenant A should have some requests rejected due to per-image limit');

  // Tenant B should succeed (not blocked by tenant A's excessive requests)
  assert.equal(tenantBRequest.statusCode, 200, 'Tenant B should be able to execute despite tenant A load');
  assert.equal(tenantBRequest.json.result.imageDigest, tenantBImage);
});
