# F1.15 Cross-Node Collaboration Authorization Revocation — Plan

**Date:** 8 November 2026

**Status:** Implementation and local validation complete; hosted CI and review pending.

**Branch:** `feat/f1-15-cross-node-auth-revocation-2026-11-08`

**Worktree:** `.worktrees/f1-15-cross-node-auth-revocation-2026-11-08`

## Objective

Qualify the existing site/principal-scoped Redis authorization invalidation path across independent API nodes, using the F1.13 PostgreSQL/Redis real-browser harness. Keep this test-only; change runtime behavior only if a demonstrated defect requires it.

## Work

- [x] Inspect the existing event-hub invalidation selectors, Redis bridge envelope validation, WebSocket base/document subscription lifecycle, and F1.13/F1.14 integration coverage.
- [x] Create independent fake identity snapshots for the two API nodes so node B retains a stale Site A membership until the invalidation is processed.
- [x] Reuse the existing Site A other-document browser client as the remote revocation probe; keep the established four-browser-context footprint.
- [x] Publish Site A/principal invalidation from node A and assert node B closes the matching WebSocket within the bounded gateway heartbeat window.
- [x] Assert a different Site A principal remains connected, a Site B connection remains connected and answers ping, and the revoked document has no committed operations.
- [x] Preserve F1.13 durable operation history, dropped-hint heartbeat repair, node-loss replay/failover, and site/document isolation assertions.
- [x] Regenerate the source-anchored tenant-isolation inventory after changing the integration test tree.
- [x] Reconcile the F1.13/F1.14 docs with actual GitHub merge and hosted-CI state; add F1.15 spec/plan and architecture/roadmap notes.
- [x] Run the dedicated PostgreSQL/Redis real-browser integration scenario: **1/1 passed**.
- [x] Run `npm run security:tenant-inventory`: 27 families, 78 route patterns, 19 source files, 41 test files.
- [x] Run `npm run check`: passed after final inventory regeneration; 566 tests (563 passed, 0 failed, 3 platform skips), 230 required artifact paths and 236 JavaScript files syntax-checked.
- [x] Run `node --check test/e2e/collaboration-postgres-multinode.spec.js` and `git diff --check` after final edits; both passed.
- [ ] Hosted CI for the final F1.15 head.
- [ ] Independent reviewer assessment and approval.
- [ ] Reconcile the promotion branch to `main` after review; do not merge without explicit authorization.

## Validation detail

The dedicated Playwright test was run with the repository's dedicated loopback test PostgreSQL database and a temporary Memurai instance bound only to 127.0.0.1 on a dedicated test port. The temporary Redis-compatible process was stopped after the test. A first ordinary invocation correctly skipped because the test Redis and explicit integration opt-in were not configured in the worktree environment; that skipped run is not counted as a pass. The configured dedicated run passed 1/1.

The full repository check initially detected the expected stale source-anchored inventory after the E2E fixture change. Running the documented `npm run security:tenant-inventory` refreshed the JSON inventory and capability-map digest. After the last E2E assertion was added, the inventory was regenerated again and the final `npm run check` passed: 566 tests (563 passed, 0 failed, 3 platform skips), 230 required artifact paths and 236 JavaScript files syntax-checked.

## GitHub / branch state

- F1.13 PR #104 is merged to `main` at merge commit `c97a9273629bc55be42a4b9bf5239f4313a7e448`.
- F1.14 PR #105 is merged to the temporary F1.13 feature branch at `41d04124376b9475e870407e7a04529082602b69`, not to `main`.
- PR #105 hosted run #441 (`42496533962`) completed successfully across all six jobs. No review submissions were present.
- The combined F1.14/F1.15 branch is pushed at `53c182b8ac074d27441473c24da154ecdd8d0dac` (`docs(security): record F1.15 promotion access limitation`) and tracks `origin/feat/f1-15-cross-node-auth-revocation-2026-11-08`.
- The GitHub integration connector returned HTTP 403 (`Resource not accessible by integration`) on PR creation. The authenticated GitHub CLI then opened [PR #106](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/106) against `main`; it is open, not merged. Hosted CI is running for the current PR head and must pass before merge. No review submissions are present.
- Do not merge or retarget PRs without explicit authorization.

## Boundaries and release

This is maintainer-authored integration regression coverage with fake identity snapshots. It is not a qualified independent security assessment, production identity-provider test, guarantee of Pub/Sub delivery, Redis failover qualification, or production readiness evidence.

Issues #14 and #25 remain open for independent assessment. Issues #19, #24, #26, and #32 remain open under their existing acceptance criteria. Production remains **NO-GO**. Package version remains **0.6.2**; no release, tag, publication, deployment, paid service, or vendor engagement is authorized.
