# VirgoScorpio Hub 0.6.2 — current release-readiness snapshot (26 November 2026; main 5be81f7388c2c32484377b918010ac399cafd574; run #45904695214)

## Current exact-main readiness — 26 November 2026 (America/Chicago)

Current main is 5be81f7388c2c32484377b918010ac399cafd574. Exact-main [Actions run #45904695214](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45904695214) completed all seven required jobs. Canonical source-bound [readiness artifact #15157402047](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45904695214/artifacts/15157402047) was generated at 2026-11-26T22:28:38.206Z; archive SHA-256: 9347b258984f828c298831669c25831936199fcdd663883c04c8655f8d123408.

Node 22.23.4 and 24.22.1 each passed 1,113/1,113 Hub tests and 94/94 EnginEx tests with zero skips; hosted PostgreSQL/Memgraph passed 200/200 with zero failures/skips; all 21 migrations applied fresh and passed the 21/21 idempotent second pass; browser editor/accessibility smoke, CodeQL, npm audit, lockfile/SBOM attestation, SBOM parity and exact-source evidence consolidation passed. Both npm audits reported zero vulnerabilities. The evidence artifact embedded an intermediate in-progress aggregation status; the authoritative Actions run subsequently completed 7/7 successfully.

Readiness is 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false and NOT_PRODUCTION_CERTIFIED. Decision: **NO-GO**. PARTIALs: qualified human dependency/lockfile review (automation and npm ci passed, but reviewer sign-off is absent); service-less diagnostic (1 pass / 54 skips), distinct from the hosted 200/200 integration.

## Fourteen missing production-evidence gates

1. Independent tenant/site authorization and isolation review — #14.
2. Live OIDC/SAML, email delivery, MFA recovery and identity-provider failure-path E2E.
3. Live ClamAV, malicious-file corpus and legacy-asset quarantine.
4. Real S3/GCS/Azure-compatible provider credentials, least privilege and lifecycle tests.
5. Stripe webhook replay/idempotency, ambiguous outcome and inventory lifecycle acceptance.
6. Full browser editor journeys, manual WCAG and screen-reader acceptance; smoke tests are not full sign-off.
7. Commerce parity: tax, shipping, discounts, refunds, fulfilment, downloads and subscriptions.
8. Community parity: group privacy, abuse, search, export/deletion and forum acceptance.
9. Signed plugin pipeline and adversarial container/runtime isolation.
10. Qualified human dependency, SBOM, provenance and CodeQL assessment — #23.
11. Load/soak, fault injection, backup/restore and recovery drills — #24.
12. Independent platform security assessment and severe-finding remediation/retest — #25.
13. Deployment runbooks, secrets, rollback, monitoring and named release-owner approval — #26 and #13.
14. Production OTLP backend, security/governance, retention, ownership and delivery evidence.

Evidence must identify the exact candidate version and full source SHA. A source change invalidates source-bound evidence and requires regeneration. Internal inventories and CI do not substitute for independent reviews.

## Current GitHub disposition

- PR #305 is merged. The only open PR in the verified snapshot is #274, still Changes requested: duplicate handler declaration, generic 202 before non-durable detached work, and mock-only tests that do not exercise the actual route/service/outbox boundary. Do not merge #274 as submitted.
- Other open issues include #277 Aikido PR-batch audit, #235 scan freshness, #234 SAST/secret-history triage, #124 tenant hardening, #14 tenant assurance, #23 dependency review, #24 load/recovery, #25 security review, #26 runbooks/release approval, #13 preview scope/provider acceptance and #32 operating controls.

## F1.74 development continuation

A separate local worktree contains an F1.74 candidate: migration 0022; bounded PostgreSQL reset-request acceptance before 202; cross-replica 120-second target cooldown; atomic hashed-token/mail-outbox/queue completion; bounded worker retry, five-minute stale recovery, eight-attempt terminalization and PII scrubbing; and route/service/worker tests. Targeted queue/route/worker and inventory tests pass 40/40; the full top-level suite passes 1,123/1,126 (3 platform skips, 0 failures) on local Node v26.12.1. The 241-path/310-file verify script passes. No TEST_DATABASE_URL is configured locally, so fresh/idempotent migration 0022 and PostgreSQL queue integration remain unverified; supported Node 22/24 CI is still required. This is not mainline evidence; full suite, real PostgreSQL migration/queue integration, supported-Node matrix, full CI, PR review and merge remain outstanding.

## Release policy

Package 0.6.2 remains private and unreleased. No tag, GitHub Release, publication, SemVer increment, deployment or production promotion while readyForProduction is false. Controlled non-production preview only; live provider and operational acceptance remain required.

## Historical exact-main readiness — 25 November 2026 (F1.71 baseline; superseded by the current snapshot above)

F1.71 / PR #256 merged at main `de16a4275828fa6411800bbaf20c16b51186dc05`. Exact-main [workflow #1396 / run 45693182743](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743) passed all seven jobs. Node 22/24 unit/security/dependency jobs passed; Node 22 logged 965/965 Hub tests with zero skips, and both dependency audits reported zero vulnerabilities. Hosted PostgreSQL/Memgraph passed 195/195 with zero failures/skips; all 19 migrations passed fresh application and idempotent second pass; browser/accessibility smoke passed 9/9; CodeQL, signed lockfile/SBOM attestation and exact-source evidence consolidation passed.

Canonical readiness [artifact #15060181017](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743/artifacts/15060181017) is source-bound to `de16a4275828fa6411800bbaf20c16b51186dc05` and records **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED`, decision **NO-GO**. Mainline signed supply-chain [artifact #15060225901](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743/artifacts/15060225901) passed provenance/signature verification; cryptographic attestation is not qualified human dependency/license approval.

## Historical merged increment — F1.71 MFA enrollment step-up reauthentication

PR [#256](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/256) merged at `de16a4275828fa6411800bbaf20c16b51186dc05`. Enrollment requires current-password proof; when MFA is active, replacement also requires the current TOTP factor or an unused recovery code. The service validates proof under the active-user lock and consumes recovery proof transactionally. Pending secrets do not authenticate. The route reads a bounded 16 KiB JSON body and rejects developer actors before parsing; browser prompts were replaced with masked, resettable input fields. PR-head workflow #1395 and post-merge workflow #1396 passed; no schema, migration, response shape, dependency, lockfile or SemVer change.

## Historical pre-merge candidate — F1.72 public query-loop amplification containment (PR #253; now merged)

PR [#253](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/253) is synchronized with current main. Public page delivery groups repeated query-loop content types and executes at most five site/locale/excluded-page-scoped published-content queries per request, max 12 rows per group. New page documents retain the five-loop validator cap. A narrowly scoped legacy published-page renderer option relaxes only that count check after the public route applies the same database query ceiling; ordinary validators/renderers retain the default, and node/depth/output limits remain enforced.

Exact-head PR workflow [#1398 / run 45695665362](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45695665362) passed Node 22/24 (975/975 each, zero failures/skips), PostgreSQL/Memgraph (195/195, zero failures/skips), 19/19 fresh and idempotent migrations, browser/accessibility (9/9), CodeQL and candidate evidence consolidation (CI EVIDENCE: PASS). PR-context lockfile/SBOM attestation is skipped by design and remains required after merge on main. Local Node.js 26.12.1 npm run check passed 975 tests (972 passed, zero failures, three conditional Windows skips); artifact verification passed 241 required paths / 294 JavaScript files. EnginEx 7.0.0 passed 94 tests (91 passed, zero failures, three conditional Windows skips). npm ci installed 178 packages and npm audit reported zero vulnerabilities (one deprecated transitive package warning only). Tenant inventory is current at 28 families / 80 route patterns / 22 source files / 61 test references. Independent tenant/site review #14, dependency/license review #23 and platform security assessment #25 remain separate open gates.

## Remaining production disposition

Canonical readiness remains **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction=false`, NOT_PRODUCTION_CERTIFIED / NO-GO. Independent tenant/site review #14, qualified dependency/license review #23, platform security assessment #25, provider-specific evidence, operational recovery/observability and release-owner approval remain separate open obligations. Package 0.6.2 remains private and unreleased. No release tag, GitHub Release, publication, SemVer increment, production deployment or promotion is authorized.


## Historical exact-main readiness - 22 November 2026 (America/Chicago; post-PR #294, before F1.68)

Current main is fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d after documentation-only [PR #294](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/294); the latest merged runtime increment remains F1.67 / [PR #293](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/293) at runtime commit 4da6f26730ff0634ffe01f85790bedf0a255c4e3. Exact-main [workflow #45096332836](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836) passed 7/7 jobs on fccd708: Node 22, Node 24, live PostgreSQL/Memgraph integration, browser smoke, CodeQL, signed lockfile/SBOM attestation and exact-source evidence consolidation.

Canonical [mainline readiness artifact #14783736045](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836/artifacts/14783736045) is bound to fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d. ZIP SHA-256 da110efa0f422c6ad6193884831d3b8692557ab75a1dacef821fc5a6a096ac02; readiness JSON SHA-256 83838a770034b091c6321a54e450a9df250ed053b43e88dc87155a0fe88cee78; readiness Markdown SHA-256 2212f7a26d6ff08d7ad8c83088fb9ac722c1e556361ee92120a1e4c93ed596e5. Classification remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; readyForProduction=false; NOT_PRODUCTION_CERTIFIED; NO-GO.

Node 22.23.4 and 24.22.1 each passed the Hub and EnginEx unit/security/dependency jobs. Live PostgreSQL/Memgraph integration passed 194/194, zero failures/skips; 19/19 migrations applied fresh and 19/19 idempotent re-entry checks passed. Browser smoke, CodeQL, mainline signed lockfile/SBOM attestation and exact-source evidence consolidation passed.

Mainline signed supply-chain [artifact #14783183173](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836/artifacts/14783183173): ZIP SHA-256 262cfe46b7501c07eef812e0a50c2ef9cee3d49b43931bb4fce63188a9958a2e; verification summary SHA-256 2b78a9cd6da63020527f29b35dfb677c20208474330c339431b9deec2543e5fd. Verified subjects include package-lock and CycloneDX SBOM; Sigstore/Rekor provenance is bound to fccd708 and refs/heads/main. This is provenance, not qualified human dependency/license approval.

F1.68 is an authentication timing-hardening candidate on a feature branch, not part of main and not reflected as a readiness PASS. It uses a fixed dummy scrypt record to keep KDF work consistent for missing/malformed login hashes, with strict hash encoding and an explicit ineligible flag for oversized/non-string credentials. Six injected-KDF input-shape assertions and the local full test suite pass; hosted validation remains pending.


The readiness artifact was generated immediately before the GitHub aggregate workflow completed; its embedded workflowRun status is in_progress by capture timing. GitHub records the completed workflow result as success at 2026-11-23T00:22:16Z, with all seven jobs successful. This does not alter the source binding or final run result.

Mainline signed supply-chain [artifact #14779528541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45088000378/artifacts/14779528541): ZIP SHA-256 e741ac7fcd91658da581eab051db999c1eab1ee839f93cdd535925203c1eb895; verification summary SHA-256 2c9702b3fedc91e53a2fde4e54e354d430cee4fadb3dbde16e01e45dc7c9f6cc. Attested package-lock SHA-256 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086; SBOM SHA-256 6c056ef27cf76732af7c7ac72d380cf246aa4c74c22a5b20f9c81e1fecb4e654. Sigstore/Rekor provenance verifies these source-bound subjects, not human dependency/license approval.

F1.67 adds migration 0019, exact derivative source-version binding, fail-closed legacy reads, transactional invalidation, version-pinned optimizer writes and conservative ambiguous-COMMIT object retention. No API, dependency, lockfile, package-version or SemVer change.

The two PARTIAL classifications remain (1) qualified human dependency/license review and (2) service-less integration diagnostics. Fourteen missing evidence gates remain:
1. Independent tenant-isolation and authorization review (issue #14).
2. OIDC/SAML, email delivery and MFA recovery end-to-end.
3. Live ClamAV, malicious-file corpus and legacy-asset quarantine.
4. Live S3/GCS/Azure/S3-compatible provider credentials and least privilege.
5. Stripe webhook replay, ambiguous outcomes and inventory lifecycle.
6. Full Playwright editor journeys and WCAG/screen-reader acceptance.
7. Commerce parity acceptance.
8. Community parity acceptance.
9. Signed plugin pipeline and adversarial container isolation.
10. Human-reviewed dependency audit, SBOM/provenance and CodeQL.
11. Load/soak, fault injection, backup/restore and recovery.
12. Independent platform security assessment and severe-finding remediation (issue #25).
13. Deployment runbooks, secrets, rollback, monitoring and release-owner approval.
14. Production OTLP observability backend, security, governance, ownership and delivery.

Tenant-isolation inventory remains maintainer-prepared, not independently reviewed. Aikido fingerprint mapping remains open in #234/#235/#277; exact findings must be triaged and rescanned rather than inferred from aggregate counts.

Package 0.6.2 remains private and unreleased. Do not tag, publish, deploy or promote it. Passing exact-main CI and signed provenance do not authorize production release. See the [full 22 November release-gate report](reports/2026-11-22-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md), [F1.67 implementation report](reports/2026-11-22-F1-67-PUBLIC-LIBRARY-VARIANT-VERSION-BINDING-REPORT.md), and [source-bound evidence ledger](RELEASE-EVIDENCE.md).
---

## Historical readiness snapshot before F1.63 (main `85315d873af73a71dc5223f02ac196b924efc928`; workflow #1240)

## Historical exact-main readiness before F1.63 - 22 November 2026

Current `main` is `85315d873af73a71dc5223f02ac196b924efc928`, a documentation-only successor merged through [PR #285](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/285). The latest runtime increment remains F1.62 collaboration operation-envelope hardening merged through [PR #263](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/263) at `9c563482ad0db51a4576b4154ad59580b8d69fc9`; F1.61 / [PR #283](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/283) is also included. Exact-main [workflow #1240 / run 44984783839](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44984783839) passed **7/7 jobs** on current main: Node.js 22, Node.js 24, live PostgreSQL/Memgraph/Redis integration, browser/accessibility smoke, CodeQL, signed lockfile/SBOM attestation, and exact-source evidence consolidation.

Canonical [release-readiness artifact #14739740143](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44984783839/artifacts/14739740143) is source-bound to exact current main. Archive SHA-256: `22fec20fa714a21b5264539761adc9b2bca8c464c327fb3d389e17007ceda922`; readiness JSON SHA-256: `e5554dd039d1df44f31e9a0b4bd79d483d0784e521329cdb2546e28313a10545`. Generated at `2026-11-22T04:25:55.257Z`. Classification: **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**; `readyForProduction=false`; `NOT_PRODUCTION_CERTIFIED`; decision **NO-GO**.

The supported Node.js 22.23.4 and 24.22.1 unit/security/dependency jobs each passed **771/771 Hub tests**; EnginEx passed **94/94** on both runtimes. Live PostgreSQL 18/Memgraph/Redis-backed integration passed **181/181** with zero failures/skips; **18/18** fresh migrations and **18/18** idempotent re-entry checks passed. Browser smoke, CodeQL, signed mainline lockfile/SBOM attestation and evidence consolidation passed. The separate service-less diagnostic (48 tests per runtime, 1 pass / 47 skipped) remains PARTIAL; skipped tests are not live integration passes.

F1.62 aligns server-side acceptance with the existing Studio client contract: exactly six version-1 envelope keys and exact operation-specific payload keys for all seven supported operation types. Malformed operations are rejected before PostgreSQL client acquisition/persistence, local realtime fan-out, Redis publication, and inbound Redis document-event acceptance. Regression coverage includes envelope/payload key omissions and extras plus database and realtime side-effect boundaries. The tenant-isolation test-reference fingerprint was refreshed; the inventory remains maintainer-prepared, not an independent review. No route/API shape, wire-version, schema, migration, dependency, lockfile, package-version or SemVer change.

F1.63 is a proposed page/custom-record isolation change in [PR #286](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/286), replacing stale unmerged Aikido [PR #241](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/241). It is not part of main or this exact-main readiness artifact. Candidate code adds both route-level non-disclosing guards and transactional expected-content-type predicates for page saves/workflow transitions, type-filtered revision reads, and page-only collaboration-store queries. Hosted PR merge-ref workflow [#44991934925](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44991934925) passed all seven required PR status contexts; Node 22/24 each passed 780/780 Hub and 94/94 EnginEx tests, live PostgreSQL/Memgraph/Redis integration passed 181/181 with zero skips, 18/18 fresh and 18/18 idempotent migrations passed, and browser smoke, CodeQL and candidate evidence consolidation passed. Live integration artifact [#14742202939](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44991934925/artifacts/14742202939) is bound to merge-ref SHA `9d738cbd49c5d45cd24a5ca08ca1778810c94de9`; mainline-only lockfile/SBOM attestation is intentionally post-merge. This candidate closes no production evidence gate and must not be interpreted as independent tenant-isolation assurance.

The two PARTIAL items remain qualified human dependency/license review and service-less integration diagnostics. The 14 missing production evidence gates remain: independent tenant-isolation review; identity-provider E2E; malware/legacy-asset quarantine; live cloud providers; Stripe lifecycle; full browser/accessibility acceptance; commerce parity; community parity; plugin isolation; human dependency/SBOM/CodeQL review; load/backup/restore; independent platform security assessment; operations/release approval; and production observability. See the [current release-gate report](reports/2026-11-21-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

F1.60 / [PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) is merged at code-bearing SHA `51cd04e60f1516741f544da35fd58fb965cdc66c`; issue #233 is closed. The outbox event-family identity registry and envelope-binding contract are in main. Final PR run #1219 attempt 3 and exact-main run #1220 passed on the F1.60 code-bearing merge SHA; documentation-only PRs #281 and #282 then advanced main to `9f4e60a59e971aff0d2f6ec7266a4c67d4fa92bd`, validated by exact-main run #1226 (7/7). F1.61 / [PR #283](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/283) subsequently merged at `ade194014aecea72e27b7cce149e979a1f8465c5`; exact-main run #1231 passed 7/7 with the current scheduler fix included. No schema, migration, API, event-schema, dependency, lockfile, package-version or SemVer change was introduced.

F1.61 scheduler abort-listener cleanup is merged in [PR #283](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/283) at main SHA `ade194014aecea72e27b7cce149e979a1f8465c5` (runtime commit `12d4b56a6dcd5b393f1fbbc0ca4c99e8e2d73b2e`) and is included in the exact-main workflow and readiness artifact above. Seven regression tests exercise the production helper and verify timer/listener cleanup across completion, abort, timer setup failure and 100 repeated cycles. This increment closes no independent production evidence gate. Package `0.6.2` remains private and unreleased. This CI result does not authorize a release tag, GitHub Release, npm publication or production deployment.

---

## Historical mainline snapshot — F1.59 / PR #232 (source SHA 70e800ad33a6d376388576ce76a608f35c595b64)

Repository `main` is `70e800ad33a6d376388576ce76a608f35c595b64`, following the merge of F1.59 / [PR #232](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/232). Exact-main [workflow #44809875826](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44809875826) completed successfully with **7/7 jobs**. The mainline run validated the Node.js 22 and 24 matrices, live PostgreSQL 18/Memgraph integration (**180/180**), all 18 migrations on fresh and idempotent passes, browser smoke, CodeQL, signed mainline lockfile/SBOM attestation, and exact-source evidence consolidation.

Canonical readiness artifact [#14666785760](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44809875826) is source-bound to the exact main SHA above. Its classification is **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, with `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED`, and decision **NO-GO**.

The two PARTIAL rows remain (1) committed dependency lockfile/clean install evidence while qualified human dependency/license review is outstanding, and (2) service-less integration diagnostics with intentional skips. The separate live database integration passed 180/180; service-less skips are not live integration evidence.

The 14 missing production evidence areas remain: independent tenant-isolation review; identity-provider E2E; malware/asset quarantine; live cloud providers; Stripe lifecycle; full browser/accessibility acceptance; commerce parity; community parity; plugin isolation; human dependency/SBOM/CodeQL review; load/backup/recovery; independent platform security assessment; operations/release approval; and production observability.

Subsequent to this historical F1.59 snapshot, F1.60 / [PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) merged at code-bearing SHA `51cd04e60f1516741f544da35fd58fb965cdc66c`, closing issue #233. Final rebased PR workflow #1219 attempt 3 and exact-main workflow #1220 passed. Documentation-only PR #281 advanced `main` to `722f527472d46d6bc50c43d793d28f457845c050` and exact-main workflow #1223 passed 7/7. Documentation-only PR #282 subsequently advanced main to `9f4e60a59e971aff0d2f6ec7266a4c67d4fa92bd`; exact-main workflow #1226 passed 7/7 with source-bound readiness artifact #14733167605, preserving 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE and NO-GO. This maintainer hardening did not change the release classification or production authorization.

The active [main-branch ruleset](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/rules/27803491) requires pull requests, seven named CI/security contexts, an up-to-date base, and resolved review threads; force pushes and deletion are blocked and there are no bypass actors. The single-maintainer policy requires documented maintainer self-review but does not require an unavailable external approval. This merge policy does not waive independent production evidence.

**Release decision: NO-GO.** Package `0.6.2` remains private/unreleased. No production deployment, publication, release tag, or certification is authorized by these checks.

---

## Historical evidence snapshots

The detailed F1.58 and pre-merge F1.59 narratives below are retained as historical evidence from 20 November 2026. Their present-tense statements describe the repository state at the time those snapshots were written, not the current `main` branch.


## Historical merged runtime increment — F1.58 (20 November 2026; superseded by F1.59)

F1.58 community-feed write authorization revalidation merged through [PR #228](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/228), closing [issue #227](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/227), at main SHA `619819230dac2e8d169ce71af7c6a41f0630cf27`. The final `POST /api/v1/sites/:siteId/community/feed` write revalidates the active actor, selected-site membership and applicable group membership in the existing PostgreSQL transaction. It follows site → actor user → selected-site memberships → target group → target-group memberships lock order, re-reads current group privacy under the group lock, and narrows an eligible comment to group visibility when privacy tightens after preflight. Focused PostgreSQL 18 regression passed 58/58 with zero skips.

Exact-main [workflow #44675989750 / run #820](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44675989750) passed **7/7 jobs** on the exact main SHA: Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub and 94/94 EnginEx tests; live PostgreSQL 18/Memgraph/Redis integration passed 180/180 with zero failures/skips/TODOs; all 18 migrations applied fresh and all 18 passed idempotent re-entry; browser smoke passed 9/9; CodeQL, signed mainline lockfile/SBOM attestation and exact-source evidence consolidation passed. The signed provenance/SBOM subjects include the exact committed `package-lock.json` and generated CycloneDX 1.5 SBOM.

Canonical readiness artifact [#14601349640](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44675989750) is bound to `619819230dac2e8d169ce71af7c6a41f0630cf27`, archive SHA-256 `bb1a62b74cc13ae495e6953d147d9e321fc8ee2bf7928545e5c3125abcbab746`, finalized JSON SHA-256 `03ef7a8de44133ed6f0861187df9a68448d5e1d6ee59c6aa243deeac30b5ed49`. The exact-main classification is **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED`, decision `NO_GO`.

The two PARTIAL rows are (1) committed lockfile and clean `npm ci` validated, while qualified human dependency/license review remains open, and (2) service-less integration diagnostics (47 per runtime; 1 pass / 46 skipped). The service-less skips are not live test results. The separately provisioned live database integration producer passed 180/180 with zero skips.

## Historical F1.59 pre-merge candidate snapshot — 20 November 2026 (subsequently merged to main)

F1.59 is tracked by [issue #231](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/231), under parent #124, and is open in [PR #232](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/232). Implementation-code head: `623a5597553ffb783d5a42f9280acd40a06227d3`; implementation commit: `bf36d356913053df069abd825e157dad400a67d2`. Current consolidated PR branch head is `c46bf837db19d0feeff1d27cfe90aff33e47588c` after a documentation/release-evidence-only commit; no runtime code changed in that commit. The graph projector now requires the validated v1 PostgreSQL outbox envelope, rejects contradictory site/resource/event identity before Memgraph writes, and uses normalized canonical identity. Full rebuild creates the same validated envelope from canonical PostgreSQL snapshot rows; no payload-only fallback remains. Content editorial version remains distinct from aggregate projection version.

Local full `npm run check` passed 677 tests (674 passed, 0 failed, 3 conditional Windows skips); focused graph/outbox tests passed 29/31 with two local Memgraph service-dependent skips. Tenant inventory freshness passed at 28 families / 80 route patterns / 22 implementation source files / 59 test references. Hosted branch push [#44798684028 / run #827](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44798684028) and PR [#44798692834 / run #828](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44798692834) both succeeded on F1.59 runtime code-validation head `623a5597553ffb783d5a42f9280acd40a06227d3`. The exact-head push readiness artifact #14660651318 also records 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE. The post-merge-only lockfile/SBOM attestation was skipped by design on both candidate events and must run on main after merge. The latest documentation-only branch push [#44804183335 / run #829](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44804183335) and PR [#44804193472 / run #830](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44804193472) both completed 7/7 jobs (six success, attestation skipped), including Node 22/24, 180/180 live PostgreSQL/Memgraph integration, 18/18 fresh and idempotent migrations, graph outage/recovery and rebuild, browser/accessibility smoke, CodeQL and source-bound evidence consolidation. Exact push artifact #14660589715 is bound to branch head `c46bf837db19d0feeff1d27cfe90aff33e47588c`; PR artifact #14662103518 is bound to synthetic merge SHA `624e16304ba751344f9c3c03f0bcc4932217f3c6`. Both report 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE and `readyForProduction=false`.

PR #232 remains open and unmerged. GitHub records four owner-account COMMENTED submissions (`done`, `done`, `reviewed`, `Reviewed`); none is an approval and no independent non-author approval is recorded. The PR must receive a non-author approval before merge. See [F1.59 implementation report](reports/2026-11-20-F1-59-OUTBOX-PROJECTION-ENVELOPE-SCOPE-REPORT.md), [full 0.6.2 release-gate report](reports/2026-11-20-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md), and the separate P2 [outbox consumer contract follow-up #233](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/233).



## Historical production release decision — 20 November 2026 (superseded by current snapshot above)

The 14 missing production evidence gates and their accountable roles remain listed below in the historical gate matrix; the canonical exact-main readiness JSON remains authoritative. Independent tenant review #14 and platform security assessment #25 are OPEN / NOT PERFORMED; qualified dependency/license/SBOM review #23 is OPEN / PARTIAL. Release scope/provider approval #13, load/backup/restore #24, operations/release approval #26 and governance #32 remain open. Issue completion or successful CI does not discharge these separate acceptance requirements.

Package 0.6.2 remains private and unreleased. **Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not create a release tag, GitHub Release, npm publication or production deployment; do not increment SemVer until an actual release boundary is approved.

## Historical exact-main baseline - F1.55 runtime PR #216 / workflow #785 (superseded by F1.57 workflow #44643356523)

At the time of the F1.55 exact-main validation, repository `main` was `db0b641880a5c842ffdcc2cf1dda6bedde58d033` after F1.55 / [PR #216 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/216), closing issue #215. Exact-main [workflow #44482863945 / run #785](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44482863945) completed successfully with **7/7 jobs** on that exact source: Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub and 94/94 EnginEx tests; live PostgreSQL/Memgraph passed 159/159 with zero failures or skips; all 18 migrations passed fresh and idempotent checks; browser smoke passed 9/9; CodeQL, signed provenance/SBOM and evidence consolidation passed. Candidate push/PR workflows #783/#784 also passed their six applicable functional jobs each.

The source-bound readiness artifact **14508174935** is bound to `db0b641880a5c842ffdcc2cf1dda6bedde58d033`. Archive SHA-256: `b4bedbc44d9067d04f5327cc57337f94238c6d18cd93fe1aff2beb74574bc786`; finalized readiness JSON SHA-256: `47c6a13ea9f4ca49449a618d20dfcf5c6094def7b92d930b7399886513976ea9`; finalized Markdown SHA-256: `457053408b0531e2b90057b3ea2af324fa37edd2d8c9dae9cba87f4933f6e8a8`. It records **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction=false`, and `NOT_PRODUCTION_CERTIFIED`. The 14 missing gates and two PARTIAL dispositions below remain unchanged. The successful workflow and CI artifact do not grant production certification.

F1.55 / PR #216 closes issue #215 under parent #124. The implementation revalidates both participants' active accounts and selected-site memberships at the final friendship acceptance write boundary. The focused live PostgreSQL 18 suite passes 26/26; local `npm run check` passes 667/670 (zero failures; three Windows-specific skips); tenant inventory remains current at 28/80/21/57. Candidate workflows #783/#784 passed, and exact-main #785 validates the merged source. PR #216 recorded zero formal review submissions and zero inline review threads; maintainer/automation evidence only. The 14 missing production gates and independent review boundaries remain unchanged.

> **F1.54 runtime-merge snapshot (historical source-bound evidence): PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.** F1.54 / [PR #213 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/213) closed issue #212 and merged into main at `c247e1cb1daa5683c3a74aa6856e9718d92b4557` on 18 November 2026 America/Chicago (19 November 2026 05:47:02 UTC). Implementation commit: `a2198c4b0cf3ead80bd47718db7b68e666642e3d`. Exact-main [workflow #44467525998 / run #779](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44467525998) passed all seven jobs on that exact merge SHA: Node 22/24 each passed 670/670 Hub and 94/94 EnginEx tests; live PostgreSQL/Memgraph passed 153/153 with zero skips; all 18 fresh and idempotent migrations passed; browser smoke 9/9, CodeQL, signed mainline provenance/SBOM, and exact-source evidence consolidation passed. CI evidence is PASS; production certification is NO. PR #213 recorded zero formal reviews and zero inline review threads; maintainer/automation evidence only.

The exact-source post-producer readiness artifact **14502244347** is bound to main `c247e1cb1daa5683c3a74aa6856e9718d92b4557`. Archive SHA-256: `a86a098067351d02d489ce14d835c85f0c28e320a305afbb0a27337cdb3a2b86`; finalized readiness JSON SHA-256: `e5d50ccf175bb70c373b7455750958ceb2fd287ac34fe946719008d51acdda3`. Canonical classification: **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**; `readyForProduction=false` and `releaseClassification=NOT_PRODUCTION_CERTIFIED`. The two PARTIAL rows remain qualified human dependency/license review and the service-less integration diagnostic; the 46 skipped service-less cases are not live integration results. The separate live database producer passed 153/153 with zero skips.

The 14 missing production gates remain: tenant-isolation-review, identity-provider-e2e, clamav-corpus, cloud-live-providers, stripe-live-lifecycle, browser-accessibility, commerce-parity-acceptance, community-parity-acceptance, plugin-container-isolation, dependency-sbom-codeql, load-backup-restore, independent-security-review, operations-release-approval and observability-production. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. Scope/provider approval #13, load/restore #24, operations/release ownership #26 and governance #32 remain separate open gates.

F1.54 is the previous merged runtime increment. The [F1.54 implementation and mainline report](reports/2026-11-18-F1-54-COMMUNITY-GROUP-JOIN-MEMBERSHIP-RACE-REPORT.md) records the group-join write-boundary revalidation, pre-fix reproduction, two-site PostgreSQL regressions, PR #213 merge, and exact-main workflow #779. This maintainer/automation evidence does not satisfy independent review or any of the remaining production gates.

Package 0.6.2 remains private and unreleased. No SemVer increment, release tag, GitHub Release, npm publication, production deployment, assessor engagement, spending or risk acceptance is authorized.

## Historical readiness snapshot — F1.51 runtime merge (main `a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a`; workflow #44342489370)

> **Historical decision at F1.51 runtime merge: PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.** F1.51 / [PR #205](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/205) merged at main SHA a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a; issue #204 is CLOSED. Exact-main [workflow #44342489370](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44342489370) passed all seven jobs: Node 22/24 each passed 670/670 Hub and 94/94 EnginEx tests; live PostgreSQL/Memgraph/Redis passed 143/143 with zero skips; 18/18 fresh and 18/18 idempotent migrations; browser smoke 9/9; CodeQL; signed mainline provenance/SBOM and exact-source evidence consolidation. CI evidence was PASS; production certification was NO. This snapshot is superseded by the current-main status at the top of this file.

The exact-source readiness artifact 14445280897 (SHA-256 a7e64f309cfc9cd953303ef6d7f9f3fbfb8bc11766e5974e9803603ffb27d23b) is bound to a95b6dc4acbb3adcb64cfec8d05ec0831d9adb9a. Canonical classification: **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**; readyForProduction=false and releaseClassification=NOT_PRODUCTION_CERTIFIED. The two PARTIAL rows remain qualified human dependency/license review and a service-less integration diagnostic; the diagnostic skips are not live integration results. The separate live database producer passed 143/143 with zero skips.

The 14 missing production gates remain: tenant-isolation-review, identity-provider-e2e, clamav-corpus, cloud-live-providers, stripe-live-lifecycle, browser-accessibility, commerce-parity-acceptance, community-parity-acceptance, plugin-container-isolation, dependency-sbom-codeql, load-backup-restore, independent-security-review, operations-release-approval and observability-production. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. Scope/provider approval #13, load/restore #24, operations/release ownership #26 and governance #32 remain separate open gates.

F1.51 fixes a maintainer-reproduced private-group membership idempotency defect and is validated by exact-main CI. This does not satisfy independent tenant review #14 or platform review #25. Package 0.6.2 remains private and unreleased. No SemVer increment, release tag, GitHub Release, npm publication, deployment, assessor engagement, spending or risk acceptance is authorized.

## Historical readiness snapshot — 17 November 2026 UTC (F1.46 / workflow #732)

> **Current decision: PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.** Exact-main [workflow #732](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44182949889) validates main SHA `54b766b05db51640281840607df7e16e09da699e` after F1.46 / PR #191. All seven jobs passed, including zero-skip live integrations, signed mainline attestations and exact-source evidence consolidation. CI evidence is PASS; production certification is NO. Independent review and the remaining 14 production evidence gates are separate. No release, publication, deployment or SemVer increment is authorized.

Current main is `54b766b05db51640281840607df7e16e09da699e`. F1.46 merged through [PR #191](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/191); merge commit `54b766b05db51640281840607df7e16e09da699e`; issue #190 is CLOSED. Exact-head workflows #730/#731 and exact-main workflow #732 passed all seven required jobs. On main, Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub tests and 94/94 EnginEx tests with zero skips; both npm audit scopes reported zero vulnerabilities; PostgreSQL/Memgraph/Redis passed 129/129 live integration tests with zero failures/skips/TODOs; fresh and idempotent migration passes each validated all 18 migrations; browser/editor smoke passed 9/9; CodeQL passed; SLSA provenance and CycloneDX SBOM attestations were signed/verified; and exact-source CI evidence consolidation passed. Readiness artifact 14372653774 (archive SHA-256 `f24ba5765160fdd91902a6fb1523c3952d92befe9e993e98d01019b3891e948c`) records `CI EVIDENCE: PASS`, `FINAL RELEASE READINESS: NOT_PRODUCTION_CERTIFIED`, and `PRODUCTION CERTIFICATION: NO`. The authoritative consolidated readiness classification is 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN with `readyForProduction=false`.

| Readiness classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

The two PARTIAL classifications remain incomplete qualified human lockfile/dependency/license review and the service-less integration diagnostic (43 skips from a 44-test diagnostic sweep per supported Node runtime). Those 43 skips are not live integration passes. The final exact-main #732 producer passed 129/129 live PostgreSQL/Memgraph/Redis tests with zero skips and fresh/idempotent migration checks passed 18/18 each. The final consolidated report has zero BLOCKED rows; the separately retained preliminary per-runtime diagnostic snapshots still show 7 PASS / 2 PARTIAL / 1 BLOCKED / 14 MISSING_EVIDENCE and are not the authoritative current-main summary. Automated browser smoke 9/9 is not manual WCAG/assistive-technology acceptance; CodeQL and signed attestations do not establish independent security or legal approval.

The 14 missing production evidence gates remain: tenant-isolation-review, identity-provider-e2e, clamav-corpus, cloud-live-providers, stripe-live-lifecycle, browser-accessibility, commerce-parity-acceptance, community-parity-acceptance, plugin-container-isolation, dependency-sbom-codeql, load-backup-restore, independent-security-review, operations-release-approval, and observability-production. The complete gate-by-gate matrix and exact-run artifact inventory are in the [17 November full release-gate report](reports/2026-11-17-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; supply-chain review #23 remains OPEN / PARTIAL. Authorized scope #13, load/restore #24, operations/release ownership #26 and governance #32 remain open. PR #179 and PR #176 merged with zero formal review submissions and zero inline review threads; their successful CI is maintainer/automation evidence only. No independent security or legal approval is implied.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No tag, GitHub Release, npm publication, production deployment or SemVer increment is authorized. See [Release evidence](RELEASE-EVIDENCE.md), the [F1.42 merged report](reports/2026-11-17-F1-42-CLOUD-CONNECTION-AUDIT-ATOMICITY-IMPLEMENTATION-REPORT.md), the [F1.41 merged report](reports/2026-11-17-F1-41-STRIPE-REFUND-AUDIT-ATOMICITY-MERGE-REPORT.md), the [F1.40 merged report](reports/2026-11-16-F1-40-REUSABLE-COMPONENT-AUDIT-ATOMICITY-REPORT.md), and the [17 November full release-gate report](reports/2026-11-17-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

### Previous merged engineering increment — F1.45 (PR #189; issue #188 CLOSED)

F1.45 applies the shared transaction-owned identity audit pattern to site-managed mega-menu POST/PUT/DELETE in `/api/v1/sites/{siteId}/mega-menus`. The metadata-only `navigation.mega_menu_created`, `navigation.mega_menu_updated` and `navigation.mega_menu_deleted` events commit on the same transaction queryable as the `navigation_menus` mutation. Audit absence fails closed; audit failure rolls back the write; item, URL and presentation payloads are excluded from audit details. PR #189 merged at main SHA `60cca7645dd5f65a2c459742b05af7eb9016eee5`; exact-head #725/#726 and exact-main #727 passed all seven jobs. #727 passed Node 22/24 670/670 Hub and 94/94 EnginEx tests, 124/124 live PostgreSQL/Memgraph/Redis integrations with zero skips, 18/18 fresh/idempotent migrations, collaboration Playwright 4/4, browser smoke 9/9, CodeQL, signed attestations and exact-source CI evidence consolidation. No schema, migration, API, dependency, lockfile or SemVer change. PR #189 had no formal review submission or inline thread; human/independent review remains separate. See the [F1.45 implementation report](reports/2026-11-17-F1-45-MEGA-MENU-AUDIT-ATOMICITY-IMPLEMENTATION-REPORT.md).

### Latest merged engineering increment — F1.46 regular navigation-menu audit atomicity (PR #191; issue #190 CLOSED)

F1.46 addresses the separate `/api/v1/sites/{siteId}/menus` route in `apps/api/src/server.js`; this is not the F1.45 `/mega-menus` route. It reuses `withIdentityAuditTransaction()` for metadata-only `navigation.menu_created`, `navigation.menu_updated` and `navigation.menu_deleted` events on the same queryable, preserving selector reconciliation, `site:manage`, tenant predicates, input bounds, expected-version behavior and HTTP contracts. PR #191 merged at main SHA `54b766b05db51640281840607df7e16e09da699e`; issue #190 is CLOSED. The local Windows/Node.js 26.12.1 `NODE_OPTIONS=--max-old-space-size=4096 npm run check` passed 667 tests / 0 failures / 3 platform-specific skips; the tenant inventory generates 28 families / 80 route patterns / 21 source files / 55 test references. Focused local PostgreSQL execution was blocked by the Windows/Docker host TCP path, but exact-main #732 subsequently passed the dedicated hosted producer with 129/129 live integrations and zero skips, including the F1.46 rollback/retry and 404/409 no-event assertions. #732 also passed Node 22/24 670/670 Hub and 94/94 EnginEx tests, 18/18 fresh/idempotent migrations, browser smoke 9/9, CodeQL, signed attestations and evidence consolidation. Exact-main artifact 14372653774 reports `CI EVIDENCE: PASS`, but final readiness remains `NOT_PRODUCTION_CERTIFIED` / production certification `NO`. PR #191 records no formal review submissions or inline review threads; independent human review and the 14 missing production evidence gates remain open. See the [F1.46 merged implementation report](reports/2026-11-17-F1-46-NAVIGATION-MENU-AUDIT-ATOMICITY-IMPLEMENTATION-REPORT.md).

### Previous merged engineering increment — F1.42 (PR #179; issue #178 CLOSED)

F1.42 moves cloud connection create, disable and post-probe health-check persistence onto the existing transaction-owned queryable and awaits the metadata-only `cloud.connection_created`, `cloud.connection_disabled` or `cloud.connection_tested` audit before COMMIT. Credential resolution and read-only provider probes stay outside PostgreSQL transactions; a conditional status update preserves `disabled` across a concurrent health-check race. Local focused cloud/platform tests passed 16/16; the full Windows `npm run check` passed 652 tests with zero failures and three Windows-specific skips; local live PostgreSQL/Memgraph/Redis integration passed 114/114 with zero skips. Exact-head #708 and exact-main #709 passed. The S3 probe regression uses a loopback protocol endpoint, not live provider credentials or provider lifecycle qualification. PR #179 records zero formal review submissions and zero inline review threads; human/independent review and the live cloud lifecycle gate remain open. No schema, migration, public API, dependency, lockfile or SemVer change.

### Previous merged engineering increment — F1.41 (PR #176; issue #175 remains open for maintainer close-out)

F1.41 keeps the Stripe request outside PostgreSQL, then commits provider refund binding/status, any full-order transition and the correlated `commerce.refund_requested` audit on the same transaction-owned queryable. Audit failure rolls back local state but preserves the durable refund reservation; same-key retry reuses the stable provider idempotency key. Local focused unit + dedicated PostgreSQL failure-injection/retry/terminal-replay tests passed 17/17 with zero skips; local `npm run check` passed 643 / 0 failed / 3 Windows-specific skips. Exact-head #702 and exact-main #703 passed. The integration regression uses a Stripe stub; live Stripe provider lifecycle and human/independent review remain open gates.

## Historical candidate implementation note — post-producer readiness finalization (12 November 2026)



Implementation began from code SHA `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907`; the branch is now rebased onto current main SHA `858e1b35bae601939f4947e3d74584945e28e8e9` (documentation PR #135). The Node.js 22/24 reports are explicitly preliminary; after all five required producer jobs complete, the aggregator validates schema-version-2 manifests (product/version, repository/workflow/event, run/attempt, job and exact source SHA), producer checksums and the PostgreSQL/Memgraph record before writing the authoritative `artifacts/release-readiness.json` and `.md`. It retains both preliminary Node reports for audit, compares each runtime's checks, evidence gates and supplemental dispositions, and promotes only the exact-source PostgreSQL live-integration and fresh-migration evidence. All independent/provider/legal/operations/governance gates remain unchanged.

Local focused validation passed **26/27 tests** (zero failures, one Windows-specific skip). The full local Hub check passed **597/600 tests** (zero failures, three platform-specific skips), validating 235 required paths and syntax-checking 245 JavaScript files. Vendored EnginEx 7.0.0 passed **91/94 tests** (zero failures, three platform-specific skips). `npm audit --audit-level=high` reported **zero vulnerabilities**. These supplemental checks used Node.js 26.12.1; the required hosted Node.js 22.23.4/24.22.1 matrix now also passes on the exact candidate branch head. Workflow YAML parsing, JavaScript syntax checks and `git diff --check` passed. Hosted exact-candidate validation now **passes** on branch-head commit `5959e3e7996f40406850dbf7bb910aef4ef1ee02`: successful push workflow [#43365367600](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43365367600) and pull-request workflow [#43365715766](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43365715766) each completed all seven jobs. Both Node runtimes passed 600/600 Hub and 94/94 EnginEx tests; the dedicated PostgreSQL/Memgraph producer passed 93/93 with zero failures/skips; fresh migrations applied 18/18 and skipped 18/18 on idempotent re-entry; browser/accessibility, CodeQL and aggregation passed. The PR run finalized the canonical post-producer report on synthetic merge SHA `818dfccb42ed3fa6266b30c91fde572eff882e07` while retaining the branch head SHA above. Its finalized readiness remains **8 PASS, 2 PARTIAL, 0 BLOCKED, 14 MISSING_EVIDENCE**, `readyForProduction: false`. Main-only signed attestation was skipped as expected for this non-main candidate branch; a successful attestation and a fresh exact-main run are still required after merge. PR [#136](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/136) remains **OPEN / DRAFT** pending human review. This is candidate CI acceptance, not production certification or release authorization. Package version remains 0.6.2 and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

## Historical mainline snapshot — 12 November 2026 (0.6.2, code PR #132; documentation PR #135)

Current main HEAD is `858e1b35bae601939f4947e3d74584945e28e8e9` after documentation-only PR #135; product-code revision `4a9ee181be5d9d46d94ed11a14de64b4dbbe9907` was merged through [PR #132](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/132) / F1.27. Exact-main [workflow #585](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43266581120) completed successfully with all seven jobs: Node 22.23.4 and 24.22.1 each passed 595/595 Hub tests and 94/94 EnginEx tests; PostgreSQL/Memgraph integration passed 93/93 with zero failures/skips; 18/18 fresh migrations applied and 18/18 idempotent second-pass skips; browser/accessibility smoke passed 9/9; CodeQL, exact-main signed provenance/SBOM and evidence consolidation passed. Both full and production npm audit scopes reported zero vulnerabilities.

The exact-source CycloneDX 1.5 SBOMs each contain 200 components and 201 dependency records with normalized inventory parity. Lockfile SHA-256 is `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`. Fourteen components have LGPL license terms; qualified human license/distribution review remains open under #23. Main supply-chain artifact 13966781173 has archive digest `sha256:51abc261fdd48444dd97bee2a20f48b421ed6d49898f713de6ea796f7bd579f8`; provenance and SBOM attestations are linked in the [current release-gate report](reports/2026-11-12-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

F1.27 adds the existing `canEditContent` guard to `submit-review` after the site-level capability check. Authors may submit only their own drafts; same-site non-owner author submissions are denied before workflow side effects; editor and owner transitions retain their prior site-wide behavior. The exact-main 93/93 live database suite passed the seeded site-owner/editor/author role matrix. No route/API contract, schema, migration, dependency, provider or package-version change was introduced. PR #132 has no formal review submission recorded; this remains maintainer/automation evidence, not independent approval. See the [F1.27 merge](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/132).

### Current formal readiness and timing qualification

The exact-source readiness snapshot currently reports **7 PASS, 2 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE, 0 NOT_RUN** and `readyForProduction: false`. The database/migration BLOCKED row in that snapshot is order-dependent: the Node jobs generate their readiness report before the dedicated PostgreSQL/Memgraph producer publishes its source-bound artifact. Later in the same workflow #585, the dedicated producer passed 93/93 live tests and fresh migration evidence passed 18/18 applied plus 18/18 idempotent second-pass checks; the final evidence consolidator passed. The early BLOCKED entry is not a failed live database test, but the final readiness workflow should be restructured so the authoritative summary is produced after all producer artifacts are verified; this follow-up is tracked in [issue #134](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/134).

The two PARTIAL areas include human review of the committed lockfile/dependency inventory and the service-less integration sweep (34 skips per Node runtime); skipped tests are not live passes. The 14 missing evidence categories include independent tenant review, identity/provider E2E, malware corpus, live cloud storage, Stripe lifecycle, manual accessibility/parity, plugin isolation, qualified human dependency/security review, load/backup/restore, independent security review, operations/release approval and production observability. The detailed disposition and 14 production-gate matrix are in the [12 November release-gate report](reports/2026-11-12-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

**Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.** Independent tenant review #14 and broader platform security review #25 remain OPEN / NOT PERFORMED; #23 remains OPEN / PARTIAL; authorized release-scope decision #13, load/restore #24, operations/release ownership #26 and governance authority #32 remain open. Package 0.6.2 remains private/unreleased; no SemVer bump, tag, GitHub Release, publication or deployment is authorized.

## Historical mainline snapshot Ã¢â‚¬â€ 10 November 2026 (0.6.2, PR #118 merged)

Historical 10 November main was c7653bb433ae8b363925d13babf239e64b2b5125, the merge commit for cloud-connection tenant-isolation PR #118. Exact-mainline workflow #522 passed all six jobs on that historical SHA. PR #118 closes issue #117; its tenant regression remains maintainer evidence only. Independent reviews #14/#25 and human supply-chain review #23 remain open. F1.20 issue #113 remains CLOSED / ACCEPTED for the restricted developer-preview reliability scope.

The historical pre-merge issue #23 candidate was maintained on branch security/dependency-supply-chain-review-2026-11-10 at code/lockfile SHA 17ba575114e1ee9576e49c7ae456a1af0280b6fc. Workflow #524 passed its six non-attestation jobs on both Node runtimes, live integration (82/82), fresh migration idempotency (18/18 applied plus 18/18 skipped), collaboration Playwright (3/3), browser smoke, CodeQL and evidence aggregation. The main-only signer was skipped on that feature branch. This is historical pre-merge maintainer evidence only; qualified human dependency/license/distribution review, exact-SHA CodeQL disposition and mainline signer verification remain open.

## Historical mainline snapshot Ã¢â‚¬â€ 10 November 2026 (0.6.2, PR #116 merged)

Current `main` includes PR #116 at exact merge commit `eb156b7620929ae94421caf69b4ddb92ed679812`. Exact-mainline [workflow #517](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42855470069) passed all six required jobs on that SHA: Node.js 22.23.4, Node.js 24.22.1, PostgreSQL/Memgraph integration, browser/accessibility smoke, CodeQL and consolidated evidence. The source-bound live database/graph suite passed **81/81, zero failures, zero skips**, including the PR #116 same-slug two-site custom-content-type registry/record regression. F1.20 issue #113 remains CLOSED / ACCEPTED for the restricted developer-preview reliability scope.

The current maintainer-generated tenant inventory declares 27 flow families, 78 route patterns, 21 implementation/source files and 43 referenced test files. PR #116 merged the schema/query anchors and targeted live custom-content-type A/B regression. These artifacts are review-preparation and drift-detection aids; they are not proof of complete route discovery or independent security acceptance.

The cloud-connection maintainer regression added Site A/B listing isolation, foreign-ID test/disable denial, selector-conflict rejection and unchanged-row checks. It was merged through PR #118 at the 10 November main SHA c7653bb433ae8b363925d13babf239e64b2b5125, closing issue #117. Exact PR-head workflow #42878000787 and exact post-merge workflow #522 passed all six required jobs on that historical revision. The focused local PostgreSQL test passed 2/2 and the full local PostgreSQL/Memgraph/Redis runner passed 81/81, zero failures and zero skips. These are targeted maintainer regressions only; issue #14 remains OPEN / NOT PERFORMED and issue #25 remains open.

Current readiness remains **NOT_PRODUCTION_CERTIFIED / NO-GO**. Green CI and maintainer regressions do not replace live provider acceptance, independent tenant/security assessment (#14/#25), human supply-chain review (#23), load/restore drills (#24), operations/rollback approval (#26), authorized release-scope approval (#13), or governance controls (#32). Package 0.6.2 remains private and unreleased; no SemVer bump, tag, publication or deployment is authorized.

## Historical mainline snapshot Ã¢â‚¬â€ 9 November 2026 (0.6.2, PR #114 merged)

Current `main` is VirgoScorpio Hub 0.6.2 at `267380be1ba441f83408e2c63c042760ec662ac7`, the merge commit for PR #114/F1.20. Hosted [mainline workflow run #495](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42700441554) completed with **4/6 required jobs successful**: Node.js 22.23.4 and 24.22.1, browser editor/accessibility smoke, and CodeQL passed; PostgreSQL/Memgraph integration and consolidated candidate evidence failed.

- Each Node matrix job passed **576/576** Hub tests and **94/94** EnginEx tests; `npm audit` reported zero vulnerabilities. The service-less integration subset had **34 skips per runtime** and remains PARTIAL, not a live integration pass.
- The PostgreSQL/Memgraph job's dedicated live integration command passed **80/80** tests with zero failure/skip/TODO. A fresh disposable PostgreSQL database applied **18/18** migrations and skipped **18/18** on its idempotent second pass. The physical Redis outage test observed 11Ã¢â‚¬â€œ12 bridge reconnect attempts and 11 presence reconnect attempts, did not replay outage-time Pub/Sub, restored the exact disposable Redis service, and verified PING.
- The PostgreSQL-backed Playwright assertions on main verified membership removal in PostgreSQL and idle-WebSocket heartbeat reauthorization during the physical Redis outage. Redis restore/PING and browser-client closure completed, but API-node teardown did not finish before the **180-second** Playwright timeout. The integration job therefore failed; later Memgraph outage/replay and graph-rebuild steps were skipped. The aggregator failed because the producer job failed and the required Memgraph evidence files were not produced. Draft PR [#115](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/115), based on this exact main SHA, adds a shared bounded Redis-client shutdown helper; its complete PostgreSQL multi-node Playwright spec passed **3/3**, including the real Redis outage case, with both API nodes closing cleanly. Local `npm run check` passed **583/586** tests (zero failures, three Windows-specific platform skips), with 232 required paths and 243 JavaScript files syntax-checked on Node.js 26.12.1. This is local follow-up evidence only: it does not replace the failed hosted run, qualify Memgraph outage/rebuild, or close F1.20.
- The exact-source local release-readiness report remains **7 PASS, 2 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE**, with `readyForProduction: false`. CI evidence is BLOCKED and production certification remains NO. This run is not a production release or a completed F1.20 acceptance.

## Historical mainline snapshot Ã¢â‚¬â€ 9 November 2026 (0.6.2, PR #109 merged)

Current mainline is VirgoScorpio Hub 0.6.2 at `36220abf4ebcc629fa616961879f5a2ffe1f847d`. F1.18 merged through PR #109. Mainline [workflow run #472](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42535903899) completed all six jobs successfully: Node.js 22.23.4 and 24.22.1 unit/security/dependency checks, dedicated PostgreSQL/Memgraph integration, Chromium browser/accessibility smoke, CodeQL, and consolidated run-bound evidence.

- Each Node matrix job passed **566/566** Hub unit/security tests and **94/94** EnginEx tests; the syntax/artifact check covered **230 required paths** and **236 JavaScript files**. The service-less integration sweep recorded **33 skips** per runtime and remains PARTIAL, not a live integration pass.
- The dedicated PostgreSQL/Memgraph job passed **79/79** integration tests with zero failure/skip/TODO, applied **18/18** migrations to a fresh disposable database and skipped **18/18** on its idempotent second pass, exercised the v0008 upgrade fixture, Memgraph outage/replay and canonical graph rebuild, and dropped the disposable database. The aggregator materialized exact-source `postgres-memgraph-live.json` PASS evidence for this SHA.
- Chromium Playwright smoke passed **9/9**. This is not manual accessibility acceptance.
- Both npm audit steps reported **0 vulnerabilities**. CycloneDX 1.5 SBOMs contained **177 components / 178 dependency records** each and the aggregator verified normalized dependency-graph parity under pinned npm 11.19.1. Human dependency/license review, provenance/attestation and LGPL-3.0-or-later notice review remain open.
- CodeQL workflow completed successfully. No CodeQL run alone is an independent security assessment.

The local `npm run release:readiness` report on the same source revision recorded **7 PASS, 2 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE**, `readyForProduction: false`. The local fresh-migration supplemental record was stale and remains BLOCKED by its exact-revision contract; this is distinct from the successful, checksum-bound hosted database producer/aggregator evidence. Do not copy hosted evidence into a different source revision or edit its SHA.

The default preview remains local media/library storage, mock-only AI, external AI content disabled, email disabled, SAML/OIDC unconfigured, realtime/Memgraph/plugin execution disabled, Stripe credentials unset and ClamAV unset. Issues #15Ã¢â‚¬â€œ#22 are deferred/not planned for this developer-preview scope; their live provider, manual accessibility, parity and plugin acceptance remain production readiness requirements and stay visible as MISSING_EVIDENCE. Issues #14/#24/#25/#26/#32 and named release-owner approval under #13 remain outstanding. Package version stays 0.6.2 and unreleased; production remains NO-GO.

## Historical mainline snapshot Ã¢â‚¬â€ 7 November 2026 (PRs #84Ã¢â‚¬â€œ#92 merged)

Current mainline: VirgoScorpio Hub 0.6.2 at c6026f137bbdc48dca13faa17f9d8f9e02d3f037 after PR #92. Its PR workflow [run 42348356762](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42348356762) and post-merge mainline workflow [run 42348591975](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42348591975) passed all six hosted jobs: Node.js 22.23.4 and 24.22.1, PostgreSQL/Memgraph integration, browser/accessibility, CodeQL and consolidated evidence. PR #92 adds live PostgreSQL concurrency coverage for mega-menu optimistic updates. Two simultaneous updates using the same expected version must result in one successful update and one ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT; the final row increments once, matches the winner, and the other tenant remains unchanged.

The maintainer-generated [Tenant-Isolation Route and Data-Access Inventory](security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-07.md) catalogs 27 route/process families, 78 declared route patterns, 19 source files and 38 referenced test files. Its source anchors, test references and file digests are checked by the generator. Route descriptions and coverage limits remain maintainer-authored; the inventory is a navigation/drift-detection aid, not proof of completeness or runtime security.

Issue #14 remains OPEN / NOT PERFORMED; no independent reviewer or passing tenant-isolation evidence record is present. Issue #25 remains open. The retained formal PostgreSQL/Memgraph evidence remains bound to product-code baseline 29a3e03997da429a1bb05964f46c22cf975a8c2e (run #341); the green PR #92 and post-merge workflows do not silently replace that exact-source evidence contract. Service-less Node integration remains PARTIAL (29 skips per runtime), human lockfile review remains outstanding, and independent/provider/product/security/supply-chain/operations gates remain open. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED. No SemVer change, tag, publication or deployment is authorized.

---

## PR #92 merged - mega-menu optimistic concurrency

The merged regression submits two concurrent HTTP updates to the same Site A mega-menu slug with the same expected version. The live PostgreSQL job verified exactly one 200 response and one ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT, one version increment, persisted state matching the winning request, and an unchanged Site B same-slug record. This tests the existing conditional version update; no runtime behavior, public contract, dependency or schema changed. PR and post-merge CI passed all six hosted jobs.

This is targeted regression coverage only. It does not satisfy independent tenant-isolation issue #14 or broader security issue #25. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

# Release Readiness and Certification Gates

> **Current status: NOT_PRODUCTION_CERTIFIED.** The readiness report is an engineering evidence snapshot, not production approval.

## Historical verified mainline snapshot Ã¢â‚¬â€ 7 November 2026 (PRs #76Ã¢â‚¬â€œ#83 merged)

Current mainline source: VirgoScorpio Hub 0.6.2 at `109c05b001003e68dfaa5584353ab683a41d9075`. PRs #76Ã¢â‚¬â€œ#83 are merged. PR #83 adds read-only recursive pinned-submodule verification to development bootstrap and dev:doctor, with actionable fail-closed diagnostics and no automatic worktree mutation. PR CI and post-merge mainline push [run #353](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42321203517) passed all six hosted jobs. Node.js 22.23.4 and 24.22.1, PostgreSQL/Memgraph integration, browser/accessibility, CodeQL and evidence consolidation are green. The focused development change adds no dependency, schema, or public HTTP contract change.

Formal database evidence remains anchored to product-code baseline 29a3e03997da429a1bb05964f46c22cf975a8c2e (run #341), not the current mainline SHA. That exact-source artifact reports ciStatus: PASS and 67/67 live integration tests with zero failures, skips or TODOs; 18/18 migrations applied fresh and 18/18 skipped on the idempotent second pass; disposable database dropped; Memgraph outage/replay and graph rebuild passed. Producer manifest SHA-256: 27d70d6ed481e55ec2bd2d07b70f8aeda20602f8d2ae947c2384196ec2c6201c. Run #353 also passed its dedicated PostgreSQL/Memgraph job on current SHA, but this snapshot does not claim a newly retained formal release-evidence contract for that revision.

PR #80 makes formal CI evidence materialization safe for both the tracked historical target and symlink destinations. It stages a unique file using exclusive wx creation and restrictive permissions, writes through the open descriptor, fsyncs, then atomically renames after producer validation. REST response data remains validation-only and is not serialized. The two CodeQL review threads are resolved/outdated; CodeQL passed in both the PR workflow and post-merge mainline workflow.

This is an engineering CI result, not production certification. The Node matrix keeps its service-less integration subset PARTIAL (29 skipped tests per runtime), not a live-database pass. Human dependency/lockfile review remains open, and 14 independent/provider/product/security/supply-chain/operations evidence gates remain missing. The CI report explicitly keeps readyForProduction: false / NOT_PRODUCTION_CERTIFIED. Hub 0.6.2 remains unreleased; no tag, GitHub Release, package publication or production deployment is authorized.

A fresh isolated Windows checkout initialized EnginEx at pinned gitlink d99e021f55664f006b5e65b4a58202f9c7bc4f4b and completed npm ci on Node.js 26.12.1; the original linked worktree and developer data were left untouched. After PR #83, the exact-SHA diagnostic at 109c05b001003e68dfaa5584353ab683a41d9075 reported 5 PASS, 2 PARTIAL, 3 BLOCKED and 14 MISSING_EVIDENCE. The local artifact/syntax check hit a native Windows VirtualAlloc allocation failure; the unit runner also reported native Zone allocation failure while running test files (including auth-security and realtime), rather than assertion failures. This was a resource-limited local diagnostic, not a hosted-CI regression: PR #83 and mainline run #353 passed all six hosted jobs on the pinned Node 22/24 matrix. The local environment did not provide dedicated PostgreSQL/Memgraph TEST_DATABASE_URL endpoints, so its 29-test integration subset was skipped. Do not use this Node 26 workstation diagnostic as a substitute for exact-source hosted evidence or external acceptance.
### Local developer-checkout bootstrap safeguards Ã¢â‚¬â€ PR #83

The shared submodule preflight runs `git submodule status --recursive` read-only. It blocks on uninitialized, mismatched, conflicted, malformed, or unverifiable submodule state and never runs update, checkout, reset, or clean. The isolated checkout verified the EnginEx gitlink and nested worktree at the pinned commit. The original linked worktreeÃ¢â‚¬â„¢s shared `.git/config` permission restriction was not modified.

### Superseded run #278 attempt history

- Attempt 1 did not expose the required PostgreSQL/Memgraph job in the Actions job list. The browser API record remained queued even though its uploaded run-bound log records 9/9 Playwright tests; the aggregator correctly rejected the inconsistent/incomplete evidence set.
- Attempt 2 completed all five producer jobs successfully on the exact main SHA. Node.js 22.23.4 and 24.22.1 each passed 486/486 Hub tests and 94/94 EnginEx 7.0.0 tests, checked 208 required paths and 215 JavaScript files, and reported zero npm audit vulnerabilities. The dedicated PostgreSQL/Memgraph job passed 65/65 tests with zero skips, applied 18/18 migrations and skipped 18/18 on the idempotent second pass, and passed Memgraph outage/replay and graph rebuild. Browser smoke passed 9/9; CodeQL passed. Both npm 11.19.1 CycloneDX SBOMs contain 177 components / 178 dependency records and have identical normalized package/dependency graphs.
- Attempt 2's aggregator still blocked because the workflow-run API exposed the prior attempt's failed conclusion while the current attempt's aggregate job was executing. A narrowly scoped correction now accepts that condition only when the current-attempt aggregate job is running and every expected producer job is uniquely identified, complete, successful, and bound to the exact run attempt/revision. A regression test rejects failed producers, wrong attempts, and a completed failed aggregator. Hosted validation of this correction is pending; do not call run #278 green.

The per-runtime formal readiness snapshot remains **NO-GO**: **7 PASS, 2 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE**, with `readyForProduction: false`. The two PARTIAL rows are the service-less integration subsets (29 skips per runtime) and the reviewed-lockfile gate. The blocked formal PostgreSQL/Memgraph gate still expects a version/source-bound `artifacts/evidence/postgres-memgraph-live.json` record. Attempt 2 independently proves the live result through its run-bound integration artifact and proves fresh migrations through a `fresh-migrations.json` record bound to version 0.6.2 and exact SHA `d50e56801ea77a811ec809be1574e769917fff78`; that producer evidence does **not** silently substitute for the formal evidence contract. The retained local supplemental migration JSON remains a historical 0.5.1/14-migration file and is deliberately not represented as current evidence.

The fourteen missing evidence gates remain: independent tenant-isolation review; identity-provider E2E; ClamAV corpus/quarantine; live cloud-provider lifecycle; Stripe lifecycle; full browser/accessibility acceptance; commerce parity; community parity; signed plugin/container isolation; human dependency/SBOM/CodeQL review; load/soak/fault-injection/backup-restore; independent security assessment; operations/release-owner approval; and production observability deployment evidence. A green engineering workflow would not close these external gates.

The full current assessment, producer metrics, formal blocker, and next actions are in the [5 November 2026 0.6.2 Release Gate Report](reports/2026-11-05-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md).

## Historical PR #68 candidate follow-up snapshot Ã¢â‚¬â€ 5 November 2026

The latest PR candidate source commit is `8db6c66f07c6ea89745fe2a0c8dd7f5f4f6440b3`; hosted pull-request workflow [run #270](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42026945926) and push run [#269](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42026938931) both completed successfully on merge ref `e39cd5c33f940762ed9fa88b27aad8f8d3070947`. All six jobs passed in each run: Node.js 22.23.4, Node.js 24.22.1, dedicated PostgreSQL/Memgraph integration, browser/editor smoke, CodeQL, and consolidated revision-bound evidence.

Both runtime jobs passed 476/476 Hub tests and 94/94 EnginEx tests with zero failures or skips; each checked 206 required paths and 213 JavaScript files and reported zero npm audit vulnerabilities. Both CycloneDX 1.5 SBOMs identify npm CLI 11.19.1, derive from lockfile SHA-256 `f404ce5862bffa60daa2cb9cd471e6ac7893b048b2e877e623ddf43c1a15e7ce`, and contain 177 components / 178 dependency records. The aggregator confirmed identical normalized component inventories and dependency graphs. The dedicated live database job passed 65/65 tests with zero skips, applied 18/18 migrations, skipped all 18 on the idempotent second pass, exercised the supported v0008-to-v0009 upgrade fixture, verified Memgraph outage/replay and graph rebuild, and dropped its disposable database. Browser smoke passed 9/9. CodeQL and consolidated evidence passed.

The service-less integration subset remains PARTIAL (29 skips per runtime) and is not represented as live integration evidence. The separate formal release gate remains **NO-GO**: `NOT_PRODUCTION_CERTIFIED`, `readyForProduction: false`, 7 PASS, 2 PARTIAL, 1 BLOCKED and 14 MISSING_EVIDENCE. The blocked formal PostgreSQL/Memgraph evidence record still lacks schema/product/version/source-revision identity for this exact candidate, even though the current run-bound CI producer artifact independently proves the live test/migration result. Do not substitute one for the other. Fourteen independent/provider/product-acceptance/security/operations evidence requirements remain open. Production certification remains blocked.

The final live-library regression also caught and corrected a stale `ERR_SYSTEMFABRIC_*` error-code prefix during the intermediate run #268; the route now uses the canonical `ERR_VIRGOSCORPIO_HUB_*` codes shared by the current library store/public asset endpoints. Run #270 passed the live tenant-isolation suite after the correction.

At the time of this pre-merge candidate snapshot, PR #68 was open and had no submitted human reviews. That state was superseded when PR #68 merged as `be1441e216c20358e8506389915a676209808e37`; PR #69 then merged to main as `d50e56801ea77a811ec809be1574e769917fff78`. No release tag, GitHub Release or production deployment is authorized.

## Previous hosted candidate snapshot Ã¢â‚¬â€ 5 November 2026

Hub 0.6.2 is proposed in PR [#68](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/68), head commit `31dd63908fbf8a9fb0340323d92ffd6cdd4d89b9`. PR CI run [#260](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/41976111045) and push run [#259](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/41976023520) passed all six checks. The revision-bound PR merge-ref is `16d9852126da4aa5c3e15d42460375a2e0ad0cd7`; its Node.js 22.23.4 and 24.22.1 jobs each passed 469/469 Hub tests, 94/94 EnginEx tests, 205 required artifact checks and 213 JavaScript syntax checks. Dedicated live PostgreSQL/Memgraph passed 65/65 tests, applied 18/18 migrations with an idempotent second pass, and browser smoke passed 9/9. Dependency audit reported zero vulnerabilities; CodeQL workflow and consolidated evidence passed.

The formal evaluator on both runtime jobs reports `NOT_PRODUCTION_CERTIFIED`, `readyForProduction: false`, 8 PASS, 2 PARTIAL and 14 MISSING_EVIDENCE. The evidence aggregator separately records production certification as BLOCKED because independent/provider/operational approval is not part of CI. The earlier supplemental fresh-migration result was blocked because retained local evidence was a stale 0.5.1 artifact, as explained in the [5 November 2026 0.6.2 Release Gate Report](reports/2026-11-05-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md). At the time of this pre-merge hosted-candidate snapshot, PR #68 remained open and unmerged. It subsequently merged on 5 November 2026; the current mainline state is documented at the top of this page. No release tag or GitHub Release has been published.

The complete earlier exact-revision assessment and original SBOM variance are in the [0.6.2 Release Gate Report](reports/2026-11-05-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md). The follow-up is now committed in PR #68 and passed hosted pull-request run [#264](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42015046006). It binds formal/supplemental evidence to schema, product, version and exact Git SHA; the migration harness emits its source revision. It pins npm 11.19.1 and validates identical normalized CycloneDX component/dependency graphs across Node.js 22/24. The latest readiness is 7 PASS, 2 PARTIAL, 1 BLOCKED and 14 MISSING_EVIDENCE. The blocked formal PostgreSQL/Memgraph evidence remains intentionally blocked until an exact-revision evidence record is supplied; the dedicated CI run-bound live integration result passed. The 4 November report below is retained as the prior 0.6.1 mainline snapshot.

## Historical mainline snapshot Ã¢â‚¬â€ 4 November 2026

The current default branch was reviewed at commit `489325585d57fe95f961c36a597faa7065848c7f` (`refactor(api): extract AI task route family`, PR #67). Hosted CI run [#258 / 41949722725](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/41949722725) completed all six checks successfully: Node.js 22.23.4, Node.js 24.22.1, dedicated PostgreSQL/Memgraph integration, browser/accessibility smoke, CodeQL, and consolidated revision-bound evidence. Both runtime jobs passed 461/461 Hub tests and 94/94 EnginEx tests; the live database job passed 65/65 tests and applied all 18 migrations with an idempotent second pass; browser smoke passed 9/9.

The formal readiness evaluator on this revision remains **NO-GO**: 8 PASS, 2 PARTIAL, 0 BLOCKED, 14 MISSING_EVIDENCE and 0 NOT_RUN; `readyForProduction` is false. The outstanding items include independent tenant-isolation/security reviews, live identity/scanner/cloud/Stripe provider verification, full accessibility and product acceptance, signed plugin isolation, SBOM/license/provenance review, load/backup/restore, production observability, operations and release-owner approval. Green CI is engineering evidence, not production certification.

The complete revision-bound assessment is in the [4 November 2026 VirgoScorpio Hub 0.6.1 Release Gate Report](reports/2026-11-04-VirgoScorpio-Hub-0.6.1-Release-Gate-Report.md). The report preserves the distinction between the 0.6.1 mainline candidate and the follow-on 0.6.2 local development branch. No release tag or GitHub Release was published at review time.

## Historical pre-PR #65 assessment Ã¢â‚¬â€ 4 November 2026 (superseded)

PR [#59](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/59) completed the identity cutover. PR #61 added the encrypted durable AI queue foundation; PR #62 centralized transaction/version infrastructure; PR #63 extracted browser auth routes/cookie handling; and PR #64 separated session persistence/lifecycle from identity orchestration. These PRs are merged to `main` at the latest pre-candidate commit `aa361ab` (4 November 2026). They are code changes, not release-certification events. The detailed candidate evidence below was generated on 1 November and is historical, not current-commit evidence.

The post-PR #63 CodeQL analysis on `dc4a82d` marked High auth-cookie alerts #30Ã¢â‚¬â€œ#33 fixed without manual dismissal. Medium alert #14 (`js/unsafe-code-construction`) remains open on the `aa361ab` baseline, at the now-removed vendor legacy renderer. PR #65 is the 0.6.0 / EnginEx 7.0.0 compatibility/security candidate that removes that legacy execution adapter; its CodeQL and other hosted checks must pass before the alert can be recorded as fixed. No finding is manually dismissed or suppressed.

**Historical disposition for the pre-PR #65 snapshot:** NOT_PRODUCTION_CERTIFIED / NO-GO. This section records the then-current 0.6.0 candidate and is retained for audit continuity; use the current mainline snapshot above and the linked 4 November report for the latest evidence.

## Historical candidate snapshot Ã¢â‚¬â€ 1 November 2026

The latest reviewed engineering evidence is recorded in the [1 November 2026 project status report](reports/2026-11-01-VirgoScorpio-Hub-0.5.1-Project-Status-Report.md). It covers candidate PR #36 at `f9d463ef9ca82d15c9220e15cf50df2ba6367a11` (based on `main` `1a903b8eab4304dd61b2489381b091d34f1ea546`). The candidate's latest hosted workflow completed all five jobs successfully, including the dedicated PostgreSQL/Memgraph job (22/22 tests, zero skips), fresh migrations (14/14 applied, 14/14 idempotently skipped), Chromium smoke (9/9), and CodeQL analysis execution.

The candidate readiness snapshots report **6 PASS, 2 PARTIAL, 2 BLOCKED, 13 MISSING_EVIDENCE, 0 NOT_RUN**. The two blockers concern (1) source-tree changes observed on a generated merge-ref checkout, whose exact four paths require diagnosis, and (2) readiness failing to aggregate the separate live integration job. The service-less matrix integration skips must remain distinct from the 22/22 dedicated live result. These are unresolved readiness-control issues, not a failed live integration run.

The candidate still has five open CodeQL results (four High and one Medium), no independent tenant-isolation or application-security review, no accepted production-provider/operations evidence, and no release-owner scope approval. **Production remains NO-GO; `readyForProduction` remains false.** This summary does not close any gate or imply PR #36 is merged.

## Historical recorded assessment (31 October 2026; superseded)

The authoritative recorded snapshot is generated by `npm run release:readiness` and retained in:

- `artifacts/release-readiness.md` Ã¢â‚¬â€ human-readable summary.
- `artifacts/release-readiness.json` Ã¢â‚¬â€ machine-readable source of truth.

The latest retained snapshot reports:

| Status | Count | Interpretation |
|---|---:|---|
| Pass | 9 | Source cleanliness, supported runtime, migration inventory, syntax/artifact check, unit/security tests, EnginEx tests, live integration, Playwright dependency availability, and PostgreSQL/Memgraph live evidence. |
| Partial | 1 | The committed npm lockfile installs reproducibly, but a maintainer has not completed the explicit dependency/lockfile review. |
| Blocked | 0 | No current source-level check is recorded as failed. |
| Missing evidence | 13 | External or independent certification gates remain without accepted evidence. |
| Not run | 0 | All programmatic checks configured by the report ran. |

The machine report tracks **9 programmatic checks plus 14 external evidence gates (23 rows total)**. One external gate (PostgreSQL/Memgraph live integration) passed; 13 remain open. The retained report was generated at `2026-10-31T21:09:35.326Z` on source commit `f4d78c6037a658006e72785d9bcc403b3508ec6d`, before PR #12 was squash-merged. The resulting main commit is `81e31b235a846c291d3d100eb33c08bf0ecd86cf`. Treat the artifact as the latest recorded snapshot, not as a report generated from the exact merge commit. Regenerate and reconcile the report when preparing the actual release candidate.

### Certification execution plan

See [Production Certification Execution Plan](PRODUCTION-CERTIFICATION-PLAN.md) for the sequenced 13-gate work plan, release-scope/provider matrix, independent tenant-isolation review checklist, workstream owners, evidence acceptance rules, and release exit criteria.

### Confirmed engineering evidence

- `npm run check`: 212/212 VirgoScorpio Hub unit/security tests passed, zero skips; 146 required artifacts and 143 JavaScript files checked.
- `npm --prefix vendor/enginex test`: 88/88 passed, zero skips.
- Fresh PostgreSQL database: all 14 migrations applied, then all 14 skipped on the second pass; only the generated disposable test database was dropped.
- Live local PostgreSQL/Memgraph/Redis integration: 22/22 passed, zero skips, against the dedicated `virgoscorpio_hub_test` database.
- Memgraph outage/recovery and canonical graph rebuild rehearsals passed using isolated test resources.
- Playwright Chromium suite: 9/9 passed with one worker, including editor, accessibility smoke, two-session collaboration and multi-node collaboration recovery. Manual screen-reader and broader WCAG acceptance remain open.
- `npm audit --audit-level=high` and runtime-only audit both reported zero vulnerabilities.
- CycloneDX 1.5 SBOM generated with 163 components and 164 dependency records.
- Gitleaks working-tree and locally fetched Git-history scans exited successfully with zero findings. Re-scan the exact published refs before release.
- PR #12 validation completed successfully: workflow runs [41242423422](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/41242423422) and [41242454838](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/41242454838) each passed all five jobs on the release-tooling correction.
- Post-merge main workflow [41242636499](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/41242636499) passed all five jobs on merge commit `81e31b235a846c291d3d100eb33c08bf0ecd86cf` (Node.js 22.23.4 and 24.22.1, PostgreSQL/Memgraph integration, browser/accessibility smoke, and CodeQL).

These are development/test results only. They do not prove production deployment behavior or replace third-party, manual, or independent assessments.

## Remaining certification gates

### Build and test integrity

- [x] Fresh database install and migrations 0001Ã¢â‚¬â€œ0014 pass on a disposable PostgreSQL database.
- [x] Supported v0008 upgrade fixture is exercised through the current migration set by the integration runner.
- [x] Live PostgreSQL/Memgraph integration passes with zero skipped tests on the current application baseline.
- [x] Hosted CI passes on the release-tooling correction across the supported Node.js matrix and all configured jobs. See the PR and post-merge workflow runs above.

### Identity, tenancy, and external providers

- [ ] Independent tenant/site isolation and authorization review across applicable routes and capabilities. The regression test expansion in merged PR #10 is targeted coverage, not an independent review.
- [ ] Real OIDC/SAML, email delivery, MFA recovery, replay/rotation/logout and outage flows for the providers in the approved release scope.
- [ ] Live ClamAV (or selected scanner) malicious-file corpus, timeout/unavailable behavior, false-positive handling and legacy-asset quarantine/rescan.
- [ ] Live object-storage provider authentication, least-privilege read/write/delete, credential resolution, encryption, retention and lifecycle tests for every provider enabled or claimed for this release.
- [ ] Stripe checkout/webhook replay, ambiguous network outcomes, inventory reservation, refund and subscription lifecycle validation.

### Browser, product acceptance, isolation and supply chain

- [ ] Full browser/accessibility acceptance, including manual keyboard, focus, contrast and screen-reader review. The 9-test Playwright suite is smoke/functional evidence, not this entire gate.
- [ ] Scoped commerce acceptance for tax, shipping, discounts, refunds, fulfilment, entitlements and subscriptions. Do not claim full parity for incomplete features.
- [ ] Scoped community acceptance for group privacy, forums, abuse controls, search, export and deletion. The release manifest explicitly records some of these features as incomplete.
- [ ] Plugin build/sign/provenance pipeline and adversarial container isolation in the actual supported runtime.
- [ ] Maintainer review of the committed lockfile and dependency tree; retained SBOM/provenance/attestation; current CodeQL and dependency-analysis evidence on the release candidate. npm audit, SBOM generation and hosted CodeQL have passed, but the complete reviewed evidence record remains open.

### Operations and approval

- [ ] Representative load/soak, resource-exhaustion and fault-injection tests.
- [ ] Backup restoration, database/graph recovery and storage crash-recovery drills.
- [ ] Independent security assessment; critical/high findings resolved or formally accepted with owners.
- [ ] Deployment and rollback runbooks, secret rotation, monitoring/alerting and incident response reviewed.
- [ ] Named operations/release owner records explicit approval for a defined release scope.

## Evidence record template

For each remaining gate, record:

| Field | Required value |
|---|---|
| Gate | Named requirement. |
| Commit | Full SHA reviewed. |
| Environment | OS/runtime, service/provider versions, topology and relevant configuration; no secrets. |
| Command or procedure | Exact command or linked runbook. |
| Result | Pass, partial, blocked or not run. |
| Evidence | Retained workflow, report, artifact or approval record. |
| Reviewer/date | Named reviewer or accountable role and UTC date. |
| Caveats | Limitations, skipped tests, failures or approved waivers. |

## Release decision

VirgoScorpio Hub remains **NOT_PRODUCTION_CERTIFIED**. Do not mark it production-ready until every required gate has current evidence for the intended release revision, exceptions are documented and approved, restore/rollback paths are proven, and the release owner signs off. A green CI run, public repository, or a passed unit suite is not production certification.

### Recommended developer-preview scope

The [0.6.2 recommended release-scope matrix](RELEASE-SCOPE.md) reconciles the manifest, sample environment, feature defaults and mainline evidence. It is a technical recommendation pending named authorized release-owner approval under issue #13. Its preview exclusions do not satisfy or waive the separate production evidence gates.


## F1.25 — content-type registry concurrency and role gate (merged)

F1.25 merged via PR #130 at main 9f8e612c883a78d322d2086b4b08d3438b0b9231. Exact-head workflows #575/#576 and docs-final #577/#578 each passed 92/92 live PostgreSQL/Memgraph integration tests with zero failures/skips. The Site B editor site:manage denial-before-persistence and concurrent same-slug version progression/tenant-preservation assertions executed. Node 22/24 594/594, CodeQL, browser/accessibility 9/9, collaboration Playwright 3/3 and dependency audits passed. No formal review submission was recorded; maintainer/automation evidence only. No runtime/API/schema/migration/dependency/provider/package-version change.


## F1.26 — Redis Pub/Sub re-subscription (candidate)

Test-only Playwright candidate on branch security/redis-pubsub-resubscribe-2026-11-12 under issue #124. It verifies the two API bridges reconnect to a full-ID-verified disposable Redis 7.4 service and a newly committed Site A authorization invalidation reaches the remote subscriber after re-subscription, closing only the revoked Site A socket before the test-only heartbeat while Site B remains usable. Local syntax/focused Redis tests and npm run check pass; exact-head hosted PostgreSQL/Redis/Playwright validation and human review are pending. Pub/Sub is ephemeral; no lost-message replay or durable delivery is claimed, and PostgreSQL command/heartbeat reauthorization fallbacks remain required. No production runtime/API/schema/migration/dependency/provider/package-version change.
