'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { handlePlatformRoute } = require('../apps/api/src/platform-routes');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const CONNECTION_ID = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = 'request-f1-42-cloud-audit';
const collectionPath = '/api/v1/sites/' + SITE_ID + '/cloud/connections';
const itemPath = collectionPath + '/' + CONNECTION_ID;

function createHarness({
  connection = null,
  failAuditAction = null,
  failCommit = false,
  identityAvailable = true,
  env = { NODE_ENV: 'test' },
} = {}) {
  const calls = [];
  const auditEvents = [];
  let currentConnection = connection ? structuredClone(connection) : null;
  let snapshot = null;
  let transactionOpen = false;
  let nextClient = 0;

  async function execute(client, sql, values = []) {
    const statement = sql.trim().replace(/\s+/g, ' ');
    calls.push({ client, statement, values });
    if (statement === 'BEGIN') {
      snapshot = {
        connection: currentConnection ? structuredClone(currentConnection) : null,
        auditEvents: auditEvents.slice(),
      };
      transactionOpen = true;
      return { rows: [] };
    }
    if (statement === 'COMMIT') {
      if (failCommit) throw new Error('simulated commit failure');
      snapshot = null;
      transactionOpen = false;
      return { rows: [] };
    }
    if (statement === 'ROLLBACK') {
      if (snapshot) {
        currentConnection = snapshot.connection ? structuredClone(snapshot.connection) : null;
        auditEvents.splice(0, auditEvents.length, ...snapshot.auditEvents);
      }
      snapshot = null;
      transactionOpen = false;
      return { rows: [] };
    }
    if (statement.startsWith('INSERT INTO cloud_connections')) {
      const [siteId, provider, name, config, credentialReference] = values;
      currentConnection = {
        id: CONNECTION_ID,
        site_id: siteId,
        provider,
        name,
        config: JSON.parse(config),
        credential_reference: credentialReference,
        status: 'configured',
        last_health_check_at: null,
        created_at: new Date('2026-11-17T00:00:00.000Z'),
        updated_at: new Date('2026-11-17T00:00:00.000Z'),
      };
      return { rows: [structuredClone(currentConnection)], rowCount: 1 };
    }
    if (statement.startsWith('SELECT id,provider,config,credential_reference,status FROM cloud_connections')) {
      const [siteId, id] = values;
      if (currentConnection?.site_id === siteId && currentConnection.id === id) {
        return { rows: [structuredClone(currentConnection)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (statement.startsWith('UPDATE cloud_connections')) {
      const [siteId, id, requestedStatus] = values;
      if (currentConnection?.site_id !== siteId || currentConnection.id !== id) {
        return { rows: [], rowCount: 0 };
      }
      currentConnection.status = statement.includes("SET status='disabled'")
        ? 'disabled'
        : (currentConnection.status === 'disabled' ? 'disabled' : requestedStatus);
      currentConnection.last_health_check_at = new Date('2026-11-17T00:01:00.000Z');
      currentConnection.updated_at = new Date('2026-11-17T00:01:00.000Z');
      return {
        rows: [{
          id: currentConnection.id,
          provider: currentConnection.provider,
          status: currentConnection.status,
          last_health_check_at: currentConnection.last_health_check_at,
        }],
        rowCount: 1,
      };
    }
    if (statement.startsWith('INSERT INTO audit_events')) {
      const [siteId, actorId, action, targetType, targetId, result, requestId, details] = values;
      if (action === failAuditAction) throw new Error('simulated audit insert failure');
      auditEvents.push({
        site_id: siteId,
        actor_id: actorId,
        action,
        target_type: targetType,
        target_id: targetId,
        result,
        request_id: requestId,
        details: JSON.parse(details),
        client,
      });
      return { rows: [], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }

  const pool = {
    query: (sql, values) => execute('pool', sql, values),
    connect: async () => {
      const client = 'client-' + (++nextClient);
      return {
        query: (sql, values) => execute(client, sql, values),
        release: () => calls.push({ client, statement: 'RELEASE', values: [] }),
      };
    },
  };
  const identity = identityAvailable
    ? {
        audit: async (input, { queryable } = {}) => {
          assert.ok(queryable, 'cloud mutation must provide its transaction-owned queryable');
          await queryable.query(
            'INSERT INTO audit_events(site_id,actor_id,action,target_type,target_id,result,request_id,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',
            [input.siteId, input.actorId, input.action, input.targetType, input.targetId, input.result || 'success', input.requestId, JSON.stringify(input.details || {})],
          );
        },
      }
    : null;

  async function call(method, route, body = {}) {
    const res = { status: null, body: null };
    const url = new URL(route, 'http://localhost');
    await handlePlatformRoute({
      req: { method, headers: {} },
      res,
      url,
      actor: { user: { id: ACTOR_ID }, isDeveloper: false, memberships: [] },
      siteIdFor: async input => input.routeSiteId,
      requireCapability: async (_actor, _site, capability) => assert.equal(capability, 'cloud:manage'),
      readJson: async () => body,
      sendJson: (_res, status, payload) => {
        res.status = status;
        res.body = payload;
        calls.push({ client: 'response', statement: 'SEND ' + status, values: [] });
        return true;
      },
      fail: (statusCode, code, message, details) => Object.assign(new Error(message), { statusCode, code, details }),
      requestId: REQUEST_ID,
      localPool: pool,
      firewall: null,
      env,
      identity,
      maxBody: 32_000,
      maxLibraryBody: 32_000,
      maxOptimizerBytes: 32_000,
      libraryStore: null,
      store: null,
    });
    return res;
  }

  return {
    calls,
    auditEvents,
    call,
    get connection() { return currentConnection ? structuredClone(currentConnection) : null; },
    set connection(value) { currentConnection = value ? structuredClone(value) : null; },
    get transactionOpen() { return transactionOpen; },
  };
}

function createConnection(overrides = {}) {
  return {
    id: CONNECTION_ID,
    site_id: SITE_ID,
    provider: 's3-compatible',
    name: 'Primary object store',
    config: { bucket: 'do-not-audit-this-bucket', endpoint: 'https://storage.example.test' },
    credential_reference: 'env://AWS_ACCESS_KEY_ID',
    status: 'configured',
    last_health_check_at: null,
    created_at: new Date('2026-11-17T00:00:00.000Z'),
    updated_at: new Date('2026-11-17T00:00:00.000Z'),
    ...overrides,
  };
}

function createInput() {
  return {
    provider: 's3-compatible',
    name: 'New object store',
    credentialReference: 'env://AWS_ACCESS_KEY_ID',
    config: { bucket: 'must-not-appear-in-audit' },
  };
}

function eventCall(harness, action) {
  return harness.calls.find(call =>
    call.statement.startsWith('INSERT INTO audit_events') && call.values[2] === action);
}

async function startProbeServer(t, onProbe = () => {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push({ method: req.method });
    onProbe();
    res.writeHead(200, { 'x-amz-bucket-region': 'us-east-1' });
    res.end();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { endpoint: 'http://127.0.0.1:' + server.address().port, requests };
}

function probeEnvironment() {
  return {
    NODE_ENV: 'test',
    AWS_ACCESS_KEY_ID: 'f1-42-test-access-key',
    AWS_SECRET_ACCESS_KEY: 'f1-42-test-secret-key',
  };
}

function setAwsProbeTestCredentials(t) {
  const keys = {
    AWS_ACCESS_KEY_ID: 'f1-42-test-access-key',
    AWS_SECRET_ACCESS_KEY: 'f1-42-test-secret-key',
    AWS_EC2_METADATA_DISABLED: 'true',
  };
  const previous = Object.fromEntries(Object.keys(keys).map(key => [key, process.env[key]]));
  Object.assign(process.env, keys);
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

function probeConfig(endpoint) {
  return { bucket: 'probe-bucket', endpoint, region: 'us-east-1', forcePathStyle: true };
}

test('cloud connection creation commits its audit event on the same transaction client', async () => {
  const h = createHarness();
  const response = await h.call('POST', collectionPath, createInput());

  assert.equal(response.status, 201);
  assert.equal(h.connection.status, 'configured');
  assert.equal(h.auditEvents.length, 1);
  const insert = h.calls.find(call => call.statement.startsWith('INSERT INTO cloud_connections'));
  const audit = eventCall(h, 'cloud.connection_created');
  assert.ok(insert && audit);
  assert.equal(insert.client, audit.client);
  assert.deepEqual(h.auditEvents[0], {
    site_id: SITE_ID,
    actor_id: ACTOR_ID,
    action: 'cloud.connection_created',
    target_type: 'cloud-connection',
    target_id: CONNECTION_ID,
    result: 'success',
    request_id: REQUEST_ID,
    details: { provider: 's3-compatible', status: 'configured' },
    client: insert.client,
  });
  assert.ok(h.calls.findIndex(call => call.statement === 'COMMIT') > h.calls.indexOf(audit));
  assert.doesNotMatch(JSON.stringify(h.auditEvents[0].details), /must-not-appear|credential|bucket|endpoint/i);
});

test('cloud connection creation rolls back when its audit insert fails', async () => {
  const h = createHarness({ failAuditAction: 'cloud.connection_created' });
  await assert.rejects(
    h.call('POST', collectionPath, createInput()),
    /simulated audit insert failure/,
  );
  assert.equal(h.connection, null);
  assert.equal(h.auditEvents.length, 0);
  assert.ok(h.calls.some(call => call.statement === 'ROLLBACK'));
});

test('cloud connection creation rolls back when its transaction commit fails', async () => {
  const h = createHarness({ failCommit: true });
  await assert.rejects(
    h.call('POST', collectionPath, createInput()),
    /simulated commit failure/,
  );
  assert.equal(h.connection, null);
  assert.equal(h.auditEvents.length, 0);
  assert.ok(h.calls.some(call => call.statement === 'ROLLBACK'));
});

test('cloud connection disable commits its audit event on the same transaction client', async () => {
  const h = createHarness({ connection: createConnection() });
  const response = await h.call('POST', itemPath + '/disable', {});

  assert.equal(response.status, 200);
  assert.equal(response.body.connection.status, 'disabled');
  const update = h.calls.find(call => call.statement.startsWith('UPDATE cloud_connections'));
  const audit = eventCall(h, 'cloud.connection_disabled');
  assert.ok(update && audit);
  assert.equal(update.client, audit.client);
  assert.equal(h.connection.status, 'disabled');
  assert.deepEqual(h.auditEvents[0].details, { provider: 's3-compatible', status: 'disabled' });
});

test('cloud connection disable rolls back when its audit insert fails', async () => {
  const h = createHarness({ connection: createConnection(), failAuditAction: 'cloud.connection_disabled' });
  await assert.rejects(
    h.call('POST', itemPath + '/disable', {}),
    /simulated audit insert failure/,
  );
  assert.equal(h.connection.status, 'configured');
  assert.equal(h.auditEvents.length, 0);
  assert.ok(h.calls.some(call => call.statement === 'ROLLBACK'));
});

test('cloud connection health check probes before opening its persistence transaction', async t => {
  setAwsProbeTestCredentials(t);
  let h;
  const { endpoint, requests } = await startProbeServer(t, () => {
    assert.equal(h.transactionOpen, false, 'provider probe must not run inside a PostgreSQL transaction');
    h.calls.push({ client: 'provider', statement: 'PROBE', values: [] });
  });
  h = createHarness({
    connection: createConnection({ config: probeConfig(endpoint) }),
    env: probeEnvironment(),
  });

  const response = await h.call('POST', itemPath + '/test', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.test.status, 'healthy');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'HEAD');
  const audit = eventCall(h, 'cloud.connection_tested');
  assert.ok(audit);
  assert.ok(h.calls.findIndex(call => call.statement === 'BEGIN') > h.calls.findIndex(call => call.statement === 'PROBE'));
  assert.deepEqual(h.auditEvents[0].details, {
    provider: 's3-compatible',
    probeStatus: 'healthy',
    connectionStatus: 'healthy',
    credentialReferenceMode: 'environment',
    liveProbeAttempted: true,
    liveObjectStoreOperationPerformed: true,
  });
  assert.doesNotMatch(JSON.stringify(h.auditEvents[0].details), /probe-bucket|127\.0\.0\.1|f1-42-test|endpoint|secret/i);
});

test('cloud connection health check preserves a concurrent disable after a successful probe', async t => {
  setAwsProbeTestCredentials(t);
  let h;
  const { endpoint, requests } = await startProbeServer(t, () => {
    assert.equal(h.transactionOpen, false);
    h.connection = { ...h.connection, status: 'disabled' };
    h.calls.push({ client: 'provider', statement: 'PROBE', values: [] });
  });
  h = createHarness({
    connection: createConnection({ config: probeConfig(endpoint) }),
    env: probeEnvironment(),
  });

  const response = await h.call('POST', itemPath + '/test', {});
  assert.equal(response.status, 200);
  assert.equal(response.body.test.status, 'healthy');
  assert.equal(requests.length, 1);
  assert.equal(h.connection.status, 'disabled');
  assert.deepEqual(h.auditEvents[0].details, {
    provider: 's3-compatible',
    probeStatus: 'healthy',
    connectionStatus: 'disabled',
    credentialReferenceMode: 'environment',
    liveProbeAttempted: true,
    liveObjectStoreOperationPerformed: true,
  });
});

test('cloud connection health check rolls back status and timestamp when audit fails', async () => {
  const h = createHarness({
    connection: createConnection({ credential_reference: 'vault://unresolved/f1-42' }),
    failAuditAction: 'cloud.connection_tested',
  });
  await assert.rejects(
    h.call('POST', itemPath + '/test', {}),
    /simulated audit insert failure/,
  );
  assert.equal(h.connection.status, 'configured');
  assert.equal(h.connection.last_health_check_at, null);
  assert.equal(h.auditEvents.length, 0);
  assert.ok(h.calls.some(call => call.statement === 'ROLLBACK'));
});

test('cloud connection mutations fail closed when identity auditing is unavailable', async () => {
  const h = createHarness({ identityAvailable: false });
  await assert.rejects(
    h.call('POST', collectionPath, createInput()),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_AUDIT_UNAVAILABLE' && error.statusCode === 503,
  );
  assert.equal(h.connection, null);
  assert.equal(h.calls.some(call => call.statement.startsWith('INSERT INTO cloud_connections')), false);
});
