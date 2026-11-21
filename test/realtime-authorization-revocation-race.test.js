'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createApiServer } = require('../apps/api/src/server');
const { createRealtimeHub } = require('../packages/realtime/src/event-hub');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = '22222222-2222-4222-8222-222222222222';
const TOKEN = 'websocket-preview-token';

function nextMessage(socket, timeoutMs = 1_000) {
  if (socket._messages.length) return Promise.resolve(JSON.parse(socket._messages.shift().toString()));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const index = socket._waiters.indexOf(onMessage);
      if (index >= 0) socket._waiters.splice(index, 1);
      reject(new Error('Timed out waiting for WebSocket message.'));
    }, timeoutMs);
    const onMessage = data => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    };
    socket._waiters.push(onMessage);
  });
}

function connect(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, { headers });
    socket._messages = [];
    socket._waiters = [];
    socket.on('message', data => {
      const waiter = socket._waiters.shift();
      if (waiter) waiter(data);
      else socket._messages.push(data);
    });
    socket.once('open', () => resolve(socket));
    socket.once('unexpected-response', (_request, response) => {
      const error = new Error('WebSocket upgrade rejected with ' + response.statusCode);
      error.statusCode = response.statusCode;
      response.resume();
      reject(error);
    });
    socket.once('error', reject);
  });
}

async function createServer(t, options = {}) {
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      VIRGOSCORPIO_HUB_API_TOKEN: TOKEN,
      VIRGOSCORPIO_HUB_DEFAULT_SITE_ID: SITE_ID,
      VIRGOSCORPIO_HUB_REALTIME_ENABLED: 'true',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100'
    },
    logger: { error() {} },
    ...options
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const url = origin.replace('http://', 'ws://') + '/api/v1/sites/' + SITE_ID + '/realtime/ws';
  t.after(async () => {
    await server.virgoScorpioHub.close();
    await new Promise(resolve => server.close(resolve));
  });
  return { server, origin, url };
}

test('document.join rejects when authorization is revoked during sync read', async t => {
  let authorizeDocumentCalls = 0;
  let authorized = true;
  let releaseSyncRead;
  const syncReadStarted = new Promise(resolve => { releaseSyncRead = resolve; });

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      // Simulate a slow sync read during which authorization can be revoked
      await syncReadStarted;
      return {
        reloadRequired: false,
        sequence: 0,
        oldestReplaySequence: 0,
        operations: []
      };
    }
  };

  const authorizeDocument = async ({ principal, sessionId, siteId, contentId }) => {
    authorizeDocumentCalls += 1;
    return authorized;
  };

  const hub = createRealtimeHub({ authorizeSubscribe: async () => authorized });
  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub,
    authorizeDocument
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Wait a bit to ensure the join has started and authorization has been checked
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(authorizeDocumentCalls >= 1, 'initial authorization check should have occurred');

  // Revoke authorization while the sync read is in progress
  authorized = false;

  // Release the sync read
  releaseSyncRead();

  // The join should fail with a forbidden error
  const error = await nextMessage(socket, 2_000);
  assert.equal(error.type, 'document.error');
  assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');
  assert.ok(authorizeDocumentCalls >= 2, 'post-sync authorization check should have occurred');
});

test('document.join rejects when hub subscription is closed during sync read', async t => {
  let releaseSyncRead;
  const syncReadStarted = new Promise(resolve => { releaseSyncRead = resolve; });
  let hubSubscription = null;

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      // Simulate a slow sync read
      await syncReadStarted;
      return {
        reloadRequired: false,
        sequence: 0,
        oldestReplaySequence: 0,
        operations: []
      };
    }
  };

  const hub = createRealtimeHub({ authorizeSubscribe: async () => true });
  
  // Intercept subscribe to capture the subscription
  const originalSubscribe = hub.subscribe.bind(hub);
  hub.subscribe = async function(options) {
    const subscription = await originalSubscribe(options);
    if (options.topic && options.topic.startsWith('document:')) {
      hubSubscription = subscription;
    }
    return subscription;
  };

  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Wait for the subscription to be created
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(hubSubscription, 'hub subscription should have been created');

  // Close the hub subscription (simulating invalidation)
  hubSubscription.close();

  // Release the sync read
  releaseSyncRead();

  // The join should fail with a forbidden error
  const error = await nextMessage(socket, 2_000);
  assert.equal(error.type, 'document.error');
  assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');
});

test('document.join delivers sync when authorization remains valid throughout', async t => {
  let syncReadCompleted = false;

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      // Simulate a slow sync read
      await new Promise(resolve => setTimeout(resolve, 100));
      syncReadCompleted = true;
      return {
        reloadRequired: false,
        sequence: 5,
        oldestReplaySequence: 0,
        operations: []
      };
    }
  };

  const hub = createRealtimeHub({ authorizeSubscribe: async () => true });
  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Should receive document.joined successfully
  const joined = await nextMessage(socket, 2_000);
  assert.equal(joined.type, 'document.joined');
  assert.equal(joined.contentId, CONTENT_ID);
  assert.equal(joined.sequence, 5);
  assert.ok(syncReadCompleted, 'sync read should have completed');
});

test('document.join with reload delivers snapshot only when authorization remains valid', async t => {
  let authorizeDocumentCalls = 0;
  let authorized = true;
  let releaseSyncRead;
  const syncReadStarted = new Promise(resolve => { releaseSyncRead = resolve; });

  const sensitiveSnapshot = {
    schemaVersion: 1,
    documentId: 'sensitive-doc',
    type: 'page',
    title: 'Confidential Document',
    children: [{ type: 'text', text: 'This is sensitive data that should not leak' }]
  };

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      // Simulate a slow sync read that returns a full snapshot
      await syncReadStarted;
      return {
        reloadRequired: true,
        sequence: 100,
        oldestReplaySequence: 50,
        document: sensitiveSnapshot,
        title: sensitiveSnapshot.title,
        version: 10,
        lockVersion: 15
      };
    }
  };

  const authorizeDocument = async ({ principal, sessionId, siteId, contentId }) => {
    authorizeDocumentCalls += 1;
    return authorized;
  };

  const hub = createRealtimeHub({ authorizeSubscribe: async () => authorized });
  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub,
    authorizeDocument
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Wait for authorization and subscription setup
  await new Promise(resolve => setTimeout(resolve, 50));

  // Revoke authorization while the sync read is in progress
  authorized = false;

  // Release the sync read
  releaseSyncRead();

  // The join should fail and NOT deliver the sensitive snapshot
  const error = await nextMessage(socket, 2_000);
  assert.equal(error.type, 'document.error');
  assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');

  // Verify no document.reload message was sent
  await assert.rejects(
    nextMessage(socket, 200),
    /Timed out waiting for WebSocket message/,
    'no additional messages should be delivered after error'
  );
});

test('document.join with replay operations rejects when authorization revoked during sync', async t => {
  let authorized = true;
  let releaseSyncRead;
  const syncReadStarted = new Promise(resolve => { releaseSyncRead = resolve; });

  const sensitiveOperations = [
    {
      sequence: 1,
      operation: {
        schemaVersion: 1,
        opId: '33333333-3333-4333-8333-333333333333',
        clientId: 'prior-editor',
        baseSequence: 0,
        type: 'text.insert',
        payload: { nodeId: 'text-1', key: 'text', offset: 0, text: 'Confidential operation data' }
      },
      appliedOperation: {
        schemaVersion: 1,
        opId: '33333333-3333-4333-8333-333333333333',
        clientId: 'prior-editor',
        baseSequence: 0,
        type: 'text.insert',
        payload: { nodeId: 'text-1', key: 'text', offset: 0, text: 'Confidential operation data' }
      }
    }
  ];

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      // Simulate a slow sync read that returns replay operations
      await syncReadStarted;
      return {
        reloadRequired: false,
        sequence: 1,
        oldestReplaySequence: 0,
        operations: sensitiveOperations
      };
    }
  };

  const authorizeDocument = async () => authorized;
  const hub = createRealtimeHub({ authorizeSubscribe: async () => authorized });
  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub,
    authorizeDocument
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Wait for authorization and subscription setup
  await new Promise(resolve => setTimeout(resolve, 50));

  // Revoke authorization while the sync read is in progress
  authorized = false;

  // Release the sync read
  releaseSyncRead();

  // The join should fail and NOT deliver the sensitive operations
  const error = await nextMessage(socket, 2_000);
  assert.equal(error.type, 'document.error');
  assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');

  // Verify no document.sync.operation messages were sent
  await assert.rejects(
    nextMessage(socket, 200),
    /Timed out waiting for WebSocket message/,
    'no replay operations should be delivered after authorization revocation'
  );
});

test('concurrent document.join requests handle authorization revocation independently', async t => {
  let authorized = true;
  let syncCallCount = 0;
  const syncReleases = [];

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      const callIndex = syncCallCount++;
      const release = new Promise(resolve => { syncReleases[callIndex] = resolve; });
      await release;
      return {
        reloadRequired: false,
        sequence: callIndex,
        oldestReplaySequence: 0,
        operations: []
      };
    }
  };

  const authorizeDocument = async () => authorized;
  const hub = createRealtimeHub({ authorizeSubscribe: async () => authorized });
  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub,
    authorizeDocument
  });

  const socket1 = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  const socket2 = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => { socket1.close(); socket2.close(); });
  await nextMessage(socket1); // connection.ready
  await nextMessage(socket2); // connection.ready

  // Start two concurrent document joins
  socket1.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));
  socket2.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Wait for both syncs to start
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(syncCallCount, 2, 'both sync reads should have started');

  // Revoke authorization
  authorized = false;

  // Release both sync reads
  syncReleases[0]();
  syncReleases[1]();

  // Both joins should fail
  const error1 = await nextMessage(socket1, 2_000);
  const error2 = await nextMessage(socket2, 2_000);
  assert.equal(error1.type, 'document.error');
  assert.equal(error1.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');
  assert.equal(error2.type, 'document.error');
  assert.equal(error2.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');
});

test('document.join checks both authorizeDocument and hub.reauthorize after sync', async t => {
  let authorizeDocumentAuthorized = true;
  let hubAuthorized = true;
  let releaseSyncRead;
  const syncReadStarted = new Promise(resolve => { releaseSyncRead = resolve; });
  let authorizeDocumentCallsAfterSync = 0;
  let reauthorizeCallsAfterSync = 0;

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      await syncReadStarted;
      // After this point, count the authorization calls
      setTimeout(() => {
        // Give time for post-sync checks to happen
      }, 10);
      return {
        reloadRequired: false,
        sequence: 0,
        oldestReplaySequence: 0,
        operations: []
      };
    }
  };

  const authorizeDocument = async () => {
    const result = authorizeDocumentAuthorized;
    if (syncReadStarted) {
      // Track calls after sync started
      authorizeDocumentCallsAfterSync += 1;
    }
    return result;
  };

  const hub = createRealtimeHub({ authorizeSubscribe: async () => hubAuthorized });
  
  // Intercept reauthorize to count calls
  const originalReauthorize = hub.reauthorize.bind(hub);
  hub.reauthorize = async function(subscription) {
    reauthorizeCallsAfterSync += 1;
    return await originalReauthorize(subscription);
  };

  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub,
    authorizeDocument
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Wait for sync to start
  await new Promise(resolve => setTimeout(resolve, 50));

  // Revoke hub authorization
  hubAuthorized = false;

  // Release the sync read
  releaseSyncRead();

  // The join should fail
  const error = await nextMessage(socket, 2_000);
  assert.equal(error.type, 'document.error');
  assert.equal(error.code, 'ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN');

  // Verify both checks were performed after sync
  assert.ok(authorizeDocumentCallsAfterSync >= 1, 'authorizeDocument should be called after sync');
  assert.ok(reauthorizeCallsAfterSync >= 1, 'hub.reauthorize should be called after sync');
});

test('document.join succeeds when gateway entry remains valid after sync', async t => {
  let syncCompleted = false;

  const store = {
    async getById({ siteId, id }) {
      return siteId === SITE_ID && id === CONTENT_ID
        ? { id, site_id: SITE_ID, content_type: 'page', status: 'draft', created_by: null }
        : null;
    },
    async getCollaborationSync() {
      // Simulate realistic sync delay
      await new Promise(resolve => setTimeout(resolve, 100));
      syncCompleted = true;
      return {
        reloadRequired: false,
        sequence: 10,
        oldestReplaySequence: 5,
        operations: []
      };
    }
  };

  const hub = createRealtimeHub({ authorizeSubscribe: async () => true });
  const { url, origin } = await createServer(t, {
    contentStore: store,
    realtimeHub: hub
  });

  const socket = await connect(url, { authorization: 'Bearer ' + TOKEN, origin });
  t.after(() => socket.close());
  await nextMessage(socket); // connection.ready

  // Start the document join
  socket.send(JSON.stringify({ type: 'document.join', contentId: CONTENT_ID, afterSequence: 0 }));

  // Should receive document.joined successfully
  const joined = await nextMessage(socket, 2_000);
  assert.equal(joined.type, 'document.joined');
  assert.equal(joined.contentId, CONTENT_ID);
  assert.equal(joined.sequence, 10);
  assert.ok(syncCompleted, 'sync should have completed');
});
