# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Evidence snapshot:** 15 November 2026 UTC / 15 November 2026 America/Chicago
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`  
**Current main:** `9c868e0f949e2c7d18f768a12b8f4e86b6591306`
**Current release decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**  
**Package:** `virgoscorpio-hub@0.6.2` — private and unreleased

> This report distinguishes exact-main hosted evidence, local maintainer engineering checks, and missing production acceptance. It does not authorize release, deployment, publication, or risk acceptance.

## 1. Executive decision

The current mainline is technically green for its defined CI workflow. F1.34, editorial workflow transition/audit atomicity, merged in PR [#154](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/154) at 08:03:20 UTC and closed issue [#152](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/152). Exact-main workflow [#643](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43692705776) passed all seven jobs on main SHA `9c868e0f949e2c7d18f768a12b8f4e86b6591306`. GitHub records no formal review submission for PR #154; merge and CI remain maintainer evidence, not independent approval.

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
| Main SHA | `9c868e0f949e2c7d18f768a12b8f4e86b6591306` |
| Main commit | `fix(content): make workflow transitions and audit atomic (F1.34) (#154)` |
| F1.34 PR | [#154](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/154), merged 15 November 2026 08:03:20 UTC; no formal review submission recorded |
| F1.34 issue | [#152](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/152), CLOSED |
| CI workflow | [Run #643](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43692705776), push, attempt 1, 7/7 jobs successful |
| CI completion | 15 November 2026 08:06:57 UTC |
| Readiness snapshot generated | 15 November 2026 08:06:54.743 UTC, after producer verification while the aggregate workflow was finishing |
| Package version | `0.6.2`, `private: true`, not published |
| Preview classification | `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED` |
| SemVer | No change authorized |
| Release / deployment | No tag, GitHub Release, npm publication, production deployment, or release authorization |

The source GitHub repository is public while the package remains private and unreleased. Do not confuse repository visibility with package publication or production authorization.

## 3. Exact-main CI and supply-chain evidence

Workflow #643 completed all seven required jobs:

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

All artifacts below belong to exact-main workflow run `43692705776`, attempt 1, source SHA `9c868e0f949e2c7d18f768a12b8f4e86b6591306`. GitHub reported expiry on 13 February 2027 at 08:03:23 UTC; retention should be rechecked before a later release review. The SHA-256 values are GitHub Actions artifact archive digests, not inner file hashes.

| Artifact | GitHub artifact ID | API SHA-256 digest | Expires |
|---|---:|---|---|
| PostgreSQL/Memgraph producer bundle | 14153400385 | `eb0ebdc91ead92b0d6034415180985e64ef3b3672f48fed19b7db4ead84f9da5` | 13 February 2027 |
| Node.js 24 CI evidence | 14153360265 | `13bc09d1e9d66453f2bd71637d79628d5621300758f10f8f8414f2a1961ce055` | 13 February 2027 |
| Browser/accessibility evidence | 14153400226 | `81869f3f57fce3d8836aa5788a5d11589d1dd063354ab0d02c2a4673d02deab9` | 13 February 2027 |
| Node.js 22 dependency/SBOM evidence | 14153640122 | `463d1a6d8dee639ece526ce506088a2bbc658ee1c7654a5dcbe28364fe70ddc8` | 13 February 2027 |
| CodeQL evidence | 14153635110 | `7baa1bffca4052c255732de376a58b7e6a0277f03bfefeef16504015ac9ab690` | 13 February 2027 |
| Mainline supply-chain attestations | 14153615251 | `7d37f01b342557daaa1663dd177c541070e027a33e9977e5cf2b8b5e7ff41ae7` | 13 February 2027 |
| Release readiness | 14153271277 | `f37ce5377ead8de5640675ba969d4bfd2afd2413c78b3f0caf471df8a8d42462` | 13 February 2027 |
| Node.js 22 CI evidence | 14152589775 | `54212353c681b2f6365c90712b5799aa8e654c0abf29fe9605fd75f28c875abf` | 13 February 2027 |
| Node.js 22 live-integration evidence | 14152364096 | `e99a27d25dd058da7565495a7904705d983d1a4eafedb2c54f725ac0c7d53bf1` | 13 February 2027 |
| Node.js 24 dependency/SBOM evidence | 14153470077 | `0370761d083b34dcc52e6355fee0db60f7e26451728410a93f31c44f7da2f865` | 13 February 2027 |

PostgreSQL/Memgraph producer artifact 14153400385 has API-reported SHA-256 `eb0ebdc91ead92b0d6034415180985e64ef3b3672f48fed19b7db4ead84f9da5`. The run-bound producer manifest SHA-256 is `d7652bfd43b84333b8e9e20c3b2ed0b2397a2db30c00b61840b63259b7db1cec`; it binds 100/100 live tests, the F1.34 audit-trigger rollback/retry regression and 18 fresh plus 18 idempotent migration checks against the exact main SHA.

The canonical readiness file was generated at 08:06:54.743 UTC while the aggregate workflow job was still finishing; GitHub's final run record independently confirms all seven jobs and overall workflow conclusion as success at 08:06:57 UTC. Do not treat the timestamp ordering as a failed CI run or transplant this artifact to another revision.

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
- The F1.28–F1.34 mutation/audit atomicity series now covers direct membership writes, site creation, design-system writes, taxonomy writes, relationship writes, site AI-policy writes and seven editorial workflow transitions. Each uses the existing transaction queryable seam rather than a parallel transaction abstraction.
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

## 7. SemVer and release authorization

No public API, schema, migration, dependency, provider, lockfile or package-version change was introduced by F1.33 or F1.34. Keep `virgoscorpio-hub@0.6.2` private and unreleased. Do not create a tag or GitHub Release, publish to npm, deploy to production, or increment SemVer until:
1. all required production evidence gates are genuinely satisfied;
2. independent tenant and platform security assessments are completed and accepted;
3. qualified human dependency/license/provenance acceptance is documented;
4. load/restore, operations, observability and release-owner approvals are complete; and
5. the named release owner explicitly authorizes the release scope and deployment.

**Final status: PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.**
