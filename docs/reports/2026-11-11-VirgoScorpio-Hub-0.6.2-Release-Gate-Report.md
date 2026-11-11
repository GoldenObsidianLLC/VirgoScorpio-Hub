# VirgoScorpio Hub 0.6.2 — Release Gate Report

> **Assessment date:** 11 November 2026 (America/Chicago)
> **Decision:** **NO-GO FOR PRODUCTION — NOT_PRODUCTION_CERTIFIED**
> **Permitted classification:** Private, unreleased, isolated self-hosted developer preview only.
> **Current main:** 253ef3a987d7151828cdc971f95f0faaf64a7f36
> **Exact-main CI:** [Workflow #541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43076849834) — all seven jobs successful.

This is a maintainer engineering and release-evidence report. It is not independent security certification, legal advice, provider qualification, release-owner approval, or authorization to deploy or publish.

## 1. Executive decision

VirgoScorpio Hub 0.6.2 remains **private and unreleased**. The exact current main revision has strong automated validation: both supported Node.js matrices, live PostgreSQL/Memgraph/Redis integration, browser and collaboration checks, CodeQL execution, exact-main SLSA provenance and signed CycloneDX SBOM verification, and consolidated evidence all passed in workflow #541.

That evidence materially improves confidence in the tested source and CI paths. It does **not** satisfy the remaining human, independent, provider, operational, governance, or formal release-evidence gates. In particular:

- Qualified maintainer review of dependencies, license/distribution obligations, provenance and CodeQL findings remains outstanding under [issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23).
- The independent tenant-isolation review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and broader independent security assessment [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) have not been performed.
- Load/soak, broader fault injection, full backup/restore and measured RPO/RTO remain open under [issue #24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24).
- Named operations/release ownership and rehearsed production controls remain open under [issue #26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26).
- The authorized 0.6.2 scope/provider decision [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) and company governance/legal authority decision [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) remain unapproved.

**No production deployment, release tag, GitHub Release, npm publication, SemVer increment, provider qualification, or public production-support claim is authorized.**

## 2. Source, branch and release boundaries

| Item | Current value | Disposition |
|---|---|---|
| Repository | GoldenObsidianLLC/VirgoScorpio-Hub | Current project |
| Package | virgoscorpio-hub@0.6.2 | private: true; unreleased |
| Declared Node.js floor | >=22.23.4 | CI matrix: 22.23.4 and 24.22.1 |
| npm used by supported CI matrix | 11.19.1 | Lockfile-driven install |
| Current main SHA | 253ef3a987d7151828cdc971f95f0faaf64a7f36 | PR #122 documentation-only merge |
| Previous product/runtime baseline | 6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d | PR #121 merge; PR #122 did not change application runtime |
| EnginEx submodule | d99e021f55664f006b5e65b4a58202f9c7bc4f4b | Pinned; not changed in this work |
| Latest exact-main workflow | [#541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43076849834) | 7/7 jobs successful |
| Current CI maintenance PR | [#123](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/123) | Open; CI green; awaiting human review |

PR #122 merged at 253ef3a as a documentation-only reconciliation. It did not change application code, dependency manifests or lockfile, API contracts, schemas, migrations, provider contracts, architecture or package version. No submitted human review was recorded for PR #122; its merge is not an independent review or product-owner approval.

PR #123 updates the two pinned actions/download-artifact references in CI to the Node.js 24-compatible v7.0.0 action. The pre-report validation head 8669c291e331e40cbe3017d6eb5b15c368b20e5f passed its branch-push and pull-request workflows (details in section 6). This full report is added as documentation-only commit 274d5090df9bf914a0f6acd70e07cbaa8f135e86 on the same PR branch; the workflows for that report-inclusive head were queued at the time of this report update and are not counted as passing evidence here. PR #123 remains open and unmerged, with no submitted review recorded. The change affects CI action runtime only, not the product's Node.js support floor, package dependencies, application behavior, APIs, schemas or migrations.

## 3. Exact-main workflow #541

[Workflow #541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43076849834) was a push to main for the exact SHA 253ef3a987d7151828cdc971f95f0faaf64a7f36. It completed successfully with all seven jobs:

| Job | Result | Verified outcome |
|---|---|---|
| Unit, security and dependency checks — Node 22.23.4 | **PASS** | 590/590 Hub tests; 94/94 EnginEx tests; full and production-only npm audit scopes reported 0 vulnerabilities |
| Unit, security and dependency checks — Node 24.22.1 | **PASS** | 590/590 Hub tests; 94/94 EnginEx tests; full and production-only npm audit scopes reported 0 vulnerabilities |
| PostgreSQL and Memgraph integration | **PASS** | 82/82 live integration tests; fresh migrations and idempotent second pass; PostgreSQL collaboration browser checks; Redis/Memgraph recovery paths |
| Browser editor and accessibility smoke | **PASS** | 9/9 automated smoke tests |
| CodeQL security analysis | **PASS** | Exact-main analysis job completed successfully; this is not a human security assessment |
| Attest dependency lockfile and SBOM | **PASS** | SLSA provenance and signed CycloneDX SBOM generated and verified for exact main |
| Consolidate candidate CI evidence | **PASS** | CI EVIDENCE: PASS; revision and checksum checks passed |

The dedicated live integration job also recorded:

- 18/18 migrations applied to a fresh disposable PostgreSQL database and 18/18 skipped on the idempotent second pass.
- PostgreSQL-backed collaboration Playwright: 3/3.
- Real Memgraph outage/outbox replay: PASS.
- Canonical graph rebuild and repeat determinism: PASS.
- Disposable CI services and migration database were used; this is not a production topology restore or capacity test.

The automated browser result does not replace full manual accessibility, keyboard and screen-reader acceptance. The live integration result does not establish production SLOs, provider availability, high availability, disaster recovery or measured RPO/RTO.

## 4. Mainline provenance and signed SBOM

The exact-main signer verified SLSA provenance and the signed CycloneDX SBOM against refs/heads/main, the full source SHA, the expected repository/workflow certificate identity, and the lockfile and SBOM subject digests. It also verified the CycloneDX predicate type and equality between the signed predicate and generated SBOM.

| Signed evidence | Exact value |
|---|---|
| package-lock.json SHA-256 | 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086 |
| Signed CycloneDX SBOM SHA-256 | ffc009df28f0a01cdeffde597760f7244dff3c42a0a92fc6b7109b2bc0d6ad4a |
| SBOM format | CycloneDX 1.5 |
| Components / dependency records | 200 / 201 |
| Signed attestation artifact | 13882262940 — virgoscorpio_hub-supply-chain-attestations |
| Artifact archive digest | sha256:ecfe525d863e754dfd0f4d3dab6b9955ddbf17d1bd1a444691355614fe6c772c |
| Artifact expiry | 9 February 2027 |
| SLSA provenance transparency entry | [66389823](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/66389823) |
| Signed SBOM transparency entry | [66389838](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/66389838) |

These values are tied to workflow #541 and its exact source SHA. Do not copy or relabel the bundle as evidence for a different source revision or release candidate.

## 5. Dependency and license inventory

The retained CycloneDX SBOM contains 200 components and 201 dependency records. Every component has an identified license expression in the generated SBOM. That establishes inventory completeness only; it does **not** establish legal compliance, permissive licensing, redistribution rights or that every optional package is installed in every target.

| License expression | Components |
|---|---:|
| MIT | 106 |
| Apache-2.0 | 69 |
| LGPL-3.0-or-later | 10 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| ISC | 6 |
| BSD-3-Clause | 2 |
| BlueOak-1.0.0 | 1 |
| 0BSD | 1 |
| GPL-2.0-or-later | 1 |
| **Total** | **200** |

The automated inventory identifies 15 GPL/LGPL-bearing components:

- **10 LGPL-3.0-or-later libvips platform packages** at version 1.3.4.
- **4 Sharp platform packages** at version 0.35.5 with combined Apache/LGPL/MIT expressions.
- **1 vendored EnginEx component**, represented as enginex@7.0.0 with GPL-2.0-or-later; the corresponding package-lock alias is enginex-ai-native@7.0.0.

The Sharp/libvips entries are platform-specific optional/native variants. Their presence in the lockfile/SBOM does not prove every variant is installed, bundled or redistributed for each deployment. The local EnginEx link/target relationship also requires human inspection.

A qualified reviewer must map supported install targets and actual distribution artifacts; evaluate linking, bundling and modifications; review applicable license texts; and determine notice, source-availability and redistribution obligations. This report makes no legal conclusion. Issue #23 remains open until qualified review, reviewer identity/date, findings, risk dispositions and formal acceptance are recorded.

## 6. CI action-runtime follow-up — PR #123

Workflow #541 exposed a Node.js 20 action-runtime warning from the pinned artifact downloader. PR [#123](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/123) updates both actions/download-artifact references to v7.0.0, pinned to verified commit 37930b1c2abaa49bbe596cd826c3c89aef350131, whose action manifest declares runs.using: node24.

The pre-report PR head 8669c291e331e40cbe3017d6eb5b15c368b20e5f passed both:
- [Branch-push workflow](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43086558620).
- [Pull-request workflow](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43086573303).

The full release-gate report was then added in documentation-only commit 274d5090df9bf914a0f6acd70e07cbaa8f135e86. The branch-push and pull-request workflows for that exact report-inclusive commit were queued at the time of this report update: [run 43095064923](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43095064923) and [run 43095074803](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43095074803). Their results must be checked before describing the current PR head as fully validated.

All six non-attestation jobs passed on each run. Both Node matrices passed 590/590 Hub and 94/94 EnginEx tests, npm audit scopes reported zero vulnerabilities, live integration passed 82/82, browser/accessibility smoke passed 9/9, CodeQL completed, and evidence aggregation reported CI EVIDENCE: PASS. Each aggregate job downloaded five revision-bound evidence artifacts and verified their checksums. The main-only attestation job was skipped as designed on branch/PR events.

The Node.js 20 action-runtime warning did not recur. A separate [DEP0005] Buffer() deprecation warning remains in the artifact download path. Upstream [actions/toolkit issue #2003](https://github.com/actions/toolkit/issues/2003) traces the warning to the unzip-stream reader used by @actions/artifact; a 5 November 2026 upstream comment reproduces it with @actions/artifact@6.3.1 / unzip-stream@0.3.4 and identifies unzip-stream/lib/unzip-stream.js:47. Artifact download and checksum verification succeeded. No local patch, warning suppression, or replacement ZIP implementation was introduced. Track the upstream dependency; do not treat this non-failing warning as an application-runtime vulnerability or as proof that the upstream reader is risk-free.

PR #123 remains **OPEN / UNMERGED** pending human review. Passing CI does not constitute approval.

## 7. Formal release-readiness record and baseline mismatch

The committed RELEASE-MANIFEST.json still records its latestMainEvidence, latestCandidateEvidence and scopeReconciliation.baselineCommit against 36220abf4ebcc629fa616961879f5a2ffe1f847d and historical workflow #472. That SHA is **not** current main 253ef3a987d7151828cdc971f95f0faaf64a7f36, and workflow #472 is not the current exact-main run.

The last formally stored readiness classification associated with that older manifest baseline is:

| Classification | Last recorded count |
|---|---:|
| PASS | 7 |
| PARTIAL | 2 |
| BLOCKED | 1 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |
| Production decision | **NO_GO** |
| readyForProduction | false |

This count is retained as the **last recorded formal snapshot**, not represented as a newly evaluated result for main SHA 253ef3a or workflow #541. CI success does not automatically refresh the formal manifest or satisfy its independent evidence-owner contracts. The candidate baseline mismatch must be resolved through the authorized release process; historical evidence must not be transplanted or relabeled.

Do not mark the formal gate accepted, populate missing evidence files, or represent npm run release:assert-ready as passing unless a fresh, clean, exact-candidate evaluation and the required evidence-owner approvals demonstrate that result.

## 8. Production gate matrix

The table separates automated evidence from independent or human acceptance. A targeted CI pass is not a substitute for the full formal gate.

| Gate area | Current evidence | Status / required action |
|---|---|---|
| Supported Node.js, lockfile and clean install | Both supported Node matrices passed; 0 npm audit vulnerabilities; signed exact-main lockfile digest verified | **Automation PASS / human dependency review open** — #23 |
| PostgreSQL migrations and upgrade evidence | Fresh 18/18 migration pass and idempotent 18/18 second pass | **Targeted PASS** — production upgrade/restore scope remains under #24/#26 |
| Live PostgreSQL, Redis and graph recovery | 82/82 integration tests; Redis restoration; Memgraph outage/outbox replay; deterministic graph rebuild | **Targeted PASS / broader resilience open** — #24 |
| Tenant/site isolation and authorization | Maintainer inventories and targeted two-site regressions exist | **Independent review NOT PERFORMED** — #14 |
| OIDC/SAML, email, MFA and account recovery | Adapter/foundation code only; no qualified live provider matrix or end-to-end provider acceptance | **MISSING** — scope/provider decision #13; production gates remain applicable |
| Malware scanner and legacy asset handling | Fail-closed production scanning behavior exists; live ClamAV/corpus and legacy rescan/quarantine acceptance not evidenced | **MISSING** |
| Object reconciliation and storage crash recovery | Local tooling and selected CI tests exist; complete restore/crash-recovery acceptance is absent | **PARTIAL / MISSING formal evidence** — #24/#26 |
| S3/GCS/Azure and object-storage provider qualification | Adapters/probes exist; no accepted live credential, permission, encryption, lifecycle and restore matrix | **MISSING** |
| Stripe/payment lifecycle | Code paths and test foundations exist; no accepted live test-mode webhook, refund, inventory and subscription lifecycle matrix | **MISSING** |
| Commerce/community/editor parity | Partial product workflows and automated browser smoke exist; full scoped parity acceptance is not complete | **MISSING** |
| Plugin artifact signing and adversarial runtime isolation | Provenance helpers exist; complete activation, sandbox, denied-egress and resource-boundary acceptance is absent | **MISSING** |
| Browser, accessibility, fuzz, load and restore acceptance | Automated browser smoke 9/9 and collaboration Playwright 3/3 passed | **PARTIAL** — manual accessibility, fuzz, load/soak and backup/restore remain open under #24 |
| Dependency/SBOM, independent security and operations | Mainline signatures and CI pass; human dependency/license review and independent security/operational acceptance remain open | **PARTIAL** — #23/#25/#26/#32 |
| Formal readiness and release approval | Manifest baseline is stale/mismatched; named release owner and authorized scope decision are absent | **BLOCKED / NOT ACCEPTED** — #13/#26/#32 |

Issues #15–#22 were previously marked not_planned for the restricted 0.6.2 developer preview; that disposition does not mean the corresponding production capabilities were completed or certified.

## 9. GitHub issue disposition

| Issue | Priority | Current status | Required disposition |
|---|---:|---|---|
| [#13 — Approve 0.6.2 scope and provider matrix](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | P0 | **OPEN** | Authorized product/release owner must approve or amend the frozen scope, exact candidate SHA, supported topology, providers, exclusions and named accountable owners. |
| [#14 — Independent tenant/site isolation review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | P0 | **OPEN / NOT PERFORMED** | Independent qualified reviewer must perform broad route discovery and two-tenant adversarial testing, record findings and independently retest remediations. |
| [#23 — Dependency, SBOM, provenance and CodeQL review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | P1 | **OPEN / PARTIAL** | Qualified human dependency-maintenance and GPL/LGPL distribution review, exact-main attestation review, exact-SHA CodeQL disposition and formal acceptance remain required. |
| [#24 — Load/soak, fault injection and backup/restore](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | P1 | **OPEN** | Approve topology, data volumes, workload assumptions, SLO/resource budgets; run load/soak/exhaustion/fault scenarios; restore PostgreSQL, graph and object data; verify integrity, tenant boundaries and measured RPO/RTO. |
| [#25 — Independent platform security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | P0 | **OPEN** | Obtain a separate qualified assessment with scope, threat model, methodology, exclusions, severity-ranked findings, remediation and retest/risk decisions. |
| [#26 — Operations runbooks and release-owner approval](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | P0 | **OPEN** | Name release/on-call/database/cache/storage/security owners; select the supported environment; rehearse deployment, migration, rollback, recovery, secret rotation, monitoring and incident response. |
| [#32 — Zero-reserve operating, compensation and capital controls](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | P0 | **OPEN** | Authorized governing persons must confirm jurisdiction/entity and approval thresholds; adopt, amend or reject the proposed zero-reserve resolution; confirm no expense or compensation authority without funded approval; and approve only the permitted no-cost discovery/quote activity. Funding mechanisms and reserve targets require proper owner approval and qualified legal/tax review. This report authorizes no spend, hiring or assessor/vendor engagement. |

These issues are separate controls. Engineering work, maintainer tests or CI success must not be used to close an independent-review, governance or release-owner gate.

## 10. Architecture, security and operational invariants

The current release-gate work does not change the product architecture. Preserve these boundaries:

- **PostgreSQL remains authoritative** for transactional application state.
- **Memgraph remains a rebuildable projection**, fed through the PostgreSQL transactional outbox; it is not the source of truth.
- **Redis Pub/Sub and presence remain ephemeral**; transient hints are not durable event history.
- Tenant/site context and capability checks must execute before database writes, provider calls, queue publication or other side effects.
- Provider configuration containing unresolved vault:// references is not live provider qualification.
- Production media scanning remains fail-closed when the required scanner is unavailable or unconfigured; legacy not_scanned assets are not presumed clean.
- CI disposable-service tests are not proof of production topology, capacity, HA, retention, backup integrity, key rotation or incident response.
- Optional/native package presence in a lockfile is not proof that each package is bundled or redistributed on every target.
- Do not suppress the upstream DEP0005 warning or add a local ZIP extraction workaround without a separately reviewed dependency/security design.

## 11. SemVer and publication boundary

The package remains 0.6.2 and private. PR #122 is documentation-only; PR #123 changes pinned GitHub Actions CI tooling and supporting evidence documentation, not the application runtime or public contract. Neither change justifies a package SemVer increment.

No version bump, release tag, GitHub Release, npm publication, production deployment, provider qualification or expanded support commitment is authorized. A future version decision must follow the approved release scope, user-visible change set, migration/API compatibility review and accepted release gates.

## 12. Prioritized next steps

1. **Complete human review of PR #123.** The action change and pre-report branch head passed their CI workflows; the current report-inclusive head 274d509 is subject to its own branch-push and PR workflows (queued at report update). The PR remains open with no submitted review. Preserve the pinned action SHA and evidence checks; do not merge without the required review/approval.
2. **Resolve scope and governance first.** Obtain the authorized decisions and owner assignments required by #13 and #32. These decisions determine which providers, environments and services can legitimately be tested and who is accountable.
3. **Complete issue #23 human acceptance.** Review exact-main #541 bundles/digests, dependency maintenance and advisories, GPL/LGPL obligations, local EnginEx distribution relationship and exact-SHA CodeQL results. Record a qualified reviewer, date, findings and formal risk disposition.
4. **Commission independent assurance.** Arrange properly authorized, independent reviews for #14 and #25 with a defined scope and rules of engagement. Do not substitute maintainer-authored inventories or tests for assessor work.
5. **Establish the operational target before resilience testing.** Under #26, name owners and approve the deployment topology, recovery model, secret controls and runbooks. Then define workload, latency/error SLOs and resource budgets before executing #24 load/soak, fault-injection and full backup/restore drills.
6. **Recompute formal readiness on the approved exact candidate.** Refresh the stale manifest/evidence baseline through the authorized process, retain all exact-SHA artifacts and reviewer decisions, and require the fail-closed release assertion to pass before reconsidering production status.

No unrelated product feature expansion is recommended ahead of these P0/P1 release and assurance gates. The next software-owned change already in flight is the focused CI action-runtime maintenance in PR #123; subsequent resilience engineering should be scoped to the approved #24 topology and acceptance criteria rather than inventing production assumptions.

## 13. Evidence index and limitations

- Current mainline CI and exact-main provenance: [workflow #541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43076849834).
- CI action-runtime follow-up: [PR #123](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/123); pre-report validated revision runs [43086558620](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43086558620) and [43086573303](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43086573303); report-inclusive revision checks at report-update time [43095064923](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43095064923) and [43095074803](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43095074803) were queued.
- Mainline license, attestation and CI detail: [post-PR #122 mainline and license inventory](2026-11-11-POST-PR122-MAINLINE-AND-LICENSE-INVENTORY.md).
- Supply-chain remediation history: [supply-chain attestation remediation](2026-11-11-SUPPLY-CHAIN-ATTESTATION-REMEDIATION.md).
- Scope and gate definitions: [release scope](../RELEASE-SCOPE.md), [release readiness](../RELEASE_READINESS.md), [release evidence](../RELEASE-EVIDENCE.md), [implementation roadmap](../IMPLEMENTATION-ROADMAP.md), and [roadmap](../ROADMAP.md).
- Upstream artifact-reader warning: [actions/toolkit issue #2003](https://github.com/actions/toolkit/issues/2003).

This report relies on revision-bound hosted CI results, repository documentation and GitHub issue/PR state observed on 11 November 2026. It does not claim access to a production deployment, production provider credentials, customer data, independent assessor results, a full backup/restore environment or an authorized release-owner decision.

**Final disposition: NO-GO FOR PRODUCTION.** Keep 0.6.2 private and unreleased until every applicable technical, independent, provider, legal, operational and release-approval gate is satisfied and accepted.
