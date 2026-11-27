# VirgoScorpio Hub 0.6.2 — Release Gate and Development Status Report

**Report date:** 27 November 2026 (America/Chicago)  
**Repository:** https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub  
**Verified main:** `4c1052988a8db57d16ca17c267ffb903907c9f69`  
**Exact-main workflow:** [#45935558396](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45935558396) — success, 7/7 jobs  
**Canonical readiness artifact:** [#15169989179](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45935558396/artifacts/15169989179)  
**Readiness artifact digest:** `sha256:2dabbadcb68f4eba3466b3133e2b0f4afbf5eac92528bef8c5a46b25d20cd1fd9`  
**Package:** `virgoscorpio-hub@0.6.2` — private, unreleased  
**Release decision:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

> This report distinguishes source-bound mainline evidence from unmerged PR candidates and local maintainer validation. Passing CI does not establish independent security assurance, provider acceptance, product parity, operational recovery, governance or release-owner approval. Do not tag, publish, deploy or promote 0.6.2.

## 1. Executive decision

The current mainline revision `4c1052988a8db57d16ca17c267ffb903907c9f69` includes F1.74 / PR #306, which replaced process-local password-reset request handling with a PostgreSQL-backed durable queue. The exact-main workflow #45935558396 completed all seven jobs successfully.

The canonical source-bound readiness artifact remains:

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

It records `readyForProduction=false` and `NOT_PRODUCTION_CERTIFIED`. Production remains **NO-GO**.

The two PARTIAL gates are qualified human dependency/lockfile review and the service-less integration diagnostic (1 pass / 56 skipped). Those skipped diagnostic tests are not live integration evidence. The hosted PostgreSQL/Memgraph suite separately passed 202/202 with zero failures or skips.

A readiness-reporting defect was identified: the same mainline workflow applied all 22 migrations to a fresh disposable PostgreSQL database and verified all 22 on the idempotent second pass, while the static migration-artifact row in the generated readiness report still counted 19. The readiness script's manually maintained 0001–0019 allow-list had fallen behind the migration directory. Open PR #307 corrects the discrepancy by sharing one filesystem-derived inventory contract across static readiness, actual migration execution and supplemental fresh-migration evidence generation; its exact-head push and PR workflows pass on code head `5085695b5fa938e4036bd2a81f4194a41b4c4160`. PR #308 separately hardens a community-message authorization race and remains intentionally stacked on #307.

## 2. Exact-main source and CI evidence

| Evidence | Exact-main result |
|---|---|
| Main SHA | `4c1052988a8db57d16ca17c267ffb903907c9f69` |
| F1.74 | Merged via PR #306 |
| Node.js 22.23.4 | 1,131/1,131 Hub tests; 94/94 EnginEx tests |
| Node.js 24.22.1 | 1,131/1,131 Hub tests; 94/94 EnginEx tests |
| Hosted PostgreSQL/Memgraph | 202/202; zero failures and skips |
| Fresh migrations | 22/22 applied |
| Idempotent migration pass | 22/22 already applied |
| Browser editor/accessibility smoke | Passed; not full WCAG or screen-reader acceptance |
| CodeQL | Passed |
| Lockfile/SBOM provenance | Signed mainline attestation and verification passed |
| SBOM parity | Passed |
| Exact-source evidence consolidation | Passed |
| Overall workflow | 7/7 required jobs successful |

The canonical readiness artifact is bound to this main SHA. Its archive digest is recorded at the top of this report. Do not rewrite or relabel the artifact after the fact; it is historical evidence for its exact source revision.

### 2.1 Migration inventory discrepancy

The 26 November exact-main readiness JSON/Markdown reports 19 migration files because the pre-fix validator ended its static list at `0019_library_variant_source_version.sql`. On the same source SHA, the hosted database job applied 22/22 migrations and skipped 22/22 on the second pass. Therefore:

- The 19-file static count is stale and must not be represented as the live migration result.
- The hosted live migration evidence remains valid for its exact main SHA.
- The prior source-bound readiness artifact is retained unchanged.
- PR #307 supplies the static inventory correction for future source revisions; its new code must pass fresh exact-head CI before it becomes authoritative mainline behavior.

## 3. Formal production evidence gates

### 3.1 PARTIAL gates

| Gate | Status | Outstanding work |
|---|---|---|
| Qualified human dependency/license review | PARTIAL | A clean install, npm audit, CodeQL, SBOM and signature/provenance automation exist; qualified human dependency/license and distribution-risk disposition with recorded sign-off is still missing. |
| Service-less integration diagnostic | PARTIAL | Current diagnostic has 1 pass / 56 skips. Skips are not live integration tests. Hosted PostgreSQL/Memgraph evidence is separately PASS at 202/202. |

### 3.2 Fourteen missing evidence categories

| # | Gate | Tracker / missing acceptance |
|---:|---|---|
| 1 | Independent tenant/site authorization and isolation review | #14; an internal route inventory or maintainer review is not independent assessment. |
| 2 | Live identity-provider end-to-end | Deployment-backed OIDC/SAML, email delivery, MFA recovery and identity-provider failure-path acceptance. |
| 3 | Malware scanning and quarantine | Live ClamAV, malicious-file corpus, upload policy and legacy-asset quarantine proof. |
| 4 | Cloud object storage | Real S3/GCS/Azure-compatible credentials, least privilege, lifecycle and failure tests. |
| 5 | Payments and inventory lifecycle | Stripe webhook replay/idempotency, ambiguous-outcome recovery and complete inventory acceptance. |
| 6 | Full browser/accessibility acceptance | Full editor journeys, manual WCAG review and assistive-technology/screen-reader acceptance. |
| 7 | Commerce parity | Tax, shipping, coupons/discounts, refunds, fulfilment, digital downloads and subscriptions. |
| 8 | Community parity | Group privacy, abuse/spam controls, search, export/deletion and forum acceptance. |
| 9 | Plugin/container isolation | Signed plugin distribution plus adversarial runtime/container-isolation evidence. |
| 10 | Qualified security/dependency evidence review | Human review of lockfile, dependency/license inventory, SBOM, provenance and CodeQL; #23. |
| 11 | Reliability and recovery | Load/soak, fault injection, backup/restore and recovery drills; #24. |
| 12 | Independent platform security assessment | Independent assessor report, severe/high finding remediation and retest; #25. |
| 13 | Operations and release-owner approval | Deployment runbooks, secrets, rollback, monitoring and named approver; #26 and #13. |
| 14 | Production observability/governance | Approved OTLP backend, security/governance, retention, ownership and delivery evidence. |

Each gate must be tied to the exact candidate version and full source SHA. Any relevant source change invalidates prior source-bound evidence and requires regeneration. Automated checks, maintainer inventories and PR status counts do not replace independent or operational evidence.

## 4. Current GitHub pull requests

### PR #307 — dynamic migration-readiness inventory

[PR #307](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/307) is **OPEN / READY FOR REVIEW**, based directly on main. Branch: `fix/release-readiness-dynamic-migrations-2026-11-27`; current code-bearing head: `5085695b5fa938e4036bd2a81f4194a41b4c4160`.

The implementation extracts `scripts/migration-inventory.js` as the single migration-inventory contract shared by three consumers: static release-readiness reporting (`scripts/release-readiness.js`), actual database execution (`scripts/migrate.js`), and supplemental fresh-migration evidence generation (`scripts/test-fresh-migrations.js`). The helper validates four-digit, non-zero migration versions and the repository's suffix naming convention; it fails closed on malformed SQL filenames, duplicate versions, sequence gaps and SQL-named non-regular entries. Both the executor and evidence runner validate the inventory before opening a database connection or creating a disposable database, preventing readiness/execution drift and avoiding database side effects for an invalid migration directory. Live application and idempotency remain separate evidence gates. Regression tests cover the 0022 migration, gaps, duplicates, malformed names (including dotted and non-four-digit names), SQL-named directories and non-SQL entries.

Local validation on Windows x64 / Node.js v26.12.1, against the current PR code-bearing head, is:

| Check | Result |
|---|---|
| Focused migration inventory tests | 6/6 passed |
| Full top-level repository unit glob | 1,137 tests; 1,134 passed; 0 failed; 3 platform-specific skips |
| `node scripts/verify.js` | Passed; 241 required paths / 316 JavaScript files syntax-checked |
| `node --check scripts/migrate.js` and `node --check scripts/test-fresh-migrations.js` | Passed after aligning executor and evidence-runner imports with the shared inventory helper. |
| Static readiness inventory diagnostic | `node scripts/release-readiness.js --skip-tests` reported 22 numbered migrations contiguous from 0001 through 0022. The command explicitly skips tests and live integration; its local readiness output is not a clean-source release artifact or release evidence. |
| `git diff --check` and `git diff --cached --check` | Passed |
| Live local PostgreSQL | Not run; no dedicated `TEST_DATABASE_URL` was configured |
| Hosted exact-head checks on previous code-bearing head `5c3c5a482feffab674b3098bd565eebadb5ca9a3` | PASS — push #45951846382 and PR #45951852778 passed the applicable functional/security/evidence jobs; this evidence predates the shared-executor/evidence-runner alignment in `5085695`. |
| Hosted exact-head checks on current code-bearing head `5085695b5fa938e4036bd2a81f4194a41b4c4160` | **PASS** — push [#45954348958](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45954348958) and PR [#45954356918](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45954356918) both completed successfully. Node 22/24, hosted PostgreSQL/Memgraph (including fresh/idempotent migrations and zero-skip integration), browser smoke, CodeQL, dependency audit/SBOM generation and candidate evidence consolidation all passed. Mainline-only signed lockfile/SBOM attestation was skipped by design and remains required after merge on main. |

Hosted CI history on the original PR #307 head `94bebce5e6672220202d8c6d068085058244f647`:

- PR-context workflow [#45938092357](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45938092357) passed its applicable functional/security jobs; the mainline-only lockfile/SBOM attestation was skipped by design.
- Push workflow [#45938087233](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45938087233) attempt 1 failed during live integration: the existing moderation/revocation concurrency test did not observe the expected site-lock wait within its five-second bound (200 passed / 2 failed / 0 skipped). The safety cleanup also refused a Redis restart because its exact container ID was unavailable in that step's environment; it correctly avoided a container-wide action.
- A failed-job rerun (attempt 2) passed the Node 22/24 matrices, browser smoke, CodeQL and PostgreSQL/Memgraph integration. Candidate evidence consolidation nevertheless failed because the rerun's producer evidence carried `runAttempt=1` while the aggregate expected attempt 2. This is a run-attempt evidence-binding limitation; it does not demonstrate a regression in the migration inventory code.
- On the immediately preceding head `4cff048fe25e7f058fd5b1640b5d337c88483618`, push [#45951332722](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45951332722) passed, but PR [#45951338234](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45951338234) exposed a flaky existing moderation/revocation concurrency test: its query-fragment-only lock observer failed to detect a site-row wait within five seconds. The migration inventory and Node matrices passed; the failure was in test lock observation, not readiness inventory behavior.
- The final candidate fixes this test-only observation using the already-supported relation-aware lock observer (`relationName: 'sites'`), matching the site-lock evidence used in PR #308. Both fresh final-head workflows passed on `5c3c5a482feffab674b3098bd565eebadb5ca9a3`: push [#45951846382](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45951846382) and PR [#45951852778](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45951852778). Each passed Node 22/24, PostgreSQL/Memgraph with zero skips, browser smoke, CodeQL and candidate evidence consolidation. The mainline-only attestation was skipped as expected for candidate events.

GitHub currently lists PR #307 as ready for review and records one repository-owner `COMMENTED` self-review, zero `APPROVED` reviews, and zero inline review threads. The checklist review documents maintainer inspection but is not an independent review or a formal approval from another maintainer. The current three-consumer inventory contract and both passing exact-head CI runs have been inspected. GitHub's COMMENTED self-review is maintainer evidence only, not an APPROVED review or independent assessment. Merge remains blocked pending the repository's required approval/merge policy; do not infer approval from a COMMENTED review.

### PR #308 — community message membership revalidation

[PR #308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/308) is **OPEN / READY FOR REVIEW**, intentionally stacked on PR #307 through base branch `fix/release-readiness-dynamic-migrations-2026-11-27`. Candidate head: `239d26270e6c58d3a50ea2d87dd192c400a629f4`.

The request preflight membership check can become stale while a message request is parsed/routed. Conversation membership alone does not prove the sender remains an active site member. The candidate introduces shared transaction-scoped helpers in `packages/community/src/workflows.js`; the lock order is:

`sites FOR KEY SHARE` → `users / site_memberships / roles FOR SHARE` → conversation/member reads → message and notification writes.

Message creation revalidates the active site membership within the same transaction before persistence or notification side effects. The same helper replaces duplicated inline lock/authorization code in the existing moderation flow, preserving capability semantics and the non-production developer bypass. Regression coverage includes positive membership, revoked membership rollback, developer bypass and a PostgreSQL concurrency test that commits member revocation before the pending message mutation proceeds.

Exact-head push [#45941295364](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45941295364) and PR [#45941331264](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45941331264) passed their applicable functional/security/evidence jobs. PostgreSQL/Memgraph integration, both Node matrices, browser smoke, CodeQL and evidence consolidation passed. Mainline-only signed attestation was skipped by design. GitHub records one repository-owner `COMMENTED` self-review, zero `APPROVED` reviews and zero inline review threads; this is maintainer evidence, not independent assurance.

PR #308 must not merge before #307. After #307 merges, rebase #308 onto the new main, change its base to `main`, review the rebased diff, and rerun exact-head CI. The change addresses one concrete community messaging race only; parent issue #124 and independent review #14 remain open.

## 5. Merged F1.74 baseline

F1.74 / PR #306 is merged at main SHA `4c1052988a8db57d16ca17c267ffb903907c9f69`. It introduces migration 0022 and a PostgreSQL-backed durable password-reset queue.

- A generic HTTP 202 is returned only after the enqueue transaction commits.
- Transaction-scoped coordination enforces target cooldown and bounded active-queue capacity across API replicas while retaining per-IP ingress throttling.
- Token digest, mail-outbox insertion and queue completion are atomic.
- Worker retries and stale-claim recovery are bounded; terminal failure/expiry cleanup removes sensitive delivery payloads.
- Reset-link expiry is validated fail-closed.
- Low-cardinality queue depth/age telemetry, a dedicated mail worker, a systemd reference unit, operator guidance and a threat model are included.

The pending/retryable mail-outbox payload necessarily carries the reset URL until delivery succeeds or the request expires/terminalizes; the threat model describes the remaining exposure to privileged database readers and backups during that window. Target-host service supervision, secret-file permissions, OTLP routing/alert thresholds and real email-provider behavior are not certified by CI.

PR #274 was closed without merge as superseded by #306. PRs #237–#276 have a disposition count of 27 merged, 13 closed without merge and zero open. This is a PR inventory only; individual Aikido/SAST fingerprints still require export, source mapping and evidence-backed disposition under #234, #235 and #277.

## 6. Active security, governance and engineering work

| Tracker | Scope | Current status |
|---|---|---|
| #124 | Maintainer-led tenant/site authorization hardening | OPEN; continue source-anchored route and mutation review |
| #14 | Independent tenant/site isolation review | OPEN / NOT PERFORMED |
| #23 | Qualified human lockfile/SBOM/dependency review | OPEN / PARTIAL |
| #24 | Load/soak, fault injection and backup/restore | OPEN |
| #25 | Independent platform security assessment | OPEN / NOT PERFORMED |
| #26 | Operations runbooks and named release-owner approval | OPEN |
| #13 | Approve 0.6.2 candidate scope/provider matrix | OPEN |
| #32 | Operating, compensation, capital and zero-reserve controls | OPEN |
| #234 / #235 / #277 | Aikido SAST, secret-history, domain coverage and autofix-batch triage | OPEN; scanner fingerprints not closed by PR disposition count |

No candidate CI or maintainer-authored change should be used to close these independent assurance or governance requirements.

## 7. Recommended development sequence

1. **Complete PR #307 approval and merge gate.** The shared four-digit inventory governs static readiness, the actual migration executor and fresh-migration evidence generation. Push #45954348958 and PR #45954356918 both passed on code head `5085695b5fa938e4036bd2a81f4194a41b4c4160`. The maintainer self-review is `COMMENTED`; obtain the repository-required `APPROVED` review before merge. Keep the historical mainline artifact unchanged; re-run exact-main attestation and evidence consolidation after merge.
2. **Then promote PR #308 from stacked to main-based.** Rebase only after #307 is merged, change the PR base to main, repeat the transaction/lock-order review, and require fresh Node 22/24, PostgreSQL/Memgraph zero-skip, CodeQL and evidence-consolidation checks on the rebased head.
3. **Continue issue #124 using the source-anchored tenant map.** Prioritize concrete authorization gaps at transaction boundaries; avoid speculative feature expansion. Reuse the shared transaction/locking helpers rather than adding duplicate mutation authorization frameworks.
4. **Start independent evidence work** for #14, #23 and #25, then #24, #26, #13 and #32. Continue provider/product/accessibility/observability work only with explicit preview scope and validated operational boundaries.
5. **Keep 0.6.2 unreleased and production NO-GO** until every required readiness gate and release-owner approval is accepted.

## 8. Compatibility, security and release boundary

PR #307 changes release-readiness tooling and tests only: no database migration, runtime route, API/wire response, dependency, lockfile, package-version or SemVer change. PR #308 is intended to change transaction-time authorization behavior and its tests only: no schema/migration, API response-shape, dependency/lockfile, package-version or SemVer change. These are candidate statements and must be reconfirmed against the final reviewed diff and merged source.

PostgreSQL remains authoritative for transactional tenant membership, community messaging and durable queue state. Memgraph remains a rebuildable projection; Redis Pub/Sub/presence remain ephemeral and must not become authorization or durable queue sources. Resource limits, fail-closed behavior, stable lock ordering, bounded retries, PII-minimizing logs and exact-source evidence requirements remain mandatory.

Package `0.6.2` remains private and unreleased. There is no authorization for a SemVer increment, tag, GitHub Release, package publication, production deployment, production-data test or promotion. Controlled non-production development/preview only, within approved scope.

## 9. Evidence links

- Mainline exact-source CI: [workflow #45935558396](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45935558396)
- Canonical mainline readiness artifact: [artifact #15169989179](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45935558396/artifacts/15169989179)
- F1.74 merge: [PR #306](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/306)
- Dynamic migration inventory: [PR #307](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/307)
- Community message revalidation: [PR #308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/308)
- F1.74 post-merge report: [26 November report](2026-11-26-VirgoScorpio-Hub-0.6.2-Post-F1.74-Merge-Report.md)
- Parent tenant-hardening issue: [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- Independent tenant review: [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14)
- Dependency/license review: [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)
- Platform security assessment: [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25)
