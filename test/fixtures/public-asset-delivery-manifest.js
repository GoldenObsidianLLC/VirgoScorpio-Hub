'use strict';

const REVISION = 'c88b53594aa6b75ea3993f2dd614145fd5e0118f';

function validManifest() {
  return {
    schemaVersion: 1,
    environment: 'production',
    deploymentId: 'virgoscorpio-hub-prod-region-a',
    sourceRevision: REVISION,
    decision: {
      status: 'approved',
      approvedAt: '2026-11-07T10:00:00.000Z',
      approvedBy: 'team:platform-architecture',
      changeReference: 'change:asset-delivery-2026-117'
    },
    providers: {
      objectStorage: {
        provider: 'AWS S3', service: 'Production private media bucket',
        verificationReference: 'artifact:asset-origin-policy-2026-11-07'
      },
      edge: {
        provider: 'Cloudflare', service: 'Production public API edge',
        verificationReference: 'artifact:asset-edge-policy-2026-11-07'
      },
      reverseProxy: {
        provider: 'nginx', service: 'Production API reverse proxy',
        verificationReference: 'artifact:asset-proxy-policy-2026-11-07'
      }
    },
    origin: {
      anonymousObjectReadDenied: true,
      publicAccessBlocked: true,
      approvedReadIdentityReference: 'identity:virgoscorpio-hub-api-read',
      privateBucketEvidence: 'artifact:private-bucket-policy-2026-11-07'
    },
    delivery: {
      routes: ['/media/', '/library/public/'].map(prefix => ({
        prefix,
        cacheMode: 'bypass',
        originCacheControlHonored: true,
        sharedCacheStoresResponses: false,
        successCacheControl: 'private, no-store',
        maxSuccessTtlSeconds: 0,
        maxNegativeTtlSeconds: 0,
        directObjectRedirects: false
      }))
    },
    legacyUrls: {
      disposition: 'purged',
      verifiedAt: '2026-11-07T09:15:00.000Z',
      evidenceReference: 'artifact:legacy-asset-purge-2026-11-07',
      purgedAt: '2026-11-07T09:00:00.000Z'
    },
    probes: {
      originAnonymousReadDenial: { reference: 'run:origin-anonymous-denial-2026-11-07', executedAt: '2026-11-07T09:20:00.000Z', statusCode: 403, cacheControl: 'private, no-store', cacheable: false },
      originSuccessNoStore: { reference: 'run:origin-no-store-2026-11-07', executedAt: '2026-11-07T09:25:00.000Z', statusCode: 200, cacheControl: 'private, no-store', cacheable: false },
      edgeSuccessNoStore: { reference: 'run:edge-no-store-2026-11-07', executedAt: '2026-11-07T09:30:00.000Z', statusCode: 200, cacheControl: 'private, no-store', cacheable: false },
      originRevocation: { reference: 'run:origin-revocation-2026-11-07', executedAt: '2026-11-07T09:35:00.000Z', statusCode: 404, cacheControl: 'private, no-store', cacheable: false },
      edgeRevocation: { reference: 'run:edge-revocation-2026-11-07', executedAt: '2026-11-07T09:40:00.000Z', statusCode: 404, cacheControl: 'private, no-store', cacheable: false }
    },
    owners: {
      serviceOwner: 'team:platform-engineering',
      securityOwner: 'team:platform-security'
    }
  };
}


module.exports = { validManifest, REVISION };
