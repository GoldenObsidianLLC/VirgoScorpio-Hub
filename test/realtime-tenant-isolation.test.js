'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createApiServer } = require('../apps/api/src/server');

const SITE_A = '11111111-1111-4111-8111-111111111111';
const SITE_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TOKEN = 'site-a-only-session-token';

function connectWebSocket(url, origin, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {
      headers: {
        authorization: 'Bearer ' + TOKEN,
        origin,
        ...extraHeaders
      }
    });
    socket._messages = [];
    socket._waiters = [];
    socket.on('message', data => {
      const waiter = socket._waiters.shift();
      if (waiter) waiter(data);
      else socket._messages.push(data);
    });
    let settled = false;

    socket.once('open', () => {
      settled = true;
      resolve(socket);
    });
    socket.once('unexpected-response', (_request, response) => {
      const error = new Error('WebSocket upgrade rejected with ' + response.statusCode);
      error.statusCode = response.statusCode;
      response.resume();
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    socket.once('error', error => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function nextWebSocketMessage(socket, timeoutMs = 1_000) {
  if (socket._messages.length) {
    return Promise.resolve(JSON.parse(socket._messages.shift().toString()));
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = socket._waiters.indexOf(onMessage);
      if (index >= 0) socket._waiters.splice(index, 1);
      reject(new Error('Timed out waiting for WebSocket readiness.'));
    }, timeoutMs);
    function onMessage(data) {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    }
    socket._waiters.push(onMessage);
  });
}

test('site-A membership cannot cross into site-B presence, SSE, or WebSocket', async t => {
  const authorizationCalls = [];
  const identityService = {
    async authenticate(token) {
      if (token !== TOKEN) return null;
      return {
        sessionId: SESSION_A,
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: USER_A,
          email: 'site-a-user@example.test',
          displayName: 'Site A User',
          status: 'active'
        },
        memberships: [{ siteId: SITE_A, capabilities: ['content:read'] }]
      };
    },
    async authorizeSite(userId, siteId, capability) {
      authorizationCalls.push({ userId, siteId, capability });
      return userId === USER_A && siteId === SITE_A && capability === 'content:read';
    },
    async isSessionActive({ userId, sessionId }) {
      return userId === USER_A && sessionId === SESSION_A;
    }
  };

  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      VIRGOSCORPIO_HUB_REALTIME_ENABLED: 'true',
      VIRGOSCORPIO_HUB_DEFAULT_SITE_ID: SITE_A,
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100'
    },
    identityService,
    logger: { error() {} }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const headers = { authorization: 'Bearer ' + TOKEN };
  const sitePath = siteId => '/api/v1/sites/' + siteId;
  let siteASocket = null;
  const sseController = new AbortController();

  t.after(async () => {
    sseController.abort();
    if (siteASocket && siteASocket.readyState !== WebSocket.CLOSED) {
      await new Promise(resolve => {
        siteASocket.once('close', resolve);
        siteASocket.close();
      });
    }
    await server.virgoScorpioHub.close();
    await new Promise(resolve => server.close(resolve));
  });

  const heartbeatA = await fetch(origin + sitePath(SITE_A) + '/presence/heartbeat', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ availability: 'active' })
  });
  assert.equal(heartbeatA.status, 200);
  assert.equal((await heartbeatA.json()).presence.availability, 'active');

  const presenceA = await fetch(origin + sitePath(SITE_A) + '/presence', { headers });
  assert.equal(presenceA.status, 200);
  assert.deepEqual(
    (await presenceA.json()).presence.map(entry => [entry.userId, entry.availability]),
    [[USER_A, 'active']]
  );

  const presenceMismatchHeader = await fetch(origin + sitePath(SITE_A) + '/presence', {
    headers: { ...headers, 'x-virgoscorpio-hub-site-id': SITE_B }
  });
  assert.equal(presenceMismatchHeader.status, 400);
  assert.equal((await presenceMismatchHeader.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');

  const presenceMismatchQuery = await fetch(origin + sitePath(SITE_A) + '/presence?siteId=' + SITE_B, { headers });
  assert.equal(presenceMismatchQuery.status, 400);
  assert.equal((await presenceMismatchQuery.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');

  const heartbeatMismatchBody = await fetch(origin + sitePath(SITE_A) + '/presence/heartbeat', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ siteId: SITE_B, availability: 'active' })
  });
  assert.equal(heartbeatMismatchBody.status, 400);
  assert.equal((await heartbeatMismatchBody.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');

  const presenceAfterMismatch = await fetch(origin + sitePath(SITE_A) + '/presence', { headers });
  assert.equal(presenceAfterMismatch.status, 200);
  assert.deepEqual((await presenceAfterMismatch.json()).presence.map(entry => [entry.userId, entry.availability]), [[USER_A, 'active']]);

  const heartbeatB = await fetch(origin + sitePath(SITE_B) + '/presence/heartbeat', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ availability: 'active' })
  });
  assert.equal(heartbeatB.status, 403);
  assert.equal((await heartbeatB.json()).code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');

  const presenceB = await fetch(origin + sitePath(SITE_B) + '/presence', { headers });
  assert.equal(presenceB.status, 403);
  assert.equal((await presenceB.json()).code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');

  const sseA = await fetch(origin + sitePath(SITE_A) + '/realtime/events?topic=presence', {
    headers,
    signal: sseController.signal
  });
  assert.equal(sseA.status, 200);
  assert.match(sseA.headers.get('content-type'), /text\/event-stream/);

  const sseMismatch = await fetch(origin + sitePath(SITE_A) + '/realtime/events?topic=presence', {
    headers: { ...headers, 'x-virgoscorpio-hub-site-id': SITE_B }
  });
  assert.equal(sseMismatch.status, 400);
  assert.equal((await sseMismatch.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
  assert.doesNotMatch(sseMismatch.headers.get('content-type') || '', /text\/event-stream/);

  const sseQueryMismatch = await fetch(origin + sitePath(SITE_A) + '/realtime/events?topic=presence&siteId=' + SITE_B, { headers });
  assert.equal(sseQueryMismatch.status, 400);
  assert.equal((await sseQueryMismatch.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
  const sseReader = sseA.body.getReader();
  const readyFrame = await sseReader.read();
  assert.match(new TextDecoder().decode(readyFrame.value), /connection\.ready/);
  sseController.abort();
  await sseReader.cancel().catch(() => {});

  const sseB = await fetch(origin + sitePath(SITE_B) + '/realtime/events?topic=presence', { headers });
  assert.equal(sseB.status, 403);
  assert.equal((await sseB.json()).code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
  assert.doesNotMatch(sseB.headers.get('content-type') || '', /text\/event-stream/);

  const wsPath = siteId => origin.replace(/^http/, 'ws') + sitePath(siteId) + '/realtime/ws';
  siteASocket = await connectWebSocket(wsPath(SITE_A), origin);
  assert.equal((await nextWebSocketMessage(siteASocket)).type, 'connection.ready');

  const subscriptionsBeforeDeniedUpgrade = server.virgoScorpioHub.realtimeHub.subscriberCount;
  await assert.rejects(
    connectWebSocket(wsPath(SITE_B), origin),
    error => error.statusCode === 403
  );

  await assert.rejects(
    connectWebSocket(wsPath(SITE_A), origin, { 'x-virgoscorpio-hub-site-id': SITE_B }),
    error => error.statusCode === 400
  );
  await assert.rejects(
    connectWebSocket(wsPath(SITE_A) + '?siteId=' + SITE_B, origin),
    error => error.statusCode === 400
  );
  assert.equal(server.virgoScorpioHub.realtimeHub.subscriberCount, subscriptionsBeforeDeniedUpgrade, 'selector-mismatched upgrades must not create subscriptions');
  assert.equal(
    server.virgoScorpioHub.realtimeHub.subscriberCount,
    subscriptionsBeforeDeniedUpgrade,
    'the denied Site B upgrade must not create a subscription'
  );

  assert.ok(authorizationCalls.some(call => call.siteId === SITE_A && call.capability === 'content:read'));
  assert.ok(authorizationCalls.some(call => call.siteId === SITE_B && call.capability === 'content:read'));
  assert.ok(authorizationCalls.every(call => call.userId === USER_A));
});

test('collaboration REST and WebSocket paths remain site-bound and recheck live edit authorization', async t => {
  const pageAId = '33333333-3333-4333-8333-333333333333';
  const pageBId = '44444444-4444-4444-8444-444444444444';
  const editorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const sessionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const token = 'site-a-collaboration-editor-token';
  const operationId = '55555555-5555-4555-8555-555555555555';
  let editGranted = true;
  const storeReads = [];
  const storeWrites = [];
  const syncReads = [];
  const documents = new Map([
    [SITE_A + ':' + pageAId, {
      id: pageAId,
      site_id: SITE_A,
      content_type: 'page',
      status: 'draft',
      created_by: editorId
    }],
    [SITE_B + ':' + pageBId, {
      id: pageBId,
      site_id: SITE_B,
      content_type: 'page',
      status: 'draft',
      created_by: editorId
    }]
  ]);
  const identityService = {
    async authenticate(candidate) {
      if (candidate !== token) return null;
      return {
        sessionId,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: editorId,
          email: 'site-a-editor@example.test',
          displayName: 'Site A Editor',
          status: 'active'
        },
        memberships: [{
          siteId: SITE_A,
          capabilities: ['content:read', 'content:edit']
        }]
      };
    },
    async isSessionActive(input) {
      return input.userId === editorId && input.sessionId === sessionId;
    },
    async authorizeSite(userId, siteId, capability) {
      if (userId !== editorId || siteId !== SITE_A) return false;
      if (capability === 'content:read') return true;
      if (capability === 'content:edit') return editGranted;
      return false;
    }
  };
  const store = {
    async getById(input) {
      storeReads.push(input);
      return documents.get(input.siteId + ':' + input.id) || null;
    },
    async getCollaborationSync(input) {
      syncReads.push(input);
      return {
        reloadRequired: false,
        sequence: 0,
        oldestReplaySequence: 0,
        operations: []
      };
    },
    async applyCollaborationOperation(input) {
      storeWrites.push(input);
      return {
        sequence: storeWrites.length,
        version: storeWrites.length + 1,
        lockVersion: storeWrites.length + 1,
        operation: input.operation,
        duplicate: false
      };
    }
  };
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      VIRGOSCORPIO_HUB_DEFAULT_SITE_ID: SITE_A,
      VIRGOSCORPIO_HUB_REALTIME_ENABLED: 'true',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100'
    },
    identityService,
    contentStore: store,
    logger: { error() {} }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const authHeaders = { authorization: 'Bearer ' + token };
  const wsPath = siteId => origin.replace(/^http/, 'ws') + '/api/v1/sites/' + siteId + '/realtime/ws';
  let siteASocket = null;

  t.after(async () => {
    if (siteASocket && siteASocket.readyState !== WebSocket.CLOSED) {
      await new Promise(resolve => {
        siteASocket.once('close', resolve);
        siteASocket.close();
      });
    }
    await server.virgoScorpioHub.close();
    await new Promise(resolve => server.close(resolve));
  });

  const siteASync = await fetch(
    origin + '/api/v1/pages/' + pageAId + '/collaboration/sync?siteId=' + SITE_A + '&afterSequence=0',
    { headers: authHeaders }
  );
  assert.equal(siteASync.status, 200);
  assert.equal((await siteASync.json()).sequence, 0);

  const operation = {
    schemaVersion: 1,
    opId: operationId,
    clientId: 'site-a-browser',
    baseSequence: 0,
    type: 'document.set_title',
    payload: { title: 'Authorized Site A edit' }
  };
  const siteAWrite = await fetch(
    origin + '/api/v1/pages/' + pageAId + '/collaboration/operations?siteId=' + SITE_A,
    {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ operation })
    }
  );
  assert.equal(siteAWrite.status, 200);
  assert.equal((await siteAWrite.json()).sequence, 1);
  assert.equal(storeWrites.length, 1);
  assert.equal(storeWrites[0].siteId, SITE_A);
  assert.equal(storeWrites[0].actorId, editorId);

  const siteBRead = await fetch(
    origin + '/api/v1/pages/' + pageBId + '/collaboration/sync?siteId=' + SITE_B + '&afterSequence=0',
    { headers: authHeaders }
  );
  assert.equal(siteBRead.status, 403);
  assert.equal((await siteBRead.json()).code, 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN');

  const siteBWrite = await fetch(
    origin + '/api/v1/pages/' + pageBId + '/collaboration/operations?siteId=' + SITE_B,
    {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: { ...operation, opId: '66666666-6666-4666-8666-666666666666' }
      })
    }
  );
  assert.equal(siteBWrite.status, 403);
  assert.equal((await siteBWrite.json()).code, 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN');
  assert.equal(storeWrites.length, 1, 'cross-site REST writes must never reach collaboration persistence');
  assert.equal(storeReads.some(call => call.siteId === SITE_B), false, 'site membership is checked before a cross-site content lookup');

  siteASocket = await connectWebSocket(wsPath(SITE_A), origin, { authorization: 'Bearer ' + token });
  assert.equal((await nextWebSocketMessage(siteASocket)).type, 'connection.ready');
  siteASocket.send(JSON.stringify({
    type: 'document.join',
    contentId: pageAId,
    afterSequence: 0
  }));
  const joined = await nextWebSocketMessage(siteASocket);
  assert.equal(joined.type, 'document.joined');
  assert.equal(joined.contentId, pageAId);
  assert.equal(syncReads.length, 2, 'authorized REST and WebSocket joins both use canonical sync');

  const subscribersAfterAllowedJoin = server.virgoScorpioHub.realtimeHub.subscriberCount;
  assert.equal(subscribersAfterAllowedJoin, 2, 'the socket has one presence and one document subscription');
  siteASocket.send(JSON.stringify({
    type: 'document.join',
    contentId: pageBId,
    afterSequence: 0
  }));
  const crossSiteJoin = await nextWebSocketMessage(siteASocket);
  assert.equal(crossSiteJoin.type, 'document.error');
  assert.equal(crossSiteJoin.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');
  assert.equal(
    server.virgoScorpioHub.realtimeHub.subscriberCount,
    subscribersAfterAllowedJoin,
    'a cross-site document ID must not create a document subscription'
  );

  await assert.rejects(
    connectWebSocket(wsPath(SITE_B), origin, { authorization: 'Bearer ' + token }),
    error => error.statusCode === 403
  );
  assert.equal(
    server.virgoScorpioHub.realtimeHub.subscriberCount,
    subscribersAfterAllowedJoin,
    'a cross-site WebSocket upgrade must be rejected before subscription'
  );

  editGranted = false;
  siteASocket.send(JSON.stringify({
    type: 'document.operation',
    contentId: pageAId,
    operation: { ...operation, opId: '77777777-7777-4777-8777-777777777777', payload: { title: 'Revoked edit' } }
  }));
  const revokedSocketWrite = await nextWebSocketMessage(siteASocket);
  assert.equal(revokedSocketWrite.type, 'document.error');
  assert.equal(revokedSocketWrite.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');
  assert.equal(storeWrites.length, 1, 'a write after edit revocation must not reach the store');
  assert.equal(
    server.virgoScorpioHub.realtimeHub.subscriberCount,
    1,
    'revoking edit authority closes the document subscription but leaves presence connected'
  );

  const revokedRestWrite = await fetch(
    origin + '/api/v1/pages/' + pageAId + '/collaboration/operations?siteId=' + SITE_A,
    {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: { ...operation, opId: '88888888-8888-4888-8888-888888888888', payload: { title: 'Revoked REST edit' } }
      })
    }
  );
  assert.equal(revokedRestWrite.status, 403);
  assert.equal((await revokedRestWrite.json()).code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
  assert.equal(storeWrites.length, 1, 'a REST write after edit revocation must not reach the store');
});
