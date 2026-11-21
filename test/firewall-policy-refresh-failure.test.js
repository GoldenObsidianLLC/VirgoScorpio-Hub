'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirewall } = require('../packages/security/src/firewall');

test('firewall without pool starts with valid policy and allows pass results', async () => {
  const firewall = createFirewall({ pool: null });
  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result.action, 'pass', 'firewall without pool should pass when no static deny rules match');
});

test('firewall with pool starts with invalid policy but becomes valid after first successful refresh', async () => {
  let queryCount = 0;
  const pool = {
    async query(sql) {
      queryCount++;
      // First call succeeds to simulate successful refresh
      return { rows: [] };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 10000 });

  // First evaluation triggers refresh which succeeds, making policy valid
  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result.action, 'pass', 'firewall should pass after successful refresh with no matching rules');
  assert.equal(queryCount, 1, 'should have attempted one refresh');

  // Second evaluation should not refresh again within TTL
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'pass', 'firewall should still pass');
  assert.equal(queryCount, 1, 'should not refresh again within TTL');
});

test('firewall fails closed when PostgreSQL refresh rejects during startup', async () => {
  let queryCount = 0;
  const pool = {
    async query(sql) {
      queryCount++;
      throw new Error('simulated database connection failure');
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // First evaluation triggers refresh which fails
  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result.action, 'deny', 'firewall should deny when refresh fails');
  assert.equal(result.reason, 'firewall-policy-unavailable', 'deny reason should indicate policy unavailable');
  assert.equal(result.ruleId, null, 'ruleId should be null for policy unavailable');
  assert.equal(queryCount, 1, 'should have attempted one refresh');
});

test('firewall fails closed when PostgreSQL refresh rejects after clearCache', async () => {
  let queryCount = 0;
  let shouldFail = false;
  const pool = {
    async query(sql) {
      queryCount++;
      if (shouldFail) {
        throw new Error('simulated database failure after cache clear');
      }
      return { rows: [{ id: 'rule-1', site_id: null, action: 'deny', scope: 'ip', pattern: '203.0.113.5', reason: 'test-rule', enabled: true }] };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 10000 });

  // First evaluation succeeds
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'pass', 'should pass with valid policy and no matching rules');
  assert.equal(queryCount, 1, 'should have refreshed once');

  // Clear cache and make next refresh fail
  firewall.clearCache();
  shouldFail = true;

  // Next evaluation should fail closed
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'deny', 'firewall should deny when refresh fails after clearCache');
  assert.equal(result2.reason, 'firewall-policy-unavailable', 'deny reason should indicate policy unavailable');
  assert.equal(queryCount, 2, 'should have attempted second refresh');
});

test('firewall continues to deny on subsequent evaluations while policy remains invalid', async () => {
  let queryCount = 0;
  const pool = {
    async query(sql) {
      queryCount++;
      throw new Error('persistent database failure');
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 1000 });

  // First evaluation
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'deny', 'first evaluation should deny');
  assert.equal(result1.reason, 'firewall-policy-unavailable');

  // Wait for cache to expire
  await new Promise(resolve => setTimeout(resolve, 1100));

  // Second evaluation should also deny
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'deny', 'second evaluation should deny');
  assert.equal(result2.reason, 'firewall-policy-unavailable');
  assert.ok(queryCount >= 2, 'should have attempted multiple refreshes');
});

test('firewall recovers and allows pass after policy becomes valid following failures', async () => {
  let queryCount = 0;
  let shouldFail = true;
  const pool = {
    async query(sql) {
      queryCount++;
      if (shouldFail) {
        throw new Error('temporary database failure');
      }
      return { rows: [] };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 1000 });

  // First evaluation fails
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'deny', 'should deny during database failure');

  // Database recovers
  shouldFail = false;

  // Wait for cache to expire
  await new Promise(resolve => setTimeout(resolve, 1100));

  // Second evaluation should succeed
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'pass', 'should pass after database recovers');
  assert.ok(queryCount >= 2, 'should have attempted multiple refreshes');
});

test('firewall denies policy-unavailable before checking dynamic rules', async () => {
  const pool = {
    async query(sql) {
      throw new Error('database unavailable');
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Even though we're checking an IP that would match a rule if loaded,
  // the policy-unavailable check happens first
  const result = await firewall.evaluate({ ip: '203.0.113.5', path: '/api/test', userAgent: 'test' });
  assert.equal(result.action, 'deny', 'should deny due to policy unavailable');
  assert.equal(result.reason, 'firewall-policy-unavailable', 'reason should be policy unavailable, not a rule match');
});

test('firewall static deny rules work even when policy is invalid', async () => {
  const pool = {
    async query(sql) {
      throw new Error('database unavailable');
    }
  };
  const env = {
    VIRGOSCORPIO_HUB_FIREWALL_DENY_CIDRS: '203.0.113.0/24,198.51.100.5'
  };
  const firewall = createFirewall({ pool, env, cacheTtlMs: 5000 });

  // Static deny should work before policy check
  const result1 = await firewall.evaluate({ ip: '203.0.113.10', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'deny', 'should deny via static CIDR rule');
  assert.equal(result1.reason, 'deployment-deny-list', 'reason should be deployment deny list');

  const result2 = await firewall.evaluate({ ip: '198.51.100.5', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'deny', 'should deny via static IP rule');
  assert.equal(result2.reason, 'deployment-deny-list', 'reason should be deployment deny list');

  // Non-matching IP should still be denied due to invalid policy
  const result3 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result3.action, 'deny', 'should deny due to policy unavailable');
  assert.equal(result3.reason, 'firewall-policy-unavailable', 'reason should be policy unavailable');
});

test('firewall evaluates dynamic rules only when policy is valid', async () => {
  let shouldFail = false;
  const pool = {
    async query(sql) {
      if (shouldFail) {
        throw new Error('database failure');
      }
      return {
        rows: [
          { id: 'rule-1', site_id: null, action: 'deny', scope: 'ip', pattern: '203.0.113.5', reason: 'blocked-ip', enabled: true },
          { id: 'rule-2', site_id: null, action: 'challenge', scope: 'path', pattern: '/admin', reason: 'admin-challenge', enabled: true }
        ]
      };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 10000 });

  // First evaluation loads rules successfully
  const result1 = await firewall.evaluate({ ip: '203.0.113.5', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'deny', 'should deny via dynamic rule');
  assert.equal(result1.reason, 'blocked-ip', 'should use rule reason');
  assert.equal(result1.ruleId, 'rule-1', 'should include rule ID');

  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/admin/settings', userAgent: 'test' });
  assert.equal(result2.action, 'challenge', 'should challenge via dynamic rule');
  assert.equal(result2.reason, 'admin-challenge', 'should use rule reason');

  // Clear cache and make refresh fail
  firewall.clearCache();
  shouldFail = true;

  // Now the same requests should be denied due to policy unavailable, not the rules
  const result3 = await firewall.evaluate({ ip: '203.0.113.5', path: '/api/test', userAgent: 'test' });
  assert.equal(result3.action, 'deny', 'should deny due to policy unavailable');
  assert.equal(result3.reason, 'firewall-policy-unavailable', 'should not evaluate stale rules');
  assert.equal(result3.ruleId, null, 'should not have rule ID when policy invalid');
});

test('firewall clearCache invalidates policy when pool exists', async () => {
  let queryCount = 0;
  const pool = {
    async query(sql) {
      queryCount++;
      return { rows: [] };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 10000 });

  // First evaluation establishes valid policy
  await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(queryCount, 1, 'should have refreshed once');

  // Clear cache
  firewall.clearCache();

  // Next evaluation should deny due to invalid policy and trigger refresh
  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  // After clearCache with pool, policy is invalid until refresh completes
  // The refresh happens during evaluate, so policy becomes valid
  assert.equal(result.action, 'pass', 'should pass after refresh completes');
  assert.equal(queryCount, 2, 'should have refreshed again');
});

test('firewall clearCache does not invalidate policy when pool is null', async () => {
  const firewall = createFirewall({ pool: null });

  // Without pool, policy is always valid
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'pass', 'should pass before clearCache');

  firewall.clearCache();

  // Should still pass after clearCache
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'pass', 'should pass after clearCache when pool is null');
});

test('firewall concurrent refresh attempts share the same promise', async () => {
  let queryCount = 0;
  let resolveQuery;
  const pool = {
    async query(sql) {
      queryCount++;
      return new Promise(resolve => {
        resolveQuery = () => resolve({ rows: [] });
      });
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 10000 });

  // Start multiple concurrent evaluations
  const promise1 = firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  const promise2 = firewall.evaluate({ ip: '192.0.2.2', path: '/api/test', userAgent: 'test' });
  const promise3 = firewall.evaluate({ ip: '192.0.2.3', path: '/api/test', userAgent: 'test' });

  // Let the query complete
  await new Promise(resolve => setTimeout(resolve, 10));
  resolveQuery();

  const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

  assert.equal(queryCount, 1, 'should only query once for concurrent requests');
  assert.equal(result1.action, 'pass', 'first request should pass');
  assert.equal(result2.action, 'pass', 'second request should pass');
  assert.equal(result3.action, 'pass', 'third request should pass');
});

test('firewall refresh failure does not prevent subsequent refresh attempts', async () => {
  let queryCount = 0;
  let shouldFail = true;
  const pool = {
    async query(sql) {
      queryCount++;
      if (shouldFail) {
        throw new Error('temporary failure');
      }
      return { rows: [] };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 500 });

  // First refresh fails
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result1.action, 'deny', 'should deny on first failure');
  assert.equal(queryCount, 1, 'should have attempted first refresh');

  // Wait for retry window
  await new Promise(resolve => setTimeout(resolve, 600));

  // Second refresh also fails
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result2.action, 'deny', 'should deny on second failure');
  assert.equal(queryCount, 2, 'should have attempted second refresh');

  // Database recovers
  shouldFail = false;
  await new Promise(resolve => setTimeout(resolve, 600));

  // Third refresh succeeds
  const result3 = await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  assert.equal(result3.action, 'pass', 'should pass after recovery');
  assert.equal(queryCount, 3, 'should have attempted third refresh');
});

test('firewall rules method also respects policy validity', async () => {
  let shouldFail = true;
  const pool = {
    async query(sql) {
      if (shouldFail) {
        throw new Error('database failure');
      }
      return {
        rows: [
          { id: 'rule-1', site_id: 'site-a', action: 'deny', scope: 'ip', pattern: '203.0.113.5', reason: 'test', enabled: true }
        ]
      };
    }
  };
  const firewall = createFirewall({ pool, cacheTtlMs: 10000 });

  // First call fails to load rules
  await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });

  // Rules method returns empty array when policy is invalid (cache is empty)
  const rules1 = await firewall.rules('site-a');
  assert.equal(rules1.length, 0, 'should return empty rules when policy invalid');

  // Database recovers
  shouldFail = false;
  firewall.clearCache();

  // After successful refresh, rules are available
  await firewall.evaluate({ ip: '192.0.2.1', path: '/api/test', userAgent: 'test' });
  const rules2 = await firewall.rules('site-a');
  assert.equal(rules2.length, 1, 'should return rules after policy becomes valid');
  assert.equal(rules2[0].id, 'rule-1', 'should return correct rule');
});
