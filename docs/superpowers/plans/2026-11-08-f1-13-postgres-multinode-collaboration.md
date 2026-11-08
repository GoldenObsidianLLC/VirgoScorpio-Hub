# F1.13 PostgreSQL-backed multi-node collaboration qualification — implementation plan

**Date:** 2026-11-08
**Status:** Implementation, local validation and hosted CI runs #431 and #435 complete. PR #103 was merged into its temporary staging branch, not directly into `main`; after PR #102 merged, PR #104 was opened directly against `main` and remains open pending review/merge.
**Design:** [F1.13 PostgreSQL-backed multi-node collaboration qualification](../specs/2026-11-08-f1-13-postgres-multinode-collaboration-design.md)
**Base:** PR #104 targets `main` directly from the F1.13 feature branch. PR #102 is already merged; PR #103's merge commit was confined to the old staging branch and is not a mainline ancestor.

## Scope guard

Prove the existing collaboration contract across real browser clients, two independently composed API nodes, independent PostgreSQL pools and shared dedicated test-database persistence. Redis remains notification-only. Do not add migrations, runtime dependencies, protocol changes, new public routes or production-readiness claims.

## Work items

- [x] Add a Playwright spec guarded by a dedicated loopback-only `TEST_DATABASE_URL`, explicit PostgreSQL integration flag and credential-free loopback Redis URL.
- [x] Create isolated sites, database-backed users, drafts and site-scoped test identities.
- [x] Run two API nodes with separate PostgreSQL pools and `createPostgresStore` instances, plus independent Redis bridge clients.
- [x] Verify cross-node browser delivery and durable sequence/history through the other node's pool.
- [x] Verify recovery from an injected Redis hint loss using the PostgreSQL-backed heartbeat reconciliation path.
- [x] Verify reconnection and ordered replay after closing one API node and its pool.
- [x] Verify document/site isolation and close all browser/server/Redis/database resources in all paths.
- [x] Add a dedicated isolated Playwright config and package script; do not start the default global API webServer.
- [x] Add the Playwright install and test step to the existing PostgreSQL/Memgraph/Redis CI job after live database integration succeeds.
- [x] Record the focused local test evidence; update the real-time foundation, architecture and roadmap only after the test passed locally. No new ADR was needed because F1.13 verifies existing ADR-019 contracts without changing the architecture.
- [x] Run JavaScript syntax/artifact checks, the focused PostgreSQL-backed browser test, the full `npm run check`, `git diff --check`, review the complete diff and keep unrelated user changes unstaged.
- [x] Pushed the feature branch and opened [PR #103](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/103) against the temporary documentation branch for stacking. The first hosted run (#429) exposed that the default browser smoke config also discovered this integration-only spec; `playwright.config.js` now excludes it while the dedicated PostgreSQL config continues to select it. Corrected hosted run #431 passed all CI jobs. PR #103 merged to the temporary documentation branch; the local commit graph confirmed its merge commit was not reachable from `main`. After PR #102 merged, [PR #104](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/104) was opened directly against `main` using the same feature-branch head. Hosted run #435 (`42494704337`) passed every job for #104. PR #104 remains open pending review/merge; do not merge without authorization. No release, tag or deployment is part of this plan.

## Local validation record (8 November 2026)

- `npm run test:e2e:collaboration:postgres` passed **1/1** locally, using system Chrome, the dedicated loopback PostgreSQL test database and credential-free loopback Redis.
- The test used two independent API nodes, PostgreSQL pools/stores and Redis bridge clients. It passed cross-node operation delivery, durable sequence/history checks, dropped-hint recovery, node-A shutdown, replay on node B, a post-failover write and document/site isolation.
- `npm run check` passed: 230 required artifact paths, 237 JavaScript files syntax-checked, and 565 tests (562 passed, 0 failed, 3 platform skips) on Node.js 26.12.1.
- Hosted CI run #435 (`42494704337`) completed successfully on PR #104; all producer jobs and consolidated revision-bound evidence passed. PR #104 remains open and independent review/merge are pending. The browser test uses a fake test identity service with database-backed fixture users; it does not validate a production identity provider.

## Validation boundaries

A skipped local run is not a pass. A green hosted integration test is evidence for this bounded correctness scenario only; it does not certify production load, failover, security, accessibility, backup/restore or operations. Keep issues #14, #19, #24, #25, #26 and #32 open unless their independent acceptance requirements are separately met.

## SemVer and release

No SemVer increment, dependency change, database migration, release tag, package publication or deployment is planned. The repository remains on the existing unreleased `0.6.2` candidate; production remains NO-GO.
