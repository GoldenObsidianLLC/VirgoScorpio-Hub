# F1.38 Library Asset Audit Atomicity Implementation Plan

> Execute sequentially and test-first. Reuse each store's existing transaction; do not add another transaction abstraction.

**Goal:** Commit library asset upload/version replacement and their correlated audit events atomically.
**Parent:** #124.
**Issue:** [#165](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/165) — CLOSED.
**Pull request:** [#166](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/166) — MERGED.
**Implementation commit:** `125a8cd0539bf11891fc05745b95273b99a76bbf`.
**Mainline merge commit:** `4e3efd859b0447ee215d26343314da25d0a867c2`.
**Baseline:** `af0e6504e8c7994e6b886c63a8e445b4931de4c1`.
**Version boundary:** private/unreleased 0.6.2; no SemVer change.

## Implementation

- [x] Add upload store tests for callback transaction identity, callback-before-COMMIT, audit failure rollback and object compensation.
- [x] Add upload connection-acquisition failure test to cover cleanup after object write.
- [x] Add replacement store test for audit failure rollback, removal of only the new object, and preservation of the previous object.
- [x] Update library route tests to verify upload and replacement audit callbacks receive the transaction queryable.
- [x] Add live PostgreSQL trigger-injection integration coverage for upload and version replacement, including rollback and safe retry.
- [x] Extend `createLibraryStore.upload` with optional `onAssetUploaded({ queryable, result })`.
- [x] Extend `createLibraryStore.replaceVersion` with optional `onVersionReplaced({ queryable, result })`.
- [x] Move `library.asset_uploaded` and `library.asset_version_replaced` audit writes into those callbacks.
- [x] Preserve the original transaction error and compensate the newly written object if PostgreSQL connection acquisition, mutation, or audit fails.

## Validation and merge

- [x] Run focused store and route tests locally: 26 passed, zero failures.
- [x] Run tenant-inventory freshness, full `npm run check` (627 passed, zero failures, three platform-specific skips), and `git diff --check`.
- [x] Record the local live-runner limitation accurately: `npm run test:integration:live` was BLOCKED because no approved disposable `TEST_DATABASE_URL` / PostgreSQL-Memgraph target was configured. The local live run is not claimed as a pass.
- [x] Review the final diff for API, schema, migration, dependency, package, lockfile and SemVer drift; none was introduced.
- [x] Commit and push implementation branch; open [PR #166](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/166).
- [x] Exact-head hosted [workflow #672](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43784747633): Node 22 and Node 24 each passed 630/630 Hub tests; live PostgreSQL/Memgraph passed 105/105 with zero skips, including both new rollback/retry cases; browser smoke, CodeQL and evidence consolidation passed.
- [x] Merge PR #166; close issue #165. Mainline merge SHA: `4e3efd859b0447ee215d26343314da25d0a867c2`.
- [x] Exact-main [workflow #673](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43790202761): Node 22/24, live PostgreSQL/Memgraph, browser/editor smoke, CodeQL, signed lockfile/SBOM attestations and evidence consolidation all passed.
- [x] Reconcile architecture, roadmap, README, release evidence and tenant-inventory references in the F1.38 documentation follow-up.

## Acceptance evidence

- Callback is awaited before COMMIT on the same client that wrote asset/version rows.
- Callback error is propagated unchanged and prevents COMMIT.
- Upload callback/SQL failure removes the newly written object; PostgreSQL connection acquisition failure after object write also removes it.
- Replacement callback failure leaves previous row/version/object intact and removes the new object.
- Live trigger-injection tests demonstrate both audit rollback and successful retry with exactly one matching audit row.
- All existing callers without callbacks continue to work.

## Mainline evidence

The exact-main workflow #673 used source SHA `4e3efd859b0447ee215d26343314da25d0a867c2`. It passed both supported Node matrices (630/630 Hub and 94/94 EnginEx each), 105/105 live PostgreSQL/Memgraph tests with zero skips, 18/18 fresh migrations and 18/18 idempotent second-pass skips, browser/editor smoke, CodeQL, signed lockfile/SBOM provenance verification and evidence consolidation. The canonical readiness result remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN and does not certify production.

## Assurance boundary

Maintainer engineering and hosted CI do not constitute independent security acceptance. Independent reviews #14/#25 remain OPEN / NOT PERFORMED and dependency/license review #23 remains OPEN / PARTIAL. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED. Object-provider compensation is best effort; PostgreSQL rollback does not prove guaranteed cleanup in external cloud storage. No schema, migration, dependency, API, lockfile, package-version or SemVer change was introduced.
