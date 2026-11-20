# F1.58 — Community Feed Write Authorization Race Report

**Status:** Merged through PR #228; exact-main workflow #44675989750 passed 7/7 jobs; no formal PR review submissions were recorded
**Date:** 19 November 2026 (America/Chicago)
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
**Original base main SHA:** `a1e0fb0cf605c6f34f9e85c252593ae1b508e0b2` (documentation-only PR #226 after F1.57)
**Merge / current main SHA:** `619819230dac2e8d169ce71af7c6a41f0630cf27`
**Merged PR:** [#228](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/228) (merged 19 November 2026 America/Chicago; 20 November 2026 UTC)
**Candidate head before merge:** `9b7638e73baf64c8e06238ea5d7dad962952a7a3`
**Candidate branch:** `security/f1-58-community-feed-write-authorization-2026-11-19`
**Issue:** [#227 — Revalidate community feed writes at the final authorization boundary](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/227)
**Parent:** [#124 — Maintainer-led tenant-isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Package:** `virgoscorpio-hub@0.6.2` (private, unreleased; unchanged)

## 1. Executive summary

F1.58 addresses a reproducible time-of-check/time-of-use (TOCTOU) authorization gap in `POST /api/v1/sites/:siteId/community/feed`. Before the change, the route performed site, actor and group checks during request preflight, then inserted the activity in a separate unguarded database operation. A lifecycle change between those steps could leave stale authorization in effect.

The merged change reuses the existing PostgreSQL `withTransaction` helper and the established site-first lifecycle lock ordering. It revalidates active actor, selected-site membership and applicable group membership in the same transaction as the final `INSERT ... SELECT`. It also reads the target group's current privacy while holding the group row lock so private/hidden group posts cannot become broadly visible because privacy changed after preflight.

The change preserves current routes, request/response shape, privacy semantics and error contracts. It introduces no runtime helper abstraction, schema migration, endpoint, runtime dependency, lockfile or package-version change. A small test-only PostgreSQL lock-wait helper was extracted from an existing integration suite and reused by the new feed serialization tests.

**Merged outcome:** the focused PostgreSQL 18 integration set passed **58/58** with zero failures/skips across community-feed privacy (22/22) and adjacent tenant community-object isolation (36/36). Local `npm run check` passed **667/670** (zero failures, three conditional skips); artifact verification covered 238 required paths / 269 JavaScript files; `npm audit --audit-level=low` found **0 vulnerabilities**. The final candidate push/PR workflows **#44674773963** and **#44674782236** passed on head SHA `9b7638e73baf64c8e06238ea5d7dad962952a7a3`. PR #228 merged at `619819230dac2e8d169ce71af7c6a41f0630cf27`; the exact-main follow-up validation is recorded below. GitHub records zero formal review submissions on PR #228, so this merge is not independent security approval.

## 2. Reproduced defect and regression design

The affected route previously executed these independent steps:

1. Resolve selected-site context and run authorization preflight.
2. For comments, read the parent activity and inherit its group/visibility scope.
3. For group posts, query active group membership.
4. Insert into `social_activities` without revalidating actor/account/site/group state at the write boundary.

A concurrent actor disablement, selected-site membership deletion, or private-group membership ban after preflight could therefore race with the final insert.

The two-site PostgreSQL suite first injects four lifecycle changes after route preflight and immediately before the write transaction begins: actor disablement, selected-site membership revocation, private-group membership revocation, and a parent group changing from public to private for a non-member commenter. Each ineligible actor must receive HTTP 403 with no persisted activity and unchanged Site A and Site B feed, group, membership, audit and outbox snapshots. A fifth positive-control scenario proves an eligible group member can still comment after the privacy change and that the final inserted comment is narrowed to `group` visibility. A separate four-case lock-contention suite holds the user, selected-site membership, group-membership or group row lock, confirms the feed write is actually waiting in PostgreSQL, commits the lifecycle change, and then verifies the final write observes that committed state.

| Injected lifecycle change | Expected final response | Error contract |
|---|---:|---|
| Authenticated actor becomes disabled | 403 | `ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN` |
| Actor loses selected-site membership | 403 | `ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN` |
| Actor's private-group membership becomes banned | 403 | `ERR_VIRGOSCORPIO_HUB_GROUP_MEMBERSHIP` |
| Parent group becomes private before an unauthorized site member comments | 403 | `ERR_VIRGOSCORPIO_HUB_GROUP_MEMBERSHIP` |

The post-preflight cases commit the lifecycle mutation before `BEGIN`, which deterministically proves the final transaction sees a newer authorization state. The separate serialization cases hold a real row lock, verify `wait_event_type='Lock'` for the final feed statement in `pg_stat_activity`, then commit the state change and prove the waiting transaction rechecks it. Both sides of the TOCTOU boundary are therefore covered without relying on scheduler timing.

## 3. Implementation

### Transaction and lock order

The feed write now reuses `withTransaction(localPool, ...)`. Within the transaction it follows the established lifecycle order:

1. Selected site row: `FOR KEY SHARE`.
2. Authenticated actor user row: `FOR UPDATE`.
3. All selected-site membership rows for that actor, ordered deterministically: `FOR UPDATE`.
4. Site-scoped target group row: `FOR UPDATE`, dependent on the selected-site membership lock.
5. Actor's membership row(s) in that target group, deterministically ordered: `FOR UPDATE`.

This preserves the existing site-before-membership ordering used by membership lifecycle operations and serializes actor/group eligibility changes against the activity insert.

### Final write predicates

The final `INSERT ... SELECT` requires the actor to remain active and to retain at least one membership in the selected site. Where group eligibility is required, an active membership in the site-scoped target group must also still exist.

Group membership remains required for:
- all group posts; and
- comments whose inherited scope is group-visible or whose parent group is private/hidden.

Public/member comments that do not require private-group membership retain their existing access behavior. Comments continue to inherit the parent activity's group and visibility; caller-supplied group IDs cannot move the comment to another scope.

The final visibility decision is recomputed from the locked current group privacy for both group posts and comments. A group that becomes private/hidden during the request cannot receive a newly inserted post or comment with broader member visibility merely because preflight observed its earlier privacy state. An eligible group member retains the ability to comment, but the inserted comment is narrowed to `group` visibility.

If the final guarded insert produces no row, the route returns the existing applicable 403 error contract. Successful responses retain the existing `{ activity, requestId }` shape.

### Reuse and scope discipline

- Reuses the existing `withTransaction` transaction seam.
- Reuses established site/user/membership/group lock-ordering patterns from adjacent community lifecycle fixes.
- Adds no new runtime transaction utility or authorization framework.
- Extracts the existing PostgreSQL `pg_stat_activity` lock-wait probe into one test-only helper shared by two integration suites, removing duplicated test code while preserving the adjacent suite's concurrency behavior.
- Adds no database migration, endpoint, dependency or public API contract.
- Does not alter the package version or release classification.

## 4. Validation evidence

| Check | Result | Qualification |
|---|---|---|
| Stale-authorization denial regressions | **4 deterministic scenarios** | Account disablement, selected-site membership revocation, private-group membership ban and parent-group privacy change are injected after route preflight and denied at the final write. |
| Locked privacy-transition positive control | **1 scenario** | An eligible member can comment after the parent group becomes private; the new comment is persisted with `group` visibility. |
| Focused community-feed PostgreSQL 18 integration | **22/22 passed** | Zero failures, skips or TODOs; includes preflight races, actual row-lock contention and existing privacy/comment-parent controls. |
| Adjacent tenant community-object integration | **36/36 passed** | Confirms the shared PostgreSQL lock-wait helper still supports existing group, friendship and community isolation concurrency tests. |
| Combined focused PostgreSQL 18 integration | **58/58 passed** | Zero failures, skips or TODOs across both suites on the disposable F1.58 database. |
| Local `npm run check` | **667 passed / 0 failed / 3 skipped** | Full run exit code 0; skips are environment/platform-conditional and are not counted as passes. |
| Dependency audit | **PASS** | `npm audit --audit-level=low`: 0 vulnerabilities. |
| Current-tree secret scan | **PASS** | Gitleaks 8.30.1 scanned approximately 7.13 MB; no findings. |
| Git-history secret scan | **PASS** | Gitleaks scanned 439 commits / approximately 14.60 MB; no findings. |
| Artifact verification | **PASS** | 238 required paths and 269 JavaScript files syntax-checked. |
| Tenant-isolation inventory | **PASS / regenerated** | 28 route/flow families, 80 declared route patterns, 21 implementation sources, 57 referenced test files. |
| Hosted Node.js 22.23.4 matrix | **PASS** | 670/670 Hub tests and 94/94 EnginEx tests; zero failures/skips/TODOs. |
| Hosted Node.js 24.22.1 matrix | **PASS** | 670/670 Hub tests and 94/94 EnginEx tests; zero failures/skips/TODOs. |
| Hosted PostgreSQL 18 / Memgraph / Redis integration | **180/180 PASS** | Zero failures/skips/TODOs; live producer evidence includes PostgreSQL/Memgraph integration, Redis outage/recovery qualification, multi-node collaboration and graph rebuild. |
| Fresh/idempotent database migrations | **PASS** | All 18 migrations applied on first pass and all 18 skipped on idempotent second pass; disposable database dropped. |
| Browser editor/accessibility smoke | **9/9 PASS** | Browser job passed all nine smoke tests; this is not manual WCAG or screen-reader acceptance. |
| CodeQL security analysis | **PASS** | PR and push CodeQL analyses completed successfully. |
| Candidate CI evidence consolidation | **PASS** | Revision-bound manifests/checksums verified; readiness snapshot 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE, `readyForProduction=false`. |
| Signed lockfile/SBOM attestation | **PASS** | Exact-main workflow #44675989750 generated and verified signed SLSA provenance and SBOM attestations for the mainline dependency lockfile/SBOM. |
| Independent assurance | **OPEN / NOT PERFORMED** | Maintainer regression evidence does not satisfy independent review #14 or assessment #25. |

### Exact-main post-merge validation — workflow #44675989750

Exact-main push [workflow #44675989750](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44675989750) completed successfully on merge SHA `619819230dac2e8d169ce71af7c6a41f0630cf27`; all **7/7 jobs passed**.

| Producer / gate | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 670/670 Hub and 94/94 EnginEx tests; zero failures/skips/TODOs. |
| Node.js 24.22.1 | PASS | 670/670 Hub and 94/94 EnginEx tests; zero failures/skips/TODOs. |
| PostgreSQL 18 / Memgraph / Redis live integration | PASS | 180/180 tests; zero failures, skips or TODOs. |
| Fresh and idempotent migrations | PASS | All 18 migrations applied on first pass; all 18 were skipped as already applied on the second pass. |
| Browser editor/accessibility smoke | PASS | 9/9 Playwright smoke tests; this is not manual WCAG or screen-reader acceptance. |
| CodeQL | PASS | Static analysis completed; not an independent application-security review. |
| Signed lockfile/SBOM attestation | PASS | Mainline SLSA provenance and SBOM attestations created and cryptographically verified. |
| Exact-source evidence consolidation | PASS | Revision-bound producer manifests, checksums and mainline evidence passed aggregation. |

The source-bound readiness bundle is GitHub Actions artifact `14601349640`. It is bound to `619819230dac2e8d169ce71af7c6a41f0630cf27`; `release-readiness.json` SHA-256 is `03ef7a8de44133ed6f0861187df9a68448d5e1d6ee59c6aa243deeac30b5ed49`, and `release-readiness-ci.json` SHA-256 is `5ee4b594d8873581ee78cd0925dacf5e6c5a24ac7d640b4107a36aaa77380ca6`. The live PostgreSQL/Memgraph producer manifest SHA-256 is `c21525e3194fa45df426a08ac5ca3f518ad526c3e96811b9c46c528387262237`.

The exact-main readiness result remains **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**; `readyForProduction=false`; `NOT_PRODUCTION_CERTIFIED`. The PARTIAL items remain the service-less integration diagnostic (47 tests per supported runtime, 1 pass / 46 skipped; not live-test evidence) and the required human dependency/license review (#23). This diagnostic is distinct from the separate 180/180 live integration producer, which passed with zero skips. Independent reviews #14 and #25 remain missing evidence.

**Review caveat:** PR #228 was merged without any formal review submission recorded by GitHub. The implementation and exact-main CI are maintainer/automation evidence only. Independent reviewers must assess the exact merged source SHA; neither #14 nor #25 is closed or satisfied by this merge.

The full local test command initially identified that the generated tenant-isolation inventory had become stale due to the route source change. The existing inventory generator was run; it regenerated the JSON and Markdown map at the unchanged 28/80/21/57 cardinality. The full `npm run check` was rerun after regeneration and passed.

Local validation used Node.js 26.12.1 on Windows. The supported hosted Node matrix remains 22.23.4 and 24.22.1; local Node 26 evidence does not expand the product support declaration.

The focused tests used a dedicated disposable PostgreSQL 18 database, `virgoscorpio_hub_f1_58_test`, after applying the repository migrations. They did not use a production database.\n\n### Local dependency-environment caveat\n\nThe optional `npm ls --depth=0` diagnostic was not clean. The isolated candidate worktree has no local `node_modules`; the shared `node_modules` in the original main checkout contains an `enginex-ai-native` file link pointing outside this repository to a separate `VirgoScorpio Hub v0.5.1` checkout. npm therefore reports the file dependency as invalid when run at the original checkout root, and reports the candidate worktree's local dependency tree as missing when run there. The candidate's vendored EnginEx submodule itself is present at the pinned commit, and the full `npm run check` plus both focused PostgreSQL suites passed using the existing Node module resolution. The original main checkout also contains pre-existing unrelated uncommitted files; F1.58 work was isolated in its dedicated worktree and none of those files or links were changed. This is an environment/setup caveat, not a candidate package/lockfile change.

## 5. Files changed

| File | Reason |
|---|---|
| `apps/api/src/platform-routes.js` | Guarded feed-write transaction and final actor/site/group eligibility checks. |
| `test/integration/community-feed-privacy.integration.test.js` | Deterministic account/site/group/privacy race regressions, four actual row-lock serialization cases, a successful visibility-narrowing control, and no-side-effect snapshots. |
| `test/helpers/postgres-locks.js` | Shared bounded PostgreSQL lock-wait probe reused by community-feed and tenant community-object integration suites. |
| `test/integration/tenant-community-object-isolation.integration.test.js` | Reuses the extracted lock-wait helper; existing 36-test suite remains green. |
| `artifacts/security/tenant-isolation-route-inventory.json` | Generated source-anchored inventory refresh. |
| `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md` | Generated route/capability map refresh. |

The generated inventory remains a maintainer navigation and drift-detection aid, not proof of exhaustive route discovery or independent assurance.

## 6. Release-gate impact

F1.58 is merged at main SHA `619819230dac2e8d169ce71af7c6a41f0630cf27`. Exact-main workflow [#44675989750](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44675989750) passed 7/7 jobs on that exact source, including both supported Node matrices, the live PostgreSQL 18/Memgraph/Redis producer, fresh and idempotent migrations, browser smoke, CodeQL, signed lockfile/SBOM attestations and exact-source evidence consolidation. The source-bound readiness bundle is artifact `14601349640`.

| Classification | Current source-bound count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

`readyForProduction=false`; final classification remains `NOT_PRODUCTION_CERTIFIED`. **Production remains NO-GO.** The two PARTIAL classifications are the service-less integration diagnostic (47 tests per supported Node runtime, 1 pass / 46 skipped; skipped cases are not live validation) and qualified human dependency/license review #23. The separate mainline live integration suite passed 180/180 with zero skips.

GitHub records zero formal review submissions on PR #228. The merge and green mainline CI are maintainer/automation evidence only; independent tenant-isolation review #14 and platform security assessment #25 remain open and not performed. The 14 missing production-evidence categories remain: independent tenant isolation (#14); identity provider and recovery (#15); malware scanning corpus/legacy clearance (#16); live cloud storage (#17); Stripe lifecycle (#18); manual accessibility/browser acceptance (#19); commerce parity (#20); community parity (#21); plugin isolation (#22); qualified human dependency/license/SBOM review (#23); load/fault/backup/restore (#24); independent platform security assessment (#25); operations and release approval (#26); and production observability. Product/provider scope #13 and zero-reserve governance #32 also remain separate open decisions.

No assessor engagement, spending, risk waiver, production-data test, deployment, release tag, GitHub Release, package publication or certification is authorized. Package `0.6.2` stays private and unreleased. No SemVer increment is warranted.

## 7. Next steps

1. **Completed:** F1.58 merge and exact-main validation are source-bound to `619819230dac2e8d169ce71af7c6a41f0630cf27`; workflow #44675989750 passed 7/7 jobs, including the mainline signed lockfile/SBOM attestation.
2. **Required retrospective review:** PR #228 merged without a formal review submission. Do not treat merge status or automation as review approval. Obtain an independent review of the merged SQL lock order and final `INSERT ... SELECT` predicates against membership removal, group join and group creation lifecycle paths.
3. **Independent assurance:** keep #14 (tenant isolation/authorization) and #25 (platform security assessment) open until qualified independent reviewers deliver source-bound findings and retest evidence for the exact merged source. Include the F1.58 feed-write path and adjacent community lifecycle transactions in scope.
4. Continue source-anchored review of adjacent site-scoped community lifecycle mutations only when a concrete invariant gap is reproduced. Do not pre-create F1.59 or add generalized helpers without evidence.
5. Keep provider, product, legal, operations and production-readiness gates separate. Package `0.6.2` remains private/unreleased; no SemVer increment, tag, publication, deployment or certification is authorized.

**Evidence boundary:** F1.58 is merged maintainer-led authorization hardening with passing exact-main CI and signed mainline supply-chain attestations. The PR had zero formal review submissions; these implementation, test and workflow results are maintainer/automation evidence only, not independent assurance. Independent tenant review #14, platform security assessment #25 and all provider/product/legal/operational release gates remain separate.
