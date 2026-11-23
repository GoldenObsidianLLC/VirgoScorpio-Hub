# VirgoScorpio Hub 0.6.2 - Release Gate Report

**Report date:** 22 November 2026 (America/Chicago)
**Repository:** GoldenObsidianLLC/VirgoScorpio-Hub
**Release decision:** **NO-GO - NOT_PRODUCTION_CERTIFIED**
**Package status:** 0.6.2 remains private and unreleased.

## 1. Executive decision

F1.67, public-library media-variant source-version binding, remains the latest merged runtime increment through [PR #293](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/293) at runtime commit 4da6f26730ff0634ffe01f85790bedf0a255c4e3. Documentation-only [PR #294](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/294) advanced main to fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d and synchronized the exact-main readiness baseline. This is maintainer implementation and automation evidence, not production certification.

The updated PR candidate completed hosted workflow [#1272 / run 45087499845](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45087499845). Node.js 22.23.4 and 24.22.1 each passed 809/809 Hub tests and 94/94 EnginEx tests. Live PostgreSQL/Memgraph integration passed 194/194 with zero failures or skips; all 19 migrations applied on the fresh database and were recognized on idempotent re-entry. Browser smoke, CodeQL, dependency/SBOM parity, and candidate evidence consolidation passed. The signed lockfile/SBOM attestation job is intentionally mainline-only and was skipped on the PR event.

Exact-main workflow #45088000378 completed successfully on merge SHA 4da6f26730ff0634ffe01f85790bedf0a255c4e3 at 2026-11-23T00:22:16Z. All seven jobs passed: Node 22.23.4, Node 24.22.1, live PostgreSQL/Memgraph integration, browser smoke, CodeQL, signed lockfile/SBOM attestation, and exact-source evidence consolidation. The exact-main readiness artifact is source-bound to the merged revision and records 8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

The latest exact-main baseline is [workflow #45096332836](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836) on main SHA fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d. Canonical readiness artifact #14783736045 reports **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, readyForProduction=false and NO-GO. This is not a weighted score. Passing CI does not close independent assurance, operational, acceptance, or release-owner evidence.

**No release action is authorized.** Do not create a tag or GitHub Release, publish to npm, bump SemVer, certify production, or deploy 0.6.2.

## 2. Source and change identity

| Item | Evidence |
|---|---|
| Current main SHA | fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d (documentation-only PR #294 after F1.67 runtime SHA 4da6f26730ff0634ffe01f85790bedf0a255c4e3) |
| Previous main SHA | 4da6f26730ff0634ffe01f85790bedf0a255c4e3 |
| Runtime increment | F1.67 - public media-variant source-version binding |
| PR | [#293](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/293), merged 22 November 2026 (America/Chicago) |
| Issue | [#292](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/292), closed by merge |
| PR head validated | 50daa6440dea5f0e209fcb0885ab6a8592c4c331 |
| Synthetic PR merge ref | 60adf51e6e11227b33b3107d32fc63683ab52430 |
| Candidate CI | [Workflow #1272 / run 45087499845](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45087499845), success |
| Latest exact-main CI | [Run 45096332836](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836), completed success (7/7) on fccd708 |
| Vendored EnginEx | 7.0.0 at pinned commit d99e021f55664f006b5e65b4a58202f9c7bc4f4b |
| Package | 0.6.2, private, unreleased |

The squash merge is signed and GitHub reports the signature as verified. No public API shape, response contract, object-storage URL, package dependency, lockfile, package version, or SemVer change was made.

## 3. F1.67 delivered

F1.67 binds public media derivatives to the exact source version that produced their bytes.

- Migration 0019 adds nullable media_variants.source_version with a positive-value constraint. Historical rows are not backfilled because their original source version cannot be inferred reliably.
- New derivative insertion locks the matching active parent asset version through the transaction. Stale version writes conflict rather than attaching output to a later asset revision.
- Public derivative reads require the recorded source version to equal the current active/public parent version. Unbound legacy derivatives fail closed.
- Source-byte replacement invalidates derivative rows in the same transaction. Old derivative objects are removed only after commit; rollback retains previous references and bytes.
- Metadata-only versions carry forward only derivatives already bound to the immediately previous version, because the underlying source bytes remain unchanged.
- Optimizer creation and optimization-status updates are pinned to the source version read before optimization. Stale optimizer work cannot publish a variant for or overwrite the status of a replacement source.
- Final review fixed an ambiguous-COMMIT cleanup hazard in replaceVersion. The code marks commitAttempted before awaiting COMMIT and retains the new object after any COMMIT attempt. PostgreSQL may have committed the row while the acknowledgement was lost; retaining the object avoids a dangling database reference. The reference-aware reconciler can later remove a true orphan. Pre-COMMIT failures still roll back and remove the staged object.

The ambiguous-COMMIT regression simulates PostgreSQL applying COMMIT and then dropping the acknowledgement. It verifies both the prior version object and potentially referenced replacement object remain, the original error propagates, and cleanup attempts to close the transaction. Existing pre-COMMIT audit-failure coverage continues to verify rollback compensation.

### Current development candidate - F1.68

F1.68 is under development on branch security/f1-68-login-timing-oracle-2026-11-22 and tracked by [issue #295](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/295). The candidate equalizes password-verification KDF work for unknown accounts and missing/malformed stored hashes using a fixed dummy scrypt record. Dummy results can never authenticate; stored-hash parsing is strict/canonical and length-bounded; oversized/non-string candidates remain ineligible even though bounded KDF work still runs. Existing generic 401 behavior and per-IP/email throttling remain unchanged. Deterministic tests inject a KDF spy across six input shapes rather than relying on wall-clock thresholds.

Local checks: npm run check passed 810 total (807 passed, zero failed, three conditional platform skips); EnginEx passed 94 total (91 passed, zero failed, three conditional Windows skips); tenant inventory freshness and git diff --check passed. This is not merged and has no hosted PR result yet. It is related to Aikido tracking #234/#273 but no scanner fingerprint is mapped or marked resolved. No migration, dependency, API, package version or SemVer change. See the [F1.68 implementation report](2026-11-22-F1-68-LOGIN-TIMING-ORACLE-HARDENING-REPORT.md).


## 4. Formal readiness gate summary

The current canonical exact-main readiness artifact 14783736045 is source-bound to main SHA fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d after documentation PR #294. It records:

| Formal status | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

readyForProduction=false; releaseClassification=NOT_PRODUCTION_CERTIFIED; decision=NO-GO. Artifact ZIP SHA-256: da110efa0f422c6ad6193884831d3b8692557ab75a1dacef821fc5a6a096ac02; release-readiness.json SHA-256: 83838a770034b091c6321a54e450a9df250ed053b43e88dc87155a0fe88cee78; release-readiness.md SHA-256: 2212f7a26d6ff08d7ad8c83088fb9ac722c1e556361ee92120a1e4c93ed596e5.

### 4.1 Formal checks

| Gate | Status | Result / limitation |
|---|---|---|
| Clean, revision-identified source tree | PASS | Clean PR candidate source and pinned EnginEx submodule. |
| Supported Node.js runtime | PASS | Required Node.js >=22.23.4; matrix validates 22.23.4 and 24.22.1. |
| Reviewed and committed npm lockfile | PARTIAL | Lockfile is tracked and clean install passed; qualified human dependency/license review remains outstanding. |
| Versioned migration files | PASS | 19 migration files; fresh and idempotent application also verified live. |
| Required artifacts and JavaScript syntax | PASS | Artifact verifier and syntax checks completed successfully. |
| Hub unit/security tests | PASS | 809/809 on Node.js 22.23.4 and 809/809 on Node.js 24.22.1. |
| Vendored EnginEx unit tests | PASS | 94/94 on both supported CI runtimes. |
| Service-less integration diagnostic | PARTIAL | 50 tests: 1 pass, 49 skipped. Skips are not live integration passes. |
| Playwright dependency available | PASS | Dependency resolves; this is not full browser, screen-reader, or WCAG acceptance. |
| Live PostgreSQL/Memgraph integration | PASS | 194/194, zero failures/skips; 19/19 fresh and 19/19 idempotent migrations; outage/outbox replay and graph rebuild passed. |

### 4.2 Missing production evidence

All fourteen gates remain MISSING_EVIDENCE. F1.67 automation and maintainer-prepared inventories do not satisfy independent or operational review.

| # | Evidence gate | Current blocker |
|---:|---|---|
| 1 | Independent tenant-isolation and authorization review | No independent reviewer evidence; issue #14 remains open. |
| 2 | OIDC/SAML, email delivery, and MFA recovery end-to-end | No deployment-backed identity-provider E2E evidence. |
| 3 | Live ClamAV, malicious-file corpus, and legacy-asset quarantine | No live scanner corpus or legacy quarantine evidence. |
| 4 | Live S3/GCS/Azure-compatible provider credentials and least privilege | No live cloud provider or least-privilege operational proof. |
| 5 | Stripe webhook replay, ambiguous outcomes, and inventory lifecycle | No production-like payment lifecycle/replay evidence. |
| 6 | Full Playwright editor journeys and WCAG-focused acceptance | Browser smoke passed; full editor journeys and accessibility acceptance remain open. |
| 7 | Commerce parity acceptance | Tax, shipping, coupon, refund, fulfillment, digital download, and subscription acceptance remain open. |
| 8 | Community parity acceptance | Group privacy, spam/abuse, search, export/deletion, and forum acceptance remain open. |
| 9 | Signed plugin pipeline and adversarial container isolation | No signed plugin distribution or container isolation evidence. |
| 10 | Human-reviewed dependency audit, SBOM/provenance, and CodeQL | Automated CI/SBOM generation passed; qualified human review and formal evidence review remain incomplete. |
| 11 | Load/soak, fault injection, backup/restore, and recovery | No measured load/soak or tested restore/recovery evidence. |
| 12 | Independent platform security assessment and severe-finding remediation | No independent assessor report or verified severe-finding closure; issue #25 remains open. |
| 13 | Deployment runbooks, secrets, rollback, monitoring, and release-owner approval | No accountable operations/release approval package. |
| 14 | Production OTLP observability, security, governance, ownership, and delivery | No deployment-approved production OTLP backend manifest. |

The two PARTIAL classifications are not hidden PASS results: clean install and automated audit do not close human dependency/license review, and unavailable service-dependent tests remain skipped in the service-less suite.

## 5. Hosted and local validation

### 5.1 Candidate PR workflow #1272

[Workflow #1272 / run 45087499845](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45087499845) succeeded on PR head 50daa6440dea5f0e209fcb0885ab6a8592c4c331. Node 22/24, PostgreSQL and Memgraph integration, browser smoke, CodeQL, CodeQL security, and candidate evidence consolidation passed. The dependency/SBOM attestation job was skipped as designed on PR events; it is mainline-only.

Live evidence records 194/194 passed, zero failures/skips, and disposable database cleanup. Migration evidence records 19/19 fresh applies and 19/19 idempotent skips on re-entry. Memgraph outage/outbox replay and canonical graph rebuild passed. Both Node jobs passed 809 Hub tests and 94 EnginEx tests, and their CycloneDX component inventories and dependency graphs matched across runtimes.

Candidate readiness artifact:
- Artifact ID: 14779074502
- ZIP size: 40,344 bytes
- ZIP SHA-256: 465a9d70dc6932ca240b04c89dcd80bb9326c13bc36524d4fe27b96c3989eb35
- release-readiness.json SHA-256: 20dc4ba21e95a51e84c38f164057a08700d8179e301ebb76a7d59937699d2fac
- Live database producer manifest SHA-256: c9e985a190484c905ae98e619dbadb6b9d85c6e6297c095e98878f9f186df2ec

This is a PR candidate artifact, not the post-merge mainline artifact.

### 5.2 Local maintainer checks

| Check | Result | Interpretation |
|---|---|---|
| Node.js 26.12.1 npm run check | 809 total; 806 passed; 0 failed; 3 conditional platform skips | Full local suite passed; platform skips are disclosed. |
| Focused library/version-binding suite | 21 total; 20 passed; 0 failed; 1 service-dependent integration skip | Unit/route coverage passed; local DB services were unavailable. |
| Tenant-isolation inventory | 28 families / 80 declared route patterns / 22 source files / 61 test files | Maintainer-prepared, not independently reviewed. |
| Inventory freshness | PASS | npm run security:tenant-inventory -- --check passed. |
| Whitespace/conflict check | PASS | git diff --check passed. |
| Local EnginEx suite | 94 total; 91 passed; 0 failed; 3 conditional Windows skips | No EnginEx code changed in the final F1.67 fix; hosted matrix passed 94/94. |
| Clean npm ci | PASS | Windows x64 / Node.js 26.12.1; 167 packages installed. |
| npm audit | PASS | --audit-level=high reported zero vulnerabilities; not a substitute for human dependency review. |
| CycloneDX SBOM | PASS | CycloneDX 1.5; 200 components / 201 dependency records. |
| Playwright Chromium smoke | PASS | Configured smoke suite had zero failed tests; not full WCAG/screen-reader acceptance. |
| Memgraph outage/replay | PASS | Durable event remained pending during outage, replayed after restart, and was not delivered twice. |
| Canonical graph rebuild | PASS | Tombstones preserved, stale nodes removed, safety limit honored, second rebuild deterministic. |
| Library-object reconciliation dry run | PASS | Isolated test DB/temp directory; no deletion candidates and no deletions. |

Inventory source SHA-256: 5738927223a4fe04732978e5833776e8452f02836d49848f846f1e31a2e2772a
Inventory test-reference SHA-256: 2d7d9c687bbc5d1ba1e57cc3313a2e305eeb1bd3324cc10be051acacede69610

### 5.3 Exact-main workflow - completed

Post-merge exact-main workflow [#45088000378](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45088000378) completed success at 2026-11-23T00:22:16Z on exact main SHA 4da6f26730ff0634ffe01f85790bedf0a255c4e3. GitHub reports all 7/7 jobs successful:

| Job | Result |
|---|---|
| Unit, security, dependency checks - Node 22.23.4 | PASS |
| Unit, security, dependency checks - Node 24.22.1 | PASS |
| PostgreSQL and Memgraph integration | PASS |
| Browser editor and accessibility smoke | PASS |
| CodeQL security analysis | PASS |
| Attest dependency lockfile and SBOM | PASS |
| Consolidate candidate CI evidence | PASS |

Exact-source release-readiness artifact 14779454147 (mainline-release-readiness-1281.zip) was generated at 2026-11-23T00:22:12.856Z. It records sourceRevision 4da6f26730ff0634ffe01f85790bedf0a255c4e3, a clean source tree, clean pinned EnginEx submodule at d99e021f55664f006b5e65b4a58202f9c7bc4f4b, ciStatus PASS, required attestation jobStatus success, and readiness 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN. The artifact generator captured workflowRun.status as in_progress because it ran shortly before the aggregate GitHub workflow finished; GitHub final run API independently confirms completed/success at 00:22:16Z. The artifact itself does not assert the overall workflow conclusion or production certification.

Canonical mainline readiness artifact:
- Artifact ID 14779454147; size 40,213 bytes.
- ZIP SHA-256: 2b4166717a52bf2e4c3b486414d6005a87ca3f3937ad0522af0ed37d9ca7d240.
- release-readiness.json SHA-256: 0e056623c2fd9df9dbe12e5436754cadb3bd8bf17cad1048e7873210bd48ed90.
- release-readiness.md SHA-256: d938e87e6151e7e4b46c7df13ed7d6e32392124d9083a77b35519a1362e8a8de.
- release-readiness-ci.json SHA-256: cc1b38bc39006f4696272878ee07cc76c2fd76a02f66c052d6b7fd6c7eaea217.
- Live PostgreSQL/Memgraph producer manifest SHA-256: 505351c76773b7d26d5f395c7e7fefbb64895cf30f6dcc19b56a8163b31c589d.
- Live database evidence JSON SHA-256: bf0737e47b6772b0a1108608839d4086b6ac07676a394622788f050098d3207d.

Exact-main live integration passed 194/194 tests, zero failures and zero skips. All 19/19 migrations applied on the fresh disposable database; all 19/19 were recognized as already applied on idempotent re-entry. Memgraph outage/outbox replay and canonical graph rebuild passed, and disposable database cleanup succeeded.

Mainline-only signed supply-chain attestation artifact:
- Artifact ID 14779528541; size 145,337 bytes.
- ZIP SHA-256: e741ac7fcd91658da581eab051db999c1eab1ee839f93cdd535925203c1eb895.
- verification-summary.json SHA-256: 2c9702b3fedc91e53a2fde4e54e354d430cee4fadb3dbde16e01e45dc7c9f6cc.
- Attested package-lock.json SHA-256: 8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086.
- Attested virgoscorpio-hub.sbom.cdx.json SHA-256: 6c056ef27cf76732af7c7ac72d380cf246aa4c74c22a5b20f9c81e1fecb4e654.
- Provenance subject binding matches main SHA 4da6f26730ff0634ffe01f85790bedf0a255c4e3 and refs/heads/main. The GitHub attestation job passed; the artifact includes a Sigstore bundle and Rekor transparency-log inclusion proof. This verifies supply-chain provenance for these subjects, not human dependency/license approval.

The PR candidate artifact #14779074502 remains separately source-bound to its synthetic PR merge ref and is not the exact-main artifact above. The exact-main run is complete; NO-GO is caused by missing independent, operational, and acceptance evidence, not a failing mainline CI job.
### 5.4 Latest exact-main baseline after documentation PR #294

Main is fccd708a439efd3e29cc7fd0b1da00a8ab9d1b7d after documentation-only PR #294. Exact-main workflow [#45096332836](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836) completed success with all 7/7 jobs: Node 22.23.4, Node 24.22.1, live PostgreSQL/Memgraph integration, browser editor/accessibility smoke, CodeQL, signed lockfile/SBOM attestation, and exact-source evidence consolidation.

Canonical current readiness artifact [#14783736045](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836/artifacts/14783736045), ZIP SHA-256 da110efa0f422c6ad6193884831d3b8692557ab75a1dacef821fc5a6a096ac02; readiness JSON SHA-256 83838a770034b091c6321a54e450a9df250ed053b43e88dc87155a0fe88cee78; readiness Markdown SHA-256 2212f7a26d6ff08d7ad8c83088fb9ac722c1e556361ee92120a1e4c93ed596e5. The exact-main classification remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

Live integration passed 194/194 tests, zero failures/skips, 19/19 fresh migration applications, and 19/19 idempotent re-entry checks. The existing Memgraph outage/outbox recovery and canonical graph rebuild coverage also passed. Mainline signed supply-chain artifact [#14783183173](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45096332836/artifacts/14783183173), ZIP SHA-256 262cfe46b7501c07eef812e0a50c2ef9cee3d49b43931bb4fce63188a9958a2e; verification summary SHA-256 2b78a9cd6da63020527f29b35dfb677c20208474330c339431b9deec2543e5fd. Provenance is bound to fccd708 and refs/heads/main. It verifies lockfile/SBOM provenance, not human dependency/license approval.

This is the current main baseline for F1.68 review. F1.68 remains branch-only and does not alter these readiness counts.


## 6. Security, governance, and scanner follow-up

Independent assurance items remain open:
- [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): independent tenant-isolation/authorization review. Generated route inventory is maintainer evidence only.
- [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23): qualified dependency/license review.
- [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25): independent platform security assessment and severe-finding remediation.

Aikido fingerprint mapping remains open in [#234](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/234), [#235](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/235), and [#277](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/277). The 20 November vendor snapshot reported 12 SAST findings (3 high, 5 medium, 4 low) and one low secret-history finding. These are historical aggregate counts, not a current fingerprint-level disposition. Do not call an alert fixed until exact fingerprint, affected asset/path, remediation, rescan, and closure evidence are mapped. The 1970 last-occurrence value associated with the domain scan must be checked against scanner execution metadata; it is not by itself evidence of exploitability, a false positive, or scanner outage.

Recommended security next step: export current Aikido fingerprints and triage the three high-severity SAST findings first, then medium/low findings and secret-history exposure. Verify the actual domain scan execution/freshness before changing #235. Avoid bulk-closing or blindly merging bot-generated remediation PRs.

## 7. Release blockers and next actions

1. Preserve exact-main run #45088000378, readiness artifact #14779454147, live database producer evidence, and signed supply-chain artifact #14779528541 as the current source-bound mainline baseline. Re-run the gate after each substantive remediation.
2. Complete fingerprint-by-fingerprint Aikido triage, starting with three high-severity findings; verify scanner freshness rather than inferring from the date field.
3. Schedule independent tenant-isolation review #14 and independent platform security assessment #25. Track findings to code, regression tests, and independent closure evidence.
4. Complete qualified dependency/license/SBOM/provenance review #23 and formalize CodeQL review.
5. Close remaining identity, malware, cloud provider, Stripe, accessibility, commerce, community, plugin isolation, load/restore, operations, and production observability gates with version-bound artifacts.
6. Re-run the release gate against exact main after each substantive fix. Do not promote 0.6.2 until every required gate is satisfied and the release owner explicitly approves.

## 8. Versioning and release boundary

F1.67 is merged into the 0.6.2 private/unreleased patch candidate. No package version, SemVer, dependency, lockfile, API, or object-storage URL change was made. The merge does not imply publication, certification, release tag, or deployment.

**Final decision: NO-GO.** Keep 0.6.2 private and unreleased until all independent, operational, security, and acceptance evidence is complete and revalidated on exact main.

## 9. Primary records

- [PR #293 - F1.67 public media source-version binding](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/293)
- [Issue #292 - F1.67 acceptance criteria](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/292)
- [Candidate workflow #1272 / run 45087499845](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45087499845)
- [Post-merge exact-main workflow #45088000378](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45088000378) - completed success, 7/7 jobs
- [Mainline readiness artifact #14779454147](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45088000378/artifacts/14779454147)
- [Mainline signed supply-chain artifact #14779528541](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45088000378/artifacts/14779528541)
- [Main branch ruleset #27803491](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/rules/27803491)
