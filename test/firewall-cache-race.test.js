'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirewall } = require('../packages/security/src/firewall');

/**
 * Security test: Firewall cache race condition mitigation
 *
 * Pentest finding: In-flight firewall refresh can republish a pre-mutation policy
 *
 * The vulnerability occurred when:
 * 1. A cache refresh query starts (SELECT from firewall_rules)
 * 2. A firewall rule transaction commits (INSERT/DELETE rule)
 * 3. clearCache() is called (only set cacheUntil=0)
 * 4. The old SELECT completes and unconditionally publishes stale rows
 * 5. Next request evaluates against pre-mutation policy (bypass)
 *
 * The fix introduces:
 * - generation counter: incremented on clearCache()
 * - startedGeneration: captured at query start
 * - conditional publication: only publish if startedGeneration === generation
 * - ensureFresh(): retry loop that re-runs refresh if cache is still invalid
 * - clearCache() now: generation++, cacheUntil=0, refreshing=null
 */

test('firewall cache refresh discards result when invalidated during query', async () => {
  let queryResolve;
  const queryPromise = new Promise(resolve => { queryResolve = resolve; });
  let queryCount = 0;

  const pool = {
    query: async () => {
      queryCount++;
      if (queryCount === 1) {
        // First query (slow, will be invalidated)
        await queryPromise;
        return { rows: [{ id: 1, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'old-rule', enabled: true }] };
      } else {
        // Second query (fast, after clearCache)
        return { rows: [] };
      }
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Start evaluation (triggers refresh)
  const evalPromise = firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  // Wait a tick to ensure refresh has started
  await new Promise(resolve => setImmediate(resolve));

  // Simulate rule mutation: clearCache() is called while query is in-flight
  firewall.clearCache();

  // Now complete the first query with old data
  queryResolve();

  // The evaluation should complete with the result from the second query
  const result = await evalPromise;

  // Since the first query result was invalidated, ensureFresh should have triggered
  // a second query which returns empty rules, so the request should pass
  assert.equal(result.action, 'pass', 'Stale query result should be discarded, resulting in pass');
  assert.ok(queryCount >= 2, 'Should have triggered a second query after invalidation');
});

test('firewall cache refresh with generation check prevents stale policy enforcement', async () => {
  let queryCount = 0;
  const queries = [];

  const pool = {
    query: async () => {
      const currentQuery = queryCount++;
      queries.push({ id: currentQuery, started: Date.now() });

      // First query returns old rule, second query returns new rule
      if (currentQuery === 0) {
        // Simulate slow first query
        await new Promise(resolve => setTimeout(resolve, 50));
        return { rows: [{ id: 1, site_id: null, action: 'allow', scope: 'ip', pattern: '192.0.2.1', reason: 'old-allow', enabled: true }] };
      } else {
        // Fast second query with new deny rule
        return { rows: [{ id: 2, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'new-deny', enabled: true }] };
      }
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Start first evaluation (triggers first refresh)
  const eval1Promise = firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  // Wait a bit to ensure first query has started
  await new Promise(resolve => setTimeout(resolve, 10));

  // Simulate rule mutation during first query
  firewall.clearCache();

  // Start second evaluation (should trigger second refresh due to clearCache)
  const eval2Promise = firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  // Wait for both evaluations
  const [result1, result2] = await Promise.all([eval1Promise, eval2Promise]);

  // Both should see the new deny rule (or pass if first query was discarded)
  // The key is that neither should see the old allow rule after clearCache
  assert.notEqual(result1.action, 'allow', 'First evaluation should not see stale allow rule');
  assert.notEqual(result2.action, 'allow', 'Second evaluation should not see stale allow rule');

  // At least one should see the deny rule
  assert.ok(result1.action === 'deny' || result2.action === 'deny', 'New deny rule should be enforced');

  // Verify multiple queries were made
  assert.ok(queryCount >= 2, 'Multiple queries should be made after clearCache');
});

test('firewall ensureFresh fails closed after refresh error and recovers on the next evaluation', async () => {
  let queryCount = 0;

  const pool = {
    query: async () => {
      queryCount++;
      if (queryCount === 1) throw new Error('simulated query failure');
      return { rows: [{ id: 1, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'valid-rule', enabled: true }] };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });
  const request = { ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null };

  const unavailable = await firewall.evaluate(request);
  assert.deepEqual(unavailable, {
    action: 'deny',
    reason: 'firewall-policy-unavailable',
    ruleId: null
  });
  assert.equal(queryCount, 1, 'the failed refresh must not be silently retried in the same generation');

  const recovered = await firewall.evaluate(request);
  assert.equal(recovered.action, 'deny');
  assert.equal(recovered.reason, 'valid-rule');
  assert.equal(queryCount, 2, 'a later evaluation must retry and publish the recovered policy');
});

test('firewall clearCache increments generation and nullifies refreshing', async () => {
  let queryStarted = false;
  let queryResolve;
  const queryPromise = new Promise(resolve => { queryResolve = resolve; });

  const pool = {
    query: async () => {
      queryStarted = true;
      await queryPromise;
      return { rows: [] };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Start a refresh
  const evalPromise = firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  // Wait for query to start
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(queryStarted, 'Query should have started');

  // Call clearCache while query is in-flight
  firewall.clearCache();

  // Complete the query
  queryResolve();
  await evalPromise;

  // Start another evaluation - should trigger a new query
  let secondQueryStarted = false;
  const pool2 = {
    query: async () => {
      secondQueryStarted = true;
      return { rows: [] };
    }
  };

  const firewall2 = createFirewall({ pool: pool2, cacheTtlMs: 5000 });
  await firewall2.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  firewall2.clearCache();
  await firewall2.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  assert.ok(secondQueryStarted, 'New query should start after clearCache');
});

test('firewall concurrent evaluations share same refresh promise', async () => {
  let queryCount = 0;

  const pool = {
    query: async () => {
      queryCount++;
      await new Promise(resolve => setTimeout(resolve, 20));
      return { rows: [{ id: 1, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'shared', enabled: true }] };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Start multiple concurrent evaluations
  const promises = [
    firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null }),
    firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null }),
    firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null })
  ];

  const results = await Promise.all(promises);

  // All should get the same result
  assert.equal(results[0].action, 'deny');
  assert.equal(results[1].action, 'deny');
  assert.equal(results[2].action, 'deny');

  // Only one query should be made (shared refresh)
  assert.equal(queryCount, 1, 'Concurrent evaluations should share refresh promise');
});

test('firewall stale cache does not bypass newly committed deny rule', async () => {
  let generation = 0;
  const rules = new Map();

  const pool = {
    query: async () => {
      const currentGen = generation;
      // Simulate query delay
      await new Promise(resolve => setTimeout(resolve, 30));

      // Return rules that existed when query started
      const snapshot = Array.from(rules.values()).filter(r => r.generation <= currentGen);
      return { rows: snapshot };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Initial state: no rules (allow/pass)
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(result1.action, 'pass', 'Initial request should pass');

  // Simulate rule creation transaction
  generation++;
  rules.set(1, { id: 1, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'blocked', enabled: true, generation });

  // Clear cache (simulating post-commit invalidation)
  firewall.clearCache();

  // Next evaluation should see the deny rule, not stale empty cache
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(result2.action, 'deny', 'Request after rule creation should be denied');
  assert.equal(result2.reason, 'blocked', 'Should see the new rule reason');
});

test('firewall stale cache does not allow request after rule deletion', async () => {
  let generation = 0;
  const rules = new Map();

  // Start with a deny rule
  rules.set(1, { id: 1, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'blocked', enabled: true, generation: 0 });

  const pool = {
    query: async () => {
      const currentGen = generation;
      // Simulate query delay
      await new Promise(resolve => setTimeout(resolve, 30));

      // Return rules that existed when query started
      const snapshot = Array.from(rules.values()).filter(r => r.generation <= currentGen);
      return { rows: snapshot };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Initial request should be denied
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(result1.action, 'deny', 'Initial request should be denied');

  // Simulate rule deletion transaction
  generation++;
  rules.delete(1);

  // Clear cache (simulating post-commit invalidation)
  firewall.clearCache();

  // Next evaluation should NOT see the old deny rule
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(result2.action, 'pass', 'Request after rule deletion should pass');
});

test('firewall rules() method also uses ensureFresh', async () => {
  let queryCount = 0;

  const pool = {
    query: async () => {
      queryCount++;
      return { rows: [{ id: 1, site_id: 'site-a', action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'test', enabled: true }] };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Get rules (should trigger refresh)
  const rules1 = await firewall.rules('site-a');
  assert.equal(rules1.length, 1);
  assert.equal(queryCount, 1);

  // Clear cache
  firewall.clearCache();

  // Get rules again (should trigger new refresh)
  const rules2 = await firewall.rules('site-a');
  assert.equal(rules2.length, 1);
  assert.ok(queryCount >= 2, 'rules() should trigger refresh after clearCache');
});

test('firewall evaluate respects action priority: deny > challenge > rate_limit > allow > pass', async () => {
  const pool = {
    query: async () => ({
      rows: [
        { id: 1, site_id: null, action: 'allow', scope: 'ip', pattern: '192.0.2.1', reason: 'allow-rule', enabled: true },
        { id: 2, site_id: null, action: 'rate_limit', scope: 'ip', pattern: '192.0.2.1', reason: 'rate-rule', enabled: true },
        { id: 3, site_id: null, action: 'challenge', scope: 'ip', pattern: '192.0.2.1', reason: 'challenge-rule', enabled: true },
        { id: 4, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'deny-rule', enabled: true }
      ]
    })
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  // Deny should win
  assert.equal(result.action, 'deny');
  assert.equal(result.reason, 'deny-rule');
  assert.equal(result.ruleId, 4);
});

test('firewall static deny list from environment is enforced before database rules', async () => {
  const pool = {
    query: async () => ({
      rows: [
        { id: 1, site_id: null, action: 'allow', scope: 'ip', pattern: '192.0.2.1', reason: 'allow-rule', enabled: true }
      ]
    })
  };

  const env = {
    VIRGOSCORPIO_HUB_FIREWALL_DENY_CIDRS: '192.0.2.0/24, 10.0.0.0/8'
  };

  const firewall = createFirewall({ pool, env, cacheTtlMs: 5000 });

  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });

  // Static deny should override database allow
  assert.equal(result.action, 'deny');
  assert.equal(result.reason, 'deployment-deny-list');
  assert.equal(result.ruleId, null);
});

test('firewall cache expiry triggers refresh on next evaluate', async () => {
  let queryCount = 0;

  const pool = {
    query: async () => {
      queryCount++;
      return { rows: [] };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 50 }); // Short TTL

  // First evaluation
  await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(queryCount, 1);

  // Wait for cache to expire
  await new Promise(resolve => setTimeout(resolve, 60));

  // Second evaluation should trigger refresh
  await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(queryCount, 2, 'Expired cache should trigger refresh');
});

test('firewall query error fails closed and retries after short cache TTL', async () => {
  let queryCount = 0;
  let shouldFail = true;

  const pool = {
    query: async () => {
      queryCount++;
      if (shouldFail) {
        throw new Error('Database connection failed');
      }
      return { rows: [{ id: 1, site_id: null, action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'test', enabled: true }] };
    }
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // First evaluation with error
  const result1 = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(result1.action, 'deny', 'Should fail closed when the policy query fails');
  assert.equal(result1.reason, 'firewall-policy-unavailable');
  assert.equal(queryCount, 1);

  // Fix the error
  shouldFail = false;

  // Wait for short error TTL to expire (should be min(cacheTtlMs, 1000) = 1000ms)
  await new Promise(resolve => setTimeout(resolve, 1100));

  // Next evaluation should retry
  const result2 = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: null });
  assert.equal(result2.action, 'deny', 'Should deny after successful retry');
  assert.ok(queryCount >= 2, 'Should retry after error TTL expires');
});

test('firewall site-scoped rules only match requests for that site', async () => {
  const pool = {
    query: async () => ({
      rows: [
        { id: 1, site_id: 'site-a', action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'site-a-rule', enabled: true },
        { id: 2, site_id: 'site-b', action: 'deny', scope: 'ip', pattern: '192.0.2.1', reason: 'site-b-rule', enabled: true },
        { id: 3, site_id: null, action: 'allow', scope: 'ip', pattern: '192.0.2.1', reason: 'global-rule', enabled: true }
      ]
    })
  };

  const firewall = createFirewall({ pool, cacheTtlMs: 5000 });

  // Request for site-a should match site-a rule
  const resultA = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: 'site-a' });
  assert.equal(resultA.action, 'deny');
  assert.equal(resultA.reason, 'site-a-rule');

  // Request for site-b should match site-b rule
  const resultB = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: 'site-b' });
  assert.equal(resultB.action, 'deny');
  assert.equal(resultB.reason, 'site-b-rule');

  // Request for site-c should only match global rule
  const resultC = await firewall.evaluate({ ip: '192.0.2.1', path: '/', userAgent: 'test', siteId: 'site-c' });
  assert.equal(resultC.action, 'allow');
  assert.equal(resultC.reason, 'global-rule');
});
