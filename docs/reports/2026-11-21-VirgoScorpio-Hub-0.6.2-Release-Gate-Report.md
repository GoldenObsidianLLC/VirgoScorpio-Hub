# VirgoScorpio Hub 0.6.2 — Current Release Gate Report

**Snapshot:** 21 November 2026, America/Chicago
**Repository:** [GoldenObsidianLLC/VirgoScorpio-Hub](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub)
**Current main:** `6a6b88fb174a4c16571b2f97a8db3e417378caec`
**Exact-main workflow:** [#1207 / run 44958894563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44958894563) — **7/7 jobs passed**
**Source-bound release artifact:** [#14728133889](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44958894563/artifacts/14728133889)
**Canonical readiness JSON SHA-256:** `e7ed0267e6cc1197c39c6a9cbbd0b6bb3656308935a714f4255077102989df76`
**Package:** `0.6.2`, private and unreleased

> **Release decision: NO-GO.** The exact-main CI workflow is green, but production certification is not. Do not tag, publish, deploy, or promote this package to production. Keep package version 0.6.2 unchanged until a separately approved release boundary.

## 1. Executive status

The latest exact-main CI run validates the current `main` revision, `6a6b88fb174a4c16571b2f97a8db3e417378caec`. Its source-bound readiness artifact reports:

| Readiness classification | Count |
|---|---:|
| PASS | **8** |
| PARTIAL | **2** |
| BLOCKED | **0** |
| MISSING_EVIDENCE | **14** |
| NOT_RUN | **0** |

The report sets `readyForProduction=false` and `releaseClassification=NOT_PRODUCTION_CERTIFIED`. Zero BLOCKED items does not imply release readiness: fourteen required production evidence packages are still missing. The two PARTIAL items also remain open: qualified human dependency/license review, and service-less integration diagnostics whose skips are not evidence of successful integrations.

The canonical artifact was generated at `2026-11-21T22:56:46.612Z` and is bound to the exact main SHA above. Do not substitute candidate-branch checks, older mainline artifacts, local test runs, or maintainer-authored evidence for the current exact-main artifact or independent evidence gates.

## 2. Exact-main CI and technical evidence

| Gate | Exact-main result | Scope and limitation |
|---|---|---|
| Node.js 22.23.4 | **PASS** | Hub unit/security suite 754/754; EnginEx 94/94 |
| Node.js 24.22.1 | **PASS** | Hub unit/security suite 754/754; EnginEx 94/94 |
| PostgreSQL 18 + Memgraph | **PASS** | 180/180 live integration tests; zero failures and skips |
| Fresh migrations | **PASS** | 18/18 applied to a disposable database |
| Migration idempotency | **PASS** | 18/18 safely skipped on the second application |
| Browser editor/accessibility smoke | **PASS** | Configured Chromium smoke only; not a full WCAG or manual accessibility acceptance |
| CodeQL | **PASS** | Exact-main analysis job completed |
| Dependency audit | **PASS** | `npm audit --audit-level=high` reported zero vulnerabilities; qualified human review remains outstanding |
| CycloneDX SBOM and runtime parity | **PASS** | CycloneDX 1.5, 200 components and 201 dependency records; Node 22/24 inventories aligned |
| Signed lockfile/SBOM attestation | **PASS** | Mainline attestation completed for the exact source and artifacts |
| Evidence consolidation | **PASS** | Exact-source manifests and checksums validated |

The live database evidence manifest SHA-256 is `8a07bd0e4ba53bae88f64dfd67d79c73ff269b573cb70e7acb416a973dd8dfe2`. The test database and migration run are disposable CI infrastructure, not production credentials, production data, or a production recovery exercise.

The separate service-less diagnostic remains PARTIAL: 47 tests per supported Node runtime, one pass and 46 skipped. Skipped cases are not counted as passed integration tests. The live PostgreSQL/Memgraph CI producer above is separate and passed 180/180.

## 3. Missing production evidence — 14 gates

| # | Gate | Required evidence |
|---:|---|---|
| 1 | Independent tenant isolation and authorization review | Independent route-to-capability/data-access review, adversarial two-site coverage, exact commit scope, findings and retest. [Issue #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) |
| 2 | Identity-provider end-to-end | OIDC/SAML, email delivery, MFA and recovery exercised end to end in the approved topology. |
| 3 | Malware scanning and legacy-asset quarantine | Live ClamAV configuration, malicious-file corpus, and legacy asset scan/quarantine reconciliation. |
| 4 | Live cloud providers | Authorized S3/GCS/Azure credentials, least-privilege IAM and lifecycle verification. |
| 5 | Stripe lifecycle | Live webhook replay, ambiguous-outcome recovery, inventory and payment/refund/subscription lifecycle qualification. |
| 6 | Browser/accessibility acceptance | Real editor journeys and documented WCAG-focused/manual accessibility acceptance. Smoke tests do not close this gate. |
| 7 | Commerce parity | Tax, shipping, coupons, refunds, fulfillment, downloads and subscription acceptance. |
| 8 | Community parity | Group privacy, abuse/spam, search, export/deletion and forum acceptance. |
| 9 | Plugin isolation | Signed plugin pipeline and adversarial container-isolation evidence. |
| 10 | Human dependency/SBOM/CodeQL review | Human disposition of dependencies, licenses, SBOM, provenance/attestations, audit and CodeQL findings. [Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) |
| 11 | Load, backup and recovery | Defined workload/SLOs, load/soak and fault injection, plus backup/restore and RPO/RTO verification. [Issue #24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) |
| 12 | Independent platform security assessment | Independent application/platform assessment, severity disposition and critical/high remediation or authorized risk acceptance. [Issue #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) |
| 13 | Operations and release approval | Named owners, supported topology, deployment/migration/rollback/secret/incident runbooks, rehearsals and exact-SHA release-owner decision. [Issue #26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) |
| 14 | Production observability | Approved production OTLP backend, ownership, security/governance and delivery evidence. |

A maintainer test, threat model, CI result, route inventory, or generated checklist is useful engineering evidence; it is not an independent assessment or a signed production-owner approval. The appropriate independent reviewer, provider owner, accessibility reviewer, or operations owner must produce and retain each required package against the exact candidate SHA.

## 4. Security, governance and open tracking

| Item | Snapshot status | Release implication |
|---|---|---|
| [#14 — independent tenant review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | P0, open | Hard production gate |
| [#25 — independent platform security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | P0, open | Hard production gate |
| [#26 — operations/release-owner approval](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | P0, open | Hard production gate |
| [#23 — dependency/SBOM/provenance review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | P1, open / partial | Human review still required |
| [#24 — load/backup/restore](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | P1, open | Load and recovery gate still missing |
| [#234 — Aikido SAST/secret-history triage](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234) | P1, open | Detailed findings require individual fingerprint-based review |
| [#235 — Aikido domain scan freshness](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235) | P2, open | Epoch-like 1970 last-occurrence value requires verification; it is not proof of a vulnerability or failed scan |
| [#277 — Aikido autofix PR batch](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277) | P1, open | Proposals remain individually untrusted; no bulk merge |
| [#233 — outbox consumer identity authority](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/233) | P2, open; implementation in [PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) | Maintainer hardening candidate, not yet mainline |

### Main-branch governance

[Issue #230](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/230) is closed. The active [main ruleset #27803491](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/rules/27803491) protects `refs/heads/main`: normal changes require PRs, seven named CI/security contexts, an up-to-date base and resolved review threads; force pushes and branch deletion are blocked; no bypass actors are configured. It follows the documented single-maintainer model with zero external approvals and requires maintainer self-review. This development governance model does not waive independent production reviews #14 and #25 or the other production evidence gates.

### Aikido autofix batch

The current GitHub inventory for PRs #237–#276 contains 40 proposals: **30 open, 6 merged and 4 closed without merge** at this snapshot. This supersedes the older aggregate counts in the original #277 issue description. The open PRs have mixed base revisions; only a subset are already based on current main. Each open proposal must be checked against its exact head, current base, source scanner fingerprint, rule/CWE, severity and affected code path. A green check alone does not prove the reported finding is real or correctly fixed. Never bulk merge generated changes. Aikido's 20 November aggregate report recorded 12 open SAST findings (0 critical, 3 high, 5 medium, 4 low) and one low secret-history item; these aggregate counts are scanner-reported and still require per-finding export, reproduction and disposition.

## 5. Current engineering candidate — F1.60 / issue #233

[PR #278](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/278) implements a bounded durable outbox consumer identity contract. The candidate was rebased locally, without conflicts, onto current main `6a6b88fb174a4c16571b2f97a8db3e417378caec`. The rebased local validation head before this report update was `eadf7f5311fce9d1278b5e3fcde7eabf643e8f53`; the final documentation commit will advance it. The original remote PR head was `4c53238730e8ffeeed74e09ff3283ac09c780664`, based on older main `a088fd440768a897e6a19b23264b49598ea3dce4`. A force-with-lease update is required to publish the rebased history; no unguarded force push is appropriate.

### Design and scope

- One immutable declarative event-family registry defines content, taxonomy and relationship classification/resource identity bindings; derived maps avoid duplicate event-family rules.
- The shared v1 contract binds registered payload `siteId` and the family resource key (`id` or `relationshipId`) to canonical envelope identity before handler effects. UUID comparison is case-insensitive.
- A shallow-frozen normalized payload copy is returned without mutating the stored row. Nested IDs and relationship `sourceId`/`targetId` remain opaque domain data. Internal/unregistered event payloads retain their prior semantics.
- Durable handlers preserve the existing `{ type, payload, envelope, delivery }` shape, but `type` and `payload` derive from the validated envelope, not the raw row.
- The graph projector reuses the shared binding helper and retains its direct-call defense-in-depth checks and graph-specific error codes.
- No SQL/schema/migration/HTTP API/event-schema/dependency/lockfile/package-version or SemVer change. Existing lease, delivery ordering, at-least-once, retry, dead-letter, replay and acknowledgement behavior remains unchanged.

### Candidate validation

| Check | Result |
|---|---|
| Rebase onto current main | **PASS** — conflict-free; based on `6a6b88f...` |
| Clean dependency install | **PASS** — `npm ci --no-audit --no-fund`; 178 packages installed |
| Tenant inventory regeneration | **PASS** — 28 families, 80 declared route patterns, 22 source files, 59 test files |
| Focused outbox/graph tests | **PASS** — 20/20, zero skips |
| Full local `npm run check` | **PASS** — artifact verification 238 required paths / 276 JavaScript files; 760 tests, 757 passed, 0 failed, 3 conditional skips on Node.js 26.12.1 |
| Fresh hosted PR validation after rebase | **PENDING** — required before merge |
| Production evidence | **UNCHANGED** — current mainline remains 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE and NO-GO |

The previous PR run #1119 on the old, pre-rebase head failed both Node matrix jobs because the generated tenant-isolation inventory was stale; 694/695 tests passed in each matrix and the inventory freshness test was the sole failure. Its evidence-consolidation failure was downstream of the failed producer jobs and missing producer artifacts. The old run's PostgreSQL/Memgraph integration, browser smoke and CodeQL jobs passed; the post-merge-only signed attestation was skipped as designed. The inventory was regenerated after rebasing and the current local full suite now passes, including the inventory freshness test. Those local results do not replace fresh hosted checks on the rebased PR head.

## 6. Recommended next steps and release sequence

1. Publish the rebased F1.60 branch to the existing PR #278 using a verified `--force-with-lease` against the remote head; preserve the original local repository's unrelated working changes.
2. Require fresh PR CI on the new head: Node 22/24, live PostgreSQL/Memgraph, browser/accessibility smoke, CodeQL and candidate evidence consolidation. Resolve all review threads and complete the required maintainer self-review under the active ruleset. Do not merge while any required context is pending or failing.
3. After PR #278 merges, validate the exact resulting main SHA with the post-merge workflow and mainline signed SBOM/lockfile attestation. Update readiness evidence only from that exact-main run. The production count remains NO-GO unless independent evidence gates are separately satisfied.
4. Continue P1 issue #277 through individual scanner-fingerprint reconciliation and exact-head review. Keep #234 and #235 separate: triage detailed SAST/secret records safely and independently verify authorized domain scan history.
5. Close production evidence gates in accountable order: independent tenant review #14, independent platform security review #25, human dependency review #23, load/recovery #24, operations approval #26, then remaining provider, accessibility, parity, plugin and observability evidence.

**Release discipline:** keep `0.6.2` private and unreleased; do not create a release tag, GitHub Release, npm publication, or production deployment. No SemVer increment is justified by this maintainer hardening candidate.
