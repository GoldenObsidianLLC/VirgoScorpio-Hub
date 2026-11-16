# F1.37 Page-Draft Save and Audit Atomicity — Historical Candidate-Local Report

**Date:** 15 November 2026
**Issue:** [#162](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/162) (child of #124)
**Candidate branch:** `security/f1-37-content-draft-audit-atomicity-2026-11-15`
**Base main SHA:** `ead1760b71d747dad3100a568ac403ce6a59a08f` (after docs-only PR #161; F1.36 product code remains at `460eff191d84fe422ed4ac15260a8fd6d9100d77`)
**Package:** `virgoscorpio-hub@0.6.2` - private and unreleased

> **Status:** This is the candidate-local snapshot captured before merge. F1.37 subsequently merged through PR #163 at main SHA `212df05a2c2af5b222eb6a06a798f2ce5ba6cabc` and passed exact-main workflow #667; see the [merge and mainline validation report](2026-11-15-F1-37-CONTENT-DRAFT-AUDIT-ATOMICITY-REPORT.md). This historical candidate report is not independent security approval or production certification.
**Candidate commit:** `058d26605b4984ed7455b5ebd4f70e24e8b9b494`
**Pull request:** [#163 - F1.37: Make page-draft save and audit atomic](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/163) (MERGED)

## Finding

`POST /api/v1/pages/drafts` previously committed `saveDraft`'s content row, collaboration checkpoint, revision, workflow event and outbox row before issuing `identity.audit` through the pool as a separate operation. An audit failure could therefore return an error after the draft and related state had already committed.

`saveDraft` already owns the relevant PostgreSQL transaction, and `identity.audit` already accepts an explicit `{ queryable }`. The candidate extends those existing seams instead of adding another transaction helper.

## Candidate changes

- Added the backwards-compatible optional `onDraftSaved` callback to `saveDraft`. The callback receives the active transaction client, saved row and prior locked row; it is awaited after content/revision/workflow/outbox writes and before COMMIT.
- Moved the page-draft route's `content.draft_saved` insert into that callback through `identity.audit(event, { queryable })`. The post-commit duplicate audit is removed. Requests without a persisted authenticated actor retain no callback.
- Narrowed `23505` route-conflict mapping to the content row INSERT/UPDATE. A unique violation from the audit callback is rolled back and retains its original database error rather than being mislabeled as a content slug conflict.
- Added store contract tests, authenticated-route correlation tests, a developer-token compatibility test, and a live PostgreSQL trigger-based rollback/retry integration test.
- Updated the tenant route inventory catalog, generated source/test references, artifact verification allow-list, architecture notes, implementation/feature roadmaps and documentation index.

## Local verification

| Check | Result | Notes |
|---|---:|---|
| F1.37 focused store/API tests | **7/7 pass** | 0 failures, 0 skips |
| Related editorial transition/audit regression set | **4/4 pass** | Existing transactional callback behavior unchanged |
| Combined focused run | **11 pass / 0 fail / 1 skip** | The one skip was the live PostgreSQL integration test, disabled in this environment |
| `npm run check` | **623 pass / 0 fail / 3 skip** | `scripts/verify.js` passed: 238 required paths and 253 JavaScript files syntax-checked |
| Tenant inventory generator | **PASS** | 27 families, 78 declared route patterns, 21 source files and 46 referenced test files |

Local runtime was Node.js 26.12.1, outside the repository's supported hosted matrix (22.23.4 and 24.22.1). The local unit/security suite passed; hosted PR CI below provides the supported-runtime validation.

## Hosted exact-head validation

Draft PR [#163](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/163) at candidate commit `058d26605b4984ed7455b5ebd4f70e24e8b9b494` passed [workflow #666](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43773908110) on 15 November 2026:

- Node.js 22.23.4 and 24.22.1 each passed **626/626 Hub tests** and **94/94 EnginEx tests**, with zero failures or skips.
- Dedicated PostgreSQL/Memgraph live integration passed **102/102**, zero failures and zero skips. The new `content.draft_saved` trigger-injection rollback/retry subtest passed.
- Fresh migration validation passed (18/18 migrations applied and 18/18 idempotent re-entry checks passed).
- Browser/editor Playwright smoke passed **9/9**; CodeQL and candidate evidence consolidation completed successfully.
- The mainline-only signed dependency/SBOM attestation job was **skipped as expected** for a pull-request event; no signed mainline attestation is claimed for this candidate.

The Node matrix's service-less integration diagnostic separately records 36 skipped tests per runtime as PARTIAL; those diagnostic skips are not live integration passes and do not alter the dedicated 102/102 zero-skip database result.

## Live integration and hosted CI

The trigger-based PostgreSQL integration test is included in `scripts/test-integration-live.js`'s discovered `test/integration/*.test.js` set. It creates isolated site/user fixtures, injects a `23505` failure on `audit_events` for the target site, verifies rollback of content, collaboration checkpoint, revision, workflow, outbox and audit rows, removes the trigger, retries, and checks that one correlated audit and one complete write set commit.

That live integration test was **not run locally** because this worktree had no `.env`, `DATABASE_URL` or enabled disposable PostgreSQL/Memgraph configuration; it was skipped in the local focused run. It subsequently ran successfully in hosted PR workflow #666, as described above. Local absence of a database is not represented as a test pass.

## Assurance and release boundary

F1.37 is maintainer-led implementation work under issue #124. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. This candidate does not satisfy or waive those gates. At the time of this candidate-local snapshot, F1.37 had not yet merged. It subsequently merged through PR #163 at main SHA `212df05a2c2af5b222eb6a06a798f2ce5ba6cabc`; exact-main workflow #667 passed all seven jobs. Readiness remains NOT_PRODUCTION_CERTIFIED and production NO-GO. No package version, schema, migration, dependency, public API, lockfile or SemVer change is intended.

## Design and plan

- [F1.37 design](../superpowers/specs/2026-11-15-f1-37-content-draft-audit-atomicity-design.md)
- [F1.37 implementation plan](../superpowers/plans/2026-11-15-f1-37-content-draft-audit-atomicity.md)