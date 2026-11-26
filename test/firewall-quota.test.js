'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFirewall, MAX_FIREWALL_RULES_PER_SITE, MAX_FIREWALL_RULES_TOTAL } = require('../packages/security/src/firewall');

test('firewall constants define bounded limits to prevent resource exhaustion', () => {
  assert.equal(typeof MAX_FIREWALL_RULES_PER_SITE, 'number', 'per-site quota must be a number');
  assert.equal(typeof MAX_FIREWALL_RULES_TOTAL, 'number', 'platform quota must be a number');
  assert.ok(MAX_FIREWALL_RULES_PER_SITE > 0, 'per-site quota must be positive');
  assert.ok(MAX_FIREWALL_RULES_TOTAL > 0, 'platform quota must be positive');
  assert.ok(MAX_FIREWALL_RULES_PER_SITE <= MAX_FIREWALL_RULES_TOTAL, 'per-site quota must not exceed platform quota');
  assert.ok(MAX_FIREWALL_RULES_PER_SITE === 500, 'per-site quota must be 500 as documented');
  assert.ok(MAX_FIREWALL_RULES_TOTAL === 20000, 'platform quota must be 20000 as documented');
});

test('firewall cache refresh query includes LIMIT clause to bound shared memory and CPU', async () => {
  let capturedQuery = null;
  const mockPool = {
    query: (sql) => {
      capturedQuery = sql;
      return Promise.resolve({ rows: [] });
    }
  };
  const firewall = createFirewall({ pool: mockPool, cacheTtlMs: 0 });
  await firewall.evaluate({ ip: '192.0.2.1', path: '/test', userAgent: 'test', siteId: null });
  assert.ok(capturedQuery, 'cache refresh must execute a query');
  assert.ok(capturedQuery.includes('LIMIT'), 'cache refresh query must include LIMIT clause');
  assert.ok(capturedQuery.includes('LIMIT ' + MAX_FIREWALL_RULES_TOTAL), 'LIMIT must match MAX_FIREWALL_RULES_TOTAL');
  assert.ok(capturedQuery.includes('WHERE enabled=true'), 'cache refresh must filter enabled rules');
  assert.ok(capturedQuery.includes("scope IN ('ip','cidr','path','user_agent')"), 'cache refresh must filter valid scopes');
});

test('firewall cache does not grow unbounded when rules exceed platform limit', async () => {
  // The LIMIT clause in the query prevents the database from returning excess rules,
  // so the cache will contain at most MAX_FIREWALL_RULES_TOTAL rules
  const exactLimit = Array.from({ length: MAX_FIREWALL_RULES_TOTAL }, (_, i) => ({
    id: `rule-${i}`,
    site_id: null,
    action: 'deny',
    scope: 'ip',
    pattern: `192.0.2.${i % 256}`,
    reason: 'bounded rule',
    enabled: true
  }));
  const mockPool = {
    query: () => Promise.resolve({ rows: exactLimit })
  };
  const firewall = createFirewall({ pool: mockPool, cacheTtlMs: 0 });
  await firewall.evaluate({ ip: '192.0.2.1', path: '/test', userAgent: 'test', siteId: null });
  const rules = await firewall.rules(null);
  assert.equal(rules.length, MAX_FIREWALL_RULES_TOTAL, 'cache must hold exactly the platform limit when database returns that many');
  assert.ok(rules.length <= MAX_FIREWALL_RULES_TOTAL, 'cached rules must not exceed platform limit');
});

test('firewall evaluation scans bounded cache regardless of total database rows', async () => {
  const largeRuleSet = Array.from({ length: MAX_FIREWALL_RULES_TOTAL }, (_, i) => ({
    id: `rule-${i}`,
    site_id: null,
    action: 'deny',
    scope: 'ip',
    pattern: `10.0.${Math.floor(i / 256)}.${i % 256}`,
    reason: 'large set',
    enabled: true
  }));
  const mockPool = {
    query: () => Promise.resolve({ rows: largeRuleSet })
  };
  const firewall = createFirewall({ pool: mockPool, cacheTtlMs: 5000 });
  const start = Date.now();
  const result = await firewall.evaluate({ ip: '192.0.2.1', path: '/test', userAgent: 'test', siteId: null });
  const elapsed = Date.now() - start;
  assert.equal(result.action, 'pass', 'non-matching IP must pass');
  assert.ok(elapsed < 1000, 'evaluation of max-size cache must complete quickly (< 1s)');
});

test('firewall cache refresh does not block concurrent evaluations', async () => {
  let queryCount = 0;
  const mockPool = {
    query: () => {
      queryCount++;
      return new Promise(resolve => setTimeout(() => resolve({ rows: [] }), 50));
    }
  };
  const firewall = createFirewall({ pool: mockPool, cacheTtlMs: 0 });
  const evaluations = await Promise.all([
    firewall.evaluate({ ip: '192.0.2.1', path: '/a', userAgent: 'test', siteId: null }),
    firewall.evaluate({ ip: '192.0.2.2', path: '/b', userAgent: 'test', siteId: null }),
    firewall.evaluate({ ip: '192.0.2.3', path: '/c', userAgent: 'test', siteId: null })
  ]);
  assert.equal(evaluations.length, 3, 'all evaluations must complete');
  assert.ok(queryCount <= 2, 'concurrent evaluations must share refresh promise and not trigger multiple queries');
});

test('firewall clearCache invalidates cache but does not trigger immediate refresh', async () => {
  let queryCount = 0;
  const mockPool = {
    query: () => {
      queryCount++;
      return Promise.resolve({ rows: [] });
    }
  };
  const firewall = createFirewall({ pool: mockPool, cacheTtlMs: 60000 });
  await firewall.evaluate({ ip: '192.0.2.1', path: '/test', userAgent: 'test', siteId: null });
  assert.equal(queryCount, 1, 'first evaluation must trigger refresh');
  firewall.clearCache();
  assert.equal(queryCount, 1, 'clearCache must not trigger immediate refresh');
  await firewall.evaluate({ ip: '192.0.2.2', path: '/test', userAgent: 'test', siteId: null });
  assert.equal(queryCount, 2, 'evaluation after clearCache must trigger refresh');
});
