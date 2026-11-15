# VirgoScorpio Hub 0.6.2 — Full Release-Gate Report

**Evidence snapshot:** 15 November 2026 UTC / 14 November 2026 America/Chicago  
**Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`  
**Current main:** `e982564c540b398a4809b072e11e15cbbe64f9cf`  
**Current release decision:** **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED**  
**Package:** `virgoscorpio-hub@0.6.2` — private and unreleased

> This report distinguishes exact-main hosted evidence, local maintainer engineering checks, and missing production acceptance. It does not authorize release, deployment, publication, or risk acceptance.

## 1. Executive decision

The current mainline is technically green for its defined CI workflow. F1.33, site AI-policy mutation/audit atomicity, merged in PR [#151](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/151), and closed issue [#150](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/150). Exact-main workflow [#637](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43670354191) passed all seven jobs on the exact main SHA.

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
| Main SHA | `e982564c540b398a4809b072e11e15cbbe64f9cf` |
| Main commit | `fix(tenant): make AI policy audit atomic (F1.33) (#151)` |
| F1.33 PR | [#151](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/151), merged 15 November 2026 03:00:26 UTC |
| F1.33 issue | [#150](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/150), CLOSED |
| CI workflow | [Run #637](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43670354191), push, attempt 1, 7/7 jobs successful |
| CI completion | 15 November 2026 03:03:37 UTC |
| Readiness snapshot generated | 15 November 2026 03:03:34.298 UTC, after producer verification while the aggregate workflow was finishing |
| Package version | `0.6.2`, `private: true`, not published |
| Preview classification | `EXPANDED_DEVELOPER_PREVIEW_NOT_PRODUCTION_CERTIFIED` |
| SemVer | No change authorized |
| Release / deployment | No tag, GitHub Release, npm publication, production deployment, or release authorization |

The source GitHub repository is public while the package remains private and unreleased. Do not confuse repository visibility with package publication or production authorization.

## 3. Exact-main CI and supply-chain evidence

Workflow #637 completed all seven required jobs:

| Job / evidence family | Result | Exact evidence |
|---|---|---|
| Node.js 22.23.4 unit, security, dependency checks | PASS | 608/608 Hub tests; 94/94 EnginEx 7.0.0 tests; zero failures/skips |
| Node.js 24.22.1 unit, security, dependency checks | PASS | 608/608 Hub tests; 94/94 EnginEx 7.0.0 tests; zero failures/skips |
| PostgreSQL / Memgraph integration | PASS | 99/99 live integration tests; zero failures/skips |
| Fresh and idempotent migrations | PASS | 18/18 applied to a fresh disposable database; 18/18 skipped on idempotent second pass; disposable database dropped |
| Browser / editor smoke | PASS | Playwright 9/9 |
| CodeQL static analysis | PASS | Workflow job succeeded |
| Mainline SBOM / provenance attestation | PASS | Required mainline signing and verification succeeded |
| Evidence consolidation | PASS | Five exact-source producer manifests validated; canonical readiness artifacts generated |

Additional dependency evidence:

- Both runtime SBOMs are CycloneDX 1.5 with 200 components and 201 dependency records; normalized inventory and dependency graph parity passed.
- npm version in hosted CI: 11.19.1.
- Lockfile SHA-256: `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`.
- Node 22 SBOM SHA-256: `6d315be3c7bba6ecae5aad257e6b9eb55c2a58785dceda88c2cef1b93cf9e758`.
- Node 24 SBOM SHA-256: `c856bbdc2770c121963e6a4ea49b0294182456a4a638e9ce95cb795fbb18a41d`.
- Hosted full and production npm audit scopes reported zero vulnerabilities.
- CodeQL and signed provenance/SBOM are automated evidence, not independent security approval or human license acceptance.

The service-less integration diagnostic remains **PARTIAL**: 34 tests were skipped on each Node runtime because those jobs do not supply the live service environment. These skips are not counted as live integration passes. The separate hosted PostgreSQL/Memgraph producer is the 99/99 live result.

### Run-bound artifact inventory

All artifacts below belong to exact-main workflow run 43670354191, attempt 1, source SHA e982564c540b398a4809b072e11e15cbbe64f9cf. GitHub reported expiry on 13 February 2027; retention should be rechecked before a later release review.

| Artifact | GitHub artifact ID | API SHA-256 digest | Expires |
|---|---:|---|---|
| PostgreSQL/Memgraph producer bundle | 14144465206 | `f181520ee47460e8a5fad99247a6b401c8d880b68c15c408ba7f1d96bf994147` | 13 February 2027 |
| Node.js 24 CI evidence | 14144345392 | `ca38b008a2df98b737c239b86f8685f5f0dccf5dd6de5760792473bd15d5fa46` | 13 February 2027 |
| Browser/accessibility evidence | 14144196564 | `e3e771bb572b0f891adfee33690872d8bec0ec33bb68937f2ef5533da2dd3af3` | 13 February 2027 |
| Node.js 22 dependency/SBOM evidence | 14144166050 | `84fbd42bbcaeb556321cf30754579f71fdc9b5b0ca5af598b19e04065c059382` | 13 February 2027 |
| CodeQL evidence | 14144037118 | `f75a1721f1ec7991bbf8162c9a3c6b280aacf8e3cd4472d7e80f1acacda1a6ca` | 13 February 2027 |
| Mainline supply-chain attestations | 14143862697 | `e73b500375443953044497e707f5bf90c7756a1a68fe59b5ed2a27a2c40ea1cb` | 13 February 2027 |
| Release readiness | 14143803012 | `605aeff05c6e8f9656f36fd4afdfe0f244270d7638f765d6ff5fd5a6ec706a34` | 13 February 2027 |
| Node.js 22 CI evidence | 14143524686 | `ca9e3145d896df970ef94d9c51511595e69f6ffb60afadd9d7a78de74b3a836c` | 13 February 2027 |
| Node.js 22 live-integration evidence | 14143169939 | `d78974b3d86602ae99f084c77c9cd3cff73590e79356a9e5151e4a4e33071712` | 13 February 2027 |
| Node.js 24 dependency/SBOM evidence | 14143154861 | `b4df6e961fa703bac5ce0803b6639e48baf4bd0da9d38646027018017d9ae91f` | 13 February 2027 |\n\nPostgreSQL/Memgraph producer artifact 14144465206 has API-reported SHA-256 `f181520ee47460e8a5fad99247a6b401c8d880b68c15c408ba7f1d96bf994147`. The run-bound producer evidence records 99/99 live tests and 18 fresh plus 18 idempotent migration checks against the exact main SHA.\n\nThe canonical readiness file was generated at 03:03:34.298 UTC while the aggregate workflow job was still finishing; GitHub's final run record independently confirms all seven jobs and overall workflow conclusion as success at 03:03:37 UTC. Do not treat the timestamp ordering as a failed CI run or transplant this artifact to another revision.

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
- The F1.28–F1.33 mutation/audit atomicity series now covers direct membership writes, site creation, design-system writes, taxonomy writes, relationship writes and site AI-policy writes. Each uses the existing transaction queryable seam rather than a parallel transaction abstraction.
- PR #151 has no formal human review submission recorded. Automated CI and maintainer implementation evidence do not constitute independent approval.

Current main branch protection is not enabled (`protected: false`). Treat this as a governance hardening gap to address through an explicitly authorized repository policy decision; do not infer that green checks alone enforce human review or release ownership.

## 6. Next development increment — F1.34

A bounded follow-up is now tracked as [issue #152](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/152): make editorial workflow transitions and their correlated audit inserts atomic.

Source inspection on main e982 found that the seven editorial routes currently dispatch the content status transition, workflow event and outbox write through the PostgreSQL store and then insert the audit event after the store transaction has returned. An audit persistence failure can therefore report an API failure after the state transition and outbox event have committed.

The proposed bounded fix reuses the existing PostgreSQL transaction client and `identity.audit(input, { queryable })` seam. It preserves route authorization, site scope, action mapping, optimistic version checks, response shape and pool-backed audit defaults. Unit and route regression tests cover all seven store/route actions, callback ordering before COMMIT, backwards compatibility when the optional callback is omitted, and rollback when audit persistence fails. A disposable two-site live PostgreSQL trigger-failure/retry integration regression is included for hosted CI.

The implementation candidate is isolated on branch `security/f1-34-editorial-workflow-audit-atomicity-2026-11-15`; it is not in current main and must not be represented as merged or production-qualified. Local Windows/Node.js 26.12.1 evidence currently includes:
- `npm run check`: 609 passed, 0 failed, 3 Windows-specific skips; artifact verification 235 required paths and 248 JavaScript files syntax-checked.
- Focused F1.34 store/API regression: 31 passed, 0 failed, 0 skipped.
- `npm audit --audit-level=high`: zero vulnerabilities.
- Local live PostgreSQL/Memgraph was not run because this host has no `DATABASE_URL` or `VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION`; the new failure-injection scenario requires hosted disposable database execution.
- Node 26 is supplemental local evidence only. Supported runtime qualification remains hosted Node 22.23.4 and 24.22.1.

The candidate must receive exact-head hosted CI, live integration and evidence aggregation. Keep independent assessments #14/#25 untouched, do not populate their evidence artifacts, and do not merge without formal human review and explicit merge authorization.

## 7. SemVer and release authorization

No public API, schema, migration, dependency, provider or package-version change is proposed by F1.33 or the bounded F1.34 candidate. Keep `virgoscorpio-hub@0.6.2` private and unreleased. Do not create a tag or GitHub Release, publish to npm, deploy to production, or increment SemVer until:
1. all required production evidence gates are genuinely satisfied;
2. independent tenant and platform security assessments are completed and accepted;
3. qualified human dependency/license/provenance acceptance is documented;
4. load/restore, operations, observability and release-owner approvals are complete; and
5. the named release owner explicitly authorizes the release scope and deployment.

**Final status: PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED.**
