# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Snapshot date:** 14 November 2026
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub` (public source repository)
**Package:** `virgoscorpio-hub@0.6.2` (`private: true`; unreleased and not publishable)
**Decision:** **PRODUCTION NO-GO — `NOT_PRODUCTION_CERTIFIED`**
**Exact main source:** 67e9440b9c543e69a46bba8cbb25a9d2329f3502
**Latest mainline feature:** [PR #144](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/144), F1.30 design-system mutation/audit atomicity; merged 14 November 2026 at 19:52:48 UTC; [issue #143](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/143) CLOSED
**Exact-main CI:** [Workflow #612](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43634472737), run 43634472737, attempt 1; completed successfully at 19:56:11 UTC

> This report distinguishes verified engineering evidence from production acceptance. Passing tests, automated security analysis, SBOM generation, signed provenance, and maintainer-authored regressions do not replace independent review, live provider qualification, accessibility acceptance, operational rehearsal, governance approval, or release-owner sign-off.

## 1. Executive decision

VirgoScorpio Hub 0.6.2 remains an **unreleased, non-production developer preview**. The latest merged change, F1.30, makes the site design-system mutation and correlated design_system.updated audit event atomic. Exact-main workflow #612 validated main 67e9440b9c543e69a46bba8cbb25a9d2329f3502; all seven jobs completed successfully. GitHub records no formal review submission on PR #144; this is maintainer/automation evidence, not independent approval.

The canonical, exact-source readiness artifact reports:

| Classification | Count | Interpretation |
|---|---:|---|
| PASS | **8** | Bounded source, runtime, test, migration, and live CI evidence passed |
| PARTIAL | **2** | Human dependency/lockfile review and the separate service-less integration diagnostic remain incomplete |
| BLOCKED | **0** | No producer failure is classified as an aggregate blocked gate in this snapshot |
| MISSING_EVIDENCE | **14** | Required production evidence is still absent |
| NOT_RUN | **0** | No readiness row was silently treated as unexecuted |

The artifact reports `readyForProduction: false` and `releaseClassification: NOT_PRODUCTION_CERTIFIED`. The production decision remains **NO-GO**. The separate production-certification decision is not satisfied by the successful CI jobs.

### Release boundary

- Package version remains **0.6.2**. No SemVer increment is warranted for the compatible F1.29 and F1.30 fixes, documentation refresh, or CI evidence.
- The GitHub source repository is public; `package.json` keeps the npm package `private: true`. The package has not been published.
- No release tag, GitHub Release, npm publication, customer/production-data use, hosted production service, or production deployment is authorized.
- The recommended posture remains isolated, self-hosted, non-production developer preview using synthetic/non-sensitive data.
- Independent tenant-isolation review #14 and independent platform security assessment #25 remain OPEN / NOT PERFORMED.

## 2. Exact source and workflow identity

| Field | Verified value |
|---|---|
| Repository | `GoldenObsidianLLC/VirgoScorpio-Hub` |
| Branch | `main` |
| Source revision | `debd9890b94b55dd3b9496d80f49a9a7c00615fb` |
| Feature merge | [PR #142](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/142), F1.29 |
| Merge time | 14 November 2026 at 16:27:43 UTC |
| Workflow | VirgoScorpio Hub CI — `.github/workflows/ci.yml` |
| Event / run / attempt | `push` / `43615723391` (#609) / `1` |
| Workflow conclusion | **completed / success**, 7 of 7 jobs successful |
| Workflow completion | 14 November 2026 at 16:30:50 UTC |
| Node matrix | 22.23.4 and 24.22.1 |
| EnginEx | 7.0.0, pinned submodule commit `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` |
| `package-lock.json` SHA-256 | `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086` |

GitHub records no formal review submission or inline review thread for PR #142. Merge and green automated checks are maintainer/automation evidence, not independent review.

## 3. Exact-main CI results

All seven jobs passed on the exact main SHA:

| Job | Result | Verified evidence and qualification |
|---|---|---|
| Unit, security and dependency checks — Node.js 22.23.4 | **PASS** | 607/607 Hub tests; 94/94 EnginEx tests; no failures or skips |
| Unit, security and dependency checks — Node.js 24.22.1 | **PASS** | 607/607 Hub tests; 94/94 EnginEx tests; no failures or skips |
| PostgreSQL and Memgraph integration | **PASS** | 95/95 live integration tests; zero failures/skips; includes the F1.29 site/audit rollback-retry regression |
| Browser editor and accessibility smoke | **PASS** | Automated browser smoke completed; this is not full manual WCAG or assistive-technology acceptance |
| CodeQL security analysis | **PASS** | Automated analysis completed; human finding disposition and independent security review remain separate |
| Signed dependency lockfile/SBOM attestations | **PASS** | Mainline signing was required and succeeded for this exact source; no human license/dependency approval is implied |
| Post-producer evidence consolidation | **PASS** | Five required producer manifests were checked for schema, exact source/run/attempt identity and checksums before readiness finalization |

### Test, migration, and supply-chain detail

The hosted database job used disposable GitHub Actions PostgreSQL 18 and Memgraph services. No production credentials or production data were used.

| Validation | Result |
|---|---:|
| PostgreSQL/Memgraph live integration | **95 passed / 0 failed / 0 skipped** |
| Fresh PostgreSQL migrations, first pass | **18/18 applied** |
| Migration re-entry, second pass | **18/18 idempotently skipped** |
| Hub tests, Node.js 22.23.4 | **607/607** |
| Hub tests, Node.js 24.22.1 | **607/607** |
| EnginEx 7.0.0 tests, each runtime | **94/94** |
| `npm audit --audit-level=high` | **0 vulnerabilities** |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilities** |
| CycloneDX SBOM | **1.5; 200 components and 201 dependency records per runtime** |

The hosted integration log executed the F1.29 audit-trigger failure case. It verifies that failure to persist `site.created` cannot leave the new site and initial owner membership committed without the audit row. The suite also retains the existing PostgreSQL transaction/concurrency, Redis outage/recovery, Memgraph projection recovery and graph-rebuild checks. PostgreSQL remains authoritative; Memgraph is a rebuildable projection; Redis Pub/Sub remains ephemeral, with database-backed reauthorization/fallbacks retained for security-sensitive behavior.

The generated SBOMs and lockfile are source-bound CI evidence, not human dependency/license approval. Lockfile SHA-256 is recorded above. The Node 22 and Node 24 SBOMs were produced in the exact-main run; the human review required by #23 is still outstanding.

## 4. Canonical readiness finalization and retained artifacts

The finalizer validated five required producer manifests and produced the canonical `artifacts/release-readiness.json` and Markdown report for source `debd9890b94b55dd3b9496d80f49a9a7c00615fb`.

- Canonical readiness generation: `2026-11-14T16:30:45.519Z`.
- The artifact snapshot was generated while the evidence-consolidation job still reported `in_progress`; GitHub subsequently recorded the overall workflow as `completed / success` at `2026-11-14T16:30:50Z`. The completed workflow conclusion is confirmed by the Actions run record, not inferred from the artifact's generation-time status.
- Aggregate readiness: **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**.
- `readyForProduction: false`; `releaseClassification: NOT_PRODUCTION_CERTIFIED`.
- Mainline supply-chain attestation was required and passed.

The two PARTIAL classifications must remain distinct:

1. Human dependency/lockfile/license review is not complete. Reproducible installation, audit, SBOM generation, CodeQL, and signed attestations do not substitute for that review.
2. The separate service-less readiness diagnostic skipped 34 integration tests per runtime because no live services were attached to that diagnostic invocation. Those skips are not passes. The separate exact-source hosted PostgreSQL/Memgraph producer passed 95/95 with zero skips.

### Exact-run artifact records

All listed artifacts belong to workflow run `43615723391`, attempt 1, and expire on 12 February 2027 at 16:27:46 UTC.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release readiness | `14121454049` | `07e6d64d7f134a418350f98f6f2e1bdd137159a2bc9a0be44d0715485fbdba7e` |
| PostgreSQL/Memgraph producer | `14122506161` | `f23b9572b9578e6c57718cc841e045cb0ea5d545e4a32d4e5485634be66faf84` |
| Mainline supply-chain attestations | `14122366478` | `a66014b5b2828022a6cdbbe2d807eecceba317601dcf1405df372a700d673313` |
| Node.js 22 CI evidence | `14122132232` | `ae368766ecd15c3d3d0d216722ff7ee808703ece879679a265c1b18a00d78f93` |
| Node.js 24 CI evidence | `14122411164` | `2ef2f7623feb233eec32029f7ab97b1c005f0b70d9818286d43c46a2f9306bd5` |
| Browser/accessibility evidence | `14121861878` | `cbd3543f81604aaaacbb8dbed4ed3e96d39931a0bdc6f3f9b71f02d101c535ea` |
| CodeQL/static-analysis evidence | `14121727500` | `a5007bb7726ce1a86cf4fb2c8607f59b1bd0f3483a4e44aee55a44b1d57dccd7` |
| Node.js 24 dependency/SBOM evidence | `14122580865` | `9a5f15fccc6be4758485928494bd9ebdcd211fb5de2a338154a48863433825cc` |
| Node.js 22 dependency/SBOM evidence | `14122266626` | `c1807d9f746ee4cf6b0b6cdc31b1b40c42a135bae6ad7c970da7037a0eec5dec` |
| Node.js 22 live-integration evidence | `14122376427` | `7563b13d3f454fe64e7980ff4a59c61c528077c60497058b225252496bccc339` |

Artifact URLs and source-bound job manifests are retained by GitHub Actions. Refresh these references from a new exact-main run before any later release decision; artifacts are subject to retention expiry.

## 5. Fourteen missing production evidence gates

Every gate below remains `MISSING_EVIDENCE`. The successful exact-main workflow does not satisfy or waive these external acceptance requirements.

| # | Evidence gate | Required evidence still missing | Tracking / status |
|---:|---|---|---|
| 1 | Independent tenant-isolation and authorization review | Qualified independent route/tenant discovery, adversarial tests, findings, remediation and retest | [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) OPEN / NOT PERFORMED |
| 2 | Identity provider and account-recovery E2E | Live OIDC/SAML, email delivery, MFA recovery and session lifecycle acceptance | [#15](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/15) CLOSED / NOT PLANNED for 0.6.2 |
| 3 | Malware scanning and legacy-asset corpus | Live ClamAV integration, known safe/infected corpus, quarantine/rescan and failure behavior | [#16](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/16) CLOSED / NOT PLANNED for 0.6.2 |
| 4 | Live cloud storage providers | Non-production S3/GCS/Azure/S3-compatible credentials, least-privilege, encryption, retention and lifecycle evidence | [#17](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/17) CLOSED / NOT PLANNED for 0.6.2 |
| 5 | Stripe lifecycle | Test-mode checkout, webhook replay/idempotency, ambiguous-outcome recovery, refunds, inventory and subscriptions | [#18](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/18) CLOSED / NOT PLANNED for 0.6.2 |
| 6 | Browser journeys and accessibility | End-to-end editor journeys, keyboard/screen-reader/manual WCAG and supported assistive-technology acceptance | [#19](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/19) CLOSED / NOT PLANNED for 0.6.2 |
| 7 | Commerce parity acceptance | Approved subset and evidence for tax, shipping, coupons, refunds, fulfilment, downloads and subscriptions | [#20](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/20) CLOSED / NOT PLANNED for 0.6.2 |
| 8 | Community parity acceptance | Group privacy, abuse/spam controls, search, export/deletion and forum acceptance | [#21](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/21) CLOSED / NOT PLANNED for 0.6.2 |
| 9 | Plugin signing and runtime isolation | Signed build provenance, adversarial container isolation, egress/permission denial and resource-boundary evidence | [#22](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/22) CLOSED / NOT PLANNED for 0.6.2 |
| 10 | Human dependency/SBOM/provenance/CodeQL review | Qualified dependency/license/distribution assessment, finding disposition and accepted source-bound artifacts | [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) OPEN / PARTIAL |
| 11 | Load, fault, backup and restore | Workload/SLO definition, sustained load/soak, failure injection, full restore, integrity validation and measured RPO/RTO | [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) OPEN |
| 12 | Independent platform security assessment | Qualified independent threat-model/security assessment, severity-ranked findings, remediation and retest | [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) OPEN / NOT PERFORMED |
| 13 | Operations and release approval | Named accountable owners, deployment/rollback/secret rotation/incident/restore runbooks, monitoring and explicit approval | [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) OPEN |
| 14 | Production observability | Deployment-approved OTLP backend manifest, secure receiver, routing, retention, access/audit, resilience, ownership and governance | [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26), [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) OPEN |

**Scope distinction:** Issues #15–#22 are closed as `not_planned` for the 0.6.2 developer preview. Their production evidence gates remain missing. A scope exclusion is not a provider pass, product-parity acceptance, or risk acceptance. Do not populate their evidence files from mocks or local tests.

## 6. Open release, security, and governance work

| Issue | Current state | Outstanding decision |
|---|---|---|
| [#13 — approve 0.6.2 scope/provider matrix](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | OPEN | Authorized scope, provider matrix, topology and exact release boundary |
| [#14 — independent tenant/site review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | OPEN / NOT PERFORMED | Independent qualified review and its own evidence contract |
| [#23 — dependency/SBOM/provenance/CodeQL review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | OPEN / PARTIAL | Human dependency/license review and formal evidence acceptance |
| [#24 — load/soak/fault/backup/restore](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | OPEN | Full recovery and performance qualification |
| [#25 — independent platform security assessment](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | OPEN / NOT PERFORMED | Independent platform security assessment and retest |
| [#26 — runbooks and release-owner approval](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | OPEN | Named operations/release owners and rehearsed controls |
| [#32 — governance and zero-reserve controls](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | OPEN | Properly authorized company governance/financial decision |
| [#124 — maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124) | OPEN | Bounded maintainer engineering; does not replace #14 or #25 |
| [#143 — F1.30 design-system audit atomicity](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/143) | OPEN | Complete exact-head hosted validation and code review for the next maintainer slice |
| [#133 — README/status documentation reconciliation](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/133) | CLOSED | Documentation reconciliation completed; current snapshot refreshed again here |
| [#134 — exact-source post-producer finalization](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/134) | CLOSED | Finalizer merged and later exact-main runs passed |
| [#141 — F1.29 site-creation audit atomicity](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/141) | CLOSED | Merged through PR #142 and validated on exact main |

PR #136's CI finalizer does not close #14, #23, #24, #25, #26, or #32. Parent issue #124 remains maintainer-only engineering. Do not create or populate the independent-review evidence files for #14 or #25 without the corresponding independent work.

## 7. Preview posture and architecture guardrails

| Area | Current boundary |
|---|---|
| Data | Synthetic/non-sensitive data in an isolated self-hosted environment only; no customer/production data |
| PostgreSQL | Authoritative canonical content, permissions, identity, transactions and audit data |
| Memgraph | Rebuildable graph projection; outages must not grant access or compromise canonical data |
| Redis realtime | Optional/ephemeral; Pub/Sub does not durably replay missed notifications; database-backed reauthorization remains the security fallback |
| Cloud storage | No live S3/GCS/Azure provider is certified by this CI run |
| AI | Mock provider / external content disabled by default unless separately approved |
| Identity/email | Provider-backed identity, email delivery and account recovery not qualified |
| Payments | Stripe lifecycle not qualified |
| Malware | ClamAV corpus and legacy-asset quarantine not qualified |
| Plugins | Execution remains disabled/unqualified pending signed build and adversarial isolation |
| Observability | No production OTLP deployment manifest or production-backend acceptance |

The source tree uses PostgreSQL transactions as the authoritative mutation boundary. Audit records that are part of a state transition must commit or roll back with that transition. Shared `withTransaction` and `insertAuditEvent` helpers are preferred over bespoke client lifecycle or duplicate route-level audit writes. Authorization invalidation and other externally visible side effects remain post-commit unless the architecture explicitly requires transactional outbox delivery.

## 8. SemVer and release control

- Keep `virgoscorpio-hub@0.6.2` unchanged.
- No version bump, prerelease tag, release tag, GitHub Release, package publication, or deployment.
- Do not change readiness to true or mark any evidence gate passed without the corresponding current, accepted evidence.
- Evaluate any later externally visible API/schema change under SemVer and the architecture decision records. Documentation-only and internal compatibility fixes do not justify 0.6.3.

## 9. F1.29 — Site-creation audit atomicity (merged mainline; issue #141 closed)

F1.29 addressed a source-confirmed commit gap in `POST /api/v1/sites`: the site and initial `site-owner` membership were committed before a separate route-level `site.created` audit write. The change reuses `withTransaction(pool, work)` and the shared `insertAuditEvent(queryable, input)` helper so the site, owner membership, and correlated audit event commit or roll back together. The route passes `requestId` into the service and removes the duplicate audit call. Existing `site:manage` authorization, developer-token denial before body parsing, slug/name validation, HTTP response behavior, and duplicate-slug 409 mapping are preserved. The unique-slug translation is scoped to the `sites` insert so an audit-table unique violation retains its original error.

PR #142 merged this change to `main` at `debd9890b94b55dd3b9496d80f49a9a7c00615fb`; issue #141 is CLOSED. Exact-main workflow #609 passed all seven jobs, including 607/607 Hub tests on both Node 22 and Node 24, 94/94 EnginEx tests on both, and 95/95 live PostgreSQL/Memgraph integration tests with zero skips. The hosted suite applied all 18 fresh migrations and verified 18 idempotent re-entry skips, browser/accessibility smoke, CodeQL, signed mainline supply-chain attestation, and exact-source evidence consolidation. GitHub records no formal PR review submission; this remains maintainer implementation and automated evidence, not independent assurance.

## 10. F1.30 — Design-system mutation/audit atomicity (merged mainline; issue #143 closed)

F1.30 corrected a transaction-boundary gap in the site design-system update path. Previously the route committed the site_design_systems upsert and only then called identity.audit() through the service pool. An audit insert failure could return an error while leaving design-system version/tokens changed without the correlated event.

The route now reuses withTransaction(pool, work) for the row lock, optimistic-version check, upsert and design_system.updated audit insert. identity.audit(input, { queryable }) accepts the transaction client while preserving the pool-backed default for all existing callers. The response is returned after commit. Site capability checks, selectors, token validation, version-conflict behavior, request correlation, response shape and site scoping remain intact. No migration, schema, API contract, dependency, provider, lockfile, package version or SemVer change.

PR #144 merged on 14 November 2026 at 19:52:48 UTC. Merge commit and current main: 67e9440b9c543e69a46bba8cbb25a9d2329f3502. Issue #143 is closed. GitHub records no formal PR review submission or requested reviewers; this is not independent approval. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED.

### Local validation

- Identity audit explicit-queryable/default-pool unit: 1/1 passed.

- Disposable PostgreSQL tenant integration: 22/22 passed, zero skips; 18 fresh migrations applied and 18 idempotently skipped on re-entry. Trigger failure rolled back the Site A mutation, preserved Site B and wrote no audit row; retry incremented once and created exactly one correlated event. Conflicting selectors and stale expected versions created no audit side effect.

- One clean local npm run check passed 608 tests (605 passed, zero failures, three Windows-specific skips); repository verification covered 235 paths and 246 JavaScript files. Two later full-suite reruns intermittently hit Undici fetch failed / Error: bad port in unrelated Windows/Node 26.12.1 loopback tests. Affected body-limit test passed three isolated reruns; billing-webhook suite passed 9/9 isolated. Exact port was not captured; root cause remains unconfirmed.

- Full and production npm audit: zero vulnerabilities. Markdown: 441 internal links, zero broken. Tenant inventory: 27 families, 78 route patterns, 21 source files, 43 test references; generator freshness passed.

### Exact-head candidate workflows

Push workflow #43632988846 and PR workflow #43633214435 passed on candidate commit ba3aaa5ea01edf4f76a694ce9728c2ff2791401e. Node 22/24 each passed 608/608 Hub and 94/94 EnginEx tests; PostgreSQL/Memgraph passed 96/96 with zero skips; migrations, Playwright, CodeQL and evidence consolidation passed. The branch-only attestation job skipped as designed.

### Post-merge exact-main validation

Exact-main workflow #612 (run 43634472737, attempt 1) completed successfully at 19:56:11 UTC on 67e9440b9c543e69a46bba8cbb25a9d2329f3502. All seven jobs passed: Node 22.23.4/24.22.1 each 608/608 Hub and 94/94 EnginEx; PostgreSQL/Memgraph 96/96, zero skips, including the F1.30 failure-injection; 18/18 fresh migrations plus 18/18 idempotent re-entry; Playwright editor/collaboration smoke 9/9; CodeQL; signed mainline SBOM/provenance attestation; exact-source evidence finalization.

The mainline CycloneDX 1.5 SBOM contains 200 components and 201 dependency records. Lockfile SHA-256: 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086. Node 22 SBOM SHA-256: c10642773b4a33097df28a03c15496152293ba8efb91d80df49ee235c83b96a7. Fourteen components contain LGPL terms and still require qualified human license/distribution review. Producer-manifest hashes, artifact IDs and archive digests are retained in RELEASE-MANIFEST.json.

F1.30 strengthens mainline transactional audit consistency but does not close independent security, supply-chain, provider, accessibility-acceptance, operational or governance gates. Readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE, readyForProduction false, NOT_PRODUCTION_CERTIFIED. Package 0.6.2 remains private/unreleased; production remains NO-GO.

## 11. Recommended next work

1. Advance independent tenant-isolation review #14 and platform security assessment #25 through qualified assessors; maintainer tests and CI do not replace those reviews.

2. Complete human dependency/license review #23, including the 14 LGPL-bearing SBOM components, and retain the separate load/backup/restore gate #24.

3. Obtain authorized decisions for scope #13, operations/release approval #26 and governance #32. Keep 0.6.2 private/unreleased; do not publish or deploy.


## 12. Source files and evidence pointers

- Canonical exact-main readiness: `virgoscorpio_hub-release-readiness-ci` artifact from workflow run `43615723391`; archive SHA-256 `07e6d64d7f134a418350f98f6f2e1bdd137159a2bc9a0be44d0715485fbdba7e`.
- Live database producer: artifact `14122506161`; archive SHA-256 `f23b9572b9578e6c57718cc841e045cb0ea5d545e4a32d4e5485634be66faf84`.
- Mainline supply-chain attestations: artifact `14122366478`; archive SHA-256 `a66014b5b2828022a6cdbbe2d807eecceba317601dcf1405df372a700d673313`.
- Exact-source implementation: `apps/api/src/server.js`, `packages/auth/src/service.js`, and the tenant/site integration tests.
- Tenant navigation inventory: `artifacts/security/tenant-isolation-route-inventory.json` and `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md`.
- CI finalization architecture: [ADR-022](../ARCHITECTURE-DECISIONS.md#adr-022-ci-release-readiness-is-finalized-after-all-exact-source-producers-complete).
- Evidence contract: [RELEASE-EVIDENCE.md](../RELEASE-EVIDENCE.md).
- Implementation continuity: [implementation roadmap](../IMPLEMENTATION-ROADMAP.md).
- Maintainer-only security policy: [maintainer-led security assurance](../security/MAINTAINER-LED-SECURITY-ASSURANCE.md).

**Prepared from exact-main workflow #612 and its retained artifacts, plus the separately identified F1.30 local validation and exact-head candidate workflows.** This report is current for main source 67e9440b9c543e69a46bba8cbb25a9d2329f3502; refresh it against the next verified exact-main source and workflow before a later release decision.
