# F1.67 - Public library variant/source version binding

**Status:** implementation candidate; tracked by [issue #292](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/292) and [PR #293](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/293). Hosted PR workflow #1270 passed on the preceding candidate revision; the additional ambiguous-COMMIT fix in this update has local regression coverage and requires a fresh hosted run before merge.

**Base:** `afb3c32d4dac14a8ea35208041060dd19ddc6277` (main after documentation synchronization PR #291; F1.66 runtime code remains at `daf18f63115e6456800447d66b640247e58121b6`).

## Risk and invariant

A `media_variants` row previously identified a derivative by asset/key but did not identify which source version produced its bytes. Replacing a private asset and later publishing its new source could therefore leave a route capable of resolving an older derivative, because the old row had no source-revision relationship. The invariant is now explicit: a derivative is publicly readable only when its recorded source version equals the current asset version.

## Implementation

1. Migration `0019_library_variant_source_version.sql` adds nullable `media_variants.source_version` and a positive-value check. Historical rows are not guessed or backfilled; NULL is treated as unbound and excluded from public reads.
2. `createVariant` records the expected source version and holds `FOR SHARE` on the matching active parent row through the insert. This serializes with replacement's existing `FOR UPDATE` lock. Stale inserts fail with HTTP 409 semantics and their object is removed when the transaction has not committed. Ambiguous commit failures keep the object for reconciliation rather than risking deletion of a committed variant.
3. replaceVersion deletes all derivative rows in its existing transaction and removes the old derivative objects only after commit. Rollback preserves the old database references and derivative objects. Replacement-object compensation now uses the same conservative commitAttempted pattern as variant insertion: after a COMMIT attempt, an ambiguous acknowledgement preserves the new object because PostgreSQL may already reference it; the safe object reconciler can later remove any true orphan.
4. `updateMetadata` advances the binding only for variants already bound to the prior version: the source bytes did not change. Legacy NULL rows remain unbound.
5. The optimizer passes the version from its source read to both variant creation and all optimization-status updates. A stale background result cannot write derivative metadata against a later source revision.

## Regression coverage

- In-memory tests prove source-version SQL binding, exact parent-row locking, fail-closed public reads for unbound rows, metadata-version propagation, stale optimization-status protection, and replacement-object preservation when a COMMIT acknowledgement is ambiguous.
- The hosted PostgreSQL integration test covers replacement rollback retaining variant row/object; committed replacement deleting both; subsequent public publication not exposing a prior private derivative; stale expected-version rejection; a freshly bound derivative serving correctly; legacy NULL rows remaining private; metadata-only publication advancing the binding; and a controlled race where replacement commits while derivative upload is paused, after which stale insertion is rejected and the temporary object is compensated.
- The tenant-isolation inventory includes the new integration and route regression tests in the authenticated-library and public-media families.

## Local validation

On Node.js 26.12.1, npm run check passed: 809 tests, 806 passed, zero failures, three conditional platform skips. The targeted library/version-binding suite passed 20 tests with zero failures and one service-dependent integration skip. Tenant-isolation inventory is current at 28 families / 80 declared route patterns / 22 source files / 61 test files (source SHA-256 5738927223a4fe04732978e5833776e8452f02836d49848f846f1e31a2e2772a; test SHA-256 2d7d9c687bbc5d1ba1e57cc3313a2e305eeb1bd3324cc10be051acacede69610). The inventory freshness check and git diff --check passed.

The PostgreSQL integration regression was syntax-checked but not executed locally because local integration services/environment were not configured. The preceding PR revision passed hosted workflow #1270 (run 45084320128): all seven required jobs passed, live PostgreSQL/Memgraph integration passed 194/194 with zero failures/skips, and migration 0019 passed 19/19 fresh application plus 19/19 idempotent re-entry. That run predates the additional replaceVersion ambiguous-COMMIT fix in this update; the updated commit must pass a fresh hosted PR run, including live integration, before merge.

The hosted runs established two successive fix points. First, PR run #45082096262 caught a stale repository gate, not a migration execution error: `scripts/test-fresh-migrations.js` and downstream evidence validators were hard-coded to expect 18 migrations, while this candidate correctly introduced migration 0019 (19 total). The candidate now derives the migration count from the ordered `database/migrations` inventory and carries that count through producer evidence, validation, and finalization; the following runs #45083149405 and #45083153565 confirmed 19/19 fresh application and 19/19 idempotent skips.

Those integration runs reached the live suites and exposed two regression-fixture/contract issues. The new replacement/rollback test needed createVariant to return its storage_key; the insert now includes that field in RETURNING. The tenant-library isolation fixture also needed to bind its valid derivative to source version 1 rather than create an unbound legacy row. Both fixes were included in the revision validated by hosted workflow #1270. A subsequent code review identified a separate object-integrity edge case: if PostgreSQL commits a replacement but the connection drops before the COMMIT acknowledgement reaches the caller, deleting the replacement object would leave a committed row pointing at missing bytes. replaceVersion now preserves that object after any COMMIT attempt, and a regression simulates the ambiguous outcome. The final local full check passes 809 tests (806 passed, zero failures, three conditional skips); the tenant inventory was regenerated and freshness-checked. Live PostgreSQL/Memgraph/Redis are not configured locally; fresh hosted PR CI must validate this final review fix with zero integration failures/skips before merge.

## Compatibility and release boundary

No HTTP route, response shape, object-storage URL, package dependency, npm lockfile, package version, or SemVer change is intended. Existing public variant URLs continue to use the same API routes; legacy unbound rows fail closed rather than being silently promoted. Package 0.6.2 remains private/unreleased. This candidate is not production certification; independent tenant-isolation review #14 and platform security review #25 remain open, and release readiness remains NO-GO / NOT_PRODUCTION_CERTIFIED until all independent evidence gates are satisfied.
