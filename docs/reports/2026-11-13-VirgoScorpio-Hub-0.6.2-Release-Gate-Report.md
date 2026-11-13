# VirgoScorpio Hub 0.6.2 — Release-Gate Report

**Snapshot date:** 13 November 2026
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub` (public GitHub source repository)
**Package:** `virgoscorpio-hub@0.6.2` (`private: true`; unreleased)
**Decision:** **PRODUCTION NO-GO — `NOT_PRODUCTION_CERTIFIED`**
**Current source:** `main` at `2b3771446bf448931ce822ea6e476697a6ea263f`
**Mainline documentation reconciliation:** [PR #137](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/137); release-readiness finalizer implementation: [PR #136](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/136)
**Exact-main CI:** [Workflow #599](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43495281163) — run `43495281163`, attempt 1

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
| Source revision | `2b3771446bf448931ce822ea6e476697a6ea263f` |
| Mainline documentation reconciliation | [PR #137](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/137), merged 13 November 2026 at 19:46:02 UTC |
| Merge commit | `2b3771446bf448931ce822ea6e476697a6ea263f` |
| Workflow | VirgoScorpio Hub CI, `.github/workflows/ci.yml` |
| Event / run / attempt | `push` / `43495281163` / `1` |
| Workflow conclusion | **completed / success**, 7 of 7 jobs successful |
| Workflow completion | 13 November 2026 at 19:49:46 UTC |
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
| Browser/accessibility | Browser editor and accessibility smoke tests | `6bac758d0ecaaa2a3286b2a8b29ca3de426db618166d38faa41cb00d240ec4bc` | PASS |
| Node.js 22.23.4 | Unit, security and dependency checks | `7355986122721e44c4c724fb1712a34e3411d8395eb7e312e535072fb318815f` | PASS |
| Node.js 24.22.1 | Unit, security and dependency checks | `33eb60bdbb54f38fe862fd11a2c02a2aa578760b0c22cf576030f56fcfd9efb5` | PASS |
| PostgreSQL/Memgraph | Live integration and fresh migrations | `3dcc7a540e1bf0ba431b34f4893e76a1f827f13c8920c700849b70855383af73` | PASS |
| CodeQL/static analysis | CodeQL security analysis | `ba8789bdc33cf9ceaf1a569181cdb6f0f54497ce2b8a1f6b37b139227b2b7dee` | PASS |

Four preliminary Node report files were retained separately. Their checksums are preserved under `ciFinalization.preliminaryReports` in the canonical JSON; they are not authoritative readiness reports.

The canonical readiness artifact was generated at `2026-11-13T19:49:42.765Z`, while the evidence-consolidation job itself was still running. The artifact correctly records its validated producer evidence and successful attestation, and does not assert the overall workflow conclusion. GitHub subsequently recorded the overall workflow as completed/success at `2026-11-13T19:49:46Z`, with all seven jobs successful. The completed workflow status is therefore confirmed by the GitHub Actions run record, not inferred from the artifact's generation-time state.

### Canonical artifact identity and retention

| Artifact | ID | Archive SHA-256 | Expires |
|---|---:|---|---|
| Release readiness | `14072066484` | `e76372997326ee6a7c5fa253e39093e5e8a90af8170be2f8a8e5f285ba952922` | 11 February 2027 |
| Mainline supply-chain attestations | `14070724805` | `6017cc88a8859a26a7dd0e837f0070e702bd6aff4a6d919edc9cdec3395baf49` | 11 February 2027 |
| PostgreSQL/Memgraph producer evidence | `14070669511` | `4c6dffea43410744ea0bcfa2392094f58862869cd0486c0c37a74d39f16300ac` | 11 February 2027 |
| Browser evidence | `14071847044` | `6eec20f7bcf97fb24fe5e9c4778e75cc4e0eb29b197bfa96dca8becd32746aeb` | 11 February 2027 |
| Node.js 22 CI evidence | `14070814412` | `2a25e15c273a009ba22c44071a10819513287c0ee42bfc28db5fe81aaa401200` | 11 February 2027 |
| Node.js 24 CI evidence | `14069959537` | `e7035c40bf74b56c68e7e2bbb32e86b98865ee4d12fe93154376656ac534a598` | 11 February 2027 |
| Node.js 22 dependency/SBOM evidence | `14071757395` | `4ca1472103278ba652cc8ea9a256581850b9190f94d70492fc043a8f419f90a5` | 11 February 2027 |
| Node.js 24 dependency/SBOM evidence | `14069874829` | `5ec56b565ebf95a21d3b19f6ceb80aa242931253ed07475134f6352f5473afaa` | 11 February 2027 |
| Node.js 22 live-integration evidence | `14071972143` | `a6cc80a09f4110882561154615d8291bdbed646f490ee24c570797847bca602c` | 11 February 2027 |
| CodeQL/static-analysis evidence | `14071082393` | `ec7989bc51c6876f55b093f60c7b4d990843a36154bc088569524343025bc543` | 11 February 2027 |

These artifact records belong to workflow run `43495281163`, attempt 1, source `2b3771446bf448931ce822ea6e476697a6ea263f`. The final readiness archive digest is the canonical artifact archive checksum, not a claim that all inner files share that digest. Node.js 22 producer artifact `14070814412` has archive SHA-256 `2a25e15c273a009ba22c44071a10819513287c0ee42bfc28db5fe81aaa401200`; Node.js 24 producer artifact `14069959537` has archive SHA-256 `e7035c40bf74b56c68e7e2bbb32e86b98865ee4d12fe93154376656ac534a598`.

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

### F1.28 implementation candidate ? transactional direct membership audit (issue #139; not merged)

The source review identified a consistency gap: direct membership addition/removal and their audit events were separate commits. The isolated candidate branch `security/f1-28-membership-audit-atomicity-2026-11-13` implements the following bounded change:

- The existing `withTransaction(pool, work)` utility now owns client acquisition, commit/rollback, and release for direct add/remove and invitation acceptance. A shared `insertAuditEvent(queryable, input)` helper accepts either the pool or transaction client and centralizes parameterized audit-event insertion.
- `identity.addMember()` now inserts membership and `site.member_added` in one transaction. `identity.removeMember()` keeps the existing per-site `FOR UPDATE` last-active-owner guard and now inserts `site.member_removed` before the same transaction commits.
- The routes pass the authenticated actor ID and request ID into the service; duplicate route-level add/remove audit writes are removed. Invitation acceptance remains atomic and now reuses the shared helper.
- Authorization invalidation remains post-commit and occurs only after an actual membership transition. A duplicate add or absent-member removal is a no-op with no audit row or invalidation.
- A live PostgreSQL regression injects audit-trigger failures for add and remove, checks rollback/no-invalidation, then retries and checks the single correlated audit record and post-commit invalidation.

**Validation on the isolated worktree:** `npm run security:tenant-inventory` generated 27 flow families, 78 declared route patterns, 21 implementation source files and 42 test references. `npm run check` passed: 600 tests, 597 passed, 0 failed and 3 Windows-specific skips; the artifact check covered 235 required paths and syntax-checked 245 JavaScript files. `npm audit --audit-level=high` reported 0 vulnerabilities. The pinned EnginEx submodule was initialized at the repository's indexed commit before the successful full check. The local host has no disposable PostgreSQL/Memgraph integration endpoint (`DATABASE_URL` is unset), so the new live rollback/retry regression was authored but not executed locally. Exact PR-head hosted integration evidence remains required before merge.

Tracking: [issue #139](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/139), child of [tenant-isolation hardening #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124). This is a maintainer implementation candidate, not independent review. Issues #14 and #25 remain OPEN / NOT PERFORMED; the 14 production evidence gates remain outstanding. No API contract, schema, migration, dependency, provider, lockfile or package-version change is intended. Package 0.6.2 remains private/unreleased; production remains NO-GO.

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
