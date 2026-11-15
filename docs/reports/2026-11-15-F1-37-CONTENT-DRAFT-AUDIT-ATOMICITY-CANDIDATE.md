# F1.37 Page-Draft Save and Audit Atomicity - Candidate Report

**Date:** 15 November 2026
**Issue:** [#162](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/162) (child of #124)
**Candidate branch:** `security/f1-37-content-draft-audit-atomicity-2026-11-15`
**Base main SHA:** `460eff191d84fe422ed4ac15260a8fd6d9100d77` (F1.36)
**Package:** `virgoscorpio-hub@0.6.2` - private and unreleased

> **Status:** Maintainer implementation candidate. This is not merged-mainline evidence, an independent assessment, release approval, or production certification.

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

Local runtime was Node.js 26.12.1, outside the repository's supported hosted matrix (22.23.4 and 24.22.1). The local unit/security suite passed, but it does not replace those supported-runtime CI jobs.

## Live integration and hosted CI

The trigger-based PostgreSQL integration test is included in `scripts/test-integration-live.js`'s discovered `test/integration/*.test.js` set. It creates isolated site/user fixtures, injects a `23505` failure on `audit_events` for the target site, verifies rollback of content, collaboration checkpoint, revision, workflow, outbox and audit rows, removes the trigger, retries, and checks that one correlated audit and one complete write set commit.

That live integration test was **not run locally**: this worktree has no `.env`, `DATABASE_URL` or enabled disposable PostgreSQL/Memgraph configuration. The integration test was observed as skipped in the focused test invocation. Exact-head hosted CI (Node.js 22/24, PostgreSQL/Memgraph, browser/editor, CodeQL and evidence consolidation) remains required before treating the candidate as CI-validated.

## Assurance and release boundary

F1.37 is maintainer-led implementation work under issue #124. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. This candidate does not satisfy or waive those gates. The current mainline remains F1.36; release readiness and production NO-GO status are unchanged. No package version, schema, migration, dependency, public API, lockfile or SemVer change is intended.

## Design and plan

- [F1.37 design](../superpowers/specs/2026-11-15-f1-37-content-draft-audit-atomicity-design.md)
- [F1.37 implementation plan](../superpowers/plans/2026-11-15-f1-37-content-draft-audit-atomicity.md)