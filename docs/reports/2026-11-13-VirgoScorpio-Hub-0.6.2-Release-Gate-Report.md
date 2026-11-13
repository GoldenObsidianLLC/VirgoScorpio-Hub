# VirgoScorpio Hub 0.6.2 — Release-Gate Report

**Snapshot date:** 13 November 2026
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub` (public GitHub source repository)
**Package:** `virgoscorpio-hub@0.6.2` (`private: true`; unreleased)
**Decision:** **PRODUCTION NO-GO — `NOT_PRODUCTION_CERTIFIED`**
**Current source:** `main` at `d991f7f9e995afc8884108949dbbbfeef21c66a2`
**Merged implementation:** [PR #136](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/136)
**Exact-main CI:** [Workflow #596](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43378967768) — run `43378967768`, attempt 1

> This report separates successful engineering/CI evidence from production acceptance. A passing build, a signed attestation, or maintainer-authored tests do not replace independent review, live provider qualification, human legal review, deployment rehearsals, accessibility acceptance, or release-owner approval.

## 1. Executive decision

The 0.6.2 candidate is **not approved for production**. Exact-main CI now produces one authoritative readiness snapshot after validating all required producer artifacts, including exact-source identity and checksums. This resolves the release-readiness sequencing defect tracked by issue #134. The resulting readiness is:

| Classification | Count | Meaning |
|---|---:|---|
| PASS | **8** | Bounded source, runtime, test, migration, and live CI evidence passed |
| PARTIAL | **2** | Human dependency review and service-less integration coverage remain incomplete |
| BLOCKED | **0** | No gate is classified as blocked by a failed producer in this finalized snapshot |
| MISSING_EVIDENCE | **14** | Required production evidence is absent |
| NOT_RUN | **0** | No readiness item was silently treated as unexecuted |

The formal readiness artifact reports `readyForProduction: false` and `releaseClassification: NOT_PRODUCTION_CERTIFIED`. The production NO-GO decision remains unchanged.

### Current release boundary

- Version remains **0.6.2**. No SemVer increment is warranted for CI tooling or documentation-only work.
- The package remains `private: true` and has not been published.
- The source repository is public; the current deployment posture remains isolated, self-hosted, non-production developer preview only.
- No release tag, GitHub Release, npm publication, customer/production data use, public hosted production service, or production deployment is authorized by these results.
- Independent tenant-isolation review #14 and independent platform security assessment #25 remain OPEN / NOT PERFORMED.

## 2. Exact source and workflow identity

| Field | Verified value |
|---|---|
| Repository | `GoldenObsidianLLC/VirgoScorpio-Hub` |
| Branch | `main` |
| Source revision | `d991f7f9e995afc8884108949dbbbfeef21c66a2` |
| Merge | [PR #136](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/136), merged 13 November 2026 at 06:28:38 UTC |
| Merge commit | `d991f7f9e995afc8884108949dbbbfeef21c66a2` |
| Workflow | VirgoScorpio Hub CI, `.github/workflows/ci.yml` |
| Event / run / attempt | `push` / `43378967768` / `1` |
| Workflow conclusion | **completed / success**, 7 of 7 jobs successful |
| Workflow completion | 13 November 2026 at 06:31:36 UTC |
| Node matrix | 22.23.4 and 24.22.1 |
| EnginEx | 7.0.0, pinned submodule commit `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` |
| Lockfile SHA-256 | `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086` |

GitHub records no formal review submission for PR #136. The merge and successful hosted checks are maintainer/automation evidence only; they are not an independent review.

## 3. Exact-main CI results

All seven workflow jobs completed successfully on the exact `main` SHA:

| Job | Result | Evidence / qualification |
|---|---|---|
| Unit, security and dependency checks — Node.js 22.23.4 | **PASS** | 600/600 Hub tests; 94/94 EnginEx tests; zero failures or skips |
| Unit, security and dependency checks — Node.js 24.22.1 | **PASS** | 600/600 Hub tests; 94/94 EnginEx tests; zero failures or skips |
| PostgreSQL and Memgraph integration | **PASS** | 93/93 live integration tests; zero failures/skips; outage/replay and graph rebuild checks completed |
| Browser editor and accessibility smoke tests | **PASS** | Automated Chromium/browser smoke completed successfully; this is not full manual WCAG or assistive-technology acceptance |
| CodeQL security analysis | **PASS** | Automated analysis job completed; human security assessment and finding disposition remain separate |
| Attest dependency lockfile and SBOM | **PASS** | Mainline attestation required and succeeded for this exact source; not a substitute for human license/dependency review |
| Consolidate candidate CI evidence | **PASS** | Validated producer job identity, source/run/attempt binding, and evidence checksums before finalizing readiness |

### Test and migration detail

The dedicated database job ran against GitHub Actions disposable services (PostgreSQL 18 and an isolated Memgraph container) on Ubuntu 24.04 / Node.js 22.23.4. No production credentials or production data were used.

| Validation | Result |
|---|---:|
| Live PostgreSQL/Memgraph integration | **93 passed / 0 failed / 0 skipped** |
| Fresh migrations, first pass | **18/18 applied** |
| Fresh migrations, second pass | **18/18 idempotently skipped** |
| Disposable database cleanup | **Completed** |
| Hub unit/security tests per supported Node runtime | **600/600** |
| EnginEx 7.0.0 tests per supported Node runtime | **94/94** |

The live database evidence included PostgreSQL-backed transaction/concurrency paths, Memgraph outage/outbox recovery, and canonical graph rebuild. PostgreSQL remains authoritative; Memgraph remains a rebuildable projection. Redis Pub/Sub remains ephemeral and must not be treated as a durable event log. Missed Pub/Sub notifications are recovered through the existing PostgreSQL-backed authorization/command/heartbeat fallbacks, not by assuming messages replay.

The readiness artifact's own service-less integration check remains **PARTIAL**: 34 tests were skipped because that diagnostic invocation had no live services. These skips are not counted as passes. The separate exact-source hosted database producer passed 93/93 with zero skips and is the evidence that satisfies the bounded live integration gate.

## 4. Post-producer readiness finalization

PR #136 implements the finalization design recorded in ADR-022:

1. Each required producer writes an immutable, run-bound artifact with a schema-v2 manifest.
2. The manifest binds product/version, repository, workflow, event, run, attempt, job, and exact source SHA.
3. The finalizer validates the five required producers and their checksums, validates the exact PostgreSQL/Memgraph record, and requires successful mainline attestation for a main push.
4. Per-runtime readiness reports remain preliminary diagnostics and are retained for audit.
5. Only after validation does the aggregator generate the canonical `artifacts/release-readiness.json` and `.md`.
6. Missing, failed, duplicate, stale, mismatched-source, mismatched-attempt, or checksum-mismatched producer evidence fails closed.

### Producer manifest checksums

| Producer | Workflow job | Manifest SHA-256 | Result |
|---|---|---|---|
| Browser/accessibility | Browser editor and accessibility smoke tests | `b952512883042e5da659124ee4ef1a23f9d1741406bd38656d915100b54bb79f` | PASS |
| Node.js 22.23.4 | Unit, security and dependency checks | `2fe60b0bde373cfad76c7197c3339cdb4e4c06444547c464125d43d747125352` | PASS |
| Node.js 24.22.1 | Unit, security and dependency checks | `fd2551da0fde232860d31f675ed5854359ee94371d606d257faa9dd3bf630999` | PASS |
| PostgreSQL/Memgraph | Live integration and fresh migrations | `134953016bbc558434bead58ed3bcac2cee3f46a060a515d9284bb462122ddb9` | PASS |
| CodeQL/static analysis | CodeQL security analysis | `f647bcc0ad75b514f0b6fa87dcc78f88cbb12ebba6c911dbf6a6c3d79835bb17` | PASS |

Four preliminary Node report files were retained separately. Their checksums are preserved under `ciFinalization.preliminaryReports` in the canonical JSON; they are not authoritative readiness reports.

The canonical readiness artifact was generated at `2026-11-13T06:31:33.387Z`, while the evidence-consolidation job itself was still running. The artifact correctly records its validated producer evidence and successful attestation, and does not assert the overall workflow conclusion. GitHub subsequently recorded the overall workflow as completed/success at `2026-11-13T06:31:36Z`, with all seven jobs successful. The completed workflow status is therefore confirmed by the GitHub Actions run record, not inferred from the artifact's generation-time state.

### Canonical artifact identity and retention

| Artifact | ID | Archive SHA-256 | Expires |
|---|---:|---|---|
| Release readiness | `14015409523` | `5d9b88206c1a67ccdd7181f5a0bd7db3851684eb45ac69e4950ef790a19251bb` | 11 February 2027 |
| Mainline supply-chain attestations | `14015762451` | `c042eb0443201ef78d46041f492ef5aa5b10e730caf0d0e5582dcb4e2ad7988e8` | 11 February 2027 |
| PostgreSQL/Memgraph producer evidence | `14015951895` | `a0160cf6f4a4b332794e0338cf3198d96d1373122e92f3b02f32c3c6d4e7ba75` | 11 February 2027 |
| Browser evidence | `14015223775` | `d8cadb5bfa76293d5e1200cc49581727077b17ad8023190e2c758d5907f2ba45` | 11 February 2027 |

These artifact records belong to workflow run `43378967768`, attempt 1, source `d991f7f9e995afc8884108949dbbbfeef21c66a2`. The final readiness archive digest is the canonical artifact archive checksum, not a claim that all inner files share that digest.

## 5. Readiness checks

The canonical JSON contains nine high-level checks. Seven passed and two are partial:

| Check | Status | Finding |
|---|---|---|
| Clean, revision-identified source tree | **PASS** | Source tree is clean at the exact main SHA; EnginEx submodule is clean at its pinned commit |
| Supported Node.js runtime | **PASS** | Required floor `>=22.23.4`; authoritative report generated on Node.js 22.23.4 |
| Reviewed and committed npm lockfile | **PARTIAL** | Lockfile is present/tracked and clean isolated `npm ci` passed; human dependency/license review remains required |
| Versioned migration files | **PASS** | 18 migration files are present |
| Required artifacts and JavaScript syntax | **PASS** | Repository artifact verification and syntax checks passed |
| Hub unit/security tests | **PASS** | 600/600 passed on the report runtime |
| Vendored EnginEx tests | **PASS** | 94/94 passed on the report runtime |
| Service-less integration test invocation | **PARTIAL** | 34/34 skipped because the invocation had no live services; a separate hosted producer passed 93/93 |
| Playwright dependency availability | **PASS** | Playwright dependency resolves; actual browser smoke result is a separate CI producer |

Supplemental checks in the readiness artifact include a fresh clean `npm ci`, fresh migration evidence, Playwright Chromium smoke, an `npm audit --audit-level=high` result with zero reported vulnerabilities, CycloneDX SBOM generation/schema checks, Memgraph outage recovery, canonical graph rebuild, and a read-only library reconciliation dry run. These are bounded supplemental results, not replacements for the fourteen missing gates.

The current CycloneDX 1.5 SBOM records 200 components and 201 dependency records. Automated inventory and attestation do not satisfy qualified human dependency, license, and distribution review. Issue #23 remains OPEN / PARTIAL.

## 6. Fourteen missing production evidence gates

Each row below maps to a distinct evidence contract in `artifacts/release-readiness.json`. Every one is presently `MISSING_EVIDENCE`; the successful CI results above do not change that status.

| # | Evidence gate | Required evidence still missing | Tracking / state |
|---:|---|---|---|
| 1 | Independent tenant-isolation and authorization review | Qualified independent route/tenant discovery, adversarial tests, findings, remediation and retest | [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) OPEN / NOT PERFORMED |
| 2 | Identity provider and account-recovery E2E | Live OIDC/SAML, email delivery, MFA recovery and session lifecycle acceptance | [#15](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/15) CLOSED / NOT PLANNED for 0.6.2 |
| 3 | Malware scanning and legacy-asset corpus | Live ClamAV integration, known safe/infected corpus, quarantine/rescan and failure behavior | [#16](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/16) CLOSED / NOT PLANNED for 0.6.2 |
| 4 | Live cloud storage providers | Non-production S3/GCS/Azure/S3-compatible credential, least-privilege, encryption, retention and lifecycle evidence | [#17](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/17) CLOSED / NOT PLANNED for 0.6.2 |
| 5 | Stripe lifecycle | Test-mode checkout, webhook replay/idempotency, ambiguous-outcome recovery, refunds, inventory and subscriptions | [#18](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/18) CLOSED / NOT PLANNED for 0.6.2 |
| 6 | Browser journeys and accessibility | End-to-end editor journeys, keyboard/screen-reader/manual WCAG and supported assistive-technology acceptance | [#19](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/19) CLOSED / NOT PLANNED for 0.6.2 |
| 7 | Commerce parity acceptance | Approved subset and evidence for tax, shipping, coupons, refunds, fulfilment, downloads and subscriptions | [#20](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/20) CLOSED / NOT PLANNED for 0.6.2 |
| 8 | Community parity acceptance | Group privacy, abuse/spam controls, search, export/deletion and forum acceptance | [#21](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/21) CLOSED / NOT PLANNED for 0.6.2 |
| 9 | Plugin signing and runtime isolation | Signed build provenance, adversarial container isolation, egress/permission denial and resource-boundary evidence | [#22](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/22) CLOSED / NOT PLANNED for 0.6.2 |
| 10 | Human dependency/SBOM/provenance/CodeQL review | Qualified dependency/license/distribution assessment, finding disposition, and accepted source-bound artifacts | [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) OPEN / PARTIAL |
| 11 | Load, fault, backup and restore | Workload/SLO definition, sustained load/soak, failure injection, full restore, integrity validation and measured RPO/RTO | [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) OPEN |
| 12 | Independent platform security assessment | Qualified independent threat-model/security assessment, severity-ranked findings, remediation and retest | [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) OPEN / NOT PERFORMED |
| 13 | Operations and release approval | Named accountable owners, deployment/rollback/secret rotation/incident/restore runbooks, monitoring and explicit approval | [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) OPEN |
| 14 | Production observability | Deployment-approved OTLP backend manifest, secure receiver, routing, retention, access/audit, resilience, ownership and governance | [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26), [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) OPEN |

**Important scope distinction:** Issues #15–#22 are closed as not planned for the 0.6.2 preview; their associated production evidence gates remain missing. "Not planned" is a scope decision, not evidence of completion or qualification. Do not populate the corresponding evidence JSON files from mock/local tests or infer provider acceptance.

## 7. Open release, security and governance work

| Issue | State | Outstanding decision |
|---|---|---|
| [#13 — approve 0.6.2 scope/provider matrix](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | OPEN | Authorized scope, provider matrix, topology and exact release boundary |
| [#14 — independent tenant/site review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | OPEN / NOT PERFORMED | Independent qualified review and its own evidence contract |
| [#23 — dependency/SBOM/provenance/CodeQL review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | OPEN / PARTIAL | Human dependency/license review and formal evidence acceptance |
| [#24 — load/soak/fault/backup/restore](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | OPEN | Full recovery and performance qualification |
| [#25 — independent platform security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | OPEN / NOT PERFORMED | Independent platform security assessment and retest |
| [#26 — runbooks and release-owner approval](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | OPEN | Named operations/release owners and rehearsed controls |
| [#32 — governance and zero-reserve controls](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | OPEN | Properly authorized company governance/financial decision |
| [#124 — maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124) | OPEN | Continue bounded internal authorization/tenant hardening; it does not replace #14/#25 |
| [#133 — README/status documentation reconciliation](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/133) | OPEN at report preparation | Consolidate current-main status and preserve historical snapshots |
| [#134 — exact-source post-producer finalization](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/134) | OPEN at report preparation | Implementation is merged and validated; reconcile documentation and issue record |

PR #136 does not close #14, #23, #24, #25, #26, or #32. Issue #124 is maintainer-led engineering only; do not create or populate `artifacts/evidence/tenant-isolation-review.json` or `artifacts/evidence/independent-security-review.json` without the respective independent work.

## 8. Preview posture and safe operating constraints

The following remains the conservative 0.6.2 developer-preview posture. Confirm current configuration files and approved release scope before changing these defaults.

| Area | Current boundary |
|---|---|
| Data | Synthetic/non-sensitive test data in an isolated self-hosted environment only; no customer/production data |
| PostgreSQL | Authoritative canonical content, permissions, identity and audit data |
| Memgraph | Rebuildable graph projection; outages must not grant access or compromise canonical data |
| Redis realtime | Optional/ephemeral; Pub/Sub does not durably replay notifications missed during outages; PostgreSQL-backed reauthorization is the security fallback |
| Cloud storage | No live S3/GCS/Azure provider is certified by this CI run |
| AI | Mock provider / external content disabled by default unless separately approved |
| Identity/email | Provider-backed identity, email delivery and recovery not qualified |
| Payments | Stripe credentials unset; live lifecycle not qualified |
| Malware | ClamAV corpus and legacy asset quarantine not qualified |
| Plugins | Execution remains disabled/unqualified pending signed build and adversarial isolation |
| Observability | No production OTLP deployment manifest or production backend acceptance |

Do not infer a production-ready state from green CI, the passing bounded Postgres/Memgraph suite, the source-code inventory, or the presence of adapter implementations.

## 9. Semantic versioning and release control

- Keep `virgoscorpio-hub@0.6.2` unchanged for this tooling/documentation work.
- No version bump, prerelease tag, release tag, GitHub Release, package publication, or deployment.
- Do not mark production readiness true or downgrade any evidence gate to passed without the corresponding accepted evidence.
- Any later product/API/schema change must be evaluated under SemVer and the architecture decision records; documentation-only and CI-finalization work do not justify 0.6.3.

## 10. Recommended next work

1. Merge this documentation reconciliation only after Markdown links, manifest JSON, whitespace checks and the exact-main documentation workflow pass; then reconcile issues #133 and #134 to their actual completion state.
2. Continue the next bounded maintainer-led tenant/security increment under #124 only after inspecting the exact current-main authorization and tenant-resolution seams and selecting one testable gap. Keep the work branch isolated from the dirty primary checkout and require exact-source hosted PostgreSQL/Memgraph evidence.
3. Preserve independent-review gaps #14/#25 and human dependency acceptance #23 as separate gates. Do not present maintainer regressions as independent sign-off.

### Recommended next code increment — F1.28 (maintainer-led; not yet implemented)

The exact-main source review identified a concrete audit-integrity gap in the existing membership administration flow:

- `site-membership-routes.js` invokes `identity.addMember()` or `identity.removeMember()`, then writes `identity.audit()` as a second operation.
- `packages/auth/src/service.js` currently inserts a member in auto-commit mode; member removal commits its existing per-site last-owner lock and delete transaction before route-level audit is written.
- If the separate audit write fails, membership state can change without its corresponding audit event. Invitation acceptance already demonstrates the stronger pattern: membership and audit are written in one PostgreSQL transaction, with authorization invalidation after commit.

**F1.28 proposal:** make direct member-add and member-remove state changes and their `site.member_added` / `site.member_removed` audit events atomic in `packages/auth/src/service.js`. Reuse a transaction-aware audit insertion helper, pass the existing authenticated actor ID and request ID into the identity service operation, and remove duplicate route-level audit writes. Preserve site-selector reconciliation, `site:manage` authorization before identity-store access, the existing per-site `FOR UPDATE` last-owner guard, current response/error contracts, and post-commit-only authorization invalidation. Define idempotent no-op add/remove behavior explicitly so an audit event never claims a state transition that did not occur. No new route, migration, schema, dependency, provider contract, or SemVer change is expected.

**Required tests before merge:** inject an audit insert failure and prove add/remove state rolls back; retry succeeds with exactly one state transition and one audit event; verify invalidation is emitted only after commit; retain last-owner concurrent-removal serialization and cross-site isolation; retain authorization-denial/no-side-effect tests; and verify duplicate/no-op requests do not create misleading transition events. Execute the dedicated tests with the hosted disposable PostgreSQL/Memgraph services because the Windows local checkout has no `node_modules` or dedicated PostgreSQL service at this time.

This is maintainer-led engineering under [issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124), not independent tenant/security approval. Independent reviews #14/#25 remain separate OPEN production gates.

## 11. Source files and evidence pointers

- Canonical machine-readable status: `artifacts/release-readiness.json`
- Canonical generated status: `artifacts/release-readiness.md`
- Preliminary diagnostics: `artifacts/release-readiness-preliminary-node-22.23.4.json/.md` and `artifacts/release-readiness-preliminary-node-24.22.1.json/.md`
- Exact-source live DB record: `artifacts/evidence/postgres-memgraph-live.json`
- Exact-source producer manifests: `artifacts/evidence/ci-evidence-*.json` and `artifacts/evidence/postgres-memgraph-ci-manifest.json`
- CI finalization architecture: [ADR-022](../ARCHITECTURE-DECISIONS.md#adr-022-ci-release-readiness-is-finalized-after-all-exact-source-producers-complete)
- Evidence contract and prior snapshots: [RELEASE-EVIDENCE.md](../RELEASE-EVIDENCE.md)
- Implementation continuity: [implementation roadmap](../IMPLEMENTATION-ROADMAP.md)
- Maintainer-only security policy: [maintainer-led security assurance](../security/MAINTAINER-LED-SECURITY-ASSURANCE.md)

**Prepared from the exact-main artifact and GitHub Actions run record.** Evidence is revision/run-bound and expires according to GitHub artifact retention; refresh the report against a new main SHA/run before making any later release decision.
