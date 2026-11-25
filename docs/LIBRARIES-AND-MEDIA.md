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

## Per-site retained-storage quotas

F1.73 applies a per-site quota to every new library storage allocation. The default ceilings are **5 GiB of retained object bytes** and **10,000 distinct retained storage objects** per site. Operators may override them with `VIRGOSCORPIO_HUB_LIBRARY_MAX_SITE_BYTES` and `VIRGOSCORPIO_HUB_LIBRARY_MAX_SITE_OBJECTS`; individual uploads remain subject to the existing 50 MiB default `VIRGOSCORPIO_HUB_LIBRARY_MAX_FILE_BYTES` limit. Migration `0020_library_storage_reservations.sql` creates the site-cascading `library_storage_reservations` lease table, its unique storage-key constraint and site/expiry lookup index.

Quota usage counts distinct storage keys referenced by current library assets, retained `library_asset_versions` snapshots, `media_variants`, and unexpired `library_storage_reservations` leases. Reservations count against both byte and object ceilings while a new object is being written. Soft-deleted/quarantined assets and historical source versions continue to consume quota while their objects remain retained. Multiple database references to one storage key count once. Legacy version snapshots without a recorded `byteSize` are conservatively charged at the configured per-file maximum instead of being treated as zero bytes.

Uploads, source-version replacements, and derivative creation acquire the same site-scoped PostgreSQL transaction advisory lock before reading usage and creating a 30-minute reservation in `library_storage_reservations`. The reservation commits before local/object-store I/O begins, so no database transaction, advisory lock, or asset row lock is held across storage latency. Finalization then opens a short transaction, reacquires the site lock, revalidates the expected source version where applicable, writes the asset/derivative reference, and consumes the reservation atomically. Concurrent allocations therefore count active leases while different sites remain independent. Expired leases are removed when the site next reserves quota; an expired operation cannot finalize and must compensate its unreferenced object. Quota checks fail closed when the database cannot provide trustworthy usage; capacity failures return HTTP 413 with `ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_EXCEEDED`, while an unverifiable quota returns HTTP 503 with `ERR_VIRGOSCORPIO_HUB_LIBRARY_QUOTA_CHECK_FAILED`.

Replacing source bytes retires derivative rows in the same database transaction as the new version, then deletes stale derivative objects after commit. Metadata-only versions retain their source bytes and carry forward only derivative rows already bound to the prior source version. Object writes and PostgreSQL still do not form a distributed transaction: pre-commit failures use best-effort compensation, ambiguous COMMIT acknowledgements preserve potentially referenced objects, and the existing orphan reconciler remains necessary.

Quota is based on retained references, not merely active UI items. Soft deletion does not immediately release storage. A future retention/garbage-collection operation must remove expired history and underlying objects safely before that capacity becomes available; it must remain site-scoped, auditable, version-aware, and dry-run capable.

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
- Variant creation first validates and reserves quota under the site advisory lock, commits that lease, and only then writes derivative bytes. A separate finalization transaction reacquires the site lock and rechecks the active parent version before inserting the source-version-bound row and consuming the lease. Storage latency therefore cannot block source replacement; if replacement wins during the object write, derivative finalization returns the existing 409 version-conflict contract and compensates the unreferenced object.
- Replacing source bytes reserves the replacement object while excluding only that source asset’s soon-to-be-retired derivatives from the initial quota calculation, then performs object I/O without a database lock. Its finalization transaction reacquires the site lock, rechecks expectedVersion, deletes derivative rows and updates the asset/version together, consumes the lease, and commits; old derivative objects are deleted only after commit. A failed replacement rolls back both the row deletion and replacement, preserving the old derivative references. A metadata-only version change retains the same source bytes and advances only already-bound variant rows to the new version in that transaction; legacy unbound rows remain unbound.
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

The SQL row and stored object cannot be atomically committed by a generic filesystem/S3 adapter. A 30-minute quota lease reserves capacity during object I/O; failed uploads/replacements/derivatives compensate by removing the newly written object and releasing the lease. A process crash can still leave an orphan object or an expired reservation; expired leases are ignored by quota reads and pruned on the next reservation for that site, while the orphan reconciler remains responsible for unreferenced objects. Schedule an orphan reconciler, object lifecycle rules, and periodic digest/metadata consistency checks before production. Soft-deleted assets require a separate retention/garbage-collection policy; they are not immediately erased from storage.

## Mutation and audit consistency

F1.38 makes the library asset row/version mutation and its corresponding `library.asset_uploaded` or `library.asset_version_replaced` audit event share one PostgreSQL transaction. The existing library store accepts optional `onAssetUploaded({ queryable, result })` and `onVersionReplaced({ queryable, result })` callbacks; the API route passes that exact transaction queryable to `identity.audit(event, { queryable })` before COMMIT. An audit error rolls back the library database mutation. Object writes remain outside PostgreSQL and use best-effort compensation; this does not provide a distributed transaction across the database and filesystem/S3 provider.

The legacy site-scoped POST /api/v1/media/uploads route is backed by createLocalMediaStore or createS3MediaStore. F1.39 issue [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167) is CLOSED after [PR #169](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/169) merged at d4e1c1ce5e08b4594614448d64ad2738a84355b2. Both stores reuse the existing withTransaction helper, await optional onAssetUploaded before COMMIT and pass the exact transaction queryable to identity.audit(event, { queryable }). Object compensation is best-effort; S3 PutObject is inside its cleanup scope because provider transport failure can leave the outcome ambiguous. Exact-main workflow #681 passed: Node 22/24 each 641/641 Hub and 94/94 EnginEx tests, PostgreSQL/Memgraph 106/106, 18/18 migrations, CodeQL, browser smoke and signed attestation. No formal PR review or inline review threads were recorded for #169. PostgreSQL and object storage do not share a distributed transaction; ambiguous COMMIT/provider outcomes and orphan reconciliation remain operational requirements.
