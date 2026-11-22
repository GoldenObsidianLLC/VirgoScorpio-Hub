# F1.67 - Public library variant/source version binding

**Status:** implementation candidate; tracked by [issue #292](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/292); hosted CI and maintainer review pending.

**Base:** `afb3c32d4dac14a8ea35208041060dd19ddc6277` (main after documentation synchronization PR #291; F1.66 runtime code remains at `daf18f63115e6456800447d66b640247e58121b6`).

## Risk and invariant

A `media_variants` row previously identified a derivative by asset/key but did not identify which source version produced its bytes. Replacing a private asset and later publishing its new source could therefore leave a route capable of resolving an older derivative, because the old row had no source-revision relationship. The invariant is now explicit: a derivative is publicly readable only when its recorded source version equals the current asset version.

## Implementation

1. Migration `0019_library_variant_source_version.sql` adds nullable `media_variants.source_version` and a positive-value check. Historical rows are not guessed or backfilled; NULL is treated as unbound and excluded from public reads.
2. `createVariant` records the expected source version and holds `FOR SHARE` on the matching active parent row through the insert. This serializes with replacement's existing `FOR UPDATE` lock. Stale inserts fail with HTTP 409 semantics and their object is removed when the transaction has not committed. Ambiguous commit failures keep the object for reconciliation rather than risking deletion of a committed variant.
3. `replaceVersion` deletes all derivative rows in its existing transaction and removes the old objects only after commit. Rollback preserves the old database references and derivative objects.
4. `updateMetadata` advances the binding only for variants already bound to the prior version: the source bytes did not change. Legacy NULL rows remain unbound.
5. The optimizer passes the version from its source read to both variant creation and all optimization-status updates. A stale background result cannot write derivative metadata against a later source revision.

## Regression coverage

- In-memory tests prove source-version SQL binding, exact parent-row locking, fail-closed public reads for unbound rows, metadata-version propagation, and stale optimization-status protection.
- The hosted PostgreSQL integration test covers replacement rollback retaining variant row/object; committed replacement deleting both; subsequent public publication not exposing a prior private derivative; stale expected-version rejection; a freshly bound derivative serving correctly; legacy NULL rows remaining private; metadata-only publication advancing the binding; and a controlled race where replacement commits while derivative upload is paused, after which stale insertion is rejected and the temporary object is compensated.
- The tenant-isolation inventory includes the new integration and route regression tests in the authenticated-library and public-media families.

## Local validation

On Node.js 26.12.1, `npm run check` passed: 808 tests, 805 passed, zero failures, three conditional Windows skips. The pinned EnginEx suite passed: 94 tests, 91 passed, zero failures, three conditional Windows skips. Tenant-isolation inventory is current at 28 families / 80 declared route patterns / 22 source files / 61 test files (source SHA-256 `cdc9deb8ead60a4e71eef5bd54623f0863eece44ed5d6006cb00a742d48d8bf8`). Changed JavaScript syntax checks and `git diff --check` passed.

The PostgreSQL integration regression was syntax-checked but not executed locally because local integration services/environment were not configured. Hosted PR CI must demonstrate live PostgreSQL migration 0019, fresh migration application, idempotent re-entry, and the test cases above before merge.

The hosted runs established two successive fix points. First, PR run #45082096262 caught a stale repository gate, not a migration execution error: `scripts/test-fresh-migrations.js` and downstream evidence validators were hard-coded to expect 18 migrations, while this candidate correctly introduced migration 0019 (19 total). The candidate now derives the migration count from the ordered `database/migrations` inventory and carries that count through producer evidence, validation, and finalization; the following runs #45083149405 and #45083153565 confirmed 19/19 fresh application and 19/19 idempotent skips.

Those integration runs then reached the live suites and exposed two regression-fixture/contract issues. The new replacement/rollback test needed `createVariant` to return its `storage_key` so it could verify object retention/deletion; the insert now includes that field in `RETURNING`. The existing tenant-library isolation fixture also inserted a derivative without `source_version`, so the new fail-closed public read correctly returned 404 instead of the test's expected 200; fixture variants now bind explicitly to source version 1. Local focused library tests passed 28/28, full `npm run check` and the EnginEx suite both exited 0, and tenant inventory freshness, changed integration syntax, and `git diff --check` passed. Live PostgreSQL/Memgraph/Redis cannot be run locally because those integration services are not configured; hosted PR CI must now verify that the two fixes restore the full zero-skip integration suite before merge.

## Compatibility and release boundary

No HTTP route, response shape, object-storage URL, package dependency, npm lockfile, package version, or SemVer change is intended. Existing public variant URLs continue to use the same API routes; legacy unbound rows fail closed rather than being silently promoted. Package 0.6.2 remains private/unreleased. This candidate is not production certification; independent tenant-isolation review #14 and platform security review #25 remain open, and release readiness remains NO-GO / NOT_PRODUCTION_CERTIFIED until all independent evidence gates are satisfied.
