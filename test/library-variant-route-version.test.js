'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const optimizer = require('../packages/media/src/optimizer');

// Inject a deterministic successful image optimizer before the route module captures it.
const originalOptimizeImage = optimizer.optimizeImage;
optimizer.optimizeImage = async () => ({
  optimized: true,
  buffer: Buffer.from('RIFFxxxxWEBP'),
  mimeType: 'image/webp',
  bytesSaved: 12,
  reason: 'integration-fixture',
});
const { handleLibraryRoute } = require('../apps/api/src/library-routes');
optimizer.optimizeImage = originalOptimizeImage;

test('library optimization binds newly-created variant to the exact source asset version', async () => {
  const siteId = '11111111-1111-4111-8111-111111111111';
  const assetId = '22222222-2222-4222-8222-222222222222';
  const assetVersion = 7;
  const events = [];
  let variantInput;
  const store = {
    async getBufferById(input) {
      events.push({ type: 'getBufferById', input });
      return {
        asset: { id: assetId, asset_kind: 'image', mime_type: 'image/png', version: assetVersion },
        data: Buffer.from('source-image'),
      };
    },
    async markOptimization(input) { events.push({ type: 'markOptimization', input }); return { id: assetId, version: input.expectedVersion }; },
    async createVariant(input) {
      variantInput = input;
      events.push({ type: 'createVariant', input });
      return { id: 'variant-one', asset_id: assetId, variant_key: 'webp-optimized' };
    },
  };
  const res = { statusCode: 0, payload: null };
  const ctx = {
    req: { method: 'POST', headers: {} },
    res,
    url: new URL(`http://localhost/api/v1/sites/${siteId}/library/items/${assetId}/optimize`),
    actor: { user: { id: '33333333-3333-4333-8333-333333333333' } },
    localPool: {}, libraryStore: store, identity: null, requestId: 'request-library-optimize-version',
    async siteIdFor({ routeSiteId }) { return routeSiteId; },
    async requireCapability() {},
    async readJson() { return {}; },
    sendJson(response, statusCode, payload) { response.statusCode = statusCode; response.payload = payload; return true; },
    fail(statusCode, code, message) { return Object.assign(new Error(message), { statusCode, code }); },
    maxBody: 100_000, maxLibraryBody: 100_000, maxOptimizerBytes: 1_000_000,
  };

  assert.equal(await handleLibraryRoute(ctx), true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.optimization.status, 'optimized');
  assert.equal(variantInput.siteId, siteId);
  assert.equal(variantInput.id, assetId);
  assert.equal(variantInput.expectedVersion, assetVersion);
  const statusWrites = events.filter(event => event.type === 'markOptimization').map(event => event.input);
  assert.deepEqual(statusWrites.map(input => input.status), ['processing', 'optimized']);
  assert.ok(statusWrites.every(input => input.expectedVersion === assetVersion), 'every optimization state transition uses the original asset version');
});
test('stale optimization attempts do not overwrite the replacement version status', async () => {
  const siteId = '11111111-1111-4111-8111-111111111111';
  const assetId = '22222222-2222-4222-8222-222222222222';
  const marked = [];
  const store = {
    async getBufferById() {
      return { asset: { id: assetId, asset_kind: 'image', mime_type: 'image/png', version: 7 }, data: Buffer.from('old-source') };
    },
    async markOptimization(input) {
      marked.push(input);
      return { id: assetId, version: input.expectedVersion };
    },
    async createVariant() {
      const error = new Error('Asset version is stale.');
      error.code = 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT';
      error.statusCode = 409;
      throw error;
    },
  };
  const res = { statusCode: 0, payload: null };
  const ctx = {
    req: { method: 'POST', headers: {} }, res,
    url: new URL(`http://localhost/api/v1/sites/${siteId}/library/items/${assetId}/optimize`),
    actor: { user: { id: '33333333-3333-4333-8333-333333333333' } },
    localPool: {}, libraryStore: store, identity: null, requestId: 'request-library-optimize-stale',
    async siteIdFor({ routeSiteId }) { return routeSiteId; },
    async requireCapability() {}, async readJson() { return {}; },
    sendJson(response, statusCode, payload) { response.statusCode = statusCode; response.payload = payload; return true; },
    fail(statusCode, code, message) { return Object.assign(new Error(message), { statusCode, code }); },
    maxBody: 100_000, maxLibraryBody: 100_000, maxOptimizerBytes: 1_000_000,
  };

  await assert.rejects(handleLibraryRoute(ctx), error => error.statusCode === 409 && error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT');
  assert.deepEqual(marked.map(input => input.status), ['processing'], 'the stale job cannot mark the replacement asset failed');
  assert.equal(marked[0].expectedVersion, 7);
});