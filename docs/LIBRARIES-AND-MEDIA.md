# Libraries and Media Operations

## Data model

`library_assets` is the current asset record; `library_asset_versions` stores snapshots and storage references for optimistic history; `media_variants` stores derived assets such as WebP or WebM and binds each current derivative to `source_version`. The database identifies the owning site and tracks content type, SHA-256, byte count, public/private visibility, status, and metadata. Binary data is stored in local storage or a configured object store.

## Upload restrictions

- Default maximum library asset size is 50 MiB at the library service level; API body limits include base64 overhead and must be configured consistently.
- Uploads validate a file signature plus an explicit category/MIME allow-list.
- For library writes, the API resolves the route site and checks membership plus `library:manage` before reading/parsing the request body. A non-empty parsed body `siteId` is reconciled against route/header/query selectors before storage access without repeating membership authorization. GET/list and download paths do not invoke the JSON body parser.
- SVG, HTML, executable formats, scripts, and unapproved archives are not accepted by the library upload route.
- Download responses use content-disposition, `nosniff`, private/no-store headers, and a restrictive CSP.
- Public assets must be explicitly marked public. Public access must never be used for confidential documents.

## Public asset delivery and revocation

- Public media, library-asset, and variant byte routes are revocable reads. Every request rechecks the current database visibility and lifecycle state before returning bytes.
- Successful public-byte responses use Cache-Control: private, no-store so compliant browsers and shared caches do not retain bytes after visibility is withdrawn. Denied responses are also non-cacheable.
- S3 media URLs always resolve through the API (/media/{assetId}); S3 objects are stored with private, no-store metadata. MEDIA_CDN_PUBLIC=true fails startup because the provider adapter has no verified edge-purge/revocation contract.
- Keep object-storage buckets private. Any reverse proxy or CDN in front of the API must bypass caching for /media/* and /library/public/* and must not override origin cache directives. Direct object URLs or edge caching require a separately implemented and tested invalidation contract before being enabled.
- Migration caveat: this change cannot purge CDN objects or revoke direct URLs issued by an older deployment. Before rollout where MEDIA_CDN_PUBLIC was enabled, purge every previously exposed media key/prefix at the provider, block public access to the origin bucket, and verify denial from both the edge and origin. Until that evidence exists, previously issued URLs remain a separate deployment risk.

The selected production deployment must also satisfy the [Public Asset Delivery Deployment Contract](security/PUBLIC-ASSET-DELIVERY-DEPLOYMENT-CONTRACT.md): private object origin, an approved application read identity, cache bypass and origin-header preservation for both public API route families, zero positive/negative TTLs, post-revocation origin/edge denial, and an explicit legacy direct-CDN URL disposition. The validator is structural only; it does not change runtime behavior or prove provider state.

## Variant/source version binding

- Every newly created row in `media_variants` records the exact `library_assets.version` from which its bytes were derived in `source_version`. Public variant reads require `source_version = library_assets.version` as well as the current public/active asset checks.
- Migration `0019_library_variant_source_version.sql` leaves historical derivative rows with `source_version IS NULL`. They are not assumed to match the current asset and are deliberately unavailable through public variant reads until regenerated. Regeneration should use the current asset version.
- Variant creation uploads the derivative object first, then holds a shared lock on the matching active parent version while inserting the row. A stale version returns the existing 409 version-conflict contract and the unreferenced uploaded object is compensated.
- Replacing source bytes deletes all derivative rows in the same transaction as the asset version update; old objects are deleted only after commit. A failed replacement rolls back both the row deletion and replacement, preserving the old derivative references. A metadata-only version change retains the same source bytes and advances only already-bound variant rows to the new version in that transaction; legacy unbound rows remain unbound.
- The optimizer route pins both derivative insertion and optimization-status updates to the version it read before optimization. A stale optimization cannot publish output for a later source revision or overwrite that revision's status.

## API outline

Authenticated routes use `Authorization: Bearer …` in development or an authenticated cookie/session with CSRF checks for browser write operations:

- `GET /api/v1/sites/{siteId}/library/items?category=image|video|audio|document|file|font`
- `POST /api/v1/sites/{siteId}/library/items`
- `GET /api/v1/sites/{siteId}/library/items/{assetId}`
- `PATCH /api/v1/sites/{siteId}/library/items/{assetId}` (metadata, with `expectedVersion`)
- `PUT /api/v1/sites/{siteId}/library/items/{assetId}` (new bytes/version, with `expectedVersion`)
- `GET /api/v1/sites/{siteId}/library/items/{assetId}/versions`
- `GET /api/v1/sites/{siteId}/library/items/{assetId}/download`
- `POST /api/v1/sites/{siteId}/library/items/{assetId}/optimize`
- `DELETE /api/v1/sites/{siteId}/library/items/{assetId}` (version-aware soft delete)

Upload JSON fields include `category`, `fileName`, `mimeType`, `dataBase64`, `displayName`, `altText`, `caption`, `description`, `isPublic`, and bounded `metadata`. The server derives the digest; callers cannot select a storage path.

## IDs and versions

Asset IDs are stable UUIDs. Versions increment on metadata/content changes; clients must send the latest `expectedVersion` or receive a conflict rather than overwrite a concurrent edit. Page documents also have content IDs, schema versions, record versions, and revision records; do not mix up these independent version spaces.

## Video and optimization

MP4/WebM uploads are accepted as video. Optimization is optional and should run in a worker for large production workloads; the current API path performs the operation synchronously. Configure a maximum optimizer input and execution timeout, and isolate FFmpeg at the deployment boundary. Keep the original, checksum every derivative, and deliver a derivative only after its row/object has been committed.

## Backups and deletion

The SQL row and stored object cannot be atomically committed by a generic filesystem/S3 adapter. Failed uploads compensate by removing the newly written object, but a process crash can still create an orphan object. Schedule an orphan reconciler, object lifecycle rules, and periodic digest/metadata consistency checks before production. Soft-deleted assets require a separate retention/garbage-collection policy; they are not immediately erased from storage.

## Mutation and audit consistency

F1.38 makes the library asset row/version mutation and its corresponding `library.asset_uploaded` or `library.asset_version_replaced` audit event share one PostgreSQL transaction. The existing library store accepts optional `onAssetUploaded({ queryable, result })` and `onVersionReplaced({ queryable, result })` callbacks; the API route passes that exact transaction queryable to `identity.audit(event, { queryable })` before COMMIT. An audit error rolls back the library database mutation. Object writes remain outside PostgreSQL and use best-effort compensation; this does not provide a distributed transaction across the database and filesystem/S3 provider.

The legacy site-scoped POST /api/v1/media/uploads route is backed by createLocalMediaStore or createS3MediaStore. F1.39 issue [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167) is CLOSED after [PR #169](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/169) merged at d4e1c1ce5e08b4594614448d64ad2738a84355b2. Both stores reuse the existing withTransaction helper, await optional onAssetUploaded before COMMIT and pass the exact transaction queryable to identity.audit(event, { queryable }). Object compensation is best-effort; S3 PutObject is inside its cleanup scope because provider transport failure can leave the outcome ambiguous. Exact-main workflow #681 passed: Node 22/24 each 641/641 Hub and 94/94 EnginEx tests, PostgreSQL/Memgraph 106/106, 18/18 migrations, CodeQL, browser smoke and signed attestation. No formal PR review or inline review threads were recorded for #169. PostgreSQL and object storage do not share a distributed transaction; ambiguous COMMIT/provider outcomes and orphan reconciliation remain operational requirements.
