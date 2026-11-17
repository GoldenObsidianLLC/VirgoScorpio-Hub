# VirgoScorpio Hub 0.6.2 — Full release-gate report

**Assessment snapshot:** 17 November 2026 UTC / 17 November 2026 America/Chicago
**Current mainline source:** `00b78a85ddf33b92878a7fcbdddca8e2fc812f66` (F1.44 / PR #184)
**Latest exact-main CI:** [workflow #718](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44081171818) — successful, 7/7 jobs
**Latest runtime merge:** F1.44 / PR #184 at `00b78a85ddf33b92878a7fcbdddca8e2fc812f66`, implementation commit `905e5f06e6929b0aa2ef2c4c65ce7a17e34a7e19`
**Decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**

> This report separates engineering implementation and CI evidence from the independent, provider, product, legal, governance and operational acceptance gates required for production. Passing CI, database regressions, CodeQL or signed attestations do not constitute independent security or legal approval.

## Executive decision

VirgoScorpio Hub `0.6.2` remains a private, unreleased developer-preview candidate. `readyForProduction` is `false`. No SemVer increment, release tag, GitHub Release, npm publication, production deployment or claim of production certification is authorized.

Current mainline includes F1.38 (PR #166), F1.39 (PR #169), F1.40 reusable-component mutation/audit atomicity (PR #172), F1.41 Stripe refund audit atomicity (PR #176), F1.42 cloud connection audit atomicity (PR #179), F1.43 site invitation audit atomicity (PR #182), and F1.44 content revision restore audit atomicity (PR #184). F1.43 implementation commit `1b98867fc3b191eecd888fb53ef52552dbc0df7b` merged at `82ace7f0413842a9d92156f6d4be3692e3913ce5`; F1.44 implementation commit `905e5f06e6929b0aa2ef2c4c65ce7a17e34a7e19` merged at current main `00b78a85ddf33b92878a7fcbdddca8e2fc812f66`. Issues #181, #183 and #178 are CLOSED. Exact-main workflow #715 passed all seven jobs after F1.43; exact-main workflow #718 passed all seven jobs on the F1.44 merge SHA, covering Node.js 22/24, live PostgreSQL/Memgraph/Redis integration, migrations, PostgreSQL-backed collaboration/browser checks, CodeQL, signed mainline attestations and exact-source evidence consolidation. PRs #182 and #184 recorded no formal review submissions or inline review threads; implementation and automation evidence are not independent security approval.

The last published canonical readiness artifact 14304914480 was generated at `2026-11-17T06:35:26.692Z`, source-bound to the prior F1.42 main SHA `10e62a5902a68cee5edc31b57847a5602078feb1` (not the current F1.44 SHA); archive SHA-256 is `2bee41c738b0dd9e1f0fd738e05591fae3dd223edb7579c92c65c47750b08019`. The classification below is the last recorded snapshot pending refresh against the newer source:

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

In that prior F1.42 snapshot, the two PARTIAL classifications were (1) incomplete qualified human lockfile/dependency/license review, and (2) service-less integration diagnostics with 40 skipped tests per supported Node runtime. Those skips are not live integration passes and remain separate from the 115/115 zero-skip PostgreSQL/Memgraph producer evidence recorded by prior workflow #709. Do not interpret this stale source-bound classification as refreshed release approval for F1.44.

## Latest exact-main source validation — workflow #718 (F1.44 merged)

Workflow [#718](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44081171818) validated exact current main SHA `00b78a85ddf33b92878a7fcbdddca8e2fc812f66` and completed all seven required jobs successfully after F1.44 merged. The run passed the supported Node.js 22/24 jobs, live PostgreSQL/Memgraph/Redis integration, fresh/idempotent migration validation, PostgreSQL-backed collaboration and browser/accessibility checks, CodeQL, signed mainline provenance/SBOM attestations and exact-source evidence consolidation.

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | Supported Node 22 validation job succeeded on the exact F1.44 source; see workflow #718 logs for the run-bound test summary. |
| Node.js 24.22.1 | PASS | Supported Node 24 validation job succeeded on the exact F1.44 source; see workflow #718 logs for the run-bound test summary. |
| PostgreSQL / Memgraph / Redis | PASS | Exact-main live integration job succeeded. The F1.44-specific authenticated restore-route audit failure/retry case is separately tracked under #185 and is not attributed to this mainline run. |
| Fresh migrations | PASS | Mainline migration validation job succeeded. The dedicated local follow-up test independently applied all 18 migrations before its PostgreSQL route regression. |
| PostgreSQL-backed collaboration browser suite | PASS | The exact-main collaboration Playwright job succeeded. |
| Browser editor/accessibility smoke | PASS | The exact-main browser/accessibility job succeeded; not full manual WCAG/assistive-technology acceptance. |
| CodeQL | PASS | Static analysis succeeded; not independent application-security review. |
| Mainline attestations | PASS | Signed SLSA provenance and CycloneDX SBOM attestations were created, uploaded and verified against the exact F1.44 mainline subjects. |
| Evidence consolidation | PASS | Exact-source producer manifests/checksums validated and evidence consolidation completed. This is distinct from refreshing the canonical production-readiness decision. |

The run-bound audit results and SBOM/provenance subjects are retained in workflow #718. The attestation links, lockfile digest and CycloneDX digest retained from the prior report revision are artifacts of F1.42 workflow #709, not hashes for the newer F1.44 source; they are not carried forward as current-source identifiers here.

### Canonical readiness and retained workflow artifacts

The last published canonical readiness artifact listed below is source-bound to the prior F1.42 main SHA `10e62a5902a68cee5edc31b57847a5602078feb1`; it has not been refreshed to the F1.44 source `00b78a85ddf33b92878a7fcbdddca8e2fc812f66`. Its 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE classification is therefore the last recorded gate snapshot, not a source-current certification. Workflow #718's successful evidence consolidation and signed attestations do not change that limitation or certify production.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release-readiness bundle | 14304914480 | `2bee41c738b0dd9e1f0fd738e05591fae3dd223edb7579c92c65c47750b08019` |
| PostgreSQL/Memgraph producer | 14305268510 | `e1a20084553cdc7b2558197354e513f4996083a6c019f919f2013c1afa5f22e4` |
| Live PostgreSQL/Memgraph tests (Node 22) | 14305013820 | `6a82f424e9729b347ca46faa4ac4bee2bb7e2ac9bb246920bc4857973002e0e8` |
| Node.js 22 CI evidence | 14305702555 | `54477a234cb1678445c0d841103db592a427dd3df15ccb75d65c4411b75dcae1` |
| Node.js 24 CI evidence | 14305532776 | `f881a2012ed140a607211091a78ee838b553ec32f472aa4bea04ecd2cbdd6729` |
| Browser/editor evidence | 14304839302 | `d2bee0edb866a0ce482b178d110f995f5c70b2c2766f2ebea3a06a40b606bd55` |
| CodeQL evidence | 14305078472 | `4b04e6ad6a532e8c4ef7179cf6d4f7cea538ecb4af21c64b50c0878889b72f9a` |
| Signed mainline dependency/SBOM attestations | 14305947193 | `377cbee5eec324dc83171cc13d8c59115247733b72f40e26f48ed6793f26327c` |
| Node.js 22 dependency evidence | 14305677498 | `b2727c2cfe821624d40085cc09c45baff3abc9d759d559ad70875b0749b10b84` |
| Node.js 24 dependency evidence | 14305842144 | `9175f16bf89c5a3b6436599b9d6780ca1805003e8ceab0f4d4aee12b503e3d0e` |

The listed hashes are GitHub artifact ZIP archive digests, not hashes of files inside each ZIP. Workflow #709 producer records and run-bound source identity are authoritative for this snapshot.

## Previous exact-main source validation — workflow #703 (F1.41 merged; historical snapshot)

At the preceding F1.41 mainline snapshot, workflow [#703](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43996617110) validated exact SHA `eb6fe4c8672dadd98892a62062ecf718ce9393b6` and completed all seven required jobs successfully; the later F1.42 mainline snapshot is workflow #709 above.

| Producer / job | Result | Qualification |
|---|---|---|
| Node.js 22.23.4 | PASS | 646/646 Hub tests; 94/94 EnginEx tests; zero failures or skips. |
| Node.js 24.22.1 | PASS | 646/646 Hub tests; 94/94 EnginEx tests; zero failures or skips. |
| PostgreSQL / Memgraph | PASS | 115/115 live integration tests; zero failures/skips. Includes F1.41 audit-failure rollback, same-key recovery and terminal replay; Memgraph outage/recovery and graph rebuild. |
| Fresh migrations | PASS | 18/18 migrations applied; 18/18 idempotent second-pass checks passed. |
| PostgreSQL-backed collaboration browser suite | PASS | 4/4 Playwright tests. |
| Browser editor/accessibility smoke | PASS | 9/9 Playwright smoke tests; not full manual WCAG/assistive-technology acceptance. |
| CodeQL | PASS | Static analysis succeeded; not independent application-security review. |
| Mainline attestations | PASS | Signed SLSA provenance and CycloneDX SBOM attestations created, uploaded and verified. |
| Evidence consolidation | PASS | Exact-source producer manifests/checksums validated; canonical readiness finalized. |

Both full and production-only npm audit scopes reported zero vulnerabilities on each runtime. Mainline attestations: [SLSA build provenance](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68411563) and [CycloneDX SBOM](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68411568). Lockfile SHA-256 is `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`. The F1.41 change introduced no lockfile or dependency change.

### Canonical readiness and retained workflow artifacts

The canonical report is source-bound to `eb6fe4c8672dadd98892a62062ecf718ce9393b6`; it does not certify production.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release-readiness bundle | 14290516898 | `1e9cf157025b2fc0338c624b28a971993152f441e732d2d5251c1b938583ba16` |
| PostgreSQL/Memgraph producer | 14289519267 | `411bc3769c9ec9b5ae69eedf4b9c50119121a13c68505c8a774b956de8614715` |
| Live PostgreSQL/Memgraph tests (Node 22) | 14290022564 | `62350aa70bbc9158c2296f170e6a665029f27f331c56106457f737ebdf29727b` |
| Node.js 22 CI evidence | 14290272065 | `05785f5049800e39dc258b6ac9c4fc73a116dd910adf4a38152daf51ca0e4f19` |
| Node.js 24 CI evidence | 14289227766 | `ed11682abce36f2b385a82ac88914f85ac201777b1b8a00f516994f87b858b7f` |
| Browser/editor evidence | 14290366833 | `900e1f67cdb96cc9995ab7d414f70e793ea78148356ef56ab96e7871574f4f5d` |
| CodeQL evidence | 14290810676 | `1c9a68d02ad3ce152d730021499cbf8216ef106cf30c8f30396ac6fef21af0b8` |
| Signed mainline dependency/SBOM attestations | 14289509139 | `62bad3d08f0aba4a711bf5d7975de9e06327afbbb05915c37550149ee22b6329` |
| Node.js 22 dependency evidence | 14290242144 | `e4cabd6d8eb773a54fd4e2b9dbdcf1d0a281481e3cff5c4caaa9bb361e82fee3` |
| Node.js 24 dependency evidence | 14289622488 | `22b725d587224e41cdb33310a9979e2ea7d788b78d0274f843945542d6056428` |

The listed hashes are GitHub artifact ZIP archive digests, not hashes of files inside each ZIP. Workflow #703 producer records and run-bound source identity are authoritative for this snapshot.

## F1.42 — Cloud connection audit atomicity (merged)

[PR #179](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/179) merged at `2026-11-17T06:32:01Z` from candidate head `2c20dafc1ffc28e67b7be0f73bbe989162c80c0f`; implementation commit is `19a4599db0087810550ea152bd509c80ce49e1bf`. Merge commit and current main SHA are `10e62a5902a68cee5edc31b57847a5602078feb1`. Issue [#178](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/178) closed at `2026-11-17T06:32:02Z`. Exact-head workflow [#708](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44031408890) and exact-main workflow [#709](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44031913251) both passed their required jobs; #709 additionally completed mainline signing and evidence consolidation.

Cloud connection create, disable, and post-probe health-check persistence now commit with their correlated metadata-only audit event on the same transaction-owned PostgreSQL queryable. Credential resolution and read-only provider probes remain outside PostgreSQL transactions. A conditional update preserves `disabled` when a health check overlaps a disable. Audit details omit credential references/values, configuration, bucket/container names, endpoints, raw provider responses and raw error messages. Existing site/capability checks, site-scoped predicates, non-disclosing 404 behavior, request correlation and response contracts are preserved.

Local Windows / Node.js 26.12.1 evidence: `npm run check` passed 652 tests / 0 failed / 3 Windows-specific skips; focused cloud/platform tests passed 16/16; live local PostgreSQL/Memgraph/Redis integration passed 114/114 with zero skips; tenant inventory reported 27 families / 78 route patterns / 21 source files / 49 test files. The S3 probe-order regression uses an ephemeral loopback HTTP endpoint with test credentials; it is a protocol stub, not live cloud-provider acceptance.

Hosted PR exact-head workflow #708 passed Node 22/24 (655/655 Hub and 94/94 EnginEx each), 115/115 live PostgreSQL/Memgraph/Redis integration tests with zero skips, fresh/idempotent migration checks, browser smoke 9/9, collaboration Playwright 4/4, CodeQL, zero-vulnerability full/production audits and candidate evidence consolidation. Mainline exact-main workflow #709 passed the same Node and integration matrices, signed Build Provenance and SBOM attestations, and finalized the canonical readiness snapshot. The mainline readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; `readyForProduction` is false.

GitHub records zero formal review submissions and zero inline review threads for PR #179. Merge and CI are maintainer/automation evidence only, not independent tenant-isolation, security or legal acceptance. Live AWS/S3-compatible/GCS/Azure/R2/MinIO lifecycle, IAM/egress/SSRF qualification, and independent review remain separate production gates. No schema, migration, public API, dependency, lockfile or SemVer change; package 0.6.2 remains private/unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

## F1.41 — Stripe refund audit atomicity (previous completed increment)

[PR #176](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/176) merged at `2026-11-17T01:34:31Z` from implementation head `f15af08e8a0647da56328a8be2717ea41c674ae0`; the underlying implementation commit is `c60c0448de676e06f7b22b399107a8e61674b8af`. Merge commit and current main SHA are `eb6fe4c8672dadd98892a62062ecf718ce9393b6`. PR exact-head [workflow #702](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43991407172) and exact-main workflow #703 both passed. Issue [#175](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/175) remains OPEN for maintainer close-out.

The Stripe refund request remains outside PostgreSQL. Once Stripe responds, provider refund ID/status, any full-order transition and the correlated metadata-only `commerce.refund_requested` audit now persist through the same checked-out PostgreSQL transaction queryable before COMMIT. Audit failure rolls back local provider binding/status/order changes while preserving the durable refund reservation. A same-key retry reuses the stable `vsh_refund_<local refund id>` Stripe idempotency key; terminal replay does not make another provider call or duplicate the audit. PostgreSQL cannot roll back an external Stripe refund already accepted by Stripe; this is not a distributed transaction.

Local Windows / Node.js 26.12.1 evidence: `npm run check` passed 643 tests / 0 failed / 3 Windows-specific skips; focused refund unit + dedicated PostgreSQL failure-injection/retry/terminal-replay suite passed 17/17 with zero skips; a fresh PostgreSQL 18 database applied all 18 migrations; tenant inventory reported 27 families / 78 route patterns / 21 source files / 49 test files; full and production npm audits reported zero vulnerabilities. The test uses a Stripe stub, not live provider credentials or provider-lifecycle certification.

GitHub records zero formal review submissions and zero inline review threads for PR #176. Merge and CI represent maintainer/automation evidence only, not independent security review. The Stripe lifecycle production gate remains MISSING_EVIDENCE.

## Production evidence matrix — 14 missing gates

| Gate | Current status | Evidence still required |
|---|---|---|
| Tenant isolation / authorization review (#14) | MISSING_EVIDENCE | Independent assessor's own route discovery, adversarial testing, findings and signed acceptance. The maintainer route inventory is not independent evidence. |
| Identity-provider E2E | MISSING_EVIDENCE | Real OIDC/SAML provider journeys, email delivery, password recovery and MFA enrollment/recovery with operational credentials and failure handling. |
| ClamAV corpus and legacy asset quarantine | MISSING_EVIDENCE | Managed scanner execution against safe/infected test corpus; quarantine/remediation of existing `not_scanned` assets; provider operational evidence. |
| Live cloud storage providers | MISSING_EVIDENCE | S3/GCS/Azure/S3-compatible live upload/read/delete/visibility-revocation/restore operations, least-privilege credential policies and deployment-bound configuration evidence. |
| Stripe lifecycle | MISSING_EVIDENCE | Live/test-mode provider-verified checkout, signed webhook replay, ambiguous outcomes, refunds, stock reconciliation and full subscription lifecycle acceptance. F1.41's PostgreSQL regression uses a provider stub only. |
| Manual accessibility | MISSING_EVIDENCE | Human WCAG/assistive-technology acceptance across keyboard-only, screen reader, focus, zoom/reflow and supported browsers. Playwright smoke is not a substitute. |
| Commerce parity | MISSING_EVIDENCE | Acceptance of tax, shipping, coupons, refunds, invoices/receipts, fulfillment, downloads, disputes and recurring subscription lifecycle. |
| Community parity | MISSING_EVIDENCE | Acceptance of group privacy, abuse/spam controls, moderation, search, export/deletion and browser workflows. |
| Plugin container isolation | MISSING_EVIDENCE | Signed OCI pipeline, SBOM/provenance verification, adversarial sandbox/egress/resource testing and containment acceptance. |
| Human dependency/SBOM/CodeQL review (#23) | MISSING_EVIDENCE | Qualified human license/notice/distribution review, SBOM disposition and exact-SHA CodeQL alert review. Machine attestations and scanner success are not legal clearance. |
| Load/backup/restore (#24) | MISSING_EVIDENCE | Measured load/soak/fault/resource-exhaustion testing, verified backup/restore and graph reconstruction drills with recovery objectives. |
| Independent platform security (#25) | MISSING_EVIDENCE | Qualified independent security assessment and documented severe-finding remediation/retest. |
| Operations/release approval (#26) | MISSING_EVIDENCE | Named release-owner approval, deployment and rollback runbooks, secret rotation, incident response, monitoring and production change control. |
| Production observability | MISSING_EVIDENCE | Approved OTLP backend, secure delivery, ownership, governance, retention, access control and alert/incident evidence. |

The two PARTIAL items are not included in the missing-gate count: service-less integration diagnostics (40 skips per runtime) and qualified human dependency/license review. The live database producer is a separate 115/115 zero-skip result.

## Governance and formal controls

- **#13 — release scope/provider matrix:** OPEN. Final product subset, provider enablement and explicit acceptance scope require authorized governance.
- **#14 — independent tenant-isolation review:** OPEN / NOT PERFORMED.
- **#23 — human dependency/SBOM/license/distribution review:** OPEN / PARTIAL.
- **#24 — load, backup and restore:** OPEN.
- **#25 — independent platform security assessment:** OPEN / NOT PERFORMED.
- **#26 — operations/release-owner acceptance:** OPEN.
- **#32 — operating reserve, compensation and capital controls:** OPEN.

No formal PR review submissions or inline review threads were recorded for PR #179, PR #176, PR #172 or documentation PR #173. Mainline attestations, CodeQL and automated tests are not independent security or legal approval. No production gate is waived by this report.

## Engineering roadmap

F1.21–F1.44 are 24 consecutive bounded engineering increments merged to main, covering site-owner concurrency, site capabilities/SSE revocation, invitation and audit recovery, content-type registry concurrency, Redis reconnect behavior, editorial ownership, membership/site creation/design-system/taxonomy/relationship/AI-policy/workflow audit atomicity, plugin lifecycle locking/audit consistency, firewall rule/audit consistency, page-draft persistence/audit atomicity, library asset upload/version audit atomicity, legacy media upload/audit atomicity, reusable-component mutation/audit atomicity, Stripe refund audit/recovery atomicity, cloud connection mutation/audit atomicity, site invitation creation/audit atomicity (F1.43), and content revision restore/audit atomicity (F1.44).

F1.44 is the latest runtime merge; issues #181, #183 and #178 are CLOSED. Issue #175 remains OPEN for maintainer close-out. Issue #185 tracks an additional live PostgreSQL route-level fault-injection regression for authenticated revision restore; the test has passed 1/1 with zero skips on a disposable PostgreSQL 18 database after 18/18 migrations, but it remains on an isolated follow-up branch and is not yet part of main. Complete its exact-head CI and human review before merge; do not self-approve. Next, inspect remaining OPEN items under parent #124 and the source-anchored tenant inventory to reproduce a concrete F1.45 route, authorization, transaction or recovery gap before selecting further runtime scope. Independent reviews #14/#25 and qualified dependency/license review #23 remain separate assurance gates. Continue non-production resilience and operations preparation under #24/#26 without implying production readiness.

No meaningful overall completion percentage or delivery date is asserted: these gates have different scope and evidence weight, and green CI must not be conflated with external product or production acceptance. Package `0.6.2` remains private and unreleased; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.
