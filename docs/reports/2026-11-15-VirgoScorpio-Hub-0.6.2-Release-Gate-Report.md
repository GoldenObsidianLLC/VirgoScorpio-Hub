# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Evidence snapshot:** 15 November 2026 UTC / 15 November 2026 America/Chicago
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`  
**Current main:** `233f8e9cf61f391cb46d269c2dd3f87ff75d1023`
**Current release decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**  
**Package:** `virgoscorpio-hub@0.6.2` — private and unreleased

> This report distinguishes exact-main hosted evidence, local maintainer engineering checks, and missing production acceptance. It does not authorize release, deployment, publication, or risk acceptance.

## 1. Executive decision

F1.35 plugin registry lifecycle/audit atomicity merged through PR [#157](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/157) as main SHA `233f8e9cf61f391cb46d269c2dd3f87ff75d1023`; issue [#156](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/156) is CLOSED. Exact-head push workflow #653 and PR workflow #654 passed 7/7 jobs each. Post-merge exact-main workflow [#655](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733907591) passed all seven jobs, including signed mainline attestations and evidence consolidation. GitHub records no formal review submission for PR #157; merge and CI remain maintainer evidence, not independent approval.

The canonical readiness classification remains:

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

`readyForProduction` is **false**. The 14 missing production gates, two partial reviews, absent independent assessments, and pending release-owner/governance decisions are material blockers. Successful CI does not remove them.

## 2. Source and release baseline

| Item | Verified value |
|---|---|
| Main SHA | `233f8e9cf61f391cb46d269c2dd3f87ff75d1023` |
| Main commit | `fix(plugin): make registry lifecycle audit atomic (F1.35) (#157)` |
| F1.35 PR | [#157](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/157), merged 15 November 2026; no formal review submission recorded |
| F1.35 issue | [#156](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/156), CLOSED |
| Release documentation sync | [PR #155](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/155), merged as main c7047881d79af654a7b85bdf2e7e7e63fc741de8; documentation-only | Updated current readiness, artifact inventory, roadmap and assurance baselines after F1.34. Exact-main workflow #646 passed 7/7 jobs; no runtime/API/schema/dependency/SemVer change. |
| CI workflow | [Run #646](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43703478252), push, attempt 1, 7/7 jobs successful |
| CI completion | 15 November 2026 10:21:57 UTC |
| Readiness snapshot generated | 15 November 2026 10:21:53.346 UTC, after producer verification while the aggregate workflow was finishing |
| Package version | `0.6.2`, `private: true`, not published |
| Preview classification | `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED` |
| SemVer | No change authorized |
| Release / deployment | No tag, GitHub Release, npm publication, production deployment, or release authorization |

The source GitHub repository is public while the package remains private and unreleased. Do not confuse repository visibility with package publication or production authorization.

## 3. Exact-main CI and supply-chain evidence

Workflow #646 completed all seven required jobs:

| Job / evidence family | Result | Exact evidence |
|---|---|---|
| Node.js 22.23.4 unit, security, dependency checks | PASS | 612/612 Hub tests; 94/94 EnginEx 7.0.0 tests; zero failures/skips |
| Node.js 24.22.1 unit, security, dependency checks | PASS | 612/612 Hub tests; 94/94 EnginEx 7.0.0 tests; zero failures/skips |
| PostgreSQL / Memgraph integration | PASS | 100/100 live integration tests; zero failures/skips |
| Fresh and idempotent migrations | PASS | 18/18 applied to a fresh disposable database; 18/18 skipped on idempotent second pass; disposable database dropped |
| Browser / editor smoke | PASS | Playwright 9/9 |
| PostgreSQL-backed collaboration browser | PASS | Playwright 4/4 |
| CodeQL static analysis | PASS | Workflow job succeeded |
| Mainline SBOM / provenance attestation | PASS | Required mainline signing and verification succeeded |
| Evidence consolidation | PASS | Five exact-source producer manifests validated; canonical readiness artifacts generated |

Additional dependency evidence:

- Both runtime SBOMs are CycloneDX 1.5 with 200 components and 201 dependency records; normalized inventory and dependency graph parity passed.
- npm version in hosted CI: 11.19.1.
- Lockfile SHA-256: `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`.
- Node 22 SBOM SHA-256: `971a79877e64aaf0ceba68675a547172f1d80c6f5b888a67d64b3938d9bc7803`.
- Node 24 SBOM SHA-256: `abd6ab417cba92d53a07709404d8116798cff6523c2bc2a0d76f2e51763503fc`.
- Hosted full and production npm audit scopes reported zero vulnerabilities.
- CodeQL and signed provenance/SBOM are automated evidence, not independent security approval or human license acceptance.

The service-less integration diagnostic remains **PARTIAL**: 34 tests were skipped on each Node runtime because those jobs do not supply the live service environment. These skips are not counted as live integration passes. The separate hosted PostgreSQL/Memgraph producer is the 100/100 live result and includes the F1.34 editorial audit-trigger rollback/retry regression.

### Run-bound artifact inventory

All artifacts below belong to exact-main workflow run 43733907591, attempt 1, source SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023. GitHub reported expiry on 13 February 2027 at 16:09:50 UTC; retention should be rechecked before a later release review. SHA-256 values are GitHub Actions artifact archive digests, not inner-file hashes.

| Artifact | GitHub artifact ID | API SHA-256 digest | Expires |
|---|---:|---|---|
| PostgreSQL/Memgraph live integration (Node 22) | 14170250189 | a24cbdafed6dadc364d42421244c69e9c198590a16d872fd06782ed184e98cfe | 13 February 2027 |
| PostgreSQL/Memgraph producer bundle | 14170225290 | 623b8041e20fe8cd2254da22a3bdad59006550e4698688c6a1cbd2eacbb7fed3 | 13 February 2027 |
| Browser/accessibility evidence | 14169990531 | bdda541f36c63e61b87041c3444fc33dff3e1c1a927e4b9952af96569d86b487 | 13 February 2027 |
| Canonical release readiness | 14169835612 | 17bcf91094e7b8b5f05c50b89abf37a6912d099f5f73723278ce31eb89d5a6da | 13 February 2027 |
| Signed supply-chain attestations | 14169735746 | 328d040ed6a660778c41b1f511e2451abb229a5a90898929b442029128f40506 | 13 February 2027 |
| Node.js 22 CI evidence | 14169735666 | 3fffa8320184fc82356958c117071f596ef52491b0fcf603adf7101376aff885 | 13 February 2027 |
| Node.js 24 CI evidence | 14169606642 | dc9372ba7fc9272e1f9c22fd91154c0ae6f422ab9a8a0c54b21c6eef567c3ee6 | 13 February 2027 |
| CodeQL evidence | 14169368294 | 63c3157648d6e7539f9dc963914b07f125e4a8b187691251b34997b994808188 | 13 February 2027 |
| Node.js 22 dependency evidence | 14169357353 | 1b6b3950b5ccf914686c775c64612a60a0209fcfcce5408540e7fc15dde79d8b | 13 February 2027 |
| Node.js 24 dependency evidence | 14169309350 | 0e4678cf1461b3c1c5ab0af94d4ba4a97b70111d44e5d5bf84e1922b34d0f864 | 13 February 2027 |

The PostgreSQL/Memgraph producer manifest SHA-256 is 728e50950723ba43ad62f0ced2c7d8932ffc48251b72e1571ee7584dceb96194. It binds 100/100 live integration tests, 18 fresh migration applications and 18 idempotent second-pass skips to exact main SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023.

The verified CycloneDX 1.5 SBOM document hashes are Node.js 22 eada98793ea79e8f95f773b6694d29954fcdf1fb08ba5b61b278d39643676d3d and Node.js 24 a27630cb3e2cf92928634d9261c207122605d624cc0e5832fd9b4c7cbbb56a75. Both derive from lockfile SHA-256 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086, contain 200 components and 201 dependency records, and match the signed mainline attestations. Fourteen Sharp/libvips components have LGPL license terms; qualified human license/distribution acceptance remains open.

The canonical readiness JSON/Markdown was generated at 16:12:47.414 UTC after all producer evidence was validated. It remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction false and NOT_PRODUCTION_CERTIFIED. Fourteen production gates remain missing; independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED and #23 remains OPEN / PARTIAL. Package 0.6.2 remains private and unreleased; no tag, GitHub Release, npm publication, production deployment or SemVer increment is authorized.

## 4. Production evidence gate matrix

All 14 listed gates remain **MISSING_EVIDENCE**. The hosted CI passes above do not convert these gates into production passes.

| Gate | Status | Required evidence still outstanding |
|---|---|---|
| Tenant isolation / authorization review | MISSING_EVIDENCE | Qualified independent tenant-isolation and authorization assessment; issue [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) is OPEN / NOT PERFORMED |
| Identity-provider E2E | MISSING_EVIDENCE | OIDC/SAML, email delivery, MFA recovery and identity lifecycle end-to-end evidence |
| ClamAV corpus | MISSING_EVIDENCE | Live scanner plus representative malicious-file corpus, quarantine and legacy-asset acceptance |
| Cloud live providers | MISSING_EVIDENCE | Live S3/GCS/Azure/S3-compatible credential, identity and least-privilege operational acceptance |
| Stripe lifecycle | MISSING_EVIDENCE | Live/test webhook replay, ambiguous-outcome recovery and inventory lifecycle evidence |
| Browser accessibility | MISSING_EVIDENCE | Manual WCAG/assistive-technology acceptance; automated Playwright smoke is not a substitute |
| Commerce parity | MISSING_EVIDENCE | Tax, shipping, coupons, refunds, fulfilment, downloads and subscription acceptance |
| Community parity | MISSING_EVIDENCE | Group privacy, abuse/spam, search, export/deletion and forum acceptance |
| Plugin container isolation | MISSING_EVIDENCE | Signed plugin pipeline and adversarial runtime/container isolation |
| Dependency / SBOM / CodeQL human acceptance | MISSING_EVIDENCE | Qualified human dependency, maintenance, license/distribution, provenance and CodeQL disposition; issue [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) remains OPEN / PARTIAL |
| Load / backup / restore | MISSING_EVIDENCE | Load/soak, fault injection, backup/restore, recovery objectives and drill results; issue [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) remains open |
| Independent platform security | MISSING_EVIDENCE | Qualified independent platform security assessment and severe-finding remediation; issue [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) is OPEN / NOT PERFORMED |
| Operations / release approval | MISSING_EVIDENCE | Named operational ownership, deployment/rollback runbooks, secrets, monitoring and authorized release decision; issue [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) remains open |
| Production observability | MISSING_EVIDENCE | Deployment-approved OTLP backend, security, governance, ownership, retention and delivery evidence |

The two **PARTIAL** readiness classifications remain:
1. Human lockfile/dependency/license/distribution review is incomplete.
2. The service-less integration diagnostic contains 34 skipped tests per runtime; skipped tests are not passes.

The separate scope/governance issues [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) and [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) remain open. Issues #15–#22 are outside the present 0.6.2 developer-preview plan; their corresponding production provider/parity/plugin acceptance must remain visibly missing, not relabeled as passed.

## 5. Maintainer security and architecture status

The maintainer-led process permits ordinary, isolated, non-production engineering to continue. It is explicitly not independent security review, production risk acceptance, waiver, or certification.

- [Issue #14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): OPEN / NOT PERFORMED.
- [Issue #25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25): OPEN / NOT PERFORMED.
- [Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23): OPEN / PARTIAL.
- The merged F1.28–F1.35 mutation/audit atomicity series covers membership, site creation, design-system, taxonomy, relationships, site AI-policy, seven editorial workflow transitions, and plugin registration/administrative lifecycle mutations. All reuse the existing transaction queryable seam; F1.35 is mainline behavior from PR #157.
- PR #154 has no formal human review submission recorded. Automated CI and maintainer implementation evidence do not constitute independent approval.

Current main branch protection is not enabled (`protected: false`). Treat this as a governance hardening gap to address through an explicitly authorized repository policy decision; do not infer that green checks alone enforce human review or release ownership.

## 6. F1.34 — Editorial workflow transition/audit atomicity (merged mainline)

A bounded follow-up tracked by [issue #152](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/152) was implemented through [PR #154](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/154), which merged 15 November 2026 at 08:03:20 UTC into main SHA `9c868e0f949e2c7d18f768a12b8f4e86b6591306`. Issue #152 is CLOSED.

Source inspection on the F1.33 baseline found that the seven editorial routes dispatched content status/version, workflow and outbox writes through the PostgreSQL store, then inserted the correlated audit event after the store transaction had returned. An audit persistence failure could therefore report an API error after the editorial mutation and durable outbox event had committed.

F1.34 reuses the existing PostgreSQL transition transaction and established `identity.audit(input, { queryable })` seam. It adds an optional, backwards-compatible `onTransition` callback to the transition and seven wrappers, passes the active transaction queryable to the audit service before COMMIT, and removes the route-level post-commit audit to avoid duplicate writes. Published-route uniqueness error mapping is narrowed to the content UPDATE so workflow/outbox/audit database errors retain their original identity. Existing route authorization, site scope, action mapping, optimistic version checks, scheduling bounds, actor/request correlation, response shape and pool-backed defaults are preserved. No new transaction abstraction, schema, migration, dependency, API/protocol, provider, lockfile or SemVer change was introduced.

### Exact-head candidate evidence

PR #154 candidate head was `9848fbfeb973bf8b349ef432dc7d03a495ee543a`. Exact-head push [workflow #640](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43689323133) and PR [workflow #641](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43689373659) both completed successfully with all seven workflow jobs. Node.js 22/24 each passed 612/612 Hub and 94/94 EnginEx tests with zero failures/skips. PostgreSQL/Memgraph passed 100/100 live tests with zero failures/skips, including the editorial workflow audit-trigger rollback/retry regression; migrations passed 18 fresh and 18 idempotent checks; Playwright smoke passed 9/9; DB-backed collaboration passed 4/4; CodeQL and evidence consolidation passed. The mainline-only attestation job was skipped as designed for the feature branch.

### Exact-main merge evidence

Exact-main [workflow #643](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43692705776) completed successfully at 08:06:57 UTC with all seven jobs, including the signed mainline SBOM/provenance attestation and post-producer evidence consolidation. On exact main SHA `9c868e0f949e2c7d18f768a12b8f4e86b6591306`, Node.js 22/24 each passed 612/612 Hub and 94/94 EnginEx; PostgreSQL/Memgraph passed 100/100 with zero failures/skips; 18 fresh migrations applied and 18 idempotently skipped; Playwright smoke passed 9/9 and DB-backed collaboration passed 4/4. Both full and production npm audit scopes reported zero vulnerabilities. CycloneDX 1.5 SBOMs contain 200 components / 201 dependency records per runtime and match the signed mainline attestation.

GitHub records no formal review submission for PR #154. Merge and automation are maintainer evidence, not independent approval. Independent tenant review #14 and platform security review #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. F1.34 does not populate or waive those independent evidence contracts.

## 7. F1.35 — Plugin registry lifecycle/audit atomicity (merged mainline; issue #156 CLOSED)

F1.35 merged through [PR #157](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/157) as exact main SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023 on 15 November 2026. [Issue #156](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/156) is CLOSED.

### Source gap and implementation

The plugin registration route previously wrote the plugin_installs row and then persisted plugin.registered separately. The approve, security-review, activate and disable routes likewise persisted state before a separate plugin.<action> audit insert. An audit failure could therefore return an HTTP error after state had committed. Lifecycle checks also loaded plugin state without a row lock, so concurrent re-registration could invalidate a review's assumptions.

F1.35 reuses withTransaction(localPool, work) and identity.audit(input, { queryable }). Registration/upsert and all four administrative transitions now persist state and correlated audit together. Lifecycle code selects the site-scoped row FOR UPDATE through the active transaction queryable before validating status, two-administrator separation, signature/artifact/SBOM provenance and pinned-image requirements. External invoke and sandbox execution stay outside transaction/row-lock scope. No new transaction helper, schema, migration, dependency, public route, API contract, lockfile or SemVer change was introduced.

### Regression and exact-head evidence

The two-site PostgreSQL fixture injects audit-events trigger failures for registration, approval, security review, activation and disable. Each failure verifies rollback/no audit followed by safe retry/exactly one correlated event. An advisory-gated concurrency regression pauses replacement registration in its audit transaction, queues security review behind the plugin row lock, then verifies that the reviewer reads the replacement pending row and is rejected. The fixture restores its expected disabled state after the concurrency case.

Exact-head push workflow [#653](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733427094) and PR workflow [#654](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733433490) each passed 7/7 jobs. Both supported Node runtimes passed 612/612 Hub and 94/94 EnginEx tests with zero failures/skips; PostgreSQL/Memgraph passed 100/100 with zero skips; migrations passed 18 fresh and 18 idempotent checks; Playwright passed 9/9 and collaboration 4/4; CodeQL and evidence consolidation passed. The branch-only attestation job was skipped as designed.

Exact-main [workflow #655](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43733907591) passed all seven jobs on SHA 233f8e9cf61f391cb46d269c2dd3f87ff75d1023, including the mainline signed lockfile/SBOM attestation and post-producer evidence consolidation. Node 22/24 each passed 612/612 Hub and 94/94 EnginEx tests; PostgreSQL/Memgraph passed 100/100, 18 fresh migrations plus 18 idempotent second-pass checks passed, Playwright 9/9, collaboration 4/4 and CodeQL passed. Both npm audit scopes reported zero vulnerabilities. The canonical readiness artifact is bound to the exact source revision and remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN.

Supplemental Windows/Node.js 26.12.1 npm run check passed 609 tests, zero failures and three platform-specific skips. Local live PostgreSQL/Memgraph was not run because local database configuration is absent; hosted exact-head and post-merge workflows supply the live integration validation. No formal GitHub review submission was recorded for PR #157; merge and CI are maintainer/automation evidence, not independent security approval.

F1.35 closes issue #156 only. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. This feature does not satisfy or waive those separate evidence contracts or any production gate.


## 8. SemVer and release authorization

No public API, schema, migration, dependency, provider, lockfile or package-version change was introduced by merged F1.33–F1.35. Keep `virgoscorpio-hub@0.6.2` private and unreleased. Do not create a tag or GitHub Release, publish to npm, deploy to production, or increment SemVer until:
1. all required production evidence gates are genuinely satisfied;
2. independent tenant and platform security assessments are completed and accepted;
3. qualified human dependency/license/provenance acceptance is documented;
4. load/restore, operations, observability and release-owner approvals are complete; and
5. the named release owner explicitly authorizes the release scope and deployment.

**Final status: PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.**
