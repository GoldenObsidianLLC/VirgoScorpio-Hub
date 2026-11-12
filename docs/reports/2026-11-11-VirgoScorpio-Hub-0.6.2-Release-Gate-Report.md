# VirgoScorpio Hub 0.6.2 — Release Gate Report

> **Assessment date:** 12 November 2026 (America/Chicago)
> **Decision:** **NO-GO FOR PRODUCTION — NOT_PRODUCTION_CERTIFIED**
> **Permitted classification:** Private, unreleased, isolated self-hosted developer preview only.
> **Current main:** 3c5df47f7a397f76a5368ef7bc036579e5406835 (F1.22 PR #127 merge)
> **Exact-main CI:** [Workflow #563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43141711056) — all seven jobs successful on current main.

This is a maintainer engineering and release-evidence report. It is not independent security certification, legal advice, provider qualification, release-owner approval, or authorization to deploy or publish.

## Current status update — after PR #127 merge and F1.23 hosted validation (12 November 2026)

PR #127 merged F1.22 at current main `3c5df47f7a397f76a5368ef7bc036579e5406835`. Exact-main workflow [#563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43141711056) passed all seven jobs, including 85/85 live integration tests, Node 22/24, CodeQL, browser/accessibility, collaboration Playwright and main-only attestation/evidence aggregation. Its GitHub review history contains no formal review submission; the maintainer-controlled merge and CI are not independent security approval. F1.23 continues in draft PR #128; exact-head workflows #566/#567 both passed the required candidate jobs, including 90/90 live PostgreSQL/Memgraph integration in each. The merge history is not involved: PR #128 remains unmerged and no formal review submission is recorded.

PR #125 serializes concurrent site membership removals on the owning site row before active-owner checks. Its live PostgreSQL regression proved one concurrent removal succeeds, the other receives `ERR_VIRGOSCORPIO_HUB_LAST_OWNER`, one active owner remains and exactly one corresponding audit event is written. No formal review submission was recorded for PR #125; it is a maintainer-controlled change validated by automated hosted CI, not independent review or peer approval.

Qualified independent assessors are not currently available. At the owner's direction, internal development continues under the [maintainer-led security assurance policy](../security/MAINTAINER-LED-SECURITY-ASSURANCE.md). Independent reviews #14 and #25 remain OPEN / NOT PERFORMED as production gates, but are not prerequisites for ordinary private, isolated developer-preview engineering. This is not a waiver, independent assessment, production risk acceptance or production certification. No independent evidence artifacts are populated.

F1.23 candidate work is in draft PR [#128](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/128) on branch `security/tenant-owner-transfer-invitation-acceptance-2026-11-11`. The code passes request ID into the existing invitation-acceptance service, records the site-scoped `site.invitation_accepted` audit event in the same PostgreSQL transaction as membership insertion and invitation consumption, rolls back on audit-storage failure, and emits authorization invalidation only after commit. Acceptance responses preserve persisted email-verification/MFA metadata for new and existing accounts. Exact-head workflows [#566](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43149638091) and [#567](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43149642960) both passed all required non-attestation jobs. Each live PostgreSQL/Memgraph suite passed **90/90, zero failures/skips**, executing new/existing-account acceptance, disabled/expired/replayed/concurrent redemption, request-correlated audit, and owner-role escalation denial. Node 22/24 each passed **594/594**, CodeQL passed, browser/accessibility 9/9 and collaboration Playwright 3/3 passed; the main-only attestation job was skipped by design. Local `npm run check` passes 594 tests (591 passed, 0 failed, 3 Windows-specific skips); the database-backed integration remains skipped locally because there is no disposable PostgreSQL service. This is maintainer/automation validation, not independent approval; no formal review submission has been recorded for PR #128. The current API has no ownership-transfer operation; a future transfer feature requires authorized product/API contract #13 and separate security review.

Current-main workflow #563 supply-chain evidence: lockfile SHA-256 `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`; signed CycloneDX 1.5 SBOM SHA-256 `47193754a73795346ba1ac2dd473c865c22aeaf7019a83ae0ef8b1379d550273` (200 components / 201 dependency records; 15 GPL/LGPL-bearing components). Attestation artifact `13909802032`, archive digest `sha256:4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d`. Qualified human dependency/license/distribution acceptance remains outstanding under #23. Workflow #558 and #555 remain historical, source-bound prior mainline evidence. Production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

## 1. Executive decision

VirgoScorpio Hub 0.6.2 remains **private and unreleased**. Current main `3c5df47f7a397f76a5368ef7bc036579e5406835` passed all seven jobs in exact-main workflow #563, including live integration, CodeQL, signed provenance/SBOM verification and consolidated evidence. PR #127 merged F1.22 maintainer regression coverage with no formal review submission recorded; the merge does not establish independent acceptance. Workflow #558 is the immediately preceding docs-only main snapshot; #555 and earlier runs remain historical source-bound evidence.

That evidence materially improves confidence in the tested source and CI paths. It does **not** satisfy the remaining human, independent, provider, operational, governance, or formal release-evidence gates. Independent reviews are currently unavailable, so maintainers will continue limited internal engineering under the documented assurance policy; this changes development sequencing, not the production release gates. In particular:

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
| Current main SHA | 3c5df47f7a397f76a5368ef7bc036579e5406835 | F1.22 PR #127 merge; exact-main workflow #563 |
| Runtime code baseline | e61baf5c1c25c8a936de6b79ba818b287d2e1cd7 | PR #125 concurrent site-owner removal serialization; exact-main workflow #555 |
| Immediate previous main baseline | 9627097269b91c39fcd345430894cdcba972b89e | PR #126 documentation-only main snapshot, before F1.22 PR #127 |
| EnginEx submodule | d99e021f55664f006b5e65b4a58202f9c7bc4f4b | Pinned; not changed in this work |
| Latest exact-main workflow | [#563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43141711056) | Current main; 7/7 jobs successful |
| Runtime code exact-main workflow | [#555](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43122759167) | Product-code baseline; 7/7 jobs successful |
| CI maintenance PR | [#123](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/123) | Merged to main; no formal review submissions recorded |
| Tenant authorization maintenance PR | [#125](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/125) | Merged at runtime code baseline; hosted PostgreSQL regression passed; no formal review submission recorded |
| Tenant authorization coverage PR | [#127](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/127) | F1.22 role/SSE regression merge; exact-main workflow #563 passed 85/85 live integration; no formal review submission recorded |\n| Prior documentation reconciliation | [#126](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/126) | Docs-only merge at `9627097269b91c39fcd345430894cdcba972b89e`; exact-main workflow #558 passed |

PR #122 merged at 253ef3a as a documentation-only reconciliation. It did not change application code, dependency manifests or lockfile, API contracts, schemas, migrations, provider contracts, architecture or package version. No submitted human review was recorded for PR #122; its merge is not an independent review or product-owner approval.

PR #123 changed the two pinned `actions/download-artifact` references in CI to verified Node.js 24-compatible v7.0.0. Its final PR head passed all six non-attestation jobs and consolidated evidence; it then merged to main at `762e3fbc25f6b98c52815b5653c54fd05826ddb3`. Exact-main workflow [#552](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43113738148) passed all seven jobs, including main-only signed provenance/SBOM verification. No formal review submission was recorded for PR #123. Passing CI and merge status do not constitute an independent security assessment or production acceptance. The change affects CI action runtime only, not the product's Node.js support floor, package dependencies, application behavior, APIs, schemas or migrations.

## 3. Historical exact-main workflow #541 (superseded by runtime baseline #555 and current-main #558)

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

## 4. Runtime code baseline provenance and signed SBOM — workflow #555 (PR #125)

The exact-main signer verified SLSA provenance and the signed CycloneDX SBOM against `refs/heads/main`, the full source SHA `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7`, the expected repository/workflow certificate identity, and the exact lockfile and SBOM subject digests. The signed CycloneDX predicate type was `https://cyclonedx.org/bom`, and its contents matched the generated SBOM document.

| Signed evidence | Exact value |
|---|---|
| package-lock.json SHA-256 | `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086` |
| Signed CycloneDX SBOM SHA-256 | `cc5e441523e4178e3e86b828bf80e8f10c742051df875accf6acf9d913cf1759` |
| SBOM format | CycloneDX 1.5 |
| Components / dependency records | 200 / 201 |
| Signed attestation artifact | `13901133411` — `virgoscorpio_hub-supply-chain-attestations` |
| Artifact archive digest | `sha256:d43de52ac5761f0d75e50b1db753417d9d82b168a8aa6d80444fe116988ef7d6` |
| Artifact expiry | 9 February 2027 |
| Exact source revision | `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7` |

This bundle is bound to workflow #555 and runtime code SHA `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7`, the main source revision at the time of the PR #125 merge. It is not the attestation bundle for current main after PR #127; use workflow #563 current-main digests in section 2. The signed provenance/SBOM provide source and artifact integrity evidence; they do not replace qualified human dependency maintenance, GPL/LGPL license/distribution review or formal acceptance under issue #23. Workflow #558 is the exact attestation for the immediately preceding docs-only main SHA `9627097269b91c39fcd345430894cdcba972b89e`; earlier #541/#552 evidence remains historical.

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

PR #123 merged at `762e3fbc25f6b98c52815b5653c54fd05826ddb3`; exact-main workflow #552 passed 7/7 jobs on that pre-PR #125 main revision. Main then advanced to the PR #125 runtime merge `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7` (#555), docs-only PR #126 `9627097269b91c39fcd345430894cdcba972b89e` (#558), and F1.22 PR #127 `3c5df47f7a397f76a5368ef7bc036579e5406835` (#563). No formal review submission was recorded for PR #123. Passing CI does not constitute independent security assessment or production acceptance.

## 7. Formal release-readiness record and baseline mismatch

The committed RELEASE-MANIFEST.json still records its latestMainEvidence, latestCandidateEvidence and scopeReconciliation.baselineCommit against 36220abf4ebcc629fa616961879f5a2ffe1f847d and historical workflow #472. That SHA is **not** current main `3c5df47f7a397f76a5368ef7bc036579e5406835` or runtime code baseline `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7`; workflow #472 is not current-main run #563.

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

This count is retained as the **last recorded formal snapshot**, not represented as a newly evaluated result for current main SHA `3c5df47f7a397f76a5368ef7bc036579e5406835` or workflow #563, or for runtime source SHA `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7`. CI success does not automatically refresh the formal manifest or satisfy its independent evidence-owner contracts. The candidate baseline mismatch must be resolved through the authorized release process; historical evidence must not be transplanted or relabeled.

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

1. **Obtain human review of F1.23 under issue #124.** Draft PR [#128](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/128) has passed exact-head push workflow [#566](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43149638091) and pull-request workflow [#567](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43149642960). Each live PostgreSQL/Memgraph integration suite passed **90/90, zero failures/skips**, executing invitation creation/acceptance, existing-account site preservation, disabled/expired/replayed/concurrent redemption, request-correlated audit and ordinary owner-role escalation denial. Node 22/24 each passed **594/594**, CodeQL passed, browser/accessibility passed 9/9 and collaboration Playwright passed 3/3; main-only attestation was skipped by design on the branch. Local `npm run check` passed 594 tests (591 passed, 0 failed, 3 Windows-specific skips); the live database suite remains skipped locally without a disposable PostgreSQL service. GitHub records no formal review submission or requested reviewer for PR #128; keep it unmerged pending human review. Continue issue #124 coverage for WebSocket/collaboration revocation, Redis cross-instance invalidation and wider transaction/fault-recovery paths. The current product has no owner-transfer API; do not add a privileged transfer route without authorized scope/API semantics under #13, last-owner atomicity/session-revocation design and separate security assessment.
2. **Complete qualified human supply-chain acceptance when available.** Under #23, review dependency maintenance/advisories, GPL/LGPL obligations and distribution relationships, exact-main provenance/SBOM digests, and exact-SHA CodeQL disposition. Maintainer-generated inventory is preparation, not legal clearance.
3. **Continue safe resilience/operations preparation.** Under #24/#26, use disposable services and synthetic data to expand fault/recovery exercises. Production-target load/soak, backup/restore and RPO/RTO acceptance still require approved topology, workload criteria and named owners.
4. **Keep independent and governance gates accurately open.** Reviews #14 and #25 have not been performed because qualified assessors are unavailable. This does not block ordinary private, non-production engineering under the maintainer-led policy, but both remain production certification gates. Obtain authorized scope/governance decisions under #13/#32 before any production-facing action.
5. **Recompute formal readiness only on an authorized exact candidate.** The committed manifest remains tied to a historical SHA. Preserve exact-SHA artifacts and reviewer decisions; do not transplant historical evidence, populate unperformed independent-review contracts, or weaken the fail-closed release assertion.

Maintainer-led work is a development-continuity process, not a substitute for independent assessment, a production risk waiver, or a release approval. Package 0.6.2 remains private/unreleased; production remains NO-GO / NOT_PRODUCTION_CERTIFIED.

## 13. Evidence index and limitations

- Current-main CI and attestation: [workflow #563](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43141711056), current main SHA `3c5df47f7a397f76a5368ef7bc036579e5406835` (7/7 jobs passed; current lockfile/SBOM digests and artifact are listed in section 2). Prior-main workflow #558 validates docs-only SHA `9627097269b91c39fcd345430894cdcba972b89e`; runtime code baseline workflow #555 validates `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7`. Earlier #552/#541 runs remain historical snapshots.
- Maintainer-led tenant hardening: [PR #125](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/125) merged at `e61baf5c1c25c8a936de6b79ba818b287d2e1cd7`. Hosted PR workflows #553/#554 both passed; the live PostgreSQL integration suite passed 83/83 with zero skips, including the concurrent owner-removal regression. Exact-main workflow #555 passed all seven jobs. No formal review submission was recorded; this is maintainer/automated evidence, not independent assessment. See [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124).
- F1.22 merged in PR #127 at main `3c5df47f7a397f76a5368ef7bc036579e5406835`; test-bearing commit `a7e5318de9c499b14ff2e63c1539861b3e2bdd2a` passed exact-head hosted workflows #559/#560 and current-main workflow #563 (85/85 live PostgreSQL/Memgraph integration, zero failures/skips). GitHub records no formal review submission; this is maintainer/automation evidence, not independent assessment.
- F1.23 draft PR #128 (`3e485cd1eead8a762e4cd6fcc88f5b8b63dc6fec`) on `security/tenant-owner-transfer-invitation-acceptance-2026-11-11`: exact-head workflows #566/#567 pass; each live PostgreSQL/Memgraph integration suite passes 90/90 with zero failures/skips; Node 22/24 each pass 594/594; CodeQL passes; browser/accessibility 9/9; collaboration Playwright 3/3. Main-only attestation is skipped by design on the feature branch. Local `npm run check` passes 594 tests (591 passed, 0 failed, 3 Windows-specific skips); local live integration is skipped without disposable PostgreSQL. No owner-transfer API is introduced; that requires authorized scope/API design and separate review. PR remains draft/unmerged with no formal review submission recorded.
- CI action-runtime follow-up: [PR #123](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/123); its final PR head passed the six non-attestation checks and consolidated evidence, and exact-main workflow #552 verified the merge. No formal review submission was recorded.
- Mainline license, attestation and CI detail: [post-PR #122 mainline and license inventory](2026-11-11-POST-PR122-MAINLINE-AND-LICENSE-INVENTORY.md), retained as historical evidence for the PR #122 source revision rather than the current mainline.
- Supply-chain remediation history: [supply-chain attestation remediation](2026-11-11-SUPPLY-CHAIN-ATTESTATION-REMEDIATION.md).
- Scope and gate definitions: [release scope](../RELEASE-SCOPE.md), [release readiness](../RELEASE_READINESS.md), [release evidence](../RELEASE-EVIDENCE.md), [implementation roadmap](../IMPLEMENTATION-ROADMAP.md), and [roadmap](../ROADMAP.md).
- Maintainer-led internal assurance policy: [maintainer-led security assurance](../security/MAINTAINER-LED-SECURITY-ASSURANCE.md).
- Upstream artifact-reader warning: [actions/toolkit issue #2003](https://github.com/actions/toolkit/issues/2003).

This report relies on revision-bound hosted CI results, repository documentation and GitHub issue/PR state observed on 11 November 2026. It does not claim access to a production deployment, production provider credentials, customer data, independent assessor results, a full backup/restore environment or an authorized release-owner decision.

**Final disposition: NO-GO FOR PRODUCTION.** Keep 0.6.2 private and unreleased until every applicable technical, independent, provider, legal, operational and release-approval gate is satisfied and accepted.
