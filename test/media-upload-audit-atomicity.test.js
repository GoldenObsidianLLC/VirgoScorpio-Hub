'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApiServer } = require('../apps/api/src/server');
const { createLocalMediaStore } = require('../packages/media/src/local-store');
const { createS3MediaStore } = require('../packages/media/src/s3-store');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const DATA_BASE64 = PNG.toString('base64');

function createPool({ connectError = null, insertError = null, commitError = null, rollbackError = null } = {}) {
  const events = [];
  const client = {
    async query(sql, values = []) {
      const statement = String(sql).trim();
      events.push({ type: 'query', statement, values });
      if (statement === 'BEGIN') return { rows: [] };
      if (statement === 'COMMIT') {
        if (commitError) throw commitError;
        return { rows: [] };
      }
      if (statement === 'ROLLBACK') {
        if (rollbackError) throw rollbackError;
        return { rows: [] };
      }
      if (statement.startsWith('INSERT INTO media_assets')) {
        if (insertError) throw insertError;
        const [id, siteId, storageKey, mimeType, byteSize, altText, metadata, actorId, publiclyAccessible] = values;
        return {
          rowCount: 1,
          rows: [{
            id, site_id: siteId, storage_key: storageKey, mime_type: mimeType,
            byte_size: byteSize, alt_text: altText, metadata: JSON.parse(metadata),
            created_by: actorId, publicly_accessible: publiclyAccessible, created_at: new Date(0).toISOString()
          }]
        };
      }
      if (statement.startsWith('INSERT INTO audit_events')) return { rowCount: 1, rows: [] };
      return { rowCount: 0, rows: [] };
    },
    release() {
      events.push({ type: 'release' });
    }
  };
  return {
    events,
    client,
    async connect() {
      events.push({ type: 'connect' });
      if (connectError) throw connectError;
      return client;
    },
    async query(...args) {
      return client.query(...args);
    }
  };
}

function createS3Harness({ failDelete = false, putError = null } = {}) {
  const events = [];
  class PutObjectCommand {
    constructor(input) { this.input = input; }
  }
  class DeleteObjectCommand {
    constructor(input) { this.input = input; }
  }
  class GetObjectCommand {
    constructor(input) { this.input = input; }
  }
  const commands = { PutObjectCommand, DeleteObjectCommand, GetObjectCommand };
  const client = {
    send(command) {
      events.push({ command: command.constructor.name, input: command.input });
      if (command instanceof DeleteObjectCommand && failDelete) throw new Error('simulated provider cleanup failure');
      if (command instanceof PutObjectCommand && putError) throw putError;
      return Promise.resolve({});
    }
  };
  return { events, client, commands };
}

async function filesBelow(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error));
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(root, fullPath));
    else if (entry.isFile()) files.push(path.relative(root, fullPath));
  }
  return files.sort();
}

test('local media upload awaits its audit callback on the transaction client before COMMIT', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-local-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pool = createPool();
  const store = createLocalMediaStore({ pool, root });
  let callbackContext;

  const asset = await store.upload({
    siteId: SITE_ID,
    actorId: ACTOR_ID,
    dataBase64: DATA_BASE64,
    mimeType: 'image/png',
    altText: 'A safe alt description',
    isPublic: false,
    onAssetUploaded: async context => {
      callbackContext = context;
      pool.events.push({ type: 'audit-callback' });
      assert.equal(context.queryable, pool.client);
      assert.equal(context.result.id, assetIdFromStorageKey(context.result.storage_key));
      await context.queryable.query('INSERT INTO audit_events(site_id, actor_id, action) VALUES($1,$2,$3)', [SITE_ID, ACTOR_ID, 'media.uploaded']);
    }
  });

  assert.ok(callbackContext);
  assert.equal(callbackContext.result.id, asset.id);
  assert.equal(asset.site_id, SITE_ID);
  assert.equal(asset.publicly_accessible, false);
  assert.deepEqual(pool.events.map(event => event.type === 'query' ? (event.statement.startsWith('INSERT INTO media_assets') ? 'INSERT INTO media_assets' : event.statement) : event.type), [
    'connect', 'BEGIN', 'INSERT INTO media_assets', 'audit-callback',
    'INSERT INTO audit_events(site_id, actor_id, action) VALUES($1,$2,$3)', 'COMMIT', 'release'
  ]);
  assert.deepEqual(await filesBelow(root), [asset.storage_key.split('/').join(path.sep)]);
  assert.deepEqual(await fs.readFile(path.join(root, ...asset.storage_key.split('/'))), PNG);
});

function assetIdFromStorageKey(storageKey) {
  return path.basename(storageKey).replace(/\.png$/, '');
}

test('local media upload rolls back and compensates its object when the audit callback fails', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-rollback-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pool = createPool({ rollbackError: new Error('rollback cleanup failed') });
  const store = createLocalMediaStore({ pool, root });
  const auditError = new Error('simulated media audit failure');

  await assert.rejects(
    store.upload({
      siteId: SITE_ID,
      actorId: ACTOR_ID,
      dataBase64: DATA_BASE64,
      mimeType: 'image/png',
      onAssetUploaded: async ({ queryable }) => {
        assert.equal(queryable, pool.client);
        throw auditError;
      }
    }),
    error => error === auditError
  );

  assert.deepEqual(pool.events.map(event => event.type === 'query' ? (event.statement.startsWith('INSERT INTO media_assets') ? 'INSERT INTO media_assets' : event.statement) : event.type), [
    'connect', 'BEGIN', 'INSERT INTO media_assets', 'ROLLBACK', 'release'
  ]);
  assert.deepEqual(await filesBelow(root), []);
});

test('local media upload compensates the newly-created file when pool connection acquisition fails', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-connect-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const connectError = new Error('postgres pool unavailable');
  const pool = createPool({ connectError });
  const store = createLocalMediaStore({ pool, root });

  await assert.rejects(
    store.upload({ siteId: SITE_ID, actorId: ACTOR_ID, dataBase64: DATA_BASE64, mimeType: 'image/png' }),
    error => error === connectError
  );
  assert.deepEqual(await filesBelow(root), []);
  assert.deepEqual(pool.events.map(event => event.type), ['connect']);
});

test('local media upload preserves the audit failure when object compensation throws synchronously', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-cleanup-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pool = createPool();
  const store = createLocalMediaStore({ pool, root });
  const auditError = new Error('original media audit failure');
  const nodeFs = require('node:fs');
  const originalUnlink = nodeFs.promises.unlink;

  try {
    nodeFs.promises.unlink = () => { throw new Error('simulated synchronous local cleanup failure'); };
    await assert.rejects(
      store.upload({
        siteId: SITE_ID,
        dataBase64: DATA_BASE64,
        mimeType: 'image/png',
        onAssetUploaded: async () => { throw auditError; }
      }),
      error => error === auditError
    );
  } finally {
    nodeFs.promises.unlink = originalUnlink;
  }
  assert.equal((await filesBelow(root)).length, 1, 'an undeleted object remains available to the orphan reconciler');
});

test('local media upload compensates after COMMIT failure and preserves the original failure', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-commit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const commitError = new Error('commit outcome unavailable');
  const pool = createPool({ commitError, rollbackError: new Error('rollback also failed') });
  const store = createLocalMediaStore({ pool, root });

  await assert.rejects(
    store.upload({ siteId: SITE_ID, actorId: ACTOR_ID, dataBase64: DATA_BASE64, mimeType: 'image/png' }),
    error => error === commitError
  );
  assert.deepEqual(await filesBelow(root), []);
  assert.deepEqual(pool.events.map(event => event.type === 'query' ? (event.statement.startsWith('INSERT INTO media_assets') ? 'INSERT INTO media_assets' : event.statement) : event.type), [
    'connect', 'BEGIN', 'INSERT INTO media_assets', 'COMMIT', 'ROLLBACK', 'release'
  ]);
});

test('local media upload remains backwards compatible when the audit callback is omitted', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-compat-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pool = createPool();
  const store = createLocalMediaStore({ pool, root });

  const asset = await store.upload({ siteId: SITE_ID, dataBase64: DATA_BASE64, mimeType: 'image/png' });
  assert.equal(asset.site_id, SITE_ID);
  assert.deepEqual(pool.events.map(event => event.type === 'query' ? (event.statement.startsWith('INSERT INTO media_assets') ? 'INSERT INTO media_assets' : event.statement) : event.type), [
    'connect', 'BEGIN', 'INSERT INTO media_assets', 'COMMIT', 'release'
  ]);
});

test('S3 media upload passes the same transaction queryable to its audit callback and preserves private object defaults', async () => {
  const pool = createPool();
  const s3 = createS3Harness();
  const store = createS3MediaStore({
    pool,
    client: s3.client,
    commands: s3.commands,
    env: { S3_BUCKET: 'virgoscorpio-hub-assets', S3_REGION: 'us-east-1' }
  });
  let callbackContext;

  const asset = await store.upload({
    siteId: SITE_ID,
    actorId: ACTOR_ID,
    dataBase64: DATA_BASE64,
    mimeType: 'image/png',
    isPublic: false,
    onAssetUploaded: async context => {
      callbackContext = context;
      assert.equal(context.queryable, pool.client);
      await context.queryable.query('INSERT INTO audit_events(site_id, actor_id, action) VALUES($1,$2,$3)', [SITE_ID, ACTOR_ID, 'media.uploaded']);
    }
  });

  assert.equal(callbackContext.result.id, asset.id);
  assert.equal(asset.publicly_accessible, false);
  assert.equal(s3.events[0].command, 'PutObjectCommand');
  assert.equal(s3.events[0].input.CacheControl, 'private, no-store');
  assert.equal(s3.events[0].input.ContentType, 'image/png');
  assert.equal(s3.events.length, 1, 'a successful transaction must not delete the object');
  assert.deepEqual(pool.events.map(event => event.type === 'query' ? (event.statement.startsWith('INSERT INTO media_assets') ? 'INSERT INTO media_assets' : event.statement) : event.type), [
    'connect', 'BEGIN', 'INSERT INTO media_assets',
    'INSERT INTO audit_events(site_id, actor_id, action) VALUES($1,$2,$3)', 'COMMIT', 'release'
  ]);
});

test('S3 media upload attempts object cleanup when PutObject returns an ambiguous transport failure', async () => {
  const pool = createPool();
  const putError = new Error('provider connection lost after upload request');
  const s3 = createS3Harness({ putError });
  const store = createS3MediaStore({
    pool,
    client: s3.client,
    commands: s3.commands,
    env: { S3_BUCKET: 'virgoscorpio-hub-assets' }
  });

  await assert.rejects(
    store.upload({ siteId: SITE_ID, dataBase64: DATA_BASE64, mimeType: 'image/png' }),
    error => error === putError
  );
  assert.deepEqual(s3.events.map(event => event.command), ['PutObjectCommand', 'DeleteObjectCommand']);
  assert.equal(s3.events[1].input.Key, s3.events[0].input.Key);
  assert.deepEqual(pool.events, [], 'database transaction must not start when the provider upload rejects');
});

test('S3 media upload compensates the object after audit failure without masking the audit error', async () => {
  const pool = createPool({ rollbackError: new Error('rollback failed') });
  const s3 = createS3Harness({ failDelete: true });
  const store = createS3MediaStore({
    pool,
    client: s3.client,
    commands: s3.commands,
    env: { S3_BUCKET: 'virgoscorpio-hub-assets' }
  });
  const auditError = new Error('simulated S3 media audit failure');

  await assert.rejects(
    store.upload({
      siteId: SITE_ID,
      dataBase64: DATA_BASE64,
      mimeType: 'image/png',
      onAssetUploaded: async () => { throw auditError; }
    }),
    error => error === auditError
  );
  assert.deepEqual(s3.events.map(event => event.command), ['PutObjectCommand', 'DeleteObjectCommand']);
  assert.equal(s3.events[1].input.Key, s3.events[0].input.Key);
  assert.deepEqual(pool.events.map(event => event.type === 'query' ? (event.statement.startsWith('INSERT INTO media_assets') ? 'INSERT INTO media_assets' : event.statement) : event.type), [
    'connect', 'BEGIN', 'INSERT INTO media_assets', 'ROLLBACK', 'release'
  ]);
});

test('S3 media upload compensates the object when PostgreSQL connection acquisition fails', async () => {
  const connectError = new Error('postgres pool unavailable');
  const pool = createPool({ connectError });
  const s3 = createS3Harness();
  const store = createS3MediaStore({
    pool,
    client: s3.client,
    commands: s3.commands,
    env: { S3_BUCKET: 'virgoscorpio-hub-assets' }
  });

  await assert.rejects(
    store.upload({ siteId: SITE_ID, dataBase64: DATA_BASE64, mimeType: 'image/png' }),
    error => error === connectError
  );
  assert.deepEqual(s3.events.map(event => event.command), ['PutObjectCommand', 'DeleteObjectCommand']);
  assert.equal(s3.events[1].input.Key, s3.events[0].input.Key);
  assert.deepEqual(pool.events.map(event => event.type), ['connect']);
});

test('media upload route writes media.uploaded through the store transaction before COMMIT', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-media-route-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pool = createPool();
  const mediaStore = createLocalMediaStore({ pool, root });
  const audits = [];
  const identityService = {
    async authenticate(token) {
      if (token !== 'media-session-token') return null;
      return {
        sessionId: 'media-session',
        user: { id: ACTOR_ID, email: 'media@example.test', displayName: 'Media Actor', status: 'active' },
        memberships: [{
          siteId: SITE_ID,
          siteSlug: 'media-site',
          siteName: 'Media Site',
          role: 'administrator',
          roles: ['administrator'],
          capabilities: ['media:manage']
        }]
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'media:manage';
    },
    async audit(event, { queryable } = {}) {
      audits.push({ event, queryable });
      await queryable.query('INSERT INTO audit_events(site_id, actor_id, action) VALUES($1,$2,$3)', [event.siteId, event.actorId, event.action]);
    }
  };
  const server = createApiServer({
    env: {
      NODE_ENV: 'test',
      AI_PROVIDER: 'mock',
      RATE_LIMIT_MAX_REQUESTS: '100',
      VIRGOSCORPIO_HUB_DEFAULT_SITE_ID: SITE_ID
    },
    identityService,
    mediaStore,
    logger: { error() {} }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/media/uploads`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer media-session-token',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ dataBase64: DATA_BASE64, mimeType: 'image/png', public: false, altText: 'route test' })
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.asset.site_id, SITE_ID);
    assert.equal(payload.asset.publicly_accessible, false);
    assert.equal(payload.url, `/media/${payload.asset.id}`);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].event.action, 'media.uploaded');
    assert.equal(audits[0].event.targetType, 'media');
    assert.equal(audits[0].event.targetId, payload.asset.id);
    assert.equal(audits[0].event.details.mimeType, 'image/png');
    assert.equal(audits[0].event.details.byteSize, PNG.length);
    assert.equal(audits[0].queryable, pool.client);
    const auditQueryIndex = pool.events.findIndex(event => event.type === 'query' && event.statement.startsWith('INSERT INTO audit_events'));
    const commitIndex = pool.events.findIndex(event => event.type === 'query' && event.statement === 'COMMIT');
    assert.ok(auditQueryIndex >= 0 && commitIndex > auditQueryIndex);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close();
  }
});
