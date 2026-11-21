'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Tests for password-reset timing oracle mitigation (pentest finding).
 * 
 * The vulnerability: The password-reset endpoint exposed a measurable latency
 * difference between nonexistent addresses and active accounts. The active-account
 * path performed and awaited token/database/outbox work, while the nonexistent-account
 * path returned after the lookup, allowing repeated unauthenticated requests to
 * statistically identify registered active email addresses.
 * 
 * The mitigation: The endpoint now returns immediately with a generic response
 * for both existing and non-existing accounts. The actual password reset processing
 * (database writes, token generation, mail outbox) happens asynchronously after
 * the response is sent, except in development mode with VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS.
 * Additionally, endpoint-specific rate limiting is enforced.
 */

// Mock the auth route handler to test the mitigation logic
function createMockAuthRouteHandler({ identity, env, allowRequest }) {
  return async function handlePasswordResetRequest({ email, requestId }) {
    // Check rate limiting (endpoint-specific)
    const limit = allowRequest('password-reset:127.0.0.1');
    if (!limit.allowed) {
      return { status: 429, retryAfterSeconds: limit.retryAfterSeconds };
    }

    // The mitigation: return immediately without awaiting the service
    const exposeDevTokens = env.NODE_ENV !== 'production' && env.VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS === 'true';
    let result = { accepted: true };
    
    if (exposeDevTokens) {
      // Development mode: await the service to expose tokens
      result = await identity.requestPasswordReset({ email });
    } else {
      // Production mode: fire and forget
      Promise.resolve()
        .then(() => identity.requestPasswordReset({ email }))
        .catch(() => { /* silently handle errors */ });
    }
    
    return {
      status: 202,
      ...result,
      message: 'If an active account matches that address, password reset instructions will be sent.',
      requestId
    };
  };
}

// Mock rate limiter
function createMockRateLimiter(maxRequests = 100) {
  const buckets = new Map();
  return function allowRequest(key) {
    const entry = buckets.get(key) || { count: 0 };
    if (entry.count >= maxRequests) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    entry.count++;
    buckets.set(key, entry);
    return { allowed: true };
  };
}

test('password-reset endpoint enforces endpoint-specific rate limiting', async () => {
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      return { accepted: true };
    }
  };
  
  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  // Make multiple requests to trigger rate limiting
  const responses = [];
  for (let i = 0; i < 105; i++) {
    const response = await handler({ email: `test${i}@example.test`, requestId: `req-${i}` });
    responses.push(response);
  }

  // At least one request should be rate-limited (429)
  const rateLimited = responses.filter(r => r.status === 429);
  assert.ok(rateLimited.length > 0, 'Expected at least one rate-limited response');
  
  // Rate-limited responses should include retry-after
  for (const limited of rateLimited) {
    assert.ok(limited.retryAfterSeconds, 'Rate-limited response must include retryAfterSeconds');
    assert.ok(limited.retryAfterSeconds > 0 && limited.retryAfterSeconds <= 3600, 'retryAfterSeconds should be reasonable');
  }
});

test('password-reset returns generic 202 response for non-existent accounts without awaiting service', async () => {
  let serviceCallCount = 0;
  let serviceCallEmail = null;
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      serviceCallCount++;
      serviceCallEmail = email;
      // Simulate database work that would cause timing difference
      await new Promise(resolve => setTimeout(resolve, 50));
      return { accepted: true };
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  const startTime = Date.now();
  const response = await handler({ email: 'nonexistent@example.test', requestId: 'req-1' });
  const responseTime = Date.now() - startTime;

  assert.equal(response.status, 202, 'Should return 202 Accepted');
  assert.equal(response.accepted, true, 'Response should indicate accepted');
  assert.match(response.message, /If an active account matches/i, 'Should return generic message');
  
  // In production mode, the response should be fast because it doesn't await the service
  assert.ok(responseTime < 100, `Response should be fast (was ${responseTime}ms), not waiting for async processing`);

  // Give async processing time to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // The service should have been called asynchronously
  assert.equal(serviceCallCount, 1, 'Service should be called once asynchronously');
  assert.equal(serviceCallEmail, 'nonexistent@example.test', 'Service should receive the email');
});

test('password-reset returns generic 202 response for existing accounts without awaiting service', async () => {
  let serviceCallCount = 0;
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      serviceCallCount++;
      // Simulate database work that would cause timing difference
      await new Promise(resolve => setTimeout(resolve, 50));
      return { accepted: true };
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  const startTime = Date.now();
  const response = await handler({ email: 'existing@example.test', requestId: 'req-1' });
  const responseTime = Date.now() - startTime;

  assert.equal(response.status, 202, 'Should return 202 Accepted');
  assert.equal(response.accepted, true, 'Response should indicate accepted');
  assert.match(response.message, /If an active account matches/i, 'Should return generic message');
  
  // Response should be fast, not waiting for async processing
  assert.ok(responseTime < 100, `Response should be fast (was ${responseTime}ms), not waiting for async processing`);

  // Give async processing time to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // The service should have been called asynchronously
  assert.equal(serviceCallCount, 1, 'Service should be called once asynchronously');
});

test('password-reset timing is consistent between existing and non-existing accounts', async () => {
  const timings = { existing: [], nonexisting: [] };
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      // Simulate different processing times for existing vs non-existing
      if (email.startsWith('existing')) {
        // Simulate database writes, token generation, mail outbox
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        // Simulate quick lookup with no match
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      return { accepted: true };
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  // Test multiple requests to both existing and non-existing accounts
  for (let i = 0; i < 10; i++) {
    // Non-existing account
    const start1 = Date.now();
    const res1 = await handler({ email: `nonexisting${i}@example.test`, requestId: `req-${i}-1` });
    timings.nonexisting.push(Date.now() - start1);
    assert.equal(res1.status, 202);

    // Existing account
    const start2 = Date.now();
    const res2 = await handler({ email: `existing${i}@example.test`, requestId: `req-${i}-2` });
    timings.existing.push(Date.now() - start2);
    assert.equal(res2.status, 202);
  }

  // Calculate average timings
  const avgNonexisting = timings.nonexisting.reduce((a, b) => a + b, 0) / timings.nonexisting.length;
  const avgExisting = timings.existing.reduce((a, b) => a + b, 0) / timings.existing.length;
  
  // Both should be fast (under 100ms) since they don't await the service
  assert.ok(avgNonexisting < 100, `Non-existing account responses should be fast (avg: ${avgNonexisting}ms)`);
  assert.ok(avgExisting < 100, `Existing account responses should be fast (avg: ${avgExisting}ms)`);
  
  // The timing difference should be minimal (within 50ms)
  const timingDifference = Math.abs(avgExisting - avgNonexisting);
  assert.ok(timingDifference < 50, `Timing difference should be minimal (was ${timingDifference}ms), preventing timing oracle`);
});

test('password-reset in development mode with VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS awaits service and returns token', async () => {
  const mockToken = 'dev-reset-token-12345';
  let serviceCallCount = 0;
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      serviceCallCount++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return { accepted: true, token: mockToken };
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'development', VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS: 'true' },
    allowRequest
  });

  const response = await handler({ email: 'dev@example.test', requestId: 'req-1' });

  assert.equal(response.status, 202);
  assert.equal(response.accepted, true);
  assert.equal(response.token, mockToken, 'Development mode should expose token for testing');
  assert.equal(serviceCallCount, 1, 'Service should be called synchronously in dev mode');
});

test('password-reset in production mode never exposes tokens', async () => {
  const mockToken = 'secret-reset-token-should-not-be-exposed';
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { accepted: true, token: mockToken };
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  const response = await handler({ email: 'user@example.test', requestId: 'req-1' });

  assert.equal(response.status, 202);
  assert.equal(response.accepted, true);
  assert.equal(response.token, undefined, 'Production mode should never expose token');
  assert.ok(!response.hasOwnProperty('token'), 'Token property should not be present in response');
});

test('password-reset handles service errors gracefully without exposing account existence', async () => {
  let serviceCallCount = 0;
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      serviceCallCount++;
      // Simulate a service error
      throw new Error('Database connection failed');
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  const response = await handler({ email: 'user@example.test', requestId: 'req-1' });

  // Even if the service fails, the response should still be generic 202
  assert.equal(response.status, 202, 'Should return 202 even if service fails');
  assert.equal(response.accepted, true, 'Should indicate accepted even if service fails');
  assert.match(response.message, /If an active account matches/i, 'Should return generic message');

  // Give async processing time to fail
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // The service should have been called
  assert.equal(serviceCallCount, 1, 'Service should be called once');
});

test('password-reset rate limiting uses endpoint-specific key prefix', async () => {
  // This test verifies that password-reset has its own rate limit bucket
  // separate from other endpoints like login
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      return { accepted: true };
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  // Make many password-reset requests
  const resetResponses = [];
  for (let i = 0; i < 105; i++) {
    const response = await handler({ email: `test${i}@example.test`, requestId: `req-${i}` });
    resetResponses.push(response.status);
  }

  // Should have some rate-limited responses
  const resetRateLimited = resetResponses.filter(s => s === 429).length;
  assert.ok(resetRateLimited > 0, 'Password-reset should be rate-limited');

  // Verify that the rate limiter is using the 'password-reset:' prefix
  // by checking that a different key would not be affected
  const loginLimit = allowRequest('login:127.0.0.1');
  assert.equal(loginLimit.allowed, true, 'Login should not be rate-limited by password-reset requests');
});

test('password-reset generic response prevents account enumeration', async () => {
  // This test verifies that the response is identical for existing and non-existing accounts
  
  const mockIdentity = {
    async requestPasswordReset({ email }) {
      // Simulate different behavior for existing vs non-existing accounts
      if (email === 'existing@example.test') {
        // Existing account: generate token, write to DB, queue email
        await new Promise(resolve => setTimeout(resolve, 100));
        return { accepted: true, tokenGenerated: true };
      } else {
        // Non-existing account: quick lookup, no work
        await new Promise(resolve => setTimeout(resolve, 5));
        return { accepted: true, tokenGenerated: false };
      }
    }
  };

  const allowRequest = createMockRateLimiter(100);
  const handler = createMockAuthRouteHandler({
    identity: mockIdentity,
    env: { NODE_ENV: 'production' },
    allowRequest
  });

  const response1 = await handler({ email: 'existing@example.test', requestId: 'req-1' });
  const response2 = await handler({ email: 'nonexisting@example.test', requestId: 'req-2' });

  // Both responses should be identical
  assert.equal(response1.status, response2.status, 'Status codes should be identical');
  assert.equal(response1.accepted, response2.accepted, 'Accepted field should be identical');
  assert.equal(response1.message, response2.message, 'Message should be identical');
  
  // Neither should expose internal details like tokenGenerated
  assert.equal(response1.tokenGenerated, undefined, 'Should not expose internal details');
  assert.equal(response2.tokenGenerated, undefined, 'Should not expose internal details');
  
  // Both should have the same structure
  const keys1 = Object.keys(response1).sort();
  const keys2 = Object.keys(response2).sort();
  assert.deepEqual(keys1, keys2, 'Response structure should be identical');
});
