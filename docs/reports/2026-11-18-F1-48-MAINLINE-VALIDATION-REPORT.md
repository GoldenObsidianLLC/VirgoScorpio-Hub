# F1.48 — Mainline merge and exact-source validation report

**Assessment time:** 18 November 2026 UTC / 17 November 2026 America/Chicago
**Mainline revision:** `37f0bfff82c53e4d616ba87ce94f5d7a784200fe`
**Runtime implementation:** `4fa49b7403db3881ac50d9827223fb1d912b5b44`
**Pull request:** [#197 — F1.48 community feed and comment-parent privacy](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/197), MERGED
**Issue:** [#196](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/196), CLOSED
**Exact-main workflow:** [#44235945030](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44235945030), 7/7 jobs passed

> **Assurance boundary:** F1.48 is maintainer-authored route hardening and regression coverage. It is not an independent security assessment, a risk acceptance, a waiver, or production-certification evidence.

## Result

F1.48 is merged on main. The change corrects a reproduced legacy comment read-side privacy bypass and prevents private/hidden group privacy from being widened through activity fields or caller-supplied comment scope. The exact-main workflow validated the merge revision, including F1.48's recursive comment-parent checks and F1.47's regular navigation-menu isolation regression.

## Exact-main validation

| Gate | Result |
|---|---|
| Required CI jobs | 7/7 success |
| Node.js 22.23.4 | 670/670 Hub and 94/94 EnginEx tests; zero skips/failures |
| Node.js 24.22.1 | 670/670 Hub and 94/94 EnginEx tests; zero skips/failures |
| Dependency audits | Full and production-only npm audit: zero vulnerabilities on both supported runtimes |
| Live PostgreSQL/Memgraph/Redis | 141/141 passed; zero failures, skips or TODOs |
| Fresh / idempotent migrations | 18/18 applied; 18/18 skipped on second pass |
| Browser/editor smoke | 9/9 passed |
| CodeQL | Passed; scanned 268 JavaScript, 1 GitHub Actions and 2 HTML files |
| Signed mainline attestations | Provenance and CycloneDX SBOM created and verified against the exact lockfile/SBOM |
| Exact-source evidence aggregation | Passed; checksummed producer evidence bound to the merge SHA |

The live integration job explicitly passed the F1.48 community-feed privacy subtests: legacy widened/moved comments are hidden; cyclic legacy comment parents terminate and fail closed; default-visibility private-group posts remain hidden from other site members; site members outside private groups cannot comment; and comment parents must belong to the selected site. It also passed the F1.47 same-slug two-site regular navigation-menu isolation test.

## Run-bound artifacts

| Evidence | Artifact ID | SHA-256 |
|---|---:|---|
| Consolidated readiness / CI evidence | 14396544068 | `578b6f06cf15d15a0ed7750b74613bf03d2b14d632e1d9a1b04ecfc10b8b7df8` |
| Live database integration evidence | 14398020197 | `e25342847d246e51b55644dbe75b726abc59cb1e3c514d568bd3dfa0e451d3fb` |
| Signed supply-chain evidence | 14397825231 | `ef1b0abc4e1ba9b2e49c552b880516786380d7a55b6d115bc3dd000aee0f7d0c` |
| Browser/editor smoke evidence | 14397257485 | `06ea2b3d199fcd9204fed2e32c2704053e101723dcea1ec81aa881c5d2c4003c` |
| CodeQL evidence | 14396334182 | `923969ce91a561a624a8e089dcc1bc8c3be4797e9c6da1ed8517e784f99766cd` |

## Release decision

The exact-source consolidated readiness artifact reports **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN** and `readyForProduction=false` / `NOT_PRODUCTION_CERTIFIED`. The two PARTIAL classifications remain human dependency/license review and a service-less per-runtime diagnostic that skips 46 of 47 tests. Those diagnostic skips are not live integration results. The separate live integration producer passed with zero skips.

The 14 missing production gates remain `tenant-isolation-review`, `identity-provider-e2e`, `clamav-corpus`, `cloud-live-providers`, `stripe-live-lifecycle`, `browser-accessibility`, `commerce-parity-acceptance`, `community-parity-acceptance`, `plugin-container-isolation`, `dependency-sbom-codeql`, `load-backup-restore`, `independent-security-review`, `operations-release-approval`, and `observability-production`.

Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED. Dependency/license review #23 remains OPEN / PARTIAL. Scope/provider approval #13, load/restore #24, operations/release ownership #26 and governance #32 remain separate open gates.

PR #197 recorded no formal review submissions or inline review threads. Merge and automation evidence is maintainer evidence, not independent approval. Package 0.6.2 remains private and unreleased; production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, release, tag, publication, deployment, assessor engagement, spending or risk acceptance is authorized.
