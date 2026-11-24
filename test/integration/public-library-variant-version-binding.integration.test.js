'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createLibraryStore } = require('../../packages/library/src/file-store');

const enabled = Boolean(process.env.DATABASE_URL && process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true');
const cleanScanner = {
  engine: 'source-version-integration-fixture',
  async scan() { return { clean: true, status: 'clean', engine: this.engine }; },
};

async function seedTextAsset(store, siteId, name) {
  return store.upload({
    siteId, category: 'document', fileName: `${name}.txt`, displayName: name,
    dataBase64: Buffer.from(`${name}-source-v1`).toString('base64'),
    mimeType: 'text/plain', isPublic: false,
  });
}

async function variantRows(pool, assetId) {
  const result = await pool.query(
    'SELECT id,asset_id,variant_key,storage_key,mime_type,byte_size,sha256,source_version FROM media_variants WHERE asset_id=$1 ORDER BY variant_key',
    [assetId],
  );
  return result.rows;
}

test(
  'public library variants are bound to the current source version',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({ DATABASE_URL: process.env.DATABASE_URL, DATABASE_POOL_MAX: '8' });
    const siteResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`library-variant-version-${randomUUID().slice(0, 12)}`, 'Library Variant Version Integration'],
    );
    const siteId = siteResult.rows[0].id;
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio-hub-library-variant-version-'));
    const store = createLibraryStore({ pool, root, requireMalwareScan: true, malwareScanner: cleanScanner });
    t.after(async () => {
      await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
      await fs.rm(root, { recursive: true, force: true }).catch(() => {});
      await pool.end();
    });

    await t.test('replacement rollback retains referenced variants; commit invalidates old private derivatives', async () => {
      const asset = await seedTextAsset(store, siteId, 'private-library-version');
      const privateDerivative = Buffer.from('PRIVATE_DERIVATIVE_FROM_SOURCE_VERSION_1');
      const oldVariant = await store.createVariant({
        siteId, id: asset.id, variantKey: 'public-preview', data: privateDerivative,
        mimeType: 'text/plain', expectedVersion: 1,
      });
      const oldVariantPath = path.join(root, ...oldVariant.storage_key.split('/'));
      assert.deepEqual(await fs.readFile(oldVariantPath), privateDerivative);
      assert.equal(oldVariant.source_version, 1);
      assert.equal(await store.readPublicVariant({ assetId: asset.id, variantKey: 'public-preview' }), null);

      const replacementBytes = Buffer.from('PUBLIC_SOURCE_VERSION_2_WITH_DIFFERENT_CONTENT');
      const auditFailure = new Error('simulated version audit failure');
      await assert.rejects(store.replaceVersion({
        siteId, id: asset.id, expectedVersion: 1,
        dataBase64: replacementBytes.toString('base64'), mimeType: 'text/plain',
        fileName: 'replacement-v2.txt', onVersionReplaced() { throw auditFailure; },
      }), error => error === auditFailure);
      assert.equal((await store.get({ siteId, id: asset.id })).version, 1);
      assert.equal((await variantRows(pool, asset.id)).length, 1, 'variant row rolls back with the failed replacement');
      assert.deepEqual(await fs.readFile(oldVariantPath), privateDerivative, 'object remains while DB still references it');

      const replacement = await store.replaceVersion({
        siteId, id: asset.id, expectedVersion: 1,
        dataBase64: replacementBytes.toString('base64'), mimeType: 'text/plain',
        fileName: 'replacement-v2.txt',
      });
      assert.equal(replacement.version, 2);
      assert.deepEqual(await variantRows(pool, asset.id), [], 'committed replacement removes all derivative rows');
      await assert.rejects(fs.access(oldVariantPath), /ENOENT/, 'old derivative object is removed after commit');

      const published = await store.updateMetadata({ siteId, id: asset.id, expectedVersion: 2, patch: { isPublic: true } });
      assert.equal(published.version, 3);
      assert.equal(published.is_public, true);
      assert.equal(await store.readPublicVariant({ assetId: asset.id, variantKey: 'public-preview' }), null,
        'publishing the replacement cannot disclose the previous private derivative');
      await assert.rejects(store.createVariant({
        siteId, id: asset.id, variantKey: 'stale-preview', data: Buffer.from('STALE_DERIVATIVE'),
        mimeType: 'text/plain', expectedVersion: 2,
      }), error => error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT' && error.statusCode === 409);

      const currentDerivative = Buffer.from('DERIVATIVE_FROM_CURRENT_PUBLIC_SOURCE_VERSION_3');
      const currentVariant = await store.createVariant({
        siteId, id: asset.id, variantKey: 'public-preview', data: currentDerivative,
        mimeType: 'text/plain', expectedVersion: 3,
      });
      const publicRead = await store.readPublicVariant({ assetId: asset.id, variantKey: 'public-preview' });
      assert.equal(publicRead.id, currentVariant.id);
      assert.deepEqual(publicRead.data, currentDerivative);
      assert.equal(currentVariant.source_version, 3);

      // Legacy rows have no source_version after migration 0019. They are
      // intentionally excluded from public reads until regenerated.
      const legacyBytes = Buffer.from('LEGACY_UNBOUND_PRIVATE_DERIVATIVE');
      const legacyKey = [siteId, asset.id, 'variants', 'legacy-unbound-' + randomUUID() + '.txt'].join('/');
      const legacyPath = path.join(root, ...legacyKey.split('/'));
      await fs.mkdir(path.dirname(legacyPath), { recursive: true });
      await fs.writeFile(legacyPath, legacyBytes);
      const digest = require('node:crypto').createHash('sha256').update(legacyBytes).digest('hex');
      await pool.query(
        'INSERT INTO media_variants(asset_id,variant_key,storage_key,mime_type,byte_size,sha256,source_version) VALUES($1,$2,$3,$4,$5,$6,NULL)',
        [asset.id, 'legacy-unbound', legacyKey, 'text/plain', legacyBytes.length, digest],
      );
      assert.equal(await store.readPublicVariant({ assetId: asset.id, variantKey: 'legacy-unbound' }), null,
        'legacy variants without a source version remain non-public after the parent is public');
    });
    await t.test('metadata-only publication carries forward variants for the unchanged source bytes', async () => {
      const asset = await seedTextAsset(store, siteId, 'metadata-only-library-version');
      const derivative = Buffer.from('SAME_SOURCE_BYTES_DERIVATIVE');
      const variant = await store.createVariant({
        siteId, id: asset.id, variantKey: 'public-preview', data: derivative,
        mimeType: 'text/plain', expectedVersion: 1,
      });
      const updated = await store.updateMetadata({
        siteId, id: asset.id, expectedVersion: 1, patch: { isPublic: true },
      });
      assert.equal(updated.version, 2);
      const rows = await variantRows(pool, asset.id);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].source_version, 2, 'the metadata-only update advances the binding transactionally');
      const publicRead = await store.readPublicVariant({ assetId: asset.id, variantKey: 'public-preview' });
      assert.equal(publicRead.id, variant.id);
      assert.deepEqual(publicRead.data, derivative);
    });

    await t.test('replacement wins while derivative bytes are uploading; stale insertion is rejected and compensated', async () => {
      const asset = await seedTextAsset(store, siteId, 'racing-library-version');
      let uploadEnteredResolve;
      let releaseUploadResolve;
      const uploadEntered = new Promise(resolve => { uploadEnteredResolve = resolve; });
      const releaseUpload = new Promise(resolve => { releaseUploadResolve = resolve; });
      const objects = new Map();
      const storageAdapter = {
        async putObject({ key, body }) {
          objects.set(key, Buffer.from(body));
          if (key.includes('/variants/')) {
            uploadEnteredResolve(key);
            await releaseUpload;
          }
        },
        async getObject({ key }) { return objects.get(key) || null; },
        async deleteObject({ key }) { objects.delete(key); },
      };
      const racingStore = createLibraryStore({
        pool, storageAdapter, requireMalwareScan: true, malwareScanner: cleanScanner,
      });
      const pendingVariant = racingStore.createVariant({
        siteId, id: asset.id, variantKey: 'race-preview',
        data: Buffer.from('DERIVATIVE_READ_FROM_VERSION_1'),
        mimeType: 'text/plain', expectedVersion: 1,
      });
      const temporaryKey = await uploadEntered;
      try {
        const replacementBytes = Buffer.from('REPLACEMENT_SOURCE_VERSION_2');
        const replacement = await store.replaceVersion({
          siteId, id: asset.id, expectedVersion: 1,
          dataBase64: replacementBytes.toString('base64'), mimeType: 'text/plain',
          fileName: 'race-replacement-v2.txt',
        });
        assert.equal(replacement.version, 2);
      } finally {
        releaseUploadResolve();
      }
      await assert.rejects(pendingVariant,
        error => error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT' && error.statusCode === 409);
      assert.equal(objects.has(temporaryKey), false, 'unreferenced derivative object is compensated');
      assert.deepEqual(await variantRows(pool, asset.id), [], 'version-one derivative cannot be inserted after version two commits');
    });
  },
);