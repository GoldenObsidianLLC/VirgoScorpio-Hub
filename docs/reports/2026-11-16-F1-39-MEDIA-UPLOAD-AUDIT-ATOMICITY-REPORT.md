# F1.39 — Legacy media upload and audit atomicity

- Issue: [#167](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/167) (OPEN)
- Parent: [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- Branch: `security/f1-39-media-audit-atomicity-2026-11-16`
- Baseline: `529bb43ca11ce06f67a4e8a7cfdb6401f0852c09`
- Status: local implementation candidate; not pushed/merged at time of this report.

## Gap and selected design

The legacy site-scoped `POST /api/v1/media/uploads` route wrote a `media_assets` row through the configured local or S3 store, waited for the store call to finish, then persisted `media.uploaded` through an independent audit operation. A failed audit could therefore return an API error after the row and object had already persisted.

Both backends now reuse the existing `withTransaction(pool, work)` helper from `packages/db/src/transaction.js`. No new transaction helper or nested transaction abstraction was added. Each backend accepts an optional, backward-compatible `onAssetUploaded({ queryable, result })` callback; it is awaited on the store-owned PostgreSQL client after inserting the media row and before COMMIT. The API route now passes the callback and emits the unchanged metadata-only `media.uploaded` event using `identity.audit(event, { queryable })`.

## Storage compensation and limits

Local storage keeps the existing site-scoped, path-contained key and exclusive `wx` creation with owner-only permissions. Once this upload creates its file, any write/sync/close, PostgreSQL connection acquisition, BEGIN, insert, callback/audit or COMMIT failure enters the same cleanup scope. The file is removed best-effort; cleanup failure does not replace the original error.

S3 keeps its existing private `PutObject` metadata, generated tenant-scoped key, endpoint/HTTPS checks, public-CDN fail-closed behavior and per-request visibility check. The `PutObject` call itself is inside the compensation scope because a transport failure can leave the provider write outcome ambiguous; the store attempts best-effort `DeleteObject` after an ambiguous `PutObject` error and after subsequent PostgreSQL transaction failures. Delete failure does not replace the original provider/transaction error.

PostgreSQL and object storage do not share a distributed transaction. Process loss or provider/network failure can still leave an orphan, and a network error at COMMIT can leave outcome ambiguity. This increment does not claim cross-system atomicity; the existing reconciliation/operational gates remain required.

## Changed files

- `packages/media/src/local-store.js`: transaction-owned insert/callback and local object compensation; input validation, supported image signatures, size limit, alt-text constraint, list/read behavior and stored metadata remain unchanged.
- `packages/media/src/s3-store.js`: same transaction callback contract; private/no-store upload, signed-image validation, bounded body read/integrity check, public URL behavior and store close remain intact.
- `apps/api/src/server.js`: injected media-store seam for deterministic route tests; post-commit audit replaced by the store callback. Route path, auth/capability checks, request/response shape and event metadata remain unchanged.
- `test/media-upload-audit-atomicity.test.js`: local/S3 transaction order, callback identity, rollback, cleanup, connection and commit failure, backwards compatibility, route regression, and best-effort cleanup after an ambiguous S3 PutObject transport failure.
- `test/integration/media-audit-atomicity.integration.test.js`: live PostgreSQL trigger-injection failure, row/audit rollback, local object compensation and safe retry.
- `test/domain-plugins-media.test.js`, `test/security-boundaries.test.js`: transaction-aware pool test doubles; no behavior weakening.

## Local validation

- Focused route/store regression command: **49 passed, 0 failed, 0 skipped**.
- Dedicated media store/route unit suite: **11 passed, 0 failed, 0 skipped**; the separately gated PostgreSQL integration test is **1 skipped** because no dedicated test database is configured.
- Full `npm run check`: **638 passed, 0 failed, 3 Windows-specific skips**; artifact verification passed **238 required paths** and syntax-checked **256 JavaScript files** on Node.js 26.12.1.
- `npm run security:tenant-inventory`: passed and regenerated **27 flow families, 78 declared route patterns, 21 implementation source files and 46 referenced test files**. The generated inventory test passes in the full check.
- `git diff --check`: passed after implementation and documentation updates.
- Live PostgreSQL trigger-injection integration test: added, but not run locally. The local environment has neither `TEST_DATABASE_URL` nor `DATABASE_URL`; no database connection was attempted. The test is intentionally opt-in and the repository runner refuses to infer `DATABASE_URL` for destructive integration work.
- Exact candidate CI, PR review, hosted PostgreSQL trigger-injection evidence and provider-backed S3 cleanup acceptance remain required before merge. Mocked S3 tests prove best-effort DeleteObject is attempted after both ambiguous PutObject transport failure and SQL/audit failure, and that cleanup errors do not mask the triggering failure; they do not prove real provider credentials, object versioning, delete permissions, consistency or recovery.

## Compatibility and release impact

The new callback is optional; direct store callers may continue calling `upload` with existing arguments. No database schema or migration, package dependency, public REST route, lockfile, package version, SemVer, release tag, publication or deployment change is intended. Package `virgoscorpio-hub@0.6.2` remains private/unreleased and Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

## Next acceptance step

Complete full local validation and source/diff review, push the branch, open a PR linked to #167, and require hosted exact-head PostgreSQL trigger-injection evidence before considering merge. After merge, require exact-main CI, signed mainline attestation and updated canonical readiness evidence; only then close #167.
