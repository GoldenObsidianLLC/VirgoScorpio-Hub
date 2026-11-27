# VirgoScorpio Hub 0.6.2 — Release Gate and Development Status Report

**Report date:** 27 November 2026 (America/Chicago)
**Repository:** https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub

## Current authoritative snapshot — F1.78 / PR #316 (27 November 2026; America/Chicago)

**Exact main:** 840fd5e5dfbcafba0be5c7c80739c4f17a93682c
**Exact-main workflow:** [#46066130972](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46066130972) — success, 7/7 jobs
**Canonical readiness artifact:** [#15230394562](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46066130972/artifacts/15230394562)
**Archive SHA-256:** f01b45d329da8d397d6c1f85db6b1e4be1642f89a76200e3926b99a747019322
**Readiness JSON SHA-256:** f3a645148ab2bd806eb823b4c756d72278667e9f4128ddddd4f0e2f334287876
**Readiness Markdown SHA-256:** 52011ae4f706c776a1b7ef077d181968b99f9a49627364f8cb56da854fc68c99
**CI readiness JSON SHA-256:** ee456c38b00c35d725d69a39f5f3bac8a64a1ad06898acd747b79033a6a3c46a
**CI readiness Markdown SHA-256:** 62030c85fbbcbb3d878b1bd91383e9a05ca478624243e33d6229fa67f8c9fecb
**Package:** virgoscorpio-hub@0.6.2 — private, unreleased
**Release decision:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

> Passing CI does not establish provider acceptance, product parity, independent security assurance, operational recovery, governance or release-owner approval. Do not tag, publish, deploy or promote 0.6.2.

### 1. Current exact-main engineering evidence

| Gate | Exact-main result on 840fd5e |
|---|---|
| Node.js 22.23.4 | 1,145/1,145 Hub tests and 94/94 EnginEx tests; zero skips |
| Node.js 24.22.1 | 1,145/1,145 Hub tests and 94/94 EnginEx tests; zero skips |
| npm audit | Zero vulnerabilities in both runtime jobs |
| PostgreSQL/Memgraph | 203/203 tests passed; zero failures and zero skips |
| Fresh migrations | 22/22 applied to a disposable PostgreSQL database |
| Idempotent migrations | 22/22 already-applied migrations skipped on second pass |
| Memgraph outage | Live outage/replay test passed |
| Graph rebuild | Live rebuild and idempotency probe passed |
| F1.78 read-marker races | GET messages membership revocation, conversation-read account disablement, notification read-all and specific-read revocation, atomic rollback and two-site snapshots passed |
| Browser smoke | 9/9 passed; not full WCAG or screen-reader acceptance |
| CodeQL | Passed |
| Lockfile/SBOM attestation | Signed mainline attestations created and verified |
| SBOM parity | 200 components / 201 dependency records |
| Overall workflow | 7/7 jobs successful |

Readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED. PARTIALs are qualified human dependency/lockfile review and service-less diagnostics (1 pass / 56 skips); those skips are distinct from the 203/203 hosted live suite.

### 2. F1.78 merged implementation — PR #316 / issue #315

PR [#316](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/316) merged to main at 840fd5e5dfbcafba0be5c7c80739c4f17a93682c; issue [#315](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/315) is closed. Final PR head was 71af5dd0f69497d5791480ea19bdb19589bcc0cd.

The confirmed finding was a request-preflight-to-read-marker authorization gap in the GET conversation-messages path. The route performed request-time site-membership preflight, then listMessages checked only a surviving conversation-member row outside a transaction, advanced last_read_at using a separate pool query, and returned messages. Conversation membership can outlive site membership.

A hosted PostgreSQL barrier reproduced the stale request: pause immediately after request-time site authorization, delete the actor's site-membership row on an independent connection, then resume the real GET handler. Before the fix, the request continued and advanced last_read_at. Pre-fix workflow [#46063371203](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46063371203) reported 203 tests, 202 passed, one failed and zero skipped; the failure was the revocation regression.

The merged implementation reuses the established transaction and site-first authorization helpers:

- GET conversation messages now validates active site membership and current conversation membership inside one transaction before advancing last_read_at and selecting messages. Revoked actors are denied before marker mutation or message disclosure.
- Conversation-read POST now revalidates membership inside a transaction and commits the participant read marker plus related notification read markers atomically.
- Notification read-all and specific-notification read now revalidate active site membership in the transaction that updates read_at.
- Existing response shapes, actor/site scoping, 403 authorization behavior and non-disclosing not-found behavior are preserved. No schema, migration, dependency, lockfile, API response-shape or SemVer change was made.

Hosted integration regressions use real route handlers and barriers to cover GET membership revocation; conversation-read account disablement; notification read-all and specific-read membership revocation; active-member positive controls; two-site snapshots; and rollback when the second conversation/notification marker write fails.

Final PR-head push [#46065565513](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46065565513) and PR-context [#46065609242](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46065609242) both passed. Each passed Node 22/24 (1,145/1,145 Hub tests each), hosted PostgreSQL/Memgraph (203/203, zero failures/skips), browser smoke 9/9, CodeQL and candidate evidence consolidation.

Exact-main workflow [#46066130972](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46066130972) completed 7/7 jobs on merge SHA 840fd5e5dfbcafba0be5c7c80739c4f17a93682c. It passed 22/22 fresh/idempotent migrations, live Memgraph outage and graph-rebuild probes, signed mainline lockfile/SBOM attestations and exact-source evidence consolidation.

Canonical source-bound readiness artifact [#15230394562](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/46066130972/artifacts/15230394562) remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

### 3. Previous merged community authorization increments

- F1.75 / PR #308: community message writes and moderation revalidate active site membership at the write boundary.
- F1.76 / PR #311: report submission revalidates reporter membership and report-status mutation revalidates community:moderate capability.
- F1.77 / PR #313: block creation revalidates actor and target account/membership; unblock revalidates actor membership.
- F1.78 / PR #316: conversation/message and notification read-marker writes revalidate site authorization in the transaction that owns the write.

### 4. Current formal production evidence gates

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

The fourteen missing evidence categories remain those listed in release readiness: independent tenant/site review (#14); live identity/provider E2E; ClamAV corpus/quarantine; real cloud providers; Stripe lifecycle; full browser/WCAG; commerce parity; community parity; signed plugin/adversarial isolation; qualified human dependency/SBOM/provenance/CodeQL review (#23); load/backup/restore (#24); independent platform security assessment (#25); deployment/runbooks/rollback/release-owner approval (#26/#13); production observability/governance.

### 5. Current GitHub issue and PR disposition

- F1.75 / PR #308 merged; F1.76 / PR #311 merged; F1.77 / PR #313 merged; F1.78 / PR #316 merged.
- Issues #310, #312 and #315 are closed; parent issue #124 remains open for broader tenant/site and community workflow review.
- Independent reviews #14/#25 remain open / NOT PERFORMED; qualified dependency/license review #23 remains PARTIAL.
- Load/restore #24, operations/release-owner #26, provider/scope approval #13 and governance #32 remain open.
- Scanner triage #234/#235/#277 remains separate from PR dispositions.

### 6. Recommended development sequence

1. Continue issue #124 with source-anchored review of remaining community and tenant-scoped workflows beyond the message, report, block and read-marker paths already hardened. Require a hosted PostgreSQL barrier and two-site snapshot to confirm any further preflight-to-write or cross-site race before opening another increment.
2. Reuse withTransaction, assertActiveSiteMembership and the established site-first lock order. Preserve HTTP response shapes and non-disclosing not-found behavior; keep coupled writes atomic.
3. Complete independent reviews #14/#25 and human dependency review #23 separately from maintainer tests; then load/restore, provider, product-parity, operations and observability gates.
4. Map individual Aikido/SAST findings under #234/#235/#277 using source evidence and fresh scans.
5. Keep 0.6.2 private/unreleased and production NO-GO until all required gates and release-owner approval are accepted.

### 7. Compatibility and release boundary

F1.78 is security/authorization hardening within 0.6.2. No schema, migration, dependency, lockfile, public API response-shape, package-version or SemVer change. No tag, GitHub Release, publication, production-data test, deployment or promotion is authorized.

## 1. Executive decision

At the original report baseline, main revision `4c1052988a8db57d16ca17c267ffb903907c9f69` included F1.74 / PR #306, which replaced process-local password-reset request handling with a PostgreSQL-backed durable queue. Exact-main workflow #45935558396 completed all seven jobs successfully. The later PR #307 merge and exact-main revalidation are recorded in the post-merge addendum above.

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

A readiness-reporting defect was identified: the original mainline workflow applied all 22 migrations to a fresh disposable PostgreSQL database and verified all 22 on the idempotent second pass, while its static migration-artifact row counted 19. PR #307 has since merged at `5eb906efdd3413cfd8851506f6863daa8afa0dfc`; one filesystem-derived inventory contract now governs static readiness, actual migration execution and fresh-migration evidence generation. Post-merge exact-main workflow #45958544633 passed and its readiness artifact #15180165662 confirms the corrected 22-migration inventory. PR #308 separately hardens a community-message authorization race and has been rebased onto the new main.

## 2. Exact-main source and CI evidence

| Evidence | Exact-main result |
|---|---|
| Original report baseline main SHA (pre-PR #307) | `4c1052988a8db57d16ca17c267ffb903907c9f69` |
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
- PR #307 merged the static inventory correction. Current mainline behavior and source-bound validation are confirmed by exact-main workflow #45958544633 and artifact #15180165662; the earlier pre-merge artifact remains historical.

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

## 4. Current GitHub pull-request and merged-increment record

### PR #307 — merged dynamic migration-readiness inventory

[PR #307](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/307) is **MERGED** to `main` at `5eb906efdd3413cfd8851506f6863daa8afa0dfc`. Final pre-merge code-bearing head: `40a363ab2dbe3effcf8f72a5d1756b2288b037e9`; squash merge is now validated by exact-main workflow #45958544633.

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

GitHub recorded one repository-owner `COMMENTED` self-review, zero `APPROVED` reviews and zero inline review threads on PR #307. The active single-maintainer ruleset [#27803491](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/rules/27803491) requires zero approving reviews; the PR merged under that policy after the exact-head checks passed. The COMMENTED checklist is maintainer evidence only, not independent assurance; issues #14 and #25 remain separate open production gates.

### PR #308 — merged community message membership revalidation

[PR #308](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/308) is **MERGED** to `main` at `4389d05864b0113e7198bbd86eed23d192ec224c`. Final PR head: `18e9ff2be151c70feb2fa06b57f4890f4df98893`.

The request preflight membership check can become stale while a message request is parsed/routed. Conversation membership alone does not prove the sender remains an active site member. The candidate introduces shared transaction-scoped helpers in `packages/community/src/workflows.js`; the lock order is:

`sites FOR KEY SHARE` → `users / site_memberships / roles FOR SHARE` → conversation/member reads → message and notification writes.

Message creation revalidates the active site membership within the same transaction before persistence or notification side effects. The same helper replaces duplicated inline lock/authorization code in the existing moderation flow, preserving capability semantics and the non-production developer bypass. Regression coverage includes positive membership, revoked membership rollback, developer bypass and a PostgreSQL concurrency test that commits member revocation before the pending message mutation proceeds.

Pre-rebase exact-head push [#45941295364](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45941295364) and PR [#45941331264](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45941331264) passed their applicable functional/security/evidence jobs on old SHA `239d262`; these are historical after the rebase. Post-rebase push [#45960983827](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45960983827) passed on `bd6ff39`, and final PR-head push [#45961720288](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45961720288) plus PR-context [#45961729096](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45961729096) both passed on `18e9ff2`. Post-merge exact-main workflow [#45962276960](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45962276960) passed the membership-revocation regression in 203/203 hosted PostgreSQL/Memgraph tests with zero skips; Node 22/24, browser smoke, CodeQL, signed supply-chain attestation and evidence consolidation also passed.

PR #308 is merged and closed. The implementation covers community message creation and the existing moderation mutation only; it does not certify all community workflows or close the parent tenant-isolation hardening issue #124. Independent reviews #14 and #25 remain open production gates.

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

1. **Complete PR #307 merge gate.** The shared four-digit inventory governs static readiness, the actual migration executor and fresh-migration evidence generation. Push #45954348958 and PR #45954356918 both passed on code head `5085695b5fa938e4036bd2a81f4194a41b4c4160`. The active single-maintainer ruleset requires zero approving reviews; once final documentation-head checks pass and review threads remain resolved, merge under that policy. Keep historical mainline evidence unchanged and require fresh exact-main attestation/evidence consolidation after merge.
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
