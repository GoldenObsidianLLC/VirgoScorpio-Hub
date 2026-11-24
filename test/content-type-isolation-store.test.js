'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPostgresStore } = require('../packages/db/src/postgres-store');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const CONTENT_ID = '33333333-3333-4333-8333-333333333333';

function createQueryRecordingPool() {
  const queries = [];
  return {
    queries,
    pool: {
      async query(sql, values = []) {
        queries.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), values });
        return { rows: [] };
      },
    },
  };
}

test('page revision reads bind the requested content type in SQL', async () => {
  const recording = createQueryRecordingPool();
  const store = createPostgresStore({ pool: recording.pool });

  await store.listRevisions({ siteId: SITE_ID, contentId: CONTENT_ID, contentType: 'page' });
  await store.getRevision({ siteId: SITE_ID, contentId: CONTENT_ID, version: 3, contentType: 'page' });

  assert.equal(recording.queries.length, 2);
  for (const query of recording.queries) {
    assert.match(query.sql, /c\.content_type=\$4/);
    assert.equal(query.values[3], 'page');
  }
  assert.match(recording.queries[0].sql, /ORDER BY r\.version DESC LIMIT \$3/);
});

test('revision store methods retain unrestricted behavior when no content type is supplied', async () => {
  const recording = createQueryRecordingPool();
  const store = createPostgresStore({ pool: recording.pool });

  await store.listRevisions({ siteId: SITE_ID, contentId: CONTENT_ID });
  await store.getRevision({ siteId: SITE_ID, contentId: CONTENT_ID, version: 1 });

  assert.equal(recording.queries.length, 2);
  for (const query of recording.queries) {
    assert.match(query.sql, /\(\$4::text IS NULL OR c\.content_type=\$4\)/);
    assert.equal(query.values[3], null);
  }
});

test('collaboration sync cannot read a custom record through a page-scoped store lookup', async () => {
  const recording = createQueryRecordingPool();
  const store = createPostgresStore({ pool: recording.pool });

  await assert.rejects(
    store.getCollaborationSync({ siteId: SITE_ID, contentId: CONTENT_ID, afterSequence: 0 }),
    error => error.statusCode === 404 && error.code === 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND',
  );

  assert.equal(recording.queries.length, 1);
  assert.match(recording.queries[0].sql, /c\.content_type='page'/);
  assert.match(recording.queries[0].sql, /c\.site_id=\$2/);
  assert.deepEqual(recording.queries[0].values.slice(0, 2), [CONTENT_ID, SITE_ID]);
});

test('collaboration operation locks only page records before accepting writes', async () => {
  const queries = [];
  let released = false;
  const client = {
    async query(sql, values = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      queries.push({ sql: normalized, values });
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  const store = createPostgresStore({
    pool: {
      async connect() {
        return client;
      },
    },
  });
  const operation = {
    schemaVersion: 1,
    opId: '55555555-5555-4555-8555-555555555555',
    clientId: 'page-type-isolation-test',
    baseSequence: 0,
    type: 'document.set_title',
    payload: { title: 'Must remain a page' },
  };

  await assert.rejects(
    store.applyCollaborationOperation({ siteId: SITE_ID, contentId: CONTENT_ID, operation }),
    error => error.statusCode === 404 && error.code === 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND',
  );

  const lockedRead = queries.find(query => query.sql.startsWith('SELECT id,site_id,title,slug,locale,content_type,status,body,version,lock_version,published_snapshot'));
  assert.ok(lockedRead);
  assert.match(lockedRead.sql, /content_type='page'/);
  assert.deepEqual(lockedRead.values, [CONTENT_ID, SITE_ID]);
  assert.ok(queries.some(query => query.sql === 'BEGIN'));
  assert.ok(queries.some(query => query.sql === 'ROLLBACK'));
  assert.equal(queries.some(query => query.sql.startsWith('INSERT INTO content_collaboration_documents')), false);
  assert.equal(queries.some(query => query.sql.startsWith('INSERT INTO content_collaboration_operations')), false);
  assert.equal(released, true);
});
