# VirgoScorpio Hub 0.6.2 — Release Gate Report
> **Latest status — 11 November 2026:** PR #119 merged at main SHA 97f11434a211f982b539ef11effd5b7432b5e4a9. Workflow #527 passed core runtime/integration/browser/CodeQL jobs but failed attestation verification due mutually exclusive GitHub CLI options; the evidence aggregator failed closed. CodeQL identified medium alert #38 in SBOM process invocation. The corrective patch is tracked on security/supply-chain-attestation-codeql-2026-11-11; see the 11 November supply-chain remediation report. Issue #23 remains OPEN / PARTIAL, independent release gates remain incomplete, and production remains NO-GO. The detailed body below remains the 10 November historical snapshot.



> **DECISION: NO-GO FOR PRODUCTION.** VirgoScorpio Hub 0.6.2 remains a private, unreleased, isolated self-hosted developer preview. The current candidate has strong hosted maintainer CI evidence and a remediated LOW dependency advisory, but independent security, qualified legal/license, provider, operations, governance, formal supply-chain acceptance, and release-owner gates remain incomplete. This report is an engineering evidence snapshot, not production authorization, legal advice, or an independent security assessment.

- **Snapshot:** 10 November 2026 (America/Chicago)
- **Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
- **Package:** `virgoscorpio-hub@0.6.2` — `private: true`, unreleased
- **Runtime floor:** Node.js `>=22.23.4`
- **Pinned package manager:** npm `11.19.1`
- **Historical main baseline (10 November):** c7653bb433ae8b363925d13babf239e64b2b5125 (PR #118 merge)
- **Issue #23 candidate branch:** `security/dependency-supply-chain-review-2026-11-10`
- **Candidate code/lockfile SHA validated by CI:** `17ba575114e1ee9576e49c7ae456a1af0280b6fc`
- **Historical baseline CI:** [workflow #522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42879875157)
- **Candidate CI:** [workflow #524](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42950578389)
- **Primary open gate:** [Issue #23 — Review lockfile, SBOM, provenance, dependency scan and CodeQL evidence](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)

This report supersedes the 9 November release-gate snapshot for current decision-making. It distinguishes the merged `main` baseline from the unmerged issue #23 candidate. Workflow #524 validates code and lockfile SHA `17ba575114e1ee9576e49c7ae456a1af0280b6fc`. This report and its companion documentation updates are a subsequent docs-only change; the resulting final PR head must receive its own CI run before merge.

## 1. Executive decision

Retain version **0.6.2** as an **isolated, self-hosted, non-production developer preview**. The current mainline has six-job maintainer CI coverage, and the issue #23 candidate branch now includes a compatible lockfile remediation for a newly published LOW parser advisory, lockfile-only CycloneDX generation, SBOM root normalization tests, and a main-only signed attestation workflow.

Candidate workflow #524 completed all six non-attestation jobs successfully: both supported Node.js dependency/unit/security jobs, live PostgreSQL/Memgraph integration, browser smoke, CodeQL, and consolidated checksum-bound CI evidence. The main-only signer job was **skipped by design** because the workflow ran on a feature branch rather than `main`. Provenance and SBOM attestations have therefore not yet been generated or verified for a mainline candidate.

The formal release-readiness snapshot remains **7 PASS, 2 PARTIAL, 1 BLOCKED, 14 MISSING_EVIDENCE**, with `readyForProduction: false`. Green candidate CI does not erase human or independent acceptance requirements, nor the separate formal readiness contract that expects exact-revision gate evidence.

**Production disposition: NO-GO / NOT_PRODUCTION_CERTIFIED.** Do not create a release tag, publish a package, deploy to production, expand supported-runtime claims, or describe this build as independently security-certified.

## 2. Source and candidate boundaries

| Reference | Revision / state | Meaning |
|---|---|---|
| `main` | `c7653bb433ae8b363925d13babf239e64b2b5125` | Historical 10 November merged product baseline; includes PR #118 |
| Issue #23 branch | `17ba575114e1ee9576e49c7ae456a1af0280b6fc` | Two commits ahead of main at the CI evidence snapshot; no intended runtime/API/schema change |
| Workflow #522 | Run 42879875157 | Exact-mainline validation for current main; predates the candidate's lockfile and CI changes |
| Workflow #524 | Run 42950578389 | Exact candidate validation; feature-branch attestation job skipped |
| Release package | `0.6.2` | Private, unreleased preview candidate |
| EnginEx submodule | `d99e021f55664f006b5e65b4a58202f9c7bc4f4b` | Pinned vendor source; do not update it as part of this slice |

PR #118 merged the cloud-connection tenant-isolation regression and closed issue #117. Its Site B-only `cloud:manage` coverage verifies list isolation, non-disclosing foreign-ID `/test` and `/disable` responses, selector-conflict rejection, unchanged Site A/Site B row snapshots, and positive same-site controls. Tests use unresolved `vault://` references and do not make provider network calls. These are targeted maintainer regression tests, not independent tenant-isolation acceptance.

## 3. Latest candidate CI evidence — workflow #524

Workflow #524 ran against exact candidate code/lockfile SHA `17ba575114e1ee9576e49c7ae456a1af0280b6fc` on 10 November 2026 local time. All six non-attestation jobs succeeded:

| Job | Result | Evidence and boundary |
|---|---|---|
| Unit, security and dependency checks — Node 22.23.4 | **PASS** | Fresh `npm ci`; syntax/artifact verification; Hub tests **589/589**; EnginEx tests **94/94**; full and production npm audits each reported **0 vulnerabilities**; CycloneDX generation passed. |
| Unit, security and dependency checks — Node 24.22.1 | **PASS** | Pinned npm install, checks, both npm audit scopes and CycloneDX generation completed successfully; revision-bound evidence uploaded. |
| PostgreSQL and Memgraph integration | **PASS** | Dedicated PostgreSQL/Memgraph/Redis services; live integration **82/82**, zero failures/skips; fresh migrations **18/18 applied** and **18/18 idempotent skips**; PostgreSQL-backed collaboration Playwright **3/3**; Redis restoration, Memgraph outage/replay and graph rebuild passed. |
| Browser editor/accessibility smoke | **PASS** | Hosted automated browser smoke job completed successfully. This is not manual WCAG or screen-reader acceptance. |
| CodeQL security analysis | **PASS — execution only** | Security-extended JavaScript CodeQL workflow completed. Alert disposition and independent security review remain separate tasks. |
| Consolidate candidate CI evidence | **PASS** | Aggregator reported `CI EVIDENCE: PASS`; expected producers, revisions and checksum-bound artifacts were consolidated. |
| Attest dependency lockfile and SBOM | **SKIPPED — expected** | Restricted to successful non-PR runs on `refs/heads/main`. No failure occurred; this feature-branch run does not prove that signing or verification succeeded. |

Nine non-expired workflow artifacts were uploaded, including Node 22/24 dependency evidence, checksum-bound producer evidence, live integration evidence, and consolidated release-readiness evidence. Artifacts are bound to workflow #524 and its source revision. Do not copy them into another commit's source tree or relabel them as mainline evidence.

### Dependency and SBOM outputs

Both Node jobs reported **CycloneDX 1.5**, **200 components**, **201 dependency records**, and **zero components without an identified license**. Both jobs used the same lockfile bytes:

- `package-lock.json` SHA-256: `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`
- Node 22 SBOM SHA-256: `be7ffdab7c8b9934e14043d50ff793d1d4933b5422001d23f26254f129aa409c`
- Node 24 SBOM SHA-256: `0c185bac3c0dcba11af50619ad50367c5e45eb47a8b894d573e9efb961851d1c`

The two SBOM file hashes are intentionally reported separately: generation metadata differs by runtime job. Component/dependency counts and normalized package inventory are the comparison targets; do not claim the raw files have identical SHA-256 digests.

The license inventory contains one `GPL-2.0-or-later` EnginEx component and LGPL-bearing optional Sharp/libvips components, including combined license expressions. Zero unidentified licenses is an inventory-quality result, **not** a legal compliance determination.

### Live data and recovery evidence

The PostgreSQL/Memgraph job created and dropped only its isolated disposable migration database; applied all **18** versioned migrations and confirmed **18** idempotent skips; ran **82/82** live integration tests without failures or skips; and passed the PostgreSQL-backed collaboration browser case (**3/3**). The test restored the exact disposable Redis service and verified recovery. Memgraph outage/replay and canonical graph rebuild also passed; the rebuild retained tombstones, removed stale nodes, respected the safety bound, and was deterministic on a second pass.

This qualifies those scenarios on the hosted test topology. It does not qualify production workload capacity, provider availability, disaster recovery, backup/restore, or independent security.

## 4. Supply-chain change and advisory disposition

The candidate branch addresses [GHSA-474x-hrwr-fgx4](https://github.com/advisories/GHSA-474x-hrwr-fgx4) / **CVE-2026-126066**, published 10 November 2026. The advisory is LOW severity (CVSS 3.1 **3.7**) and describes quadratic CPU consumption in `fast-xml-parser` when the non-default `stopNodes` option is enabled and malformed unterminated tag fragments are parsed. The affected locked version was `5.11.2`; the fixed version is `5.12.0`. See the [OSV advisory record](https://osv.dev/vulnerability/GHSA-474x-hrwr-fgx4).

The lockfile remediation is:
- `fast-xml-parser`: `5.11.2` → `5.12.0`.
- `is-unsafe`: `2.0.2` → `2.0.3`.
- Other parser dependency ranges are satisfied by already-locked compatible versions.
- `package.json`, direct dependencies, product version and public/runtime APIs are unchanged.

The relevant repository source trees were searched for explicit `stopNodes` configuration and none was found. That reduces evidence of direct use but does not prove the option is unreachable in every optional SDK or deployment path. Updating the vulnerable transitive resolution is still the safer compatible choice.

A fresh local Windows `npm ci` and hosted Node 22/24 clean-install jobs passed. Full-tree and production-only npm audit checks each reported zero vulnerabilities on the updated lockfile. npm audit is limited to advisories known to its database at check time; it is not proof that dependencies are safe, maintained, non-malicious, or free from unknown vulnerabilities.

## 5. Lockfile, SBOM generator and maintainability review

The maintainer inventory records:

- npm lockfile v3 with **205** non-root package entries.
- **16** direct runtime, **1** direct development, and **4** direct optional dependencies.
- **203/203** remote resolutions use HTTPS and carry integrity metadata.
- No remote package resolution outside `registry.npmjs.org`.
- No locked package has `hasInstallScript` set.
- No root manifest/lock dependency mismatch.
- Local `enginex-ai-native` is supplied by the pinned `vendor/enginex` submodule.
- Lock metadata records EnginEx's `GPL-2.0-or-later` license, aligning it with the checked-out vendor package metadata. This is not license clearance.

The SBOM generator uses one frozen argument list across npm's `npm_execpath` and fallback invocation paths. It uses `--package-lock-only`, normalizes root component name/version from `package.json`, validates the root `bom-ref` and PURL, serializes once, then hashes the exact bytes written. Windows fallback invocation is explicit and avoids shell-string interpolation. Tests cover invocation parity, fallback selection, spawn diagnostics, root normalization and rejection of mismatched package identity.

This targeted implementation reuses the existing normalization module and shared argument constant rather than duplicating flags or creating a second SBOM generation path. It does not add runtime dependencies or change public APIs/schema. No obvious high-severity implementation defect was identified in the reviewed issue #23 diff; this is maintainer review, not an independent audit or final post-documentation PR review.

The npm CLI's `--package-lock-only` option inventories lockfile data rather than incidental `node_modules` state. See the [npm SBOM documentation](https://docs.npmjs.com/cli/v11/commands/npm-sbom).

## 6. Formal release-readiness snapshot

The latest candidate readiness generator reports:

| Classification | Count | Interpretation |
|---|---:|---|
| PASS | 7 | Source identity/clean-tree, supported runtime, versioned migration files, artifact/syntax check, Hub tests, EnginEx tests, Playwright dependency availability. |
| PARTIAL | 2 | Human review of the committed lockfile; service-less PostgreSQL/Memgraph integration subset in the Node matrix. |
| BLOCKED | 1 | Formal fresh/upgrade/database evidence contract is not satisfied by the local readiness snapshot. This is separate from the successful exact-run live database job artifact. |
| MISSING_EVIDENCE | 14 | Independent, provider, product, operations and formal release records remain absent. |
| NOT_RUN | 0 | No readiness rows were classified as not run. |

The missing evidence groups span:
1. Independent tenant-isolation/authorization review.
2. OIDC/SAML, email delivery and MFA/account-recovery end-to-end evidence.
3. ClamAV integration, malicious-file corpus and legacy-asset quarantine.
4. Live S3/GCS/Azure compatibility, permissions and lifecycle.
5. Stripe webhook replay, ambiguous-outcome recovery and inventory lifecycle.
6. Full Playwright editor journeys and manual WCAG/screen-reader acceptance.
7. Commerce parity: tax, shipping, coupons, refunds, fulfillment, downloads and subscriptions.
8. Community parity: group privacy, abuse controls, search, export/deletion and forums.
9. Signed plugin build and adversarial container-isolation evidence.
10. Formal human dependency/SBOM/provenance/CodeQL review.
11. Load/soak, fault injection, backup/restore and measured recovery drills.
12. Independent platform security assessment and severe-finding remediation.
13. Deployment/runbook, secrets/rollback, monitoring and authorized release approval.
14. Production OTLP backend/security/governance/ownership and delivery evidence.

Workflow success does not reduce these categories by itself. The candidate remains `readyForProduction: false`; `npm run release:assert-ready` must continue to fail closed until its canonical evidence contracts are satisfied.

## 7. GitHub issue disposition

| Issue | Priority | Status | Required next action |
|---|---|---|---|
| [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13) | P0 | **OPEN** | Authorized release owner must accept the exact 0.6.2 scope, name provider/operations owners and record decision authority/date/exact SHA. |
| [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) | P0 | **OPEN / NOT PERFORMED** | Commission an independent assessor for their own route discovery, two-tenant adversarial review, findings and retests. Maintainer inventories/tests are review aids only. |
| [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) | P1 | **OPEN / PARTIAL** | Complete human dependency/maintenance/license/distribution review, exact-SHA CodeQL alert disposition, mainline attestation verification and formal reviewer acceptance. |
| [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24) | P1 | **OPEN** | Approve topology/workload/SLO budgets and perform load/soak/fault plus full PostgreSQL/graph/object backup-restore with measured RPO/RTO. |
| [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) | P0 | **OPEN** | Commission a separate independent platform security assessment and independently retest findings. CodeQL is not an independent assessment. |
| [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) | P0 | **OPEN** | Name release/on-call/database/cache/storage/security owners; approve topology and rehearse migration, rollback, recovery, secret rotation and incident response. |
| [#32](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/32) | P0 | **OPEN** | Authorized governing persons and qualified legal/tax advisors must resolve authority, capital, jurisdiction and legal obligations. |
| [#117](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/117) | — | **CLOSED** | Closed by merged PR #118; targeted regression work is complete. |
| [#113](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/113) | — | **CLOSED / ACCEPTED** | F1.20 accepted for its restricted developer-preview reliability scope only. |

Issues remain independent gates. Do not close #14/#25 on maintainer-authored tests, close #23 on green automation alone, or infer approval of #13/#26/#32 from engineering work.

## 8. Architecture, stability and security boundaries

No runtime/public API, database schema, migration, data model or provider contract change is intended in the issue #23 branch. The source changes are limited to the lockfile, SBOM generation/normalization/testing, supply-chain workflow and evidence/documentation.

Preserve these architecture invariants:
- **PostgreSQL is authoritative** for transactional application state.
- **Memgraph is a rebuildable relationship projection**, fed through the PostgreSQL transactional outbox.
- **Redis Pub/Sub and presence are ephemeral**; outage-time hints are not durable or replay-guaranteed.
- Tenant/site predicates and capability checks are required before side effects. Targeted two-site maintainer regressions do not prove exhaustive route coverage.
- Cloud-connection test fixtures retain unresolved `vault://` references; provider connectivity and least-privilege credentials are not qualified.
- Production library upload scanning remains fail-closed when required; existing `not_scanned` assets are not assumed clean.
- Disposable CI recovery tests do not certify production topology, scaling, high availability, restore integrity, retention, key rotation or incident response.

## 9. SemVer and release boundary

The dependency fix updates compatible transitive lockfile resolutions and internal SBOM/evidence tooling. It does not change direct dependencies, runtime/public interfaces, schema or migrations. Package metadata remains **0.6.2** and `private: true`.

No SemVer increment is proposed. Do not create a tag, GitHub Release, npm publication or production deployment. Preserve the developer-preview classification until the authorized release owner approves scope and every applicable gate is satisfied.

## 10. Standards and specification review

### Standards review
- Contribution guidance calls for focused diffs, automated regression tests, authorization/input safety, fail-closed behavior, documentation updates and reviewed evidence.
- The SBOM CLI flags are shared and frozen; normalization remains centralized; tests cover fallback invocation and package identity invariants.
- The patch avoids a new runtime dependency, a duplicate SBOM normalizer, API contract changes and database migrations.
- No obvious high-risk code smell or documented-standard violation was identified in this targeted maintainer review. Final review must inspect the final PR head, including this documentation update.

### Issue #23 acceptance specification

| Acceptance criterion | Assessment |
|---|---|
| Review direct/transitive dependencies, versions, optional/native packages, install scripts, licenses and advisories | **PARTIAL** — machine inventory/advisory review recorded; qualified human maintenance and license/distribution review remains required. |
| Compare committed lockfile with clean `npm ci`; explain deltas | **AUTOMATION PASS / HUMAN REVIEW OPEN** — fresh install and structural consistency pass; maintainer approval still required. |
| Review CycloneDX completeness against candidate dependency graph | **AUTOMATION PASS / HUMAN REVIEW OPEN** — 200/201 lockfile inventory on both supported runtimes; license/platform review remains. |
| Retain build provenance, attestations and digest verification | **NOT MET** — signer implementation exists, but the main-only job was skipped on the branch and must pass after authorized merge. |
| Run npm audit/dependency scan and CodeQL on exact candidate revision | **AUTOMATION PASS** — workflow #524 exact candidate jobs passed; npm audit scopes reported zero; human CodeQL alert disposition remains. |
| Remediate or formally risk-accept critical/high dependency/code findings | **PARTIAL** — discovered LOW advisory fixed; exact-SHA CodeQL alert triage and formal dispositions remain. |
| Record reviewer/date/exact commit/reports/caveats | **PARTIAL** — maintainer evidence is recorded; qualified reviewer identity and acceptance remain absent. |

The automation portion is materially advanced but the formal issue is not accepted.

## 11. Prioritized next development steps

1. **Finish the issue #23 PR review.** Validate the final documentation commit with PR CI, inspect the final diff and the signed-workflow conditions, preserve the exact evidence artifacts, and keep issue #23 open until human review is recorded.
2. **Verify mainline supply-chain attestations after an authorized merge.** Require the main-only job to pass on the resulting main SHA; inspect the provenance and SBOM bundles, signer workflow/certificate identity, source ref/full source digest, subject SHA-256 values and CycloneDX predicate equality. Record run/attempt and artifact IDs.
3. **Complete independent assurance.** Commission #14 tenant-isolation assessment and #25 broader security assessment against clean exact-SHA checkouts, using independent route discovery, synthetic two-site data, findings, fixes and independent retests.
4. **Resolve governance/scope/operations ownership.** Obtain authorized decisions for #13 and #32; name accountable release/on-call/database/cache/storage/security owners and rehearse deploy/rollback/recovery/monitoring/incident processes under #26.
5. **Qualify resilience.** With approved topology and workload budgets, execute load/soak/fault tests and full PostgreSQL/graph/object backup-restore with measured RPO/RTO under #24.
6. **Recompute formal readiness.** Only after evidence owners accept each gate, generate canonical evidence for the exact clean candidate SHA and require `npm run release:assert-ready` to pass.

Do not advance unrelated P1 product features while critical independent-security, supply-chain, governance and operational gates remain open.

## 12. Evidence and limitations

- [Candidate workflow #524](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42950578389) — exact code/lockfile SHA `17ba575114e1ee9576e49c7ae456a1af0280b6fc`.
- [Historical mainline workflow #522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42879875157) — current main SHA `c7653bb433ae8b363925d13babf239e64b2b5125`.
- [Issue #23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23); [Release Blocker Triage](RELEASE-BLOCKER-TRIAGE-2026-11-10.md); [Maintainer Supply-Chain Review](2026-11-10-SUPPLY-CHAIN-REVIEW.md).
- [Release Scope](../RELEASE-SCOPE.md), [Release Readiness](../RELEASE_READINESS.md), [Release Evidence Contract](../RELEASE-EVIDENCE.md), [Roadmap](../ROADMAP.md), and [Implementation Roadmap](../IMPLEMENTATION-ROADMAP.md).
- The [GitHub CLI attestation verification manual](https://cli.github.com/manual/gh_attestation_verify) documents verification controls for signer/workflow identity, predicate type, source ref/digest and hosted-runner constraints.
- The assistant inspected GitHub Actions job summaries/logs and the selected local Windows worktree. The original parent checkout contains user-owned uncommitted files and was not changed. The dedicated issue #23 worktree has the expected branch/head; its EnginEx submodule worktree is locally marked dirty and was left untouched.

**Final disposition: RELEASE GATE NOT SATISFIED. Continue restricted developer-preview classification; production NO-GO / NOT_PRODUCTION_CERTIFIED.**
