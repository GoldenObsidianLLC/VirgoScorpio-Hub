'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');

/**
 * Security test suite: Variant version binding prevents stale derivative disclosure
 *
 * Pentest finding: Public variant delivery exposes stale bytes from a previously private asset version
 *
 * Root cause: Variant rows had no source-version binding. After replacing a private asset and
 * publishing it, unauthenticated users could retrieve derivatives generated from the earlier
 * private version because readPublicVariant only checked current asset visibility.
 *
 * Mitigation:
 * 1. replaceVersion now deletes all existing variants before committing the new version
 * 2. createVariant requires expectedVersion and validates it matches current asset.version
 * 3. createVariant uses FOR SHARE lock to serialize against concurrent replaceVersion
 * 4. Optimization flow passes expectedVersion from the read asset to createVariant
 *
 * These tests verify that stale variants cannot be created or served after version replacement.
 */

// Mock pool that simulates the database behavior
function createMockPool() {
  const assets = new Map();
  const variants = new Map();
  const transactions = new Map();

  return {
    assets,
    variants,
    transactions,
    async query(sql, params) {
      // Simulate SELECT for asset lookup in createVariant
      if (sql.includes('SELECT id,asset_kind,version FROM library_assets')) {
        const [siteId, assetId] = params;
        const asset = assets.get(assetId);
        if (!asset || asset.site_id !== siteId || asset.deleted_at || asset.status !== 'active') {
          return { rows: [] };
        }
        return { rows: [{ id: asset.id, asset_kind: asset.asset_kind, version: asset.version }] };
      }

      // Simulate INSERT variant with version check and FOR SHARE
      if (sql.includes('INSERT INTO media_variants') && sql.includes('FOR SHARE')) {
        const [assetId, variantKey, storageKey, mimeType, byteSize, width, height, sha256, siteId, expectedVersion] = params;
        const asset = assets.get(assetId);
        
        // FOR SHARE would fail if asset doesn't exist or version mismatch
        if (!asset || asset.site_id !== siteId || asset.version !== expectedVersion || asset.deleted_at || asset.status !== 'active') {
          return { rows: [] }; // Version conflict - no row inserted
        }

        // Check for conflict on (asset_id, variant_key)
        const existingKey = `${assetId}:${variantKey}`;
        const existing = variants.get(existingKey);
        
        const variant = {
          id: randomUUID(),
          asset_id: assetId,
          variant_key: variantKey,
          storage_key: storageKey,
          mime_type: mimeType,
          byte_size: byteSize,
          width,
          height,
          sha256,
          created_at: new Date().toISOString()
        };

        variants.set(existingKey, variant);
        return { rows: [variant] };
      }

      // Simulate DELETE variants during replaceVersion
      if (sql.includes('DELETE FROM media_variants WHERE asset_id=$1')) {
        const [assetId] = params;
        const deleted = [];
        for (const [key, variant] of variants.entries()) {
          if (variant.asset_id === assetId) {
            deleted.push({ storage_key: variant.storage_key });
            variants.delete(key);
          }
        }
        return { rows: deleted };
      }

      // Simulate readPublicVariant query
      if (sql.includes('SELECT v.id,v.storage_key,v.mime_type') && sql.includes('JOIN library_assets a')) {
        const [assetId, variantKey] = params;
        const asset = assets.get(assetId);
        if (!asset || !asset.is_public || asset.status !== 'active' || asset.deleted_at) {
          return { rows: [] };
        }
        const variantEntry = variants.get(`${assetId}:${variantKey}`);
        if (!variantEntry) {
          return { rows: [] };
        }
        return {
          rows: [{
            id: variantEntry.id,
            storage_key: variantEntry.storage_key,
            mime_type: variantEntry.mime_type,
            byte_size: variantEntry.byte_size,
            sha256: variantEntry.sha256,
            asset_kind: asset.asset_kind
          }]
        };
      }

      return { rows: [] };
    },
    async connect() {
      const txId = randomUUID();
      const txAssets = new Map(assets);
      const txVariants = new Map(variants);
      transactions.set(txId, { assets: txAssets, variants: txVariants, committed: false });

      return {
        async query(sql, params) {
          const tx = transactions.get(txId);
          if (!tx) throw new Error('Transaction not found');

          // Handle FOR UPDATE in replaceVersion
          if (sql.includes('FOR UPDATE')) {
            const [siteId, assetId] = params;
            const asset = tx.assets.get(assetId);
            if (!asset || asset.site_id !== siteId || asset.deleted_at || asset.status !== 'active') {
              return { rows: [] };
            }
            return { rows: [asset] };
          }

          // Handle UPDATE in replaceVersion
          if (sql.includes('UPDATE library_assets SET') && sql.includes('version=$8')) {
            const [siteId, assetId, originalName, storageKey, mimeType, byteSize, sha256, nextVersion, actorId, oldVersion] = params;
            const asset = tx.assets.get(assetId);
            if (!asset || asset.version !== oldVersion) {
              return { rows: [] }; // Version conflict
            }
            asset.version = nextVersion;
            asset.storage_key = storageKey;
            asset.mime_type = mimeType;
            asset.byte_size = byteSize;
            asset.sha256 = sha256;
            asset.original_name = originalName;
            asset.optimization_status = 'pending';
            asset.updated_at = new Date().toISOString();
            return { rows: [asset] };
          }

          // Handle DELETE variants in transaction
          if (sql.includes('DELETE FROM media_variants WHERE asset_id=$1')) {
            const [assetId] = params;
            const deleted = [];
            for (const [key, variant] of tx.variants.entries()) {
              if (variant.asset_id === assetId) {
                deleted.push({ storage_key: variant.storage_key });
                tx.variants.delete(key);
              }
            }
            return { rows: deleted };
          }

          if (sql === 'BEGIN') return { rows: [] };
          if (sql === 'COMMIT') {
            tx.committed = true;
            // Apply transaction changes to main state
            assets.clear();
            for (const [k, v] of tx.assets) assets.set(k, v);
            variants.clear();
            for (const [k, v] of tx.variants) variants.set(k, v);
            return { rows: [] };
          }
          if (sql === 'ROLLBACK') {
            transactions.delete(txId);
            return { rows: [] };
          }

          return { rows: [] };
        },
        release() {
          transactions.delete(txId);
        }
      };
    }
  };
}

// Mock storage adapter
function createMockStorage() {
  const objects = new Map();
  return {
    objects,
    async putObject({ key, body }) {
      objects.set(key, Buffer.from(body));
    },
    async getObject({ key }) {
      return objects.get(key) || null;
    },
    async deleteObject({ key }) {
      objects.delete(key);
    }
  };
}

// Create a minimal PNG buffer for testing
function createTestPNG() {
  return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
}

// Create a minimal WebP buffer for testing
function createTestWebP() {
  return Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ');
}

test('createVariant rejects stale expectedVersion after asset replacement', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  
  // Setup: Create an asset at version 1
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 1,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v1.png`,
    is_public: false,
    status: 'active',
    deleted_at: null
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  // Simulate: Asset is replaced, version increments to 2
  pool.assets.get(assetId).version = 2;
  pool.assets.get(assetId).storage_key = `${siteId}/${assetId}/v2.png`;

  // Attack: Try to create a variant with stale expectedVersion=1
  const variantData = createTestWebP();
  
  await assert.rejects(
    store.createVariant({
      siteId,
      id: assetId,
      variantKey: 'webp-optimized',
      data: variantData,
      mimeType: 'image/webp',
      expectedVersion: 1 // Stale version
    }),
    error => {
      return error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT' &&
             error.statusCode === 409 &&
             error.message.includes('Asset version is stale');
    },
    'createVariant must reject stale expectedVersion with version conflict error'
  );

  // Verify: No variant was created
  assert.equal(pool.variants.size, 0, 'No variant should be created with stale version');
  assert.equal(storage.objects.size, 0, 'No storage object should be created with stale version');
});

test('createVariant succeeds only when expectedVersion matches current asset version', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  
  // Setup: Create an asset at version 3
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 3,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v3.png`,
    is_public: false,
    status: 'active',
    deleted_at: null
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  const variantData = createTestWebP();
  
  // Success case: expectedVersion matches current version
  const variant = await store.createVariant({
    siteId,
    id: assetId,
    variantKey: 'webp-optimized',
    data: variantData,
    mimeType: 'image/webp',
    expectedVersion: 3 // Matches current version
  });

  assert.ok(variant.id, 'Variant should have an ID');
  assert.equal(variant.asset_id, assetId, 'Variant should reference the asset');
  assert.equal(variant.variant_key, 'webp-optimized', 'Variant key should match');
  assert.equal(pool.variants.size, 1, 'Variant should be created');
  assert.ok(storage.objects.size > 0, 'Storage object should be created');
});

test('replaceVersion deletes all existing variants before committing new version', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  const actorId = randomUUID();
  
  // Setup: Create an asset at version 1 with existing variants
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 1,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v1.png`,
    display_name: 'Test Image',
    original_name: 'test.png',
    alt_text: '',
    caption: '',
    description: '',
    is_public: false,
    status: 'active',
    deleted_at: null,
    metadata: {},
    updated_by: actorId
  });

  // Add existing variants from version 1
  const variant1Key = `${assetId}:webp-optimized`;
  const variant2Key = `${assetId}:thumbnail`;
  pool.variants.set(variant1Key, {
    id: randomUUID(),
    asset_id: assetId,
    variant_key: 'webp-optimized',
    storage_key: `${siteId}/${assetId}/variants/webp-optimized-old.webp`,
    mime_type: 'image/webp',
    byte_size: 100,
    sha256: 'a'.repeat(64)
  });
  pool.variants.set(variant2Key, {
    id: randomUUID(),
    asset_id: assetId,
    variant_key: 'thumbnail',
    storage_key: `${siteId}/${assetId}/variants/thumbnail-old.png`,
    mime_type: 'image/png',
    byte_size: 50,
    sha256: 'b'.repeat(64)
  });

  // Put variant objects in storage
  storage.objects.set(`${siteId}/${assetId}/variants/webp-optimized-old.webp`, Buffer.from('old-webp'));
  storage.objects.set(`${siteId}/${assetId}/variants/thumbnail-old.png`, Buffer.from('old-thumb'));

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  assert.equal(pool.variants.size, 2, 'Should start with 2 variants');

  // Action: Replace the asset version
  const newPNG = createTestPNG();
  const newDataBase64 = newPNG.toString('base64');
  
  const replaced = await store.replaceVersion({
    siteId,
    id: assetId,
    actorId,
    expectedVersion: 1,
    dataBase64: newDataBase64,
    mimeType: 'image/png',
    fileName: 'test-v2.png'
  });

  // Verify: All variants were deleted
  assert.equal(pool.variants.size, 0, 'All variants must be deleted after version replacement');
  assert.equal(replaced.version, 2, 'Asset version should be incremented');
  assert.equal(replaced.optimization_status, 'pending', 'Optimization status should be reset to pending');
  
  // Verify: Variant storage objects were cleaned up
  assert.equal(storage.objects.has(`${siteId}/${assetId}/variants/webp-optimized-old.webp`), false, 
    'Old variant storage should be deleted');
  assert.equal(storage.objects.has(`${siteId}/${assetId}/variants/thumbnail-old.png`), false,
    'Old variant storage should be deleted');
});

test('optimization flow passes expectedVersion to createVariant preventing stale variant creation', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  
  // Setup: Asset at version 2
  const assetVersion = 2;
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: assetVersion,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v${assetVersion}.png`,
    is_public: false,
    status: 'active',
    deleted_at: null
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  // Simulate optimization workflow:
  // 1. Read asset (gets version 2)
  const asset = pool.assets.get(assetId);
  const readVersion = asset.version;
  
  // 2. Perform optimization (external to store)
  const optimizedData = createTestWebP();
  
  // 3. Create variant with the version we read
  const variant = await store.createVariant({
    siteId,
    id: assetId,
    variantKey: 'webp-optimized',
    data: optimizedData,
    mimeType: 'image/webp',
    expectedVersion: readVersion // Pass the version from the read
  });

  assert.ok(variant.id, 'Variant should be created successfully');
  assert.equal(variant.asset_id, assetId, 'Variant should reference correct asset');
  
  // Now simulate concurrent replacement that happened after read but before variant creation
  pool.assets.get(assetId).version = 3;
  
  // Attempt to create another variant with the old version should fail
  await assert.rejects(
    store.createVariant({
      siteId,
      id: assetId,
      variantKey: 'another-variant',
      data: optimizedData,
      mimeType: 'image/webp',
      expectedVersion: readVersion // Still using old version
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT',
    'Creating variant with stale version after replacement must fail'
  );
});

test('readPublicVariant cannot retrieve variants after asset version replacement', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  const actorId = randomUUID();
  
  // Setup: Private asset at version 1 with a variant
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 1,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v1.png`,
    display_name: 'Private Image',
    original_name: 'private.png',
    alt_text: '',
    caption: '',
    description: '',
    is_public: false, // Private
    status: 'active',
    deleted_at: null,
    metadata: {},
    updated_by: actorId
  });

  const variantData = createTestWebP();
  const variantKey = 'webp-optimized';
  const variantStorageKey = `${siteId}/${assetId}/variants/${variantKey}-v1.webp`;
  
  pool.variants.set(`${assetId}:${variantKey}`, {
    id: randomUUID(),
    asset_id: assetId,
    variant_key: variantKey,
    storage_key: variantStorageKey,
    mime_type: 'image/webp',
    byte_size: variantData.length,
    sha256: createHash('sha256').update(variantData).digest('hex')
  });
  
  storage.objects.set(variantStorageKey, variantData);

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  // Verify: Cannot read variant while asset is private
  let result = await store.readPublicVariant({ assetId, variantKey });
  assert.equal(result, null, 'Variant should not be readable when asset is private');

  // Action: Replace asset version (this deletes all variants)
  const newPNG = createTestPNG();
  await store.replaceVersion({
    siteId,
    id: assetId,
    actorId,
    expectedVersion: 1,
    dataBase64: newPNG.toString('base64'),
    mimeType: 'image/png',
    fileName: 'public.png'
  });

  // Action: Make asset public
  pool.assets.get(assetId).is_public = true;

  // Verify: Variant was deleted during replacement, so readPublicVariant returns null
  result = await store.readPublicVariant({ assetId, variantKey });
  assert.equal(result, null, 'Variant should not exist after version replacement');
  
  // Verify: The variant row is gone
  assert.equal(pool.variants.has(`${assetId}:${variantKey}`), false,
    'Variant row must be deleted during version replacement');
});

test('createVariant without expectedVersion defaults to current version for backward compatibility', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 5,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v5.png`,
    is_public: false,
    status: 'active',
    deleted_at: null
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  const variantData = createTestWebP();
  
  // Call without expectedVersion (null/undefined)
  const variant = await store.createVariant({
    siteId,
    id: assetId,
    variantKey: 'webp-optimized',
    data: variantData,
    mimeType: 'image/webp'
    // expectedVersion not provided
  });

  assert.ok(variant.id, 'Variant should be created when expectedVersion is omitted');
  assert.equal(variant.asset_id, assetId, 'Variant should reference the asset');
  
  // The implementation should use current version when expectedVersion is null/undefined
  // This maintains backward compatibility while still checking version
});

test('concurrent variant creation and version replacement: FOR SHARE prevents stale variant', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  const actorId = randomUUID();
  
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 1,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v1.png`,
    display_name: 'Test',
    original_name: 'test.png',
    alt_text: '',
    caption: '',
    description: '',
    is_public: false,
    status: 'active',
    deleted_at: null,
    metadata: {},
    updated_by: actorId
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  // Simulate: Optimization reads version 1
  const readVersion = pool.assets.get(assetId).version;
  assert.equal(readVersion, 1, 'Initial read should see version 1');

  // Simulate: Concurrent replacement happens (increments version to 2)
  const newPNG = createTestPNG();
  await store.replaceVersion({
    siteId,
    id: assetId,
    actorId,
    expectedVersion: 1,
    dataBase64: newPNG.toString('base64'),
    mimeType: 'image/png',
    fileName: 'replaced.png'
  });

  assert.equal(pool.assets.get(assetId).version, 2, 'Version should be incremented to 2');
  assert.equal(pool.variants.size, 0, 'All variants should be deleted');

  // Simulate: Optimization completes and tries to create variant with stale version
  const variantData = createTestWebP();
  await assert.rejects(
    store.createVariant({
      siteId,
      id: assetId,
      variantKey: 'webp-optimized',
      data: variantData,
      mimeType: 'image/webp',
      expectedVersion: readVersion // Stale version 1
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT',
    'FOR SHARE lock and version check must prevent stale variant creation'
  );

  // Verify: No stale variant was created
  assert.equal(pool.variants.size, 0, 'No variant should exist after failed creation');
});

test('security property: public variant delivery only serves derivatives from current version', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  const actorId = randomUUID();
  
  // Scenario: Asset starts private at version 1
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 1,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v1.png`,
    display_name: 'Sensitive',
    original_name: 'sensitive.png',
    alt_text: '',
    caption: '',
    description: '',
    is_public: false,
    status: 'active',
    deleted_at: null,
    metadata: {},
    updated_by: actorId
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  // Step 1: Create variant from private version 1
  const privateVariantData = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 PRIVATE_CONTENT');
  const variant1 = await store.createVariant({
    siteId,
    id: assetId,
    variantKey: 'webp-optimized',
    data: privateVariantData,
    mimeType: 'image/webp',
    expectedVersion: 1
  });
  
  assert.ok(variant1.id, 'Private variant should be created');

  // Step 2: Replace asset (increments to version 2, deletes all variants)
  const newPNG = createTestPNG();
  await store.replaceVersion({
    siteId,
    id: assetId,
    actorId,
    expectedVersion: 1,
    dataBase64: newPNG.toString('base64'),
    mimeType: 'image/png',
    fileName: 'public.png'
  });

  assert.equal(pool.assets.get(assetId).version, 2, 'Version should be 2');
  assert.equal(pool.variants.size, 0, 'All variants should be deleted after replacement');

  // Step 3: Make asset public
  pool.assets.get(assetId).is_public = true;

  // Step 4: Attempt to read the old variant (should fail - variant was deleted)
  const publicRead = await store.readPublicVariant({
    assetId,
    variantKey: 'webp-optimized'
  });

  assert.equal(publicRead, null, 
    'SECURITY: Old variant from private version must not be accessible after replacement and publication');

  // Step 5: Create new variant from public version 2
  const publicVariantData = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 PUBLIC_CONTENT');
  const variant2 = await store.createVariant({
    siteId,
    id: assetId,
    variantKey: 'webp-optimized',
    data: publicVariantData,
    mimeType: 'image/webp',
    expectedVersion: 2
  });

  assert.ok(variant2.id, 'New variant should be created for version 2');

  // Step 6: Now public read should succeed with new variant
  storage.objects.set(variant2.storage_key, publicVariantData);
  const publicRead2 = await store.readPublicVariant({
    assetId,
    variantKey: 'webp-optimized'
  });

  assert.ok(publicRead2, 'New variant should be readable when asset is public');
  assert.equal(publicRead2.storage_key, variant2.storage_key, 
    'Should retrieve the new variant, not the old one');
});

test('variant key validation prevents injection attacks', async () => {
  const { createLibraryStore } = require('../packages/library/src/file-store');
  const pool = createMockPool();
  const storage = createMockStorage();
  
  const siteId = randomUUID();
  const assetId = randomUUID();
  
  pool.assets.set(assetId, {
    id: assetId,
    site_id: siteId,
    asset_kind: 'image',
    version: 1,
    mime_type: 'image/png',
    storage_key: `${siteId}/${assetId}/v1.png`,
    is_public: false,
    status: 'active',
    deleted_at: null
  });

  const store = createLibraryStore({
    pool,
    storageAdapter: storage,
    requireMalwareScan: false
  });

  const variantData = createTestWebP();
  
  // Test invalid variant keys
  const invalidKeys = [
    '../../../etc/passwd',
    'key with spaces',
    'key/with/slashes',
    'key\\with\\backslashes',
    'key;with;semicolons',
    'a'.repeat(100), // Too long
    '', // Empty
    'Key-With-Uppercase', // Uppercase not allowed
  ];

  for (const invalidKey of invalidKeys) {
    await assert.rejects(
      store.createVariant({
        siteId,
        id: assetId,
        variantKey: invalidKey,
        data: variantData,
        mimeType: 'image/webp',
        expectedVersion: 1
      }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_LIBRARY_INVALID',
      `Invalid variant key "${invalidKey}" should be rejected`
    );
  }

  // Test valid variant keys
  const validKeys = [
    'webp-optimized',
    'thumbnail',
    'preview-large',
    'a',
    'a1',
    'key_with_underscores',
    'key-with-dashes',
    'key123',
  ];

  for (const validKey of validKeys) {
    const result = await store.createVariant({
      siteId,
      id: assetId,
      variantKey: validKey,
      data: variantData,
      mimeType: 'image/webp',
      expectedVersion: 1
    });
    assert.ok(result.id, `Valid variant key "${validKey}" should be accepted`);
    
    // Clean up for next iteration
    pool.variants.delete(`${assetId}:${validKey}`);
  }
});
