'use strict';

const FULL_GIT_SHA = /^[a-f0-9]{40}$/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._ /+-]{1,119}$/;
const REFERENCE = /^(artifact|run|policy|change|identity|team|user):[A-Za-z0-9][A-Za-z0-9._:/-]{2,220}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DEFAULT_MAX_EVIDENCE_AGE_DAYS = 30;
const MAX_EVIDENCE_AGE_DAYS = 90;
const ROUTES = Object.freeze(['/media/', '/library/public/']);
const ROOT_KEYS = Object.freeze([
  'schemaVersion', 'environment', 'deploymentId', 'sourceRevision',
  'decision', 'providers', 'origin', 'delivery', 'legacyUrls', 'probes', 'owners'
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUtcTimestamp(value) {
  if (typeof value !== 'string' || !UTC_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validatePublicAssetDeliveryManifest(manifest, {
  now = new Date(),
  expectedRevision,
  maxEvidenceAgeDays = DEFAULT_MAX_EVIDENCE_AGE_DAYS
} = {}) {
  const errors = [];
  const issue = (path, code) => errors.push({ path, code });
  const currentTime = now instanceof Date ? now.getTime() : Date.parse(now);

  if (!Number.isFinite(currentTime)) throw new TypeError('now must be a valid Date or timestamp.');
  if (!Number.isInteger(maxEvidenceAgeDays) || maxEvidenceAgeDays < 1 || maxEvidenceAgeDays > MAX_EVIDENCE_AGE_DAYS) {
    throw new TypeError('maxEvidenceAgeDays must be an integer between 1 and 90.');
  }

  function objectAt(value, path, keys) {
    if (!isRecord(value)) {
      issue(path, 'object_required');
      return {};
    }
    for (const key of keys) {
      if (!Object.hasOwn(value, key)) issue(path + '.' + key, 'required');
    }
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) issue(path + '.' + key, 'unexpected_field');
    }
    return value;
  }

  function text(value, path, { min = 2, max = 200, pattern = SAFE_IDENTIFIER } = {}) {
    if (typeof value !== 'string' || value.length < min || value.length > max ||
        value.trim() !== value || !pattern.test(value) || value.includes('://')) {
      issue(path, 'invalid_value');
      return false;
    }
    return true;
  }

  function reference(value, path, allowedPrefixes = ['artifact', 'run', 'policy']) {
    if (typeof value !== 'string' || !REFERENCE.test(value) || !allowedPrefixes.includes(value.split(':', 1)[0])) {
      issue(path, 'typed_reference_required');
      return false;
    }
    return true;
  }

  function boolean(value, path, expected) {
    if (typeof value !== 'boolean' || (expected !== undefined && value !== expected)) {
      issue(path, expected === undefined ? 'boolean_required' : 'must_match_security_policy');
      return false;
    }
    return true;
  }

  function utc(value, path, { recent = false, approvedAt } = {}) {
    if (!isUtcTimestamp(value)) {
      issue(path, 'invalid_utc_timestamp');
      return null;
    }
    const timestamp = Date.parse(value);
    if (timestamp > currentTime) issue(path, 'timestamp_in_future');
    if (recent && currentTime - timestamp > maxEvidenceAgeDays * 86_400_000) {
      issue(path, 'evidence_stale');
    }
    if (approvedAt && timestamp > approvedAt) issue(path, 'evidence_after_approval');
    return timestamp;
  }

  if (!isRecord(manifest)) {
    issue('$', 'object_required');
    return { ready: false, errors };
  }
  const root = objectAt(manifest, '$', ROOT_KEYS);
  if (root.schemaVersion !== 1) issue('$.schemaVersion', 'unsupported_version');
  if (root.environment !== 'production') issue('$.environment', 'must_be_production');
  text(root.deploymentId, '$.deploymentId', { min: 3, max: 120 });
  if (typeof root.sourceRevision !== 'string' || !FULL_GIT_SHA.test(root.sourceRevision)) {
    issue('$.sourceRevision', 'full_git_revision_required');
  }
  if (expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== '') {
    if (typeof expectedRevision !== 'string' || !FULL_GIT_SHA.test(expectedRevision)) {
      issue('$.sourceRevision', 'expected_revision_invalid');
    } else if (typeof root.sourceRevision === 'string' && FULL_GIT_SHA.test(root.sourceRevision) &&
        root.sourceRevision.toLowerCase() !== expectedRevision.toLowerCase()) {
      issue('$.sourceRevision', 'revision_mismatch');
    }
  }

  const decision = objectAt(root.decision, '$.decision', ['status', 'approvedAt', 'approvedBy', 'changeReference']);
  if (decision.status !== 'approved') issue('$.decision.status', 'approval_required');
  const approvedAt = utc(decision.approvedAt, '$.decision.approvedAt', { recent: true });
  reference(decision.approvedBy, '$.decision.approvedBy', ['team', 'user']);
  reference(decision.changeReference, '$.decision.changeReference', ['change']);

  const providers = objectAt(root.providers, '$.providers', ['objectStorage', 'edge', 'reverseProxy']);
  for (const [name, value] of [
    ['objectStorage', providers.objectStorage], ['edge', providers.edge], ['reverseProxy', providers.reverseProxy]
  ]) {
    const provider = objectAt(value, '$.providers.' + name, ['provider', 'service', 'verificationReference']);
    text(provider.provider, '$.providers.' + name + '.provider', { min: 2, max: 120 });
    text(provider.service, '$.providers.' + name + '.service', { min: 2, max: 120 });
    reference(provider.verificationReference, '$.providers.' + name + '.verificationReference');
    if (name === 'reverseProxy' && provider.provider === 'none' && provider.service === 'none') {
      // An explicit absence declaration still needs a retained operator record.
      if (typeof provider.verificationReference === 'string' && !provider.verificationReference.startsWith('policy:')) {
        issue('$.providers.reverseProxy.verificationReference', 'policy_reference_required');
      }
    } else if (name === 'reverseProxy' && (provider.provider === 'none' || provider.service === 'none')) {
      issue('$.providers.reverseProxy', 'proxy_absence_must_be_explicit');
    }
  }

  const origin = objectAt(root.origin, '$.origin', [
    'anonymousObjectReadDenied', 'publicAccessBlocked', 'approvedReadIdentityReference', 'privateBucketEvidence'
  ]);
  boolean(origin.anonymousObjectReadDenied, '$.origin.anonymousObjectReadDenied', true);
  boolean(origin.publicAccessBlocked, '$.origin.publicAccessBlocked', true);
  reference(origin.approvedReadIdentityReference, '$.origin.approvedReadIdentityReference', ['identity']);
  reference(origin.privateBucketEvidence, '$.origin.privateBucketEvidence');

  const delivery = objectAt(root.delivery, '$.delivery', ['routes']);
  if (!Array.isArray(delivery.routes)) {
    issue('$.delivery.routes', 'array_required');
  } else {
    if (delivery.routes.length !== ROUTES.length) issue('$.delivery.routes', 'route_set_incomplete');
    const seen = new Set();
    for (let index = 0; index < delivery.routes.length; index += 1) {
      const routePath = '$.delivery.routes[' + index + ']';
      const route = objectAt(delivery.routes[index], routePath, [
        'prefix', 'cacheMode', 'originCacheControlHonored', 'sharedCacheStoresResponses',
        'successCacheControl', 'maxSuccessTtlSeconds', 'maxNegativeTtlSeconds', 'directObjectRedirects'
      ]);
      if (!ROUTES.includes(route.prefix) || seen.has(route.prefix)) issue(routePath + '.prefix', 'route_prefix_invalid');
      seen.add(route.prefix);
      if (route.cacheMode !== 'bypass') issue(routePath + '.cacheMode', 'shared_cache_bypass_required');
      boolean(route.originCacheControlHonored, routePath + '.originCacheControlHonored', true);
      boolean(route.sharedCacheStoresResponses, routePath + '.sharedCacheStoresResponses', false);
      if (route.successCacheControl !== 'private, no-store') issue(routePath + '.successCacheControl', 'private_no_store_required');
      if (route.maxSuccessTtlSeconds !== 0) issue(routePath + '.maxSuccessTtlSeconds', 'cache_ttl_must_be_zero');
      if (route.maxNegativeTtlSeconds !== 0) issue(routePath + '.maxNegativeTtlSeconds', 'cache_ttl_must_be_zero');
      boolean(route.directObjectRedirects, routePath + '.directObjectRedirects', false);
    }
    for (const prefix of ROUTES) {
      if (!seen.has(prefix)) issue('$.delivery.routes', 'route_set_incomplete');
    }
  }

  const legacy = objectAt(root.legacyUrls, '$.legacyUrls', [
    'disposition', 'verifiedAt', 'evidenceReference', 'purgedAt'
  ]);
  if (!['none-issued', 'purged'].includes(legacy.disposition)) {
    issue('$.legacyUrls.disposition', 'legacy_url_disposition_required');
  }
  utc(legacy.verifiedAt, '$.legacyUrls.verifiedAt', { recent: true, approvedAt });
  reference(legacy.evidenceReference, '$.legacyUrls.evidenceReference');
  if (legacy.disposition === 'none-issued') {
    if (legacy.purgedAt !== null) issue('$.legacyUrls.purgedAt', 'must_be_null_when_not_purged');
  } else if (legacy.disposition === 'purged') {
    utc(legacy.purgedAt, '$.legacyUrls.purgedAt', { recent: true, approvedAt });
  }

  const probes = objectAt(root.probes, '$.probes', [
    'originAnonymousReadDenial', 'originSuccessNoStore', 'edgeSuccessNoStore',
    'originRevocation', 'edgeRevocation'
  ]);
  for (const name of [
    'originAnonymousReadDenial', 'originSuccessNoStore', 'edgeSuccessNoStore',
    'originRevocation', 'edgeRevocation'
  ]) {
    const probePath = '$.probes.' + name;
    const probe = objectAt(probes[name], probePath, ['reference', 'executedAt', 'statusCode', 'cacheControl', 'cacheable']);
    reference(probe.reference, probePath + '.reference');
    utc(probe.executedAt, probePath + '.executedAt', { recent: true, approvedAt });
    const expectedStatus = name === 'originAnonymousReadDenial' ? [403, 404] :
      (name.endsWith('Revocation') ? [404] : [200]);
    if (!expectedStatus.includes(probe.statusCode)) issue(probePath + '.statusCode', 'observed_status_mismatch');
    if (probe.cacheControl !== 'private, no-store') issue(probePath + '.cacheControl', 'private_no_store_required');
    boolean(probe.cacheable, probePath + '.cacheable', false);
  }

  const owners = objectAt(root.owners, '$.owners', ['serviceOwner', 'securityOwner']);
  reference(owners.serviceOwner, '$.owners.serviceOwner', ['team']);
  reference(owners.securityOwner, '$.owners.securityOwner', ['team']);

  return { ready: errors.length === 0, errors };
}

module.exports = {
  validatePublicAssetDeliveryManifest,
  DEFAULT_MAX_EVIDENCE_AGE_DAYS,
  MAX_EVIDENCE_AGE_DAYS,
  PUBLIC_ASSET_ROUTE_PREFIXES: ROUTES
};
