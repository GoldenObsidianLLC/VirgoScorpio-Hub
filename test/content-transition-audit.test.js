'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPostgresStore } = require('../packages/db/src/postgres-store');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

function createRecordingPool(initialStatus = 'draft', contentType = 'page') {
  const calls = [];
  const previous = {
    id: CONTENT_ID,
    site_id: SITE_ID,
    title: 'Transaction callback test',
    slug: 'transaction-callback-test',
    locale: 'en',
    content_type: contentType,
    status: initialStatus,
    body: { schemaVersion: 1, type: 'page', title: 'Transaction callback test', children: [] },
    version: 1,
    lock_version: 1,
    published_snapshot: null,
  };
  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      calls.push(normalized);
      if (normalized.startsWith('SELECT id,site_id,title,slug,locale,content_type,status,body,version,published_snapshot')) {
        return { rows: params[2] && previous.content_type !== params[2] ? [] : [{ ...previous }] };
      }
      if (normalized.startsWith('UPDATE content_items SET status=$3')) {
        return {
          rows: [{
            id: CONTENT_ID,
            site_id: SITE_ID,
            title: previous.title,
            slug: previous.slug,
            locale: previous.locale,
            content_type: previous.content_type,
            status: params[2],
            version: previous.version,
            lock_version: previous.lock_version + 1,
            scheduled_at: params[3],
            published_at: null,
            published_version: null,
          }],
        };
      }
      if (normalized.startsWith('SELECT sequence FROM content_collaboration_documents')) return { rows: [] };
      return { rows: [] };
    },
    release() { calls.push('RELEASE'); },
  };
  return {
    calls,
    client,
    pool: { async connect() { return client; } },
  };
}

const ACTIONS = [
  { method: 'submitForReview', status: 'draft', action: 'submitted_for_review' },
  { method: 'approve', status: 'in_review', action: 'approved' },
  { method: 'rejectReview', status: 'in_review', action: 'rejected' },
  { method: 'publishContent', status: 'approved', action: 'published' },
  { method: 'scheduleContent', status: 'approved', action: 'scheduled' },
  { method: 'archiveContent', status: 'published', action: 'archived' },
  { method: 'unpublishContent', status: 'published', action: 'unpublished' },
];

test('all editorial transition methods invoke the audit callback inside their existing transaction', async () => {
  for (const scenario of ACTIONS) {
    const recording = createRecordingPool(scenario.status);
    const store = createPostgresStore({ pool: recording.pool });
    const callbackCalls = [];
    const input = {
      siteId: SITE_ID,
      id: CONTENT_ID,
      actorId: ACTOR_ID,
      correlationId: 'workflow-audit-unit-test',
      expectedVersion: 1,
      note: 'transaction callback assertion',
      onTransition: async context => {
        recording.calls.push('AUDIT_CALLBACK');
        callbackCalls.push(context);
      },
      ...(scenario.method === 'scheduleContent'
        ? { scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString() }
        : {}),
    };

    const result = await store[scenario.method](input);

    assert.equal(result.status, scenario.method === 'submitForReview' ? 'in_review'
      : scenario.method === 'approve' ? 'approved'
        : scenario.method === 'rejectReview' || scenario.method === 'unpublishContent' ? 'draft'
          : scenario.method === 'publishContent' ? 'published'
            : scenario.method === 'scheduleContent' ? 'scheduled' : 'archived');
    assert.equal(callbackCalls.length, 1, scenario.method + ' must invoke exactly one audit callback');
    assert.equal(callbackCalls[0].queryable, recording.client, scenario.method + ' must pass the transaction client');
    assert.equal(callbackCalls[0].previous.status, scenario.status);
    assert.equal(callbackCalls[0].action, scenario.action);

    const callbackIndex = recording.calls.indexOf('AUDIT_CALLBACK');
    const outboxIndex = recording.calls.findIndex(sql => sql.startsWith('INSERT INTO outbox_events'));
    const commitIndex = recording.calls.findIndex(sql => sql === 'COMMIT');
    assert.ok(outboxIndex >= 0 && outboxIndex < callbackIndex, scenario.method + ' writes its outbox event before the callback');
    assert.ok(callbackIndex < commitIndex, scenario.method + ' must await audit before COMMIT');
  }
});

test('all editorial transition methods enforce the expected content type before writing', async () => {
  for (const scenario of ACTIONS) {
    const recording = createRecordingPool(scenario.status, 'product');
    const store = createPostgresStore({ pool: recording.pool });
    const input = {
      siteId: SITE_ID,
      id: CONTENT_ID,
      actorId: ACTOR_ID,
      expectedVersion: 1,
      expectedContentType: 'page',
      ...(scenario.method === 'scheduleContent'
        ? { scheduledAt: new Date(Date.now() + 5 * 60_000).toISOString() }
        : {}),
    };

    await assert.rejects(
      store[scenario.method](input),
      error => error.statusCode === 404 && error.code === 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND',
      scenario.method + ' must not transition a custom record through a page-scoped operation',
    );

    assert.ok(recording.calls.some(sql => sql === 'ROLLBACK'));
    assert.equal(recording.calls.some(sql => sql.startsWith('UPDATE content_items SET status=')), false);
    assert.equal(recording.calls.some(sql => sql.startsWith('INSERT INTO content_workflow_events')), false);
  }
});

test('editorial transitions remain backwards compatible when no audit callback is supplied', async () => {
  const recording = createRecordingPool('draft');
  const store = createPostgresStore({ pool: recording.pool });

  await store.submitForReview({
    siteId: SITE_ID,
    id: CONTENT_ID,
    actorId: ACTOR_ID,
    expectedVersion: 1,
    note: 'legacy caller without an audit callback',
  });

  assert.ok(recording.calls.includes('COMMIT'));
  assert.equal(recording.calls.includes('AUDIT_CALLBACK'), false);
});

test('audit callback failures roll back and preserve the original database error code', async () => {
  const recording = createRecordingPool('draft');
  const store = createPostgresStore({ pool: recording.pool });
  const auditError = Object.assign(new Error('simulated audit uniqueness failure'), { code: '23505' });

  await assert.rejects(
    store.submitForReview({
      siteId: SITE_ID,
      id: CONTENT_ID,
      actorId: ACTOR_ID,
      expectedVersion: 1,
      note: 'audit failure rollback',
      onTransition: async () => { throw auditError; },
    }),
    error => error === auditError,
  );

  assert.ok(recording.calls.includes('ROLLBACK'));
  assert.equal(recording.calls.includes('COMMIT'), false);
});
