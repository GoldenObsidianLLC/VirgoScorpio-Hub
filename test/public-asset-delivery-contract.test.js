'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validatePublicAssetDeliveryManifest
} = require('../packages/media/src/public-asset-delivery-contract');
const { validManifest, REVISION } = require('./fixtures/public-asset-delivery-manifest');

const NOW = '2026-11-07T12:00:00.000Z';

function codes(result) {
  return new Set(result.errors.map(error => error.code));
}

test('complete source-bound public asset deployment evidence satisfies the structural contract', () => {
  const result = validatePublicAssetDeliveryManifest(validManifest(), { now: NOW, expectedRevision: REVISION });
  assert.equal(result.ready, true);
  assert.deepEqual(result.errors, []);
});

test('origin access must deny anonymous reads and require private bucket evidence plus an approved identity', () => {
  const manifest = validManifest();
  manifest.origin.anonymousObjectReadDenied = false;
  manifest.origin.publicAccessBlocked = false;
  manifest.origin.approvedReadIdentityReference = 'read-role';
  manifest.origin.privateBucketEvidence = '';
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(codes(result).has('must_match_security_policy'));
  assert.ok(codes(result).has('typed_reference_required'));
});

test('each public route must bypass shared caches and preserve private no-store origin headers', () => {
  const manifest = validManifest();
  manifest.delivery.routes[0].cacheMode = 'cache';
  manifest.delivery.routes[1].originCacheControlHonored = false;
  manifest.delivery.routes[1].sharedCacheStoresResponses = true;
  manifest.delivery.routes[0].successCacheControl = 'public, max-age=60';
  manifest.delivery.routes[1].maxSuccessTtlSeconds = 60;
  manifest.delivery.routes[0].maxNegativeTtlSeconds = 30;
  manifest.delivery.routes[1].directObjectRedirects = true;
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(codes(result).has('shared_cache_bypass_required'));
  assert.ok(codes(result).has('must_match_security_policy'));
  assert.ok(codes(result).has('private_no_store_required'));
  assert.ok(codes(result).has('cache_ttl_must_be_zero'));
});

test('both required route prefixes must be present exactly once', () => {
  const manifest = validManifest();
  manifest.delivery.routes.pop();
  manifest.delivery.routes.push({ ...manifest.delivery.routes[0] });
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(codes(result).has('route_prefix_invalid'));
  assert.ok(codes(result).has('route_set_incomplete'));
});

test('origin and edge success/revocation probes are all required', () => {
  const manifest = validManifest();
  delete manifest.probes.edgeRevocation;
  delete manifest.probes.originSuccessNoStore;
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(result.errors.some(error => error.path === '$.probes.edgeRevocation' && error.code === 'object_required'));
  assert.ok(result.errors.some(error => error.path === '$.probes.originSuccessNoStore' && error.code === 'object_required'));
});

test('probe assertions require the exact denial/revocation status and non-cacheable no-store behavior', () => {
  const manifest = validManifest();
  manifest.probes.originAnonymousReadDenial.statusCode = 200;
  manifest.probes.edgeSuccessNoStore.cacheable = true;
  manifest.probes.edgeRevocation.statusCode = 200;
  manifest.probes.originRevocation.cacheControl = 'public, max-age=60';
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(result.errors.some(error => error.path === '$.probes.originAnonymousReadDenial.statusCode' && error.code === 'observed_status_mismatch'));
  assert.ok(result.errors.some(error => error.path === '$.probes.edgeSuccessNoStore.cacheable' && error.code === 'must_match_security_policy'));
  assert.ok(result.errors.some(error => error.path === '$.probes.edgeRevocation.statusCode' && error.code === 'observed_status_mismatch'));
  assert.ok(result.errors.some(error => error.path === '$.probes.originRevocation.cacheControl' && error.code === 'private_no_store_required'));
});

test('stale, future and impossible evidence timestamps fail closed', () => {
  const stale = validManifest();
  stale.probes.edgeSuccessNoStore.executedAt = '2026-09-01T09:30:00.000Z';
  const future = validManifest();
  future.probes.edgeRevocation.executedAt = '2026-11-08T09:40:00.000Z';
  const impossible = validManifest();
  impossible.probes.originRevocation.executedAt = '2026-02-30T09:35:00.000Z';
  assert.ok(codes(validatePublicAssetDeliveryManifest(stale, { now: NOW })).has('evidence_stale'));
  assert.ok(codes(validatePublicAssetDeliveryManifest(future, { now: NOW })).has('timestamp_in_future'));
  assert.ok(codes(validatePublicAssetDeliveryManifest(impossible, { now: NOW })).has('invalid_utc_timestamp'));
});

test('evidence executed after approval does not satisfy the approval decision', () => {
  const manifest = validManifest();
  manifest.probes.edgeSuccessNoStore.executedAt = '2026-11-07T10:30:00.000Z';
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(result.errors.some(error => error.path === '$.probes.edgeSuccessNoStore.executedAt' && error.code === 'evidence_after_approval'));
});

test('legacy direct-CDN URLs require an explicit none-issued or purged disposition', () => {
  const missing = validManifest();
  missing.legacyUrls.disposition = '';
  const incompletePurge = validManifest();
  incompletePurge.legacyUrls.purgedAt = null;
  const noneIssued = validManifest();
  noneIssued.legacyUrls.disposition = 'none-issued';
  noneIssued.legacyUrls.purgedAt = null;
  assert.ok(codes(validatePublicAssetDeliveryManifest(missing, { now: NOW })).has('legacy_url_disposition_required'));
  assert.ok(codes(validatePublicAssetDeliveryManifest(incompletePurge, { now: NOW })).has('invalid_utc_timestamp'));
  assert.equal(validatePublicAssetDeliveryManifest(noneIssued, { now: NOW }).ready, true);
});

test('source revision must be a full SHA and must match the requested candidate revision', () => {
  const manifest = validManifest();
  manifest.sourceRevision = 'c88b535';
  const malformed = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(codes(malformed).has('full_git_revision_required'));
  const mismatch = validatePublicAssetDeliveryManifest(validManifest(), { now: NOW, expectedRevision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  assert.ok(codes(mismatch).has('revision_mismatch'));
});

test('provider, route and evidence objects reject unknown fields and raw URLs', () => {
  const manifest = validManifest();
  manifest.providers.edge.apiToken = 'DO_NOT_PRINT_THIS_SECRET';
  manifest.providers.objectStorage.provider = 'https://storage.example/bucket';
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(result.errors.some(error => error.path === '$.providers.edge.apiToken' && error.code === 'unexpected_field'));
  assert.ok(result.errors.some(error => error.path === '$.providers.objectStorage.provider' && error.code === 'invalid_value'));
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PRINT_THIS_SECRET/);
});

test('reverse proxy absence is explicit and still references an operator verification record', () => {
  const manifest = validManifest();
  manifest.providers.reverseProxy = {
    provider: 'none', service: 'none', verificationReference: 'artifact:proxy-absence-review-2026-11-07'
  };
  const invalid = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(codes(invalid).has('policy_reference_required'));
  manifest.providers.reverseProxy.verificationReference = 'policy:no-reverse-proxy';
  assert.equal(validatePublicAssetDeliveryManifest(manifest, { now: NOW }).ready, true);
});

test('approval and owner references must be typed and production approval must be explicit', () => {
  const manifest = validManifest();
  manifest.decision.status = 'draft';
  manifest.owners.securityOwner = 'platform-security';
  const result = validatePublicAssetDeliveryManifest(manifest, { now: NOW });
  assert.ok(codes(result).has('approval_required'));
  assert.ok(codes(result).has('typed_reference_required'));
});

test('validator bounds the configured evidence freshness policy', () => {
  assert.throws(() => validatePublicAssetDeliveryManifest(validManifest(), { now: NOW, maxEvidenceAgeDays: 0 }), /between 1 and 90/);
  assert.throws(() => validatePublicAssetDeliveryManifest(validManifest(), { now: 'not-a-date' }), /valid Date or timestamp/);
});
