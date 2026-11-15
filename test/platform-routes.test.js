'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { handlePlatformRoute } = require('../apps/api/src/platform-routes');

const SITE_A = '11111111-1111-4111-8111-111111111111';
const SITE_B = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';
const RULE = '44444444-4444-4444-8444-444444444444';

function harness({ failEvent = null, deleteMissing = false, failCommit = false } = {}) {
  const calls = [], rules = new Map(), events = [];
  let snapshot = null, cacheClears = 0, nextClient = 0;
  async function query(client, sql, values = []) {
    const statement = sql.trim().replace(/\s+/g, ' ');
    calls.push({ client, statement });
    if (statement === 'BEGIN') { snapshot = { rules: new Map(rules), events: events.slice() }; return { rows: [] }; }
    if (statement === 'COMMIT') { if (failCommit) throw new Error('simulated commit failure'); snapshot = null; return { rows: [] }; }
    if (statement === 'ROLLBACK') {
      if (snapshot) { rules.clear(); for (const [id, row] of snapshot.rules) rules.set(id, row); events.splice(0, events.length, ...snapshot.events); snapshot = null; }
      return { rows: [] };
    }
    if (statement.startsWith('INSERT INTO firewall_rules')) {
      const row = { id: RULE, site_id: values[0], action: values[1], scope: values[2], pattern: values[3], reason: values[4], enabled: values[5], created_by: values[6] };
      rules.set(RULE, row); return { rows: [row], rowCount: 1 };
    }
    if (statement.startsWith('DELETE FROM firewall_rules')) {
      const [siteId, id] = values, row = rules.get(id);
      if (!deleteMissing && row?.site_id === siteId) { rules.delete(id); return { rows: [{ id, action: row.action, scope: row.scope }], rowCount: 1 }; }
      return { rows: [], rowCount: 0 };
    }
    if (statement.startsWith('INSERT INTO site_security_events')) {
      const [siteId, requestId, eventType, severity, actorId, details] = values;
      if (eventType === failEvent) throw new Error('simulated event insert failure');
      events.push({ siteId, requestId, eventType, severity, actorId, details: JSON.parse(details), client });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  const pool = {
    connect: async () => { const client = 'client-' + (++nextClient); return { query: (sql, values) => query(client, sql, values), release: () => calls.push({ client, statement: 'RELEASE' }) }; },
    query: (sql, values) => query('pool', sql, values)
  };
  async function call(method, siteId, body = {}) {
    const res = { status: null, body: null };
    const rulePath = '/api/v1/sites/' + siteId + '/security/firewall-rules';
    const url = new URL(method === 'DELETE' ? rulePath + '/' + RULE : rulePath, 'http://localhost');
    await handlePlatformRoute({
      req: { method, headers: {} }, res, url,
      actor: { user: { id: ACTOR }, isDeveloper: false, memberships: [] },
      siteIdFor: async input => input.routeSiteId,
      requireCapability: async (_actor, _site, capability) => assert.equal(capability, 'security:manage'),
      readJson: async () => body,
      sendJson: (_res, status, payload) => { res.status = status; res.body = payload; calls.push({ client: 'response', statement: 'SEND ' + status }); return true; },
      fail: (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code }),
      requestId: 'request-f1-36', localPool: pool,
      firewall: { clearCache() { cacheClears++; calls.push({ client: 'cache', statement: 'CLEAR_CACHE' }); } },
      env: {}, identity: null, maxBody: 32_000, maxLibraryBody: 32_000, maxOptimizerBytes: 32_000,
      libraryStore: null, store: null
    });
    return res;
  }
  return { calls, rules, events, call, get cacheClears() { return cacheClears; } };
}

test('firewall create writes rule and event on one transaction client before cache invalidation', async () => {
  const h = harness();
  const response = await h.call('POST', SITE_A, { action: 'deny', scope: 'ip', pattern: '192.0.2.5', reason: 'fixture' });
  assert.equal(response.status, 201);
  const rule = h.calls.find(x => x.statement.startsWith('INSERT INTO firewall_rules'));
  const event = h.calls.find(x => x.statement.startsWith('INSERT INTO site_security_events'));
  assert.equal(rule.client, event.client);
  assert.equal(h.events[0].eventType, 'firewall.rule_created');
  assert.equal(h.events[0].details.action, 'deny');
  assert.equal(h.events[0].details.scope, 'ip');
  assert.equal(h.events[0].details.reason, undefined);
  assert.ok(h.calls.findIndex(x => x.statement === 'BEGIN') < h.calls.indexOf(rule));
  assert.ok(h.calls.findIndex(x => x.statement === 'COMMIT') > h.calls.indexOf(event));
  assert.ok(h.calls.findIndex(x => x.statement === 'CLEAR_CACHE') > h.calls.findIndex(x => x.statement === 'COMMIT'));
  assert.equal(h.cacheClears, 1);
});

test('firewall create rolls back rule and leaves cache untouched on event failure', async () => {
  const h = harness({ failEvent: 'firewall.rule_created' });
  await assert.rejects(h.call('POST', SITE_A, { action: 'deny', scope: 'ip', pattern: '192.0.2.5', reason: 'fixture' }), /simulated event insert failure/);
  assert.equal(h.rules.size, 0);
  assert.equal(h.events.length, 0);
  assert.equal(h.cacheClears, 0);
  assert.ok(h.calls.some(x => x.statement === 'ROLLBACK'));
});

test('firewall create rolls back and leaves cache untouched when COMMIT fails', async () => {
  const h = harness({ failCommit: true });
  await assert.rejects(h.call('POST', SITE_A, { action: 'deny', scope: 'ip', pattern: '192.0.2.5', reason: 'fixture' }), /simulated commit failure/);
  assert.equal(h.rules.size, 0);
  assert.equal(h.events.length, 0);
  assert.equal(h.cacheClears, 0);
  assert.ok(h.calls.some(x => x.statement === 'ROLLBACK'));
});
test('firewall delete writes its event transactionally before invalidating cache', async () => {
  const h = harness(); h.rules.set(RULE, { id: RULE, site_id: SITE_A, action: 'deny', scope: 'ip' });
  const response = await h.call('DELETE', SITE_A);
  assert.equal(response.status, 200);
  assert.equal(h.rules.has(RULE), false);
  assert.equal(h.events[0].eventType, 'firewall.rule_deleted');
  assert.equal(h.events[0].details.action, 'deny');
  assert.equal(h.events[0].details.scope, 'ip');
  const del = h.calls.find(x => x.statement.startsWith('DELETE FROM firewall_rules'));
  const event = h.calls.find(x => x.statement.startsWith('INSERT INTO site_security_events'));
  assert.equal(del.client, event.client);
  assert.ok(h.calls.findIndex(x => x.statement === 'CLEAR_CACHE') > h.calls.findIndex(x => x.statement === 'COMMIT'));
  assert.equal(h.cacheClears, 1);
});

test('firewall delete rolls back and leaves cache untouched on event failure', async () => {
  const h = harness({ failEvent: 'firewall.rule_deleted' }); h.rules.set(RULE, { id: RULE, site_id: SITE_A });
  await assert.rejects(h.call('DELETE', SITE_A), /simulated event insert failure/);
  assert.equal(h.rules.has(RULE), true);
  assert.equal(h.events.length, 0);
  assert.equal(h.cacheClears, 0);
  assert.ok(h.calls.some(x => x.statement === 'ROLLBACK'));
});

test('firewall delete rolls back and leaves cache untouched when COMMIT fails', async () => {
  const h = harness({ failCommit: true });
  h.rules.set(RULE, { id: RULE, site_id: SITE_A, action: 'deny', scope: 'ip' });
  await assert.rejects(h.call('DELETE', SITE_A), /simulated commit failure/);
  assert.equal(h.rules.has(RULE), true);
  assert.equal(h.events.length, 0);
  assert.equal(h.cacheClears, 0);
  assert.ok(h.calls.some(x => x.statement === 'ROLLBACK'));
});
test('not-found and cross-site firewall deletions do not write events or invalidate cache', async () => {
  const missing = harness({ deleteMissing: true });
  await assert.rejects(missing.call('DELETE', SITE_A), e => e.statusCode === 404 && e.code === 'ERR_VIRGOSCORPIO_HUB_FIREWALL_RULE_NOT_FOUND');
  assert.equal(missing.events.length, 0); assert.equal(missing.cacheClears, 0);
  const foreign = harness(); foreign.rules.set(RULE, { id: RULE, site_id: SITE_A });
  await assert.rejects(foreign.call('DELETE', SITE_B), e => e.statusCode === 404 && e.code === 'ERR_VIRGOSCORPIO_HUB_FIREWALL_RULE_NOT_FOUND');
  assert.equal(foreign.rules.get(RULE).site_id, SITE_A);
  assert.equal(foreign.events.length, 0); assert.equal(foreign.cacheClears, 0);
});
