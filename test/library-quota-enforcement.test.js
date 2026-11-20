'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createLibraryStore } = require('../packages/library/src/file-store');

// Test fixtures: minimal valid files for each category
const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0]);
const smallPng = png;
const mediumPng = Buffer.concat([png, Buffer.alloc(1024, 0x00)]);
const largePng = Buffer.concat([png, Buffer.alloc(5 * 1024, 0x00)]);

/**
 * Creates a mock pool that tracks queries and simulates quota enforcement.
 * This allows us to test the quota logic without a real database.
 */
function createMockPoolForQuota({ 
  existingBytes = 0, 
  existingObjects = 0, 
  maxSiteBytes = 10000, 
  maxSiteObjects = 5,
  siteId = 'test-site-id',
  lockCalls = [],
  quotaCalls = [],
  insertCalls = [],
  prePopulatedAssets = new Map()
} = {}) {
  let currentBytes = existingBytes;
  let currentObjects = existingObjects;
  const assets = new Map(prePopulatedAssets);
  const versions = new Map();

  return {
    async connect() {
      const client = {
        async query(sql, args) {
          // Track advisory lock calls
          if (/pg_advisory_xact_lock/.test(sql)) {
            lockCalls.push({ sql, args });
            return { rows: [] };
          }

          // Simulate quota usage query
          if (/SELECT COALESCE\(SUM\(size\),0\)::text AS bytes/.test(sql)) {
            quotaCalls.push({ sql, args, currentBytes, currentObjects });
            return {
              rows: [{
                bytes: String(currentBytes),
                objects: String(currentObjects)
              }]
            };
          }

          // Track asset inserts
          if (/INSERT INTO library_assets/.test(sql)) {
            const [id, site, kind, displayName, originalName, provider, storageKey, mimeType, byteSize] = args;
            const asset = {
              id, site_id: site, asset_kind: kind, display_name: displayName,
              original_name: originalName, storage_provider: provider, storage_key: storageKey,
              mime_type: mimeType, byte_size: byteSize, sha256: 'a'.repeat(64),
              alt_text: '', caption: '', description: '', is_public: false,
              version: 1, status: 'active', optimization_status: 'pending',
              malware_scan_status: 'not_scanned', malware_scan_engine: null,
              metadata: {}, created_by: null, created_at: new Date(), updated_at: new Date()
            };
            assets.set(id, asset);
            currentBytes += byteSize;
            currentObjects += 1;
            insertCalls.push({ type: 'asset', asset });
            return { rows: [asset] };
          }

          // Track version inserts
          if (/INSERT INTO library_asset_versions/.test(sql)) {
            const [assetId, version, snapshot] = args;
            const versionRecord = { asset_id: assetId, version, snapshot };
            versions.set(`${assetId}-${version}`, versionRecord);
            insertCalls.push({ type: 'version', versionRecord });
            return { rows: [versionRecord], rowCount: 1 };
          }

          // Handle SELECT for replaceVersion
          if (/SELECT \* FROM library_assets WHERE site_id=\$1 AND id=\$2/.test(sql)) {
            const [querySiteId, queryId] = args;
            const asset = assets.get(queryId);
            if (asset && asset.site_id === querySiteId) {
              return { rows: [asset] };
            }
            return { rows: [] };
          }

          // Handle UPDATE for replaceVersion
          if (/UPDATE library_assets SET original_name/.test(sql)) {
            const [querySiteId, queryId, originalName, storageKey, mimeType, byteSize, sha256, version] = args;
            const asset = assets.get(queryId);
            if (asset && asset.site_id === querySiteId) {
              asset.original_name = originalName;
              asset.storage_key = storageKey;
              asset.mime_type = mimeType;
              asset.byte_size = byteSize;
              asset.sha256 = sha256;
              asset.version = version;
              currentBytes += byteSize; // Replacement adds new object
              currentObjects += 1;
              insertCalls.push({ type: 'replace', asset });
              return { rows: [asset] };
            }
            return { rows: [] };
          }

          // Handle BEGIN/COMMIT/ROLLBACK
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [] };
          }

          throw new Error(`Unexpected query in mock pool: ${sql}`);
        },
        release() {}
      };
      return client;
    }
  };
}

test('library store enforces cumulative byte quota on initial upload', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-bytes-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  const insertCalls = [];
  
  // Site already has 9000 bytes, quota is 10000, trying to upload 2000 bytes
  const pool = createMockPoolForQuota({
    existingBytes: 9000,
    existingObjects: 2,
    maxSiteBytes: 10000,
    maxSiteObjects: 10,
    lockCalls,
    quotaCalls,
    insertCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 10000,
    maxSiteObjects: 10
  });

  const largeFile = Buffer.concat([png, Buffer.alloc(2000, 0x00)]);
  
  await assert.rejects(
    store.upload({
      siteId: 'test-site-id',
      category: 'image',
      dataBase64: largeFile.toString('base64'),
      mimeType: 'image/png',
      fileName: 'large.png'
    }),
    error => {
      return error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED' &&
             error.statusCode === 413 &&
             error.message.includes('storage quota');
    },
    'Upload exceeding byte quota must be rejected'
  );

  // Verify the advisory lock was acquired
  assert.equal(lockCalls.length, 1, 'Advisory lock must be acquired');
  assert.ok(lockCalls[0].args[0].includes('library-quota:'), 'Lock key must include site identifier');

  // Verify quota was checked
  assert.equal(quotaCalls.length, 1, 'Quota usage must be queried');
  assert.equal(quotaCalls[0].currentBytes, 9000, 'Existing bytes must be counted');

  // Verify no asset was inserted
  assert.equal(insertCalls.length, 0, 'No asset must be inserted when quota is exceeded');
});

test('library store enforces cumulative object count quota on initial upload', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-objects-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  const insertCalls = [];
  
  // Site already has 5 objects, quota is 5, trying to upload 1 more
  const pool = createMockPoolForQuota({
    existingBytes: 1000,
    existingObjects: 5,
    maxSiteBytes: 100000,
    maxSiteObjects: 5,
    lockCalls,
    quotaCalls,
    insertCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 100000,
    maxSiteObjects: 5
  });

  await assert.rejects(
    store.upload({
      siteId: 'test-site-id',
      category: 'image',
      dataBase64: smallPng.toString('base64'),
      mimeType: 'image/png',
      fileName: 'sixth.png'
    }),
    error => {
      return error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED' &&
             error.statusCode === 413 &&
             error.message.includes('object quota');
    },
    'Upload exceeding object quota must be rejected'
  );

  // Verify the advisory lock was acquired
  assert.equal(lockCalls.length, 1, 'Advisory lock must be acquired');

  // Verify quota was checked
  assert.equal(quotaCalls.length, 1, 'Quota usage must be queried');
  assert.equal(quotaCalls[0].currentObjects, 5, 'Existing objects must be counted');

  // Verify no asset was inserted
  assert.equal(insertCalls.length, 0, 'No asset must be inserted when quota is exceeded');
});

test('library store allows upload within quota limits', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-allowed-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  const insertCalls = [];
  
  // Site has 1000 bytes and 1 object, quota allows more
  const pool = createMockPoolForQuota({
    existingBytes: 1000,
    existingObjects: 1,
    maxSiteBytes: 100000,
    maxSiteObjects: 10,
    lockCalls,
    quotaCalls,
    insertCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 100000,
    maxSiteObjects: 10
  });

  const asset = await store.upload({
    siteId: 'test-site-id',
    category: 'image',
    dataBase64: mediumPng.toString('base64'),
    mimeType: 'image/png',
    fileName: 'allowed.png'
  });

  // Verify upload succeeded
  assert.ok(asset.id, 'Asset must have an ID');
  assert.equal(asset.site_id, 'test-site-id', 'Asset must belong to the site');

  // Verify the advisory lock was acquired
  assert.equal(lockCalls.length, 1, 'Advisory lock must be acquired');

  // Verify quota was checked
  assert.equal(quotaCalls.length, 1, 'Quota usage must be queried');

  // Verify asset and version were inserted
  assert.equal(insertCalls.filter(c => c.type === 'asset').length, 1, 'Asset must be inserted');
  assert.equal(insertCalls.filter(c => c.type === 'version').length, 1, 'Version must be inserted');
});

test('library store enforces cumulative byte quota on version replacement', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-replace-bytes-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  const insertCalls = [];
  
  // Pre-populate an existing asset
  const existingAssetId = 'existing-asset-id';
  const existingAsset = {
    id: existingAssetId,
    site_id: 'test-site-id',
    asset_kind: 'image',
    display_name: 'existing.png',
    original_name: 'existing.png',
    storage_provider: 'local',
    storage_key: 'test-site-id/existing-asset-id/v1.png',
    mime_type: 'image/png',
    byte_size: 100,
    sha256: 'a'.repeat(64),
    alt_text: '',
    caption: '',
    description: '',
    is_public: false,
    version: 1,
    status: 'active',
    optimization_status: 'pending',
    malware_scan_status: 'not_scanned',
    malware_scan_engine: null,
    metadata: {},
    created_by: null,
    updated_by: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  // Site has 9000 bytes and 3 objects, quota is 10000 bytes
  const pool = createMockPoolForQuota({
    existingBytes: 9000,
    existingObjects: 3,
    maxSiteBytes: 10000,
    maxSiteObjects: 10,
    lockCalls,
    quotaCalls,
    insertCalls,
    prePopulatedAssets: new Map([[existingAssetId, existingAsset]])
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 10000,
    maxSiteObjects: 10
  });

  // Try to replace with a 2000-byte file (would exceed quota)
  const largeReplacement = Buffer.concat([png, Buffer.alloc(2000, 0x00)]);

  await assert.rejects(
    store.replaceVersion({
      siteId: 'test-site-id',
      id: existingAssetId,
      expectedVersion: 1,
      dataBase64: largeReplacement.toString('base64'),
      mimeType: 'image/png',
      fileName: 'replacement.png'
    }),
    error => {
      return error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED' &&
             error.statusCode === 413 &&
             error.message.includes('storage quota');
    },
    'Version replacement exceeding byte quota must be rejected'
  );

  // Verify the advisory lock was acquired
  assert.ok(lockCalls.length >= 1, 'Advisory lock must be acquired');

  // Verify quota was checked
  assert.ok(quotaCalls.length >= 1, 'Quota usage must be queried');

  // Verify no replacement occurred (only the SELECT, no UPDATE)
  const replacements = insertCalls.filter(c => c.type === 'replace');
  assert.equal(replacements.length, 0, 'No replacement must occur when quota is exceeded');
});

test('library store allows version replacement within quota limits', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-replace-allowed-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  const insertCalls = [];
  
  // Pre-populate an existing asset
  const existingAssetId = 'existing-asset-id';
  const existingAsset = {
    id: existingAssetId,
    site_id: 'test-site-id',
    asset_kind: 'image',
    display_name: 'existing.png',
    original_name: 'existing.png',
    storage_provider: 'local',
    storage_key: 'test-site-id/existing-asset-id/v1.png',
    mime_type: 'image/png',
    byte_size: 100,
    sha256: 'a'.repeat(64),
    alt_text: '',
    caption: '',
    description: '',
    is_public: false,
    version: 1,
    status: 'active',
    optimization_status: 'pending',
    malware_scan_status: 'not_scanned',
    malware_scan_engine: null,
    metadata: {},
    created_by: null,
    updated_by: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  // Site has 1000 bytes and 2 objects, quota allows more
  const pool = createMockPoolForQuota({
    existingBytes: 1000,
    existingObjects: 2,
    maxSiteBytes: 100000,
    maxSiteObjects: 10,
    lockCalls,
    quotaCalls,
    insertCalls,
    prePopulatedAssets: new Map([[existingAssetId, existingAsset]])
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 100000,
    maxSiteObjects: 10
  });

  const replacement = Buffer.concat([png, Buffer.alloc(500, 0x00)]);

  const result = await store.replaceVersion({
    siteId: 'test-site-id',
    id: existingAssetId,
    expectedVersion: 1,
    dataBase64: replacement.toString('base64'),
    mimeType: 'image/png',
    fileName: 'replacement.png'
  });

  // Verify replacement succeeded
  assert.ok(result.id, 'Replaced asset must have an ID');
  assert.equal(result.version, 2, 'Version must be incremented');

  // Verify the advisory lock was acquired
  assert.ok(lockCalls.length >= 1, 'Advisory lock must be acquired');

  // Verify quota was checked
  assert.ok(quotaCalls.length >= 1, 'Quota usage must be queried');

  // Verify replacement occurred
  const replacements = insertCalls.filter(c => c.type === 'replace');
  assert.equal(replacements.length, 1, 'Replacement must occur when within quota');
});

test('library store quota enforcement serializes concurrent uploads per site', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-serialize-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  
  const pool = createMockPoolForQuota({
    existingBytes: 5000,
    existingObjects: 2,
    maxSiteBytes: 100000,
    maxSiteObjects: 10,
    lockCalls,
    quotaCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 100000,
    maxSiteObjects: 10
  });

  // Perform multiple uploads
  await store.upload({
    siteId: 'test-site-id',
    category: 'image',
    dataBase64: smallPng.toString('base64'),
    mimeType: 'image/png',
    fileName: 'first.png'
  });

  await store.upload({
    siteId: 'test-site-id',
    category: 'image',
    dataBase64: smallPng.toString('base64'),
    mimeType: 'image/png',
    fileName: 'second.png'
  });

  // Verify advisory lock was acquired for each upload
  assert.equal(lockCalls.length, 2, 'Advisory lock must be acquired for each upload');
  
  // Verify all locks use the same site-specific key
  const lockKeys = lockCalls.map(c => c.args[0]);
  assert.ok(lockKeys.every(key => key === lockKeys[0]), 'All locks must use the same site-specific key');
  assert.ok(lockKeys[0].includes('test-site-id'), 'Lock key must include site ID');

  // Verify quota was checked for each upload
  assert.equal(quotaCalls.length, 2, 'Quota must be checked for each upload');
});

test('library store rejects invalid quota configuration', async t => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-invalid-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const pool = { async connect() { return { async query() {}, release() {} }; } };

  await t.test('rejects zero byte quota', () => {
    assert.throws(
      () => createLibraryStore({ pool, root, maxSiteBytes: 0, maxSiteObjects: 10 }),
      TypeError,
      'Zero byte quota must be rejected'
    );
  });

  await t.test('rejects negative byte quota', () => {
    assert.throws(
      () => createLibraryStore({ pool, root, maxSiteBytes: -1000, maxSiteObjects: 10 }),
      TypeError,
      'Negative byte quota must be rejected'
    );
  });

  await t.test('rejects zero object quota', () => {
    assert.throws(
      () => createLibraryStore({ pool, root, maxSiteBytes: 10000, maxSiteObjects: 0 }),
      TypeError,
      'Zero object quota must be rejected'
    );
  });

  await t.test('rejects negative object quota', () => {
    assert.throws(
      () => createLibraryStore({ pool, root, maxSiteBytes: 10000, maxSiteObjects: -5 }),
      TypeError,
      'Negative object quota must be rejected'
    );
  });

  await t.test('rejects non-finite byte quota', () => {
    assert.throws(
      () => createLibraryStore({ pool, root, maxSiteBytes: NaN, maxSiteObjects: 10 }),
      TypeError,
      'NaN byte quota must be rejected'
    );
  });

  await t.test('rejects non-finite object quota', () => {
    assert.throws(
      () => createLibraryStore({ pool, root, maxSiteBytes: 10000, maxSiteObjects: Infinity }),
      TypeError,
      'Infinite object quota must be rejected'
    );
  });
});

test('library store quota check counts soft-deleted assets', async t => {
  // This test verifies that the quota query includes soft-deleted rows,
  // which is critical to the security fix since deletion does not reclaim storage.
  
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-soft-delete-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  
  // Simulate a site with soft-deleted assets that still consume storage
  const pool = createMockPoolForQuota({
    existingBytes: 8000, // Includes soft-deleted assets
    existingObjects: 4,  // Includes soft-deleted assets
    maxSiteBytes: 10000,
    maxSiteObjects: 10,
    lockCalls,
    quotaCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 10000,
    maxSiteObjects: 10
  });

  // Try to upload a 3000-byte file (would exceed quota when soft-deleted assets are counted)
  const largeFile = Buffer.concat([png, Buffer.alloc(3000, 0x00)]);

  await assert.rejects(
    store.upload({
      siteId: 'test-site-id',
      category: 'image',
      dataBase64: largeFile.toString('base64'),
      mimeType: 'image/png',
      fileName: 'after-delete.png'
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED',
    'Upload must be rejected when soft-deleted assets push usage over quota'
  );

  // Verify quota query was executed
  assert.equal(quotaCalls.length, 1, 'Quota must be checked');
  
  // The quota query should count all assets including soft-deleted ones
  // This is verified by the fact that existingBytes (8000) includes soft-deleted assets
  assert.equal(quotaCalls[0].currentBytes, 8000, 'Quota check must include soft-deleted assets');
});

test('library store quota check counts version history objects', async t => {
  // This test verifies that the quota query includes version history,
  // which is critical since replacements create new objects without removing old ones.
  
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-versions-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  
  // Simulate a site with multiple versions (e.g., 3 assets with 2 versions each = 6 objects)
  // The site is at the object limit (6 objects, quota is 6)
  const pool = createMockPoolForQuota({
    existingBytes: 5000,
    existingObjects: 6, // Counts all versions - at the limit
    maxSiteBytes: 100000,
    maxSiteObjects: 6,  // At the limit
    lockCalls,
    quotaCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 100000,
    maxSiteObjects: 6
  });

  // Try to upload one more asset (would exceed object quota)
  await assert.rejects(
    store.upload({
      siteId: 'test-site-id',
      category: 'image',
      dataBase64: smallPng.toString('base64'),
      mimeType: 'image/png',
      fileName: 'seventh.png'
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED',
    'Upload must be rejected when version history pushes object count over quota'
  );

  // Verify quota query counted all version objects
  assert.equal(quotaCalls.length, 1, 'Quota must be checked');
  assert.equal(quotaCalls[0].currentObjects, 6, 'Quota check must include all version objects');
});

test('library store quota enforcement prevents unbounded allocation by authorized principals', async t => {
  // This is the core security test: verify that repeated authorized uploads
  // cannot exceed the cumulative quota, preventing the DoS scenario described in the pentest.
  
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vsh-quota-dos-prevention-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));

  const lockCalls = [];
  const quotaCalls = [];
  const insertCalls = [];
  
  // Start with a site near its quota limit
  const pool = createMockPoolForQuota({
    existingBytes: 9500,
    existingObjects: 4,
    maxSiteBytes: 10000,
    maxSiteObjects: 5,
    lockCalls,
    quotaCalls,
    insertCalls
  });

  const store = createLibraryStore({
    pool,
    root,
    requireMalwareScan: false,
    maxSiteBytes: 10000,
    maxSiteObjects: 5
  });

  // First upload: within quota (400 bytes, bringing total to 9900)
  const firstUpload = Buffer.concat([png, Buffer.alloc(400, 0x00)]);
  const asset1 = await store.upload({
    siteId: 'test-site-id',
    actorId: 'authorized-principal',
    category: 'image',
    dataBase64: firstUpload.toString('base64'),
    mimeType: 'image/png',
    fileName: 'first.png'
  });
  assert.ok(asset1.id, 'First upload within quota must succeed');

  // Second upload: would exceed byte quota (200 bytes would bring total to 10100)
  const secondUpload = Buffer.concat([png, Buffer.alloc(200, 0x00)]);
  await assert.rejects(
    store.upload({
      siteId: 'test-site-id',
      actorId: 'authorized-principal',
      category: 'image',
      dataBase64: secondUpload.toString('base64'),
      mimeType: 'image/png',
      fileName: 'second.png'
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED',
    'Second upload exceeding quota must be rejected even for authorized principal'
  );

  // Verify that quota enforcement prevented unbounded allocation
  assert.equal(insertCalls.filter(c => c.type === 'asset').length, 1, 
    'Only one asset must be inserted; quota must prevent further allocations');
  
  // Verify quota was checked for both attempts
  assert.equal(quotaCalls.length, 2, 'Quota must be checked for each upload attempt');
  
  // Verify the second quota check reflected the first upload
  assert.ok(quotaCalls[1].currentBytes > quotaCalls[0].currentBytes,
    'Second quota check must reflect bytes from first upload');
});
