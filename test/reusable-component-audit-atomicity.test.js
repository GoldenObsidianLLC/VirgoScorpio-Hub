'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createApiServer } = require('../apps/api/src/server');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'reusable-component-session-token';
const DOCUMENT = Object.freeze({
  schemaVersion: 1,
  documentId: 'reusable-component-test',
  type: 'page',
  title: 'Reusable component test',
  children: [{
    id: 'component-section',
    type: 'section',
    props: { className: 'vsh-component' },
    children: [
      { id: 'component-heading', type: 'widget.heading', props: { text: 'Component heading', level: 1 }, children: [] }
    ]
  }]
});

function copy(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createPool({ failAudit = false } = {}) {
  const rows = new Map();
  const audits = [];
  const events = [];
  let transactionSnapshot = null;
  const client = {
    async query(sql, values = []) {
      const statement = String(sql).trim();
      events.push({ type: 'query', statement, values: copy(values) });
      if (statement === 'BEGIN') {
        assert.equal(transactionSnapshot, null, 'transactions must not be nested');
        transactionSnapshot = { rows: new Map([...rows].map(([id, row]) => [id, copy(row)])), audits: audits.slice() };
        return { rowCount: 0, rows: [] };
      }
      if (statement === 'COMMIT') {
        transactionSnapshot = null;
        return { rowCount: 0, rows: [] };
      }
      if (statement === 'ROLLBACK') {
        if (transactionSnapshot) {
          rows.clear();
          for (const [id, row] of transactionSnapshot.rows) rows.set(id, row);
          audits.splice(0, audits.length, ...transactionSnapshot.audits);
        }
        transactionSnapshot = null;
        return { rowCount: 0, rows: [] };
      }
      if (statement.startsWith('INSERT INTO reusable_components')) {
        const [siteId, slug, name, documentJson, actorId] = values;
        const row = {
          id: randomUUID(),
          site_id: siteId,
          slug,
          name,
          version: 1,
          document: JSON.parse(documentJson),
          created_by: actorId,
          updated_by: actorId,
          created_at: new Date(0).toISOString(),
          updated_at: new Date(0).toISOString()
        };
        rows.set(row.id, row);
        return { rowCount: 1, rows: [copy(row)] };
      }
      if (statement.startsWith('UPDATE reusable_components')) {
        const [siteId, id, slug, name, documentJson, actorId, expectedVersion] = values;
        const current = rows.get(id);
        if (!current || current.site_id !== siteId || current.version !== expectedVersion) return { rowCount: 0, rows: [] };
        const updated = {
          ...current,
          slug,
          name,
          document: JSON.parse(documentJson),
          version: current.version + 1,
          updated_by: actorId,
          updated_at: new Date(1).toISOString()
        };
        rows.set(id, updated);
        return { rowCount: 1, rows: [copy(updated)] };
      }
      if (statement.startsWith('DELETE FROM reusable_components')) {
        const [siteId, id] = values;
        const current = rows.get(id);
        if (!current || current.site_id !== siteId) return { rowCount: 0, rows: [] };
        rows.delete(id);
        return { rowCount: 1, rows: [{ id: current.id, slug: current.slug, version: current.version }] };
      }
      if (statement.startsWith('INSERT INTO audit_events')) {
        if (failAudit) {
          const error = new Error('simulated reusable-component audit persistence failure');
          error.code = '23505';
          throw error;
        }
        audits.push({
          site_id: values[0],
          actor_id: values[1],
          action: values[2],
          target_type: values[3],
          target_id: values[4],
          result: values[5],
          request_id: values[6],
          details: JSON.parse(values[7])
        });
        return { rowCount: 1, rows: [] };
      }
      throw new Error('Unexpected transaction query: ' + statement);
    },
    release() {
      events.push({ type: 'release' });
    }
  };
  const pool = {
    rows,
    audits,
    events,
    client,
    async connect() {
      events.push({ type: 'connect' });
      return client;
    },
    async query(sql, values = []) {
      const statement = String(sql).trim();
      events.push({ type: 'pool-query', statement, values: copy(values) });
      if (statement.includes('FROM firewall_rules')) return { rowCount: 0, rows: [] };
      if (statement.startsWith('SELECT id,slug,name,version,document,created_at,updated_at FROM reusable_components')) {
        const [siteId] = values;
        return {
          rowCount: [...rows.values()].filter(row => row.site_id === siteId).length,
          rows: [...rows.values()]
            .filter(row => row.site_id === siteId)
            .sort((left, right) => left.name.localeCompare(right.name))
            .map(copy)
        };
      }
      throw new Error('Unexpected pool query: ' + statement);
    },
    async end() {}
  };
  return pool;
}

function createHarness({ failAudit = false } = {}) {
  const pool = createPool({ failAudit });
  const auditCalls = [];
  const identityService = {
    async authenticate(token) {
      if (token !== TOKEN) return null;
      return {
        sessionId: 'reusable-component-session',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: { id: ACTOR_ID, email: 'component-actor@example.test', displayName: 'Component Actor', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'component-site', siteName: 'Component Site', role: 'administrator', roles: ['administrator'], capabilities: ['content:read', 'content:edit'] }]
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && ['content:read', 'content:edit'].includes(capability);
    },
    async audit(event, { queryable } = {}) {
      auditCalls.push({ event: copy(event), queryable });
      await queryable.query(
        'INSERT INTO audit_events(site_id,actor_id,action,target_type,target_id,result,request_id,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',
        [event.siteId, event.actorId, event.action, event.targetType, event.targetId || null, 'success', event.requestId || null, JSON.stringify(event.details || {})]
      );
    }
  };
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100',
      VIRGOSCORPIO_HUB_DEFAULT_SITE_ID: SITE_ID
    },
    pool,
    identityService,
    logger: { error() {} }
  });
  return { pool, auditCalls, server };
}

async function startHarness(t, options) {
  const harness = createHarness(options);
  await new Promise((resolve, reject) => {
    harness.server.once('error', reject);
    harness.server.listen(0, '127.0.0.1', resolve);
  });
  const base = `http://127.0.0.1:${harness.server.address().port}`;
  const headers = {
    authorization: 'Bearer ' + TOKEN,
    'x-virgoscorpio-hub-site-id': SITE_ID,
    'content-type': 'application/json'
  };
  t.after(async () => {
    if (harness.server.listening) await new Promise(resolve => harness.server.close(resolve));
    await harness.server.virgoScorpioHub.close().catch(() => {});
  });
  return { ...harness, base, headers };
}

function componentBody(overrides = {}) {
  return {
    slug: 'component-example',
    name: 'Component Example',
    document: copy(DOCUMENT),
    ...overrides
  };
}

async function send(base, headers, method, url, body, requestId) {
  return fetch(base + url, {
    method,
    headers: { ...headers, 'x-request-id': requestId, ...(body === undefined ? {} : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

test('reusable component create, update and delete audit through the owning transaction queryable before COMMIT', async t => {
  const { pool, auditCalls, server, base, headers } = await startHarness(t);
  const collection = '/api/v1/sites/' + SITE_ID + '/reusable-components';

  const createdResponse = await send(base, headers, 'POST', collection, componentBody(), 'component-create-atomic-01');
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()).component;
  assert.equal(created.version, 1);

  const updatedResponse = await send(base, headers, 'PUT', collection + '/' + created.id, componentBody({
    slug: 'component-example-updated',
    name: 'Component Example Updated',
    expectedVersion: 1
  }), 'component-update-atomic-01');
  assert.equal(updatedResponse.status, 200);
  const updated = (await updatedResponse.json()).component;
  assert.equal(updated.version, 2);

  const deletedResponse = await send(base, headers, 'DELETE', collection + '/' + created.id, undefined, 'component-delete-atomic-01');
  assert.equal(deletedResponse.status, 200);
  assert.deepEqual(await deletedResponse.json(), { deleted: true, requestId: 'component-delete-atomic-01' });

  assert.deepEqual(auditCalls.map(call => ({
    action: call.event.action,
    targetType: call.event.targetType,
    targetId: call.event.targetId,
    requestId: call.event.requestId,
    details: call.event.details,
    queryable: call.queryable
  })), [
    {
      action: 'reusable_component.created',
      targetType: 'reusable-component',
      targetId: created.id,
      requestId: 'component-create-atomic-01',
      details: { slug: 'component-example', version: 1 },
      queryable: pool.client
    },
    {
      action: 'reusable_component.updated',
      targetType: 'reusable-component',
      targetId: created.id,
      requestId: 'component-update-atomic-01',
      details: { slug: 'component-example-updated', version: 2 },
      queryable: pool.client
    },
    {
      action: 'reusable_component.deleted',
      targetType: 'reusable-component',
      targetId: created.id,
      requestId: 'component-delete-atomic-01',
      details: { slug: 'component-example-updated', version: 2 },
      queryable: pool.client
    }
  ]);

  for (const action of ['reusable_component.created', 'reusable_component.updated', 'reusable_component.deleted']) {
    const mutationIndex = pool.events.findIndex(event => event.type === 'query' &&
      ((action.endsWith('.created') && event.statement.startsWith('INSERT INTO reusable_components')) ||
       (action.endsWith('.updated') && event.statement.startsWith('UPDATE reusable_components')) ||
       (action.endsWith('.deleted') && event.statement.startsWith('DELETE FROM reusable_components'))));
    const auditIndex = pool.events.findIndex((event, index) => index > mutationIndex &&
      event.type === 'query' && event.statement.startsWith('INSERT INTO audit_events'));
    const commitIndex = pool.events.findIndex((event, index) => index > auditIndex &&
      event.type === 'query' && event.statement === 'COMMIT');
    assert.ok(mutationIndex >= 0, action + ' mutation must run in the transaction');
    assert.ok(auditIndex > mutationIndex, action + ' audit must follow the mutation');
    assert.ok(commitIndex > auditIndex, action + ' audit must complete before COMMIT');
  }
  assert.equal(pool.rows.size, 0, 'the successful delete leaves no component row');
});

test('reusable component create, update and delete roll back when audit persistence fails without remapping the database error', async t => {
  const { pool, auditCalls, server, base, headers } = await startHarness(t, { failAudit: true });
  const collection = '/api/v1/sites/' + SITE_ID + '/reusable-components';
  const seededId = '44444444-4444-4444-8444-444444444444';
  pool.rows.set(seededId, {
    id: seededId,
    site_id: SITE_ID,
    slug: 'component-seeded',
    name: 'Component Seeded',
    version: 1,
    document: copy(DOCUMENT),
    created_by: ACTOR_ID,
    updated_by: ACTOR_ID,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString()
  });
  const baseline = copy(pool.rows.get(seededId));

  const failedCreate = await send(base, headers, 'POST', collection, componentBody({
    slug: 'component-failed-create',
    name: 'Component Failed Create'
  }), 'component-failed-create-01');
  assert.equal(failedCreate.status, 500);
  assert.equal((await failedCreate.json()).code, '23505');
  assert.equal([...pool.rows.values()].some(row => row.slug === 'component-failed-create'), false);

  const failedUpdate = await send(base, headers, 'PUT', collection + '/' + seededId, componentBody({
    slug: 'component-failed-update',
    name: 'Component Failed Update',
    expectedVersion: 1
  }), 'component-failed-update-01');
  assert.equal(failedUpdate.status, 500);
  assert.equal((await failedUpdate.json()).code, '23505');
  assert.deepEqual(pool.rows.get(seededId), baseline);

  const failedDelete = await send(base, headers, 'DELETE', collection + '/' + seededId, undefined, 'component-failed-delete-01');
  assert.equal(failedDelete.status, 500);
  assert.equal((await failedDelete.json()).code, '23505');
  assert.deepEqual(pool.rows.get(seededId), baseline);

  assert.equal(pool.audits.length, 0, 'failed audit insertions must not leave records');
  assert.equal(auditCalls.length, 3, 'each attempted mutation must invoke audit on the transaction client');
  assert.ok(pool.events.filter(event => event.type === 'query' && event.statement === 'ROLLBACK').length === 3);
  assert.equal(pool.events.filter(event => event.type === 'query' && event.statement === 'COMMIT').length, 0);
});
