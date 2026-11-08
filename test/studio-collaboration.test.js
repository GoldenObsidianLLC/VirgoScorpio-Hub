'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const {
  applyCollaborationOperation,
  createStudioCollaborationClient
} = require('../apps/admin/assets/studio-collaboration');

const siteId = '11111111-1111-4111-8111-111111111111';
const contentId = '22222222-2222-4222-8222-222222222222';
const actorId = '33333333-3333-4333-8333-333333333333';

function pageDocument() {
  return {
    schemaVersion: 1,
    documentId: 'page-1',
    type: 'page',
    title: 'Draft title',
    children: [{
      id: 'section-1',
      type: 'section',
      props: {},
      children: [{
        id: 'heading-1',
        type: 'widget.heading',
        props: { text: 'Hello', level: 2 },
        children: []
      }]
    }]
  };
}

function operation(type, payload, baseSequence = 0) {
  return {
    schemaVersion: 1,
    opId: webcrypto.randomUUID(),
    clientId: 'studio-client-1',
    baseSequence,
    type,
    payload
  };
}

class FakeWebSocket {
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.OPEN;
    this.listeners = new Map();
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, callback) {
    const entries = this.listeners.get(type) || [];
    entries.push(callback);
    this.listeners.set(type, entries);
  }

  send(value) {
    assert.equal(this.readyState, FakeWebSocket.OPEN);
    this.sent.push(JSON.parse(value));
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    for (const callback of this.listeners.get('close') || []) callback({});
  }

  receive(message) {
    for (const callback of this.listeners.get('message') || []) {
      callback({ data: JSON.stringify(message) });
    }
  }
}

function createClient(overrides = {}) {
  FakeWebSocket.instances.length = 0;
  const operations = [];
  const reloads = [];
  const statuses = [];
  const errors = [];
  const client = createStudioCollaborationClient({
    siteId,
    contentId,
    clientId: 'studio-client-1',
    cryptoRef: webcrypto,
    WebSocketClass: FakeWebSocket,
    locationRef: { href: 'https://hub.example.test/admin' },
    onOperation: (value, metadata) => operations.push({ value, metadata }),
    onReload: (value, metadata) => reloads.push({ value, metadata }),
    onStatus: (status, metadata) => statuses.push({ status, metadata }),
    onError: error => errors.push(error),
    ...overrides
  });
  return { client, operations, reloads, statuses, errors };
}

async function joinClient(client) {
  const start = client.start();
  const socket = FakeWebSocket.instances.at(-1);
  socket.receive({ type: 'connection.ready' });
  assert.deepEqual(socket.sent.at(-1), {
    type: 'document.join',
    contentId,
    afterSequence: 0
  });
  socket.receive({
    type: 'document.joined',
    contentId,
    sequence: 0,
    oldestReplaySequence: 0,
    reloadRequired: false
  });
  await start;
  return socket;
}

test('applies typed document, node and Unicode code-point text operations', () => {
  let document = pageDocument();

  document = applyCollaborationOperation(document, operation('document.set_title', { title: 'Updated title' }));
  document = applyCollaborationOperation(document, operation('text.insert', {
    nodeId: 'heading-1', key: 'text', offset: 5, text: ' 🌍'
  }, 1));

  assert.equal(document.title, 'Updated title');
  assert.equal(document.children[0].children[0].props.text, 'Hello 🌍');
  assert.equal(pageDocument().children[0].children[0].props.text, 'Hello');
});

test('inserts and deletes nodes using stable identifiers', () => {
  let document = pageDocument();
  const inserted = {
    id: 'text-1',
    type: 'widget.text',
    props: { text: 'Collaborative paragraph' },
    children: []
  };

  document = applyCollaborationOperation(document, operation('node.insert', {
    node: inserted,
    parentId: 'section-1',
    afterNodeId: 'heading-1'
  }));
  assert.equal(document.children[0].children[1].id, 'text-1');

  document = applyCollaborationOperation(document, operation('node.delete', { nodeId: 'text-1' }, 1));
  assert.equal(document.children[0].children.length, 1);
});

test('rejects invalid envelopes, duplicate identifiers, and unsafe tree mutations', () => {
  const document = pageDocument();
  const invalidEnvelope = {
    ...operation('document.set_title', { title: 'No' }),
    tenantId: 'attacker-selected'
  };
  assert.throws(() => applyCollaborationOperation(document, invalidEnvelope), /invalid operation envelope/i);

  assert.throws(() => applyCollaborationOperation(document, operation('node.insert', {
    node: {
      id: 'heading-1',
      type: 'widget.text',
      props: { text: 'Duplicate' },
      children: []
    },
    parentId: 'section-1',
    afterNodeId: 'heading-1'
  })), /duplicate|already exists|invalid page node tree/i);

  assert.throws(() => applyCollaborationOperation(document, operation('node.set_prop', {
    nodeId: 'heading-1',
    key: 'onClick',
    value: 'alert(1)'
  })), /unsupported component property|not approved/i);

  assert.throws(() => applyCollaborationOperation(document, operation('node.move', {
    nodeId: 'section-1',
    parentId: 'section-1',
    afterNodeId: null
  })), /itself or a descendant/i);
});

test('joins the authenticated draft socket, sequences acknowledgements, and leaves cleanly', async () => {
  const { client, operations } = createClient();
  const socket = await joinClient(client);

  assert.match(socket.url, /^wss:\/\/hub\.example\.test\/api\/v1\/sites\//);
  assert.equal(client.connected, true);
  assert.equal(client.sequence, 0);

  const submitted = client.submit({ type: 'document.set_title', payload: { title: 'Changed in Studio' } });
  const command = socket.sent.at(-1);
  assert.equal(command.type, 'document.operation');
  assert.equal(command.contentId, contentId);
  assert.equal(command.operation.baseSequence, 0);
  assert.equal(command.operation.schemaVersion, 1);

  socket.receive({
    type: 'document.operation.ack',
    contentId,
    operationId: command.operation.opId,
    operation: command.operation,
    sequence: 1,
    version: 2,
    lockVersion: 2,
    duplicate: false
  });

  const result = await submitted;
  assert.equal(result.sequence, 1);
  assert.equal(result.version, 2);
  assert.equal(client.sequence, 1);
  assert.equal(operations.length, 1);
  assert.equal(operations[0].metadata.local, true);

  const remote = operation('document.set_title', { title: 'Changed by another editor' }, 1);
  socket.receive({ type: 'document.operation', contentId, operation: remote, sequence: 2, version: 3 });
  assert.equal(client.sequence, 2);
  assert.equal(operations.length, 2);
  assert.equal(operations[1].metadata.local, false);

  assert.equal(client.close(), true);
  assert.equal(socket.sent.at(-1).type, 'document.leave');
  assert.equal(client.connected, false);
});

test('recovers a reload-required socket from the canonical REST sync endpoint', async () => {
  let syncUrl = '';
  const canonical = pageDocument();
  canonical.title = 'Recovered canonical draft';
  const { client, reloads } = createClient({
    fetchImpl: async url => {
      syncUrl = url;
      return {
        ok: true,
        json: async () => ({
          reloadRequired: true,
          sequence: 5,
          oldestReplaySequence: 5,
          version: 7,
          document: canonical
        })
      };
    }
  });
  const socket = await joinClient(client);

  socket.receive({ type: 'document.reload.required', contentId });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(reloads.length, 1);
  assert.equal(reloads[0].value.title, 'Recovered canonical draft');
  assert.equal(reloads[0].metadata.sequence, 5);
  assert.equal(reloads[0].metadata.version, 7);
  assert.match(syncUrl, new RegExp('/api/v1/pages/' + contentId + '/collaboration/sync\\?afterSequence=0$'));
  assert.deepEqual(socket.sent.at(-1), {
    type: 'document.join',
    contentId,
    afterSequence: 5
  });

  socket.receive({
    type: 'document.joined',
    contentId,
    sequence: 5,
    oldestReplaySequence: 5,
    reloadRequired: false
  });
  assert.equal(client.sequence, 5);
  assert.equal(client.connected, true);
  client.close();
});

test('closing before the first join rejects the pending start promise', async () => {
  const { client } = createClient();
  const start = client.start();
  const rejected = assert.rejects(start, /closed before joining/i);

  client.close();
  await rejected;
});
