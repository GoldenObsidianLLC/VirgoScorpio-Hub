'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createLibraryStore } = require('../../packages/library/src/file-store');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

async function createFixture(t, { maxSiteBytes, maxSiteObjects, onPutObject = null }) {
  const pool = createPostgresPool({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_MAX: '8',
  });
  const objects = new Map();
  let siteId = null;
  t.after(async () => {
    if (siteId) await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
    await pool.end();
    objects.clear();
  });

  const site = await pool.query(
    'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
    ['library-quota-' + randomUUID().slice(0, 12), 'Library Quota Integration']
  );
  siteId = site.rows[0].id;

  const storageAdapter = {
    async putObject({ key, body }) {
      if (typeof onPutObject === 'function') await onPutObject({ key, body });
      if (objects.has(key)) throw new Error('Storage key already exists: ' + key);
      objects.set(key, Buffer.from(body));
    },
    async getObject({ key }) {
      const value = objects.get(key);
      return value ? Buffer.from(value) : null;
    },
    async deleteObject({ key }) {
      objects.delete(key);
    },
  };
  const malwareScanner = {
    engine: 'quota-integration-fixture',
    async scan() { return { clean: true, status: 'clean', engine: 'quota-integration-fixture' }; },
  };
  const store = createLibraryStore({
    pool,
    maxFileBytes: 1024,
    maxSiteBytes,
    maxSiteObjects,
    storageAdapter,
    malwareScanner,
    requireMalwareScan: true,
  });
  return { pool, siteId, store, objects };
}

function uploadArgs(siteId, fileName) {
  return {
    siteId,
    category: 'image',
    dataBase64: png.toString('base64'),
    mimeType: 'image/png',
    fileName,
    isPublic: true,
  };
}

test(
  'library quota serializes simultaneous uploads and rejects the losing allocation before storage write',
  { skip: !enabled },
  async t => {
    const { siteId, store, objects } = await createFixture(t, { maxSiteBytes: 1024, maxSiteObjects: 1 });
    const outcomes = await Promise.allSettled([
      store.upload(uploadArgs(siteId, 'concurrent-a.png')),
      store.upload(uploadArgs(siteId, 'concurrent-b.png')),
    ]);
    const succeeded = outcomes.filter(result => result.status === 'fulfilled');
    const rejected = outcomes.filter(result => result.status === 'rejected');
    assert.equal(succeeded.length, 1, 'one concurrent upload must acquire the final object slot');
    assert.equal(rejected.length, 1, 'the competing upload must observe the committed quota usage');
    assert.equal(rejected[0].reason.code, 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED');
    assert.equal(rejected[0].reason.statusCode, 413);
    assert.equal(objects.size, 1, 'rejected allocation must not create a storage object');
  }
);

test(
  'a slow derivative write does not hold the site quota lock or block a source replacement',
  { skip: !enabled },
  async t => {
    let releaseVariantPut;
    let notifyVariantPutStarted;
    const variantPutGate = new Promise(resolve => { releaseVariantPut = resolve; });
    const variantPutStarted = new Promise(resolve => { notifyVariantPutStarted = resolve; });
    const { pool, siteId, store, objects } = await createFixture(t, {
      maxSiteBytes: png.length * 4,
      maxSiteObjects: 4,
      onPutObject: async ({ key }) => {
        if (key.includes('/variants/')) {
          notifyVariantPutStarted();
          await variantPutGate;
        }
      },
    });
    const asset = await store.upload(uploadArgs(siteId, 'race-source.png'));
    const variant = store.createVariant({
      siteId,
      id: asset.id,
      variantKey: 'slow-preview',
      data: png,
      mimeType: 'image/png',
      expectedVersion: 1,
    });
    const variantOutcome = variant.then(
      value => ({ value }),
      error => ({ error }),
    );
    let replacement;
    let startedTimeout;
    let timeout;
    try {
      await Promise.race([
        variantPutStarted,
        new Promise((_, reject) => {
          startedTimeout = setTimeout(() => reject(new Error('Derivative storage write did not start.')), 5000);
        }),
      ]);
      clearTimeout(startedTimeout);
      replacement = await Promise.race([
        store.replaceVersion({
          siteId,
          id: asset.id,
          expectedVersion: 1,
          dataBase64: png.toString('base64'),
          mimeType: 'image/png',
          fileName: 'race-replacement.png',
        }),
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Source replacement blocked behind derivative storage I/O.')), 5000);
        }),
      ]);
    } finally {
      clearTimeout(startedTimeout);
      clearTimeout(timeout);
      releaseVariantPut();
    }
    assert.equal(replacement.version, 2, 'source replacement must complete while derivative storage is paused');
    const outcome = await variantOutcome;
    assert.ok(outcome.error, 'the derivative must not publish after its source version changes');
    assert.equal(outcome.error.code, 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT');
    assert.equal(outcome.error.statusCode, 409);
    assert.equal(objects.size, 2, 'only the retained source history and current replacement should remain');
    const variants = await pool.query('SELECT id FROM media_variants WHERE asset_id=$1', [asset.id]);
    assert.equal(variants.rowCount, 0, 'the losing derivative must not leave a database reference');
    const reservations = await pool.query('SELECT id FROM library_storage_reservations WHERE site_id=$1', [siteId]);
    assert.equal(reservations.rowCount, 0, 'completed and rejected operations must consume or release their quota leases');
  }
);
test(
  'concurrent source replacements count the still-retained derivatives in both quota reservations',
  { skip: !enabled },
  async t => {
    let releaseFirstPut;
    let notifyFirstPut;
    let replacementPutCount = 0;
    const firstPutGate = new Promise(resolve => { releaseFirstPut = resolve; });
    const firstPutStarted = new Promise(resolve => { notifyFirstPut = resolve; });
    const { pool, siteId, store, objects } = await createFixture(t, {
      maxSiteBytes: png.length * 3,
      maxSiteObjects: 3,
      onPutObject: async ({ key }) => {
        if (/\/v[0-9]+-/.test(key)) {
          replacementPutCount += 1;
          if (replacementPutCount === 1) { notifyFirstPut(); await firstPutGate; }
        }
      },
    });
    const asset = await store.upload(uploadArgs(siteId, 'concurrent-source.png'));
    const variant = await store.createVariant({
      siteId, id: asset.id, variantKey: 'retained-preview', data: png, mimeType: 'image/png', expectedVersion: 1,
    });
    const first = store.replaceVersion({
      siteId, id: asset.id, expectedVersion: 1, dataBase64: png.toString('base64'),
      mimeType: 'image/png', fileName: 'first-replacement.png',
    });
    const firstOutcome = first.then(value => ({ value }), error => ({ error }));
    let timeout;
    try {
      await Promise.race([firstPutStarted, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('First replacement did not reach object storage.')), 5000);
      })]);
      clearTimeout(timeout);
      await assert.rejects(
        store.replaceVersion({
          siteId, id: asset.id, expectedVersion: 1, dataBase64: png.toString('base64'),
          mimeType: 'image/png', fileName: 'second-replacement.png',
        }),
        error => error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED' && error.statusCode === 413,
        'the second pending replacement must count the first lease and every still-retained derivative'
      );
    } finally {
      clearTimeout(timeout);
      releaseFirstPut();
    }
    const result = await firstOutcome;
    assert.equal(result.value?.version, 2, result.error?.message || 'the first replacement should commit');
    assert.equal(objects.has(variant.storage_key), false, 'the derivative remains retained until the winning source replacement commits');
    const reservations = await pool.query('SELECT id FROM library_storage_reservations WHERE site_id=$1', [siteId]);
    assert.equal(reservations.rowCount, 0, 'the successful lease is consumed and the rejected lease is never persisted');
  }
);
test(
  'library quota counts history and derivatives, carries valid variants across metadata versions, and releases replaced derivatives',
  { skip: !enabled },
  async t => {
    const { pool, siteId, store, objects } = await createFixture(t, { maxSiteBytes: png.length * 3, maxSiteObjects: 3 });
    const asset = await store.upload(uploadArgs(siteId, 'source.png'));
    const variant = await store.createVariant({
      siteId,
      id: asset.id,
      variantKey: 'preview',
      data: png,
      mimeType: 'image/png',
      expectedVersion: 1,
    });
    assert.ok(objects.has(variant.storage_key), 'derivative bytes must be persisted');

    const updated = await store.updateMetadata({
      siteId,
      id: asset.id,
      expectedVersion: 1,
      patch: { caption: 'Metadata-only version update' },
    });
    assert.equal(updated.version, 2);
    const readableVariant = await store.readPublicVariant({ assetId: asset.id, variantKey: 'preview' });
    assert.ok(readableVariant, 'a still-current derivative should remain readable after metadata-only versioning');
    assert.equal(Number(readableVariant.source_version), 2, 'metadata-only update must carry the variant binding forward');
    assert.deepEqual(readableVariant.data, png);


    const replacement = await store.replaceVersion({
      siteId,
      id: asset.id,
      expectedVersion: 2,
      dataBase64: png.toString('base64'),
      mimeType: 'image/png',
      fileName: 'replacement.png',
    });
    assert.equal(replacement.version, 3);
    assert.equal(objects.has(variant.storage_key), false, 'stale derivative bytes must be removed after the replacement commits');
    assert.equal(await store.readPublicVariant({ assetId: asset.id, variantKey: 'preview' }), null);
    const variants = await pool.query('SELECT id FROM media_variants WHERE asset_id=$1', [asset.id]);
    assert.equal(variants.rowCount, 0, 'source replacement must remove stale derivative references transactionally');
    const replacementVariant = await store.createVariant({ siteId, id: asset.id, variantKey: 'replacement-preview', data: png, mimeType: 'image/png', expectedVersion: 3 });
    assert.ok(objects.has(replacementVariant.storage_key));
    await assert.rejects(
      store.createVariant({ siteId, id: asset.id, variantKey: 'overflow-preview', data: png, mimeType: 'image/png', expectedVersion: 3 }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED' && error.statusCode === 413,
      'retained history, current source, and current derivative must all consume quota'
    );

    const history = await store.history({ siteId, id: asset.id });
    assert.equal(history.length, 3);
    assert.deepEqual(history.map(row => Number(row.snapshot.byteSize)), [png.length, png.length, png.length]);
  }
);
