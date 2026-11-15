'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPostgresStore } = require('../packages/db/src/postgres-store');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const DOCUMENT = { schemaVersion: 1, type: 'page', title: 'Atomic draft', children: [] };

function createRecordingPool({ existing = null, failContentWrite = null } = {}) {
  const calls = [];
  const row = {
    id: CONTENT_ID, site_id: SITE_ID, title: 'Atomic draft', slug: 'atomic-draft', locale: 'en',
    content_type: 'page', status: 'draft', version: existing ? existing.version + 1 : 1,
    lock_version: existing ? 2 : 1, body: DOCUMENT, published_version: null, updated_at: new Date().toISOString(),
  };
  const client = {
    async query(sql, values = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, values });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return { rows: [] };
      if (normalized.startsWith('SELECT id,version,status FROM content_items')) return { rows: existing ? [{ ...existing }] : [] };
      if (normalized.startsWith('INSERT INTO content_items') || normalized.startsWith('UPDATE content_items SET title=')) {
        if (failContentWrite) throw failContentWrite;
        return { rows: [{ ...row }] };
      }
      if (normalized.startsWith('SELECT sequence FROM content_collaboration_documents')) return { rows: [] };
      return { rows: [] };
    },
    release() { calls.push({ sql: 'RELEASE', values: [] }); },
  };
  return { calls, client, pool: { async connect() { calls.push({ sql: 'CONNECT', values: [] }); return client; } } };
}

function input(overrides = {}) {
  return { siteId: SITE_ID, title: 'Atomic draft', slug: 'atomic-draft', locale: 'en', contentType: 'page', document: DOCUMENT, authorId: ACTOR_ID, correlationId: 'draft-request-1', ...overrides };
}

test('saveDraft awaits onDraftSaved with the exact transaction client before commit', async () => {
  const recording = createRecordingPool();
  const store = createPostgresStore({ pool: recording.pool });
  const callbackContexts = [];
  const saved = await store.saveDraft(input({ onDraftSaved: async context => { recording.calls.push({ sql: 'CALLBACK', values: [] }); callbackContexts.push(context); } }));
  assert.equal(saved.id, CONTENT_ID);
  assert.equal(callbackContexts.length, 1);
  assert.equal(callbackContexts[0].queryable, recording.client);
  assert.equal(callbackContexts[0].result, saved);
  assert.equal(callbackContexts[0].previous, null);
  const callbackIndex = recording.calls.findIndex(call => call.sql === 'CALLBACK');
  assert.ok(callbackIndex >= 0, 'onDraftSaved must be invoked');
  const outboxIndex = recording.calls.findIndex(call => call.sql.startsWith('INSERT INTO outbox_events')) ;
  const commitIndex = recording.calls.findIndex(call => call.sql === 'COMMIT');
  assert.ok(outboxIndex >= 0 && outboxIndex < callbackIndex, 'outbox must be written before audit callback');
  assert.ok(callbackIndex < commitIndex, 'audit callback must complete before COMMIT');
  assert.equal(recording.calls.at(-1).sql, 'RELEASE');
});

test('saveDraft passes the locked previous row to onDraftSaved for updates', async () => {
  const previous = { id: CONTENT_ID, version: 7, status: 'in_review' };
  const recording = createRecordingPool({ existing: previous });
  const store = createPostgresStore({ pool: recording.pool });
  let context;
  const saved = await store.saveDraft(input({ id: CONTENT_ID, expectedVersion: 7, onDraftSaved: async value => { context = value; } }));
  assert.equal(saved.version, 8);
  assert.deepEqual(context.previous, previous);
  assert.equal(context.queryable, recording.client);
  assert.equal(context.result, saved);
});

test('saveDraft remains backwards compatible when onDraftSaved is omitted', async () => {
  const recording = createRecordingPool();
  const store = createPostgresStore({ pool: recording.pool });
  const saved = await store.saveDraft(input());
  assert.equal(saved.id, CONTENT_ID);
  assert.ok(recording.calls.some(call => call.sql === 'COMMIT'));
  assert.equal(recording.calls.some(call => call.sql === 'ROLLBACK'), false);
});

test('onDraftSaved failures roll back and preserve the original audit error, including 23505', async () => {
  const recording = createRecordingPool();
  const store = createPostgresStore({ pool: recording.pool });
  const auditError = Object.assign(new Error('simulated audit unique violation'), { code: '23505' });
  await assert.rejects(store.saveDraft(input({ onDraftSaved: async () => { throw auditError; } })), error => error === auditError);
  assert.ok(recording.calls.some(call => call.sql === 'ROLLBACK'));
  assert.equal(recording.calls.some(call => call.sql === 'COMMIT'), false);
  assert.equal(recording.calls.at(-1).sql, 'RELEASE');
});

test('content-row unique violations still map to the route conflict contract', async () => {
  const duplicate = Object.assign(new Error('duplicate content route'), { code: '23505' });
  const recording = createRecordingPool({ failContentWrite: duplicate });
  const store = createPostgresStore({ pool: recording.pool });
  await assert.rejects(store.saveDraft(input()), error => error.code === 'ERR_VIRGOSCORPIO_HUB_ROUTE_CONFLICT' && error.statusCode === 409);
  assert.ok(recording.calls.some(call => call.sql === 'ROLLBACK'));
  assert.equal(recording.calls.some(call => call.sql === 'COMMIT'), false);
});
