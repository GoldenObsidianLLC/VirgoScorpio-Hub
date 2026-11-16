# F1.38 Library Asset Audit Atomicity Implementation Plan

> Execute sequentially and test-first. Reuse each store's existing transaction; do not add another transaction abstraction.

**Goal:** Commit library asset upload/version replacement and their correlated audit events atomically.
**Parent:** #124.
**Issue:** [#165](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/165).
**Baseline:** `af0e6504e8c7994e6b886c63a8e445b4931de4c1`.
**Version boundary:** private/unreleased 0.6.2; no SemVer change.

## Tasks

- [x] Add upload store tests for callback transaction identity, callback-before-COMMIT, audit failure rollback and object compensation.
- [x] Add upload connection-acquisition failure test to cover cleanup after object write.
- [x] Add replacement store test for audit failure rollback, removal of only the new object, and preservation of the previous object.
- [x] Update library route tests to verify upload and replacement audit callbacks receive the transaction queryable.
- [x] Add live PostgreSQL trigger-injection integration coverage for upload and version replacement, including rollback and safe retry.
- [x] Extend `createLibraryStore.upload` with optional `onAssetUploaded({ queryable, result })`.
- [x] Extend `createLibraryStore.replaceVersion` with optional `onVersionReplaced({ queryable, result })`.
- [x] Move `library.asset_uploaded` and `library.asset_version_replaced` audit writes into those callbacks.
- [x] Run focused store and route unit tests: 26 passed, zero failures; the dedicated PostgreSQL integration case is separately skipped locally because the test database is not configured.
- [ ] Run live PostgreSQL/Memgraph integration with zero skips; `npm run test:integration:live` is BLOCKED locally because `TEST_DATABASE_URL` (and an approved local integration target) is not configured. The new integration test is present and is included by the live runner.
- [x] Run tenant-inventory freshness, full `npm run check` (627 passed, zero failures, three platform-specific skips), and `git diff --check`.
- [ ] Review the final diff for API, schema, migration, dependency, package and SemVer drift.
- [ ] Commit, push and open a PR; validate exact-head hosted CI and keep attestation claims event-accurate.
- [ ] Update #124, release documentation and tenant inventory references after merge, without claiming independent review.

## Acceptance evidence

- Callback is awaited before COMMIT on the same client that wrote asset/version rows.
- Callback error is propagated unchanged and prevents COMMIT.
- Upload callback/SQL failure removes the newly written object; PostgreSQL connection acquisition failure after object write also removes it.
- Replacement callback failure leaves previous row/version/object intact and removes the new object.
- Live trigger-injection tests demonstrate both audit rollback and successful retry with exactly one matching audit row.
- All existing callers without callbacks continue to work.

## Assurance boundary

Maintainer engineering and CI do not constitute independent security acceptance. Independent reviews #14/#25 remain OPEN / NOT PERFORMED and dependency/license review #23 remains OPEN / PARTIAL. Production remains NO-GO.
