# VirgoScorpio Hub 0.6.2 Ã¢â‚¬â€ Maintainer Supply-Chain Review
> **11 November 2026 final mainline continuation:** PR #121 is merged at exact main SHA `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d`. Mainline push workflow [#538](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43068232804) passed all seven jobs. The main-only signer verified SLSA provenance for the lockfile and CycloneDX SBOM, the signed SBOM attestation, exact repository/workflow certificate identity, `refs/heads/main`, full source SHA, both subject digests and equality of the signed CycloneDX predicate with the generated SBOM. Run-bound artifact `13875954614` is retained through 9 February 2027 (archive digest `sha256:099cca5a896e6695adbecd678167235b93a9287bc6cb0275761337277e8b7872`). Node 22/24 each passed 590/590 Hub and 94/94 EnginEx tests; both npm audit scopes reported zero vulnerabilities; CycloneDX 1.5 contains 200 components / 201 dependency records. Live PostgreSQL/Memgraph/Redis integration passed 82/82 with zero skips, PostgreSQL collaboration browser passed 3/3, browser/accessibility smoke passed 9/9, Memgraph outage/outbox replay and canonical graph rebuild passed, CodeQL passed and consolidated evidence reported `CI EVIDENCE: PASS`. CodeQL alert #38 is fixed and the open main-alert query is empty. Earlier workflows #532/#533 remain historical pre-fix failures because Playwright's `--with-deps` apt step encountered Ubuntu mirror DNS failure; the merged PR #121 removes that apt dependency. Qualified human dependency/maintenance/license/distribution review and formal issue #23 acceptance remain OPEN / PARTIAL.



> **STATUS: PARTIAL MAINTAINER REVIEW Ã¢â‚¬â€ NOT A COMPLETED RELEASE GATE, LEGAL OPINION, OR PRODUCTION APPROVAL.** This report records reproducible maintainer checks, a newly disclosed low-severity dependency advisory and its lockfile remediation, and outstanding human review. It does not substitute for qualified legal review or independent security assessment.

- **Snapshot date:** 10 November 2026
- **Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
- **Package:** `virgoscorpio-hub@0.6.2` Ã¢â‚¬â€ private, unreleased developer-preview candidate
- **Node engine floor:** `>=22.23.4`
- **Pinned package manager:** `npm@11.19.1`
- **Historical main baseline (10 November):** c7653bb433ae8b363925d13babf239e64b2b5125 (PR #118 merge)
- **Historical baseline CI:** [workflow #522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42879875157) Ã¢â‚¬â€ all six jobs passed on the 10 November PR #118 merge, before PR #119
- **Formal gate:** [Issue #23 Ã¢â‚¬â€ Review lockfile, SBOM, provenance, dependency scan and CodeQL evidence](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)
- **Production disposition:** **NO-GO / NOT_PRODUCTION_CERTIFIED**

**Current branch validation:** Windows x64, Node.js 26.12.1 and npm 11.19.1. A fresh `npm ci --ignore-scripts --no-audit --no-fund` completed successfully (178 packages added), followed by the repository-owned `npm run postinstall`, `npm run sbom`, both npm audit scopes, and `npm run check`. The unit/artifact check passed **586/589** tests (0 failures, 3 Windows-specific skips), checked 235 required artifacts and syntax-checked 243 JavaScript files. Full-tree and production-only `npm audit` each report **0 vulnerabilities after the lockfile remediation**. These are local maintainer results on Node.js 26.12.1, not the declared Node.js 22/24 support-matrix evidence or production certification.

**Latest hosted candidate validation Ã¢â‚¬â€ workflow #524:** Exact code/lockfile SHA `17ba575114e1ee9576e49c7ae456a1af0280b6fc` passed all six non-attestation jobs. Node.js 22 passed **589/589** Hub tests and **94/94** EnginEx tests; both supported Node jobs completed clean installs, zero-vulnerability full/production npm audits and CycloneDX generation. Live PostgreSQL/Memgraph/Redis integration passed **82/82**, fresh migrations **18/18 applied plus 18/18 idempotent skips**, and PostgreSQL-backed collaboration Playwright **3/3**; browser smoke, CodeQL and evidence aggregation also passed (`CI EVIDENCE: PASS`). The main-only attestation job was skipped by design on this feature branch. The [full release-gate report](2026-11-10-VirgoScorpio-Hub-0.6.2-Release-Gate-Report.md) records exact lockfile and per-runtime SBOM hashes. Candidate CI is maintainer evidence; mainline attestations and human acceptance remain outstanding.

## 1. Scope and evidence boundary

This review covers the package manifest and lockfile, the generated CycloneDX inventory, npm advisory results, install-script and package-resolution metadata, vendored EnginEx licensing metadata, and the existing hosted Node.js 22/24 dependency/CodeQL workflow.

The 10 November baseline workflow #522 completed both Node.js dependency/unit/security jobs, PostgreSQL/Memgraph integration, browser/accessibility smoke, CodeQL and evidence consolidation. It is bound to the 10 November main source revision and lockfile that existed before this follow-up branch. It did not execute the new main-only attestation job added by this branch; that job still requires PR review and a successful post-merge mainline run.

No package manifest, runtime API, database schema, migration, or product version change is included. The committed lockfile is deliberately updated below to remediate a newly reported transitive dependency advisory. No registry publication, release, tag, or deployment was performed.

## 2. Manifest and lockfile consistency

The reviewed worktree reports:

| Check | Result |
|---|---:|
| Package identity | `virgoscorpio-hub@0.6.2` |
| Package manager | `npm@11.19.1` |
| Node.js engine declaration | `>=22.23.4` |
| Lockfile format | npm lockfile v3 |
| Lockfile package entries (excluding root) | 205 |
| Direct runtime dependencies | 16 |
| Direct development dependencies | 1 |
| Direct optional dependencies | 4 |
| HTTPS package resolutions | 203 |
| Remote package entries with integrity metadata | 203 / 203 |
| Remote resolutions outside `registry.npmjs.org` | 0 |
| Locked packages marked with `hasInstallScript` | 0 |
| Root manifest/lock dependency mismatches | 0 |

The lockfile root package remains version 0.6.2 and all three direct dependency groups match `package.json`. The 203 remote package records resolve to the npm registry over HTTPS and include integrity hashes. The remaining entries include the local `enginex-ai-native` package supplied from `vendor/enginex`.

The lockfile metadata for the vendored `enginex-ai-native` component now records `GPL-2.0-or-later`, matching the checked-out EnginEx 7.0.0 package manifest. The repository's `THIRD-PARTY-NOTICES.md` points to the submodule LICENSE, COPYRIGHT and NOTICE files. This correction aligns generated lock metadata; it is **not** a license clearance.

The exact-mainline workflow #522 ran the repository's pinned npm 11.19.1 installation and verification jobs on Node.js 22.23.4 and 24.22.1. In this separate Windows worktree, a fresh `npm ci --ignore-scripts --no-audit --no-fund` also completed successfully and added 178 packages. Dependency lifecycle scripts were suppressed during installation; the repository-owned `npm run postinstall` asset-materialization step was run explicitly afterward. npm emitted a deprecation warning for optional transitive `node-domexception@1.0.0`, reached through the optional Google Cloud Storage dependency chain. This is an upstream maintenance warning, not an npm audit vulnerability; revisit it when that optional cloud-storage dependency is next upgraded.

## 3. CycloneDX SBOM

The maintainer SBOM is generated from the committed lockfile, not the incidental contents of `node_modules`, using `npm sbom --sbom-format=cyclonedx --package-lock-only --omit=dev`. The generator now applies the same frozen argument list whether npm is invoked through `npm_execpath` or the platform fallback. It normalizes the root component name, validates the root `bom-ref` and PURL against `package.json`, and hashes the exact serialized SBOM bytes written to disk.

| Field | Recorded value |
|---|---|
| Format | CycloneDX 1.5 |
| Components | 200 |
| Dependency records | 201 |
| Components without identified license | 0 |
| `package-lock.json` SHA-256 | `feb241bab593040a6e6f1397a832878d1b5ce1c495979cb6babad40fecf37fd8` |
| Normalized SBOM SHA-256 | `433b868aeb6d9d595655a4b23f5950a0bf6b82489c0acca12ecdf67e4108e9fa` |

The SBOM license expressions were summarized as follows:

| License identifier / expression | Components |
|---|---:|
| 0BSD | 1 |
| Apache-2.0 | 69 |
| Apache-2.0 AND LGPL-3.0-or-later | 3 |
| Apache-2.0 AND LGPL-3.0-or-later AND MIT | 1 |
| BlueOak-1.0.0 | 1 |
| BSD-3-Clause | 2 |
| GPL-2.0-or-later | 1 |
| ISC | 6 |
| LGPL-3.0-or-later | 10 |
| MIT | 106 |

The lockfile inventory includes optional platform-specific `sharp` native/wasm packages, so the SBOM inventory is not a claim that every platform-specific binary is installed together on one host. The vendored EnginEx component uses `GPL-2.0-or-later`. These licenses, combined-license terms, notices, source-offer and distribution obligations, linking/packaging model, optional-platform artifacts, and downstream redistribution conditions still require a human license reviewer and, where appropriate, qualified counsel. The automated SBOM does not determine legal compliance.

A directory-name variance was found during this review: npm initially emitted the SBOM root component's display name from the worktree basename even though its `bom-ref` and PURL were stable. The existing `scripts/normalize-sbom.js` is now applied before hashing and writing. A regression test verifies root normalization, deterministic serialized bytes and rejection of mismatched package identity. A second test verifies that both npm invocation paths use the same lockfile-only inventory flags.

Machine-readable SBOM and generation evidence are retained alongside this report:

- `artifacts/evidence/supply-chain-review-2026-11-10/virgoscorpio-hub.sbom.cdx.json`
- `artifacts/evidence/supply-chain-review-2026-11-10/sbom-generation.log`

The local Windows SBOM remains a maintainer diagnostic snapshot, not the final release SBOM or a substitute for the supported-runtime CI artifacts. CI compares normalized CycloneDX inventories on both supported Node.js runtimes; the mainline #522 workflow predates this follow-up's lock-only generation change.

## 4. npm advisory discovery and remediation

The first full-tree and production-only audit of this branch's original lockfile found one **LOW** advisory. The lockfile resolved `fast-xml-parser@5.11.2` through optional Azure Blob and Google Cloud Storage dependency paths. npm reported the same advisory in the production-only audit because these are optional production dependency paths.

| Advisory | Affected locked version | Fixed version | Severity |
|---|---|---|---|
| [GHSA-474x-hrwr-fgx4](https://github.com/advisories/GHSA-474x-hrwr-fgx4) / CVE-2026-126066 | `fast-xml-parser@5.11.2` | `5.12.0` | CVSS 3.1 3.7 Ã¢â‚¬â€ Low |

The advisory describes quadratic CPU consumption in the parser's stop-node parsing path when the non-default `stopNodes` option is enabled and malformed unterminated tag fragments are supplied. The reported impact is availability-only. The advisory labels its analysis static and unbenchmarked; its proof-of-concept confidence is 0.5. The condition requires use of that non-default parser option. A search of this repository's `apps`, `packages`, `scripts` and `test` source trees found no explicit `stopNodes` configuration, but that source search is not a proof of runtime reachability in every optional SDK or deployment.

The advisory's OSV record is active/non-withdrawn and identifies 5.12.0 as fixed. The queried NVD record status was `Deferred`. The queried CISA KEV catalog did not include this CVE; EPSS data was not returned. Absence from KEV is not proof that exploitation has never occurred, and a missing EPSS value is not a zero exploitation probability.

The remediation is a lockfile-only compatible transitive update: `fast-xml-parser@5.11.2` to `5.12.0`. Both upstream dependency ranges in the lockfile (`^5.5.9` and `^5.3.4`) admit 5.12.0. The fixed parser's dependency ranges are already satisfied by the existing locked `@nodable/entities@3.1.0`, `fast-xml-builder@1.3.1` and `strnum@2.5.1` versions, so those resolutions remain unchanged; `is-unsafe` advances from `2.0.2` to `2.0.3`. The root `package.json` and its direct dependency declarations are unchanged. OSV's explicit 5.11.2 to 5.12.0 package-version comparison returned the advisory for the former and none for the latter; OSV documents fuzzy matching against upstream version strings, so this source result complements rather than replaces the exact lockfile and npm audit checks.

After the lockfile update, a fresh `npm ci`, the postinstall asset step, `npm audit --json` and `npm audit --omit=dev --json` all completed successfully. Both current npm audit summaries report zero info, low, moderate, high or critical advisories:

| Scope after lockfile remediation | Info | Low | Moderate | High | Critical | Total |
|---|---:|---:|---:|---:|---:|---:|
| Full dependency tree | 0 | 0 | 0 | 0 | 0 | 0 |
| Production dependencies | 0 | 0 | 0 | 0 | 0 | 0 |

The retained JSON outputs correspond to the post-remediation lockfile:

- `artifacts/evidence/supply-chain-review-2026-11-10/npm-audit-all.json`
- `artifacts/evidence/supply-chain-review-2026-11-10/npm-audit-production.json`
- `artifacts/evidence/supply-chain-review-2026-11-10/npm-audit-summary.json` Ã¢â‚¬â€ binds both audit exit codes, vulnerability/dependency counts and raw report digests to the package-lock SHA-256.

These results mean npm reported no advisories for this lockfile at the time of the post-update checks. They do not prove every package is secure, maintained, non-malicious, correctly configured or free from vulnerabilities not represented in npm's advisory database.

## 5. CI and provenance follow-up

The existing mainline #522 workflow passed on exact main SHA `c7653bb433ae8b363925d13babf239e64b2b5125`, including the pinned Node.js/npm dependency jobs, npm audits, SBOM generation, CodeQL execution and consolidated evidence. That run predates the current follow-up branch's lockfile and workflow changes. Successful CodeQL execution is not an independent security assessment and does not imply that every alert has been reviewed or resolved.

This follow-up branch adds a main-only `attest-supply-chain` job to `.github/workflows/ci.yml`. After the Node.js 22 dependency job succeeds on `main`, it:

1. Downloads that run's dependency evidence artifact.
2. Verifies the lockfile root identity, CycloneDX version and SBOM package identity.
3. Recomputes SHA-256 digests for the downloaded lockfile and SBOM and checks them against the SBOM-generation log.
4. Uses a commit-pinned `actions/attest@v4.2.2` action to generate SLSA provenance for the lockfile and SBOM.
5. Generates a signed SBOM attestation using the lockfile as subject and the CycloneDX document as the SBOM predicate.
6. Installs GitHub CLI `2.103.3` from the official Linux x64 release archive only after checking its pinned SHA-256 (`4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d`). This is above the `2.102.0` security-fix floor for the case-insensitive `--source-ref` ([GHSA-4mq3-hpgx-9cx8](https://github.com/cli/cli/security/advisories/GHSA-4mq3-hpgx-9cx8)) and prefix-matching `--signer-workflow` ([GHSA-wjmr-j3rp-mh2g](https://github.com/cli/cli/security/advisories/GHSA-wjmr-j3rp-mh2g)) verification advisories. It verifies both provenance subjects and the CycloneDX SBOM attestation with `gh attestation verify`, constraining the certificate identity, signer workflow, `refs/heads/main`, full source commit SHA and hosted-runner requirement.
7. Compares the signed CycloneDX predicate with the exact generated SBOM document and records the verified lockfile/SBOM digests in a machine-readable summary.
8. Uploads the bundles and verification results as a workflow artifact for retention and inspection.

The job runs only on a successful push or manual workflow run targeting `main`; it deliberately does not request OIDC/attestation write permission for pull-request workflows. Its permissions are limited to `actions: read`, `contents: read`, `id-token: write` and `attestations: write`. It sets `create-storage-record: false`; it does not publish a package, push an image or create an artifact-registry storage record.

This attestation mechanism is implemented in the current unmerged review branch but has not yet been exercised by a successful hosted mainline run. Pull-request workflows intentionally skip the main-only signer job. After an authorized merge, verify the exact-mainline run, inspect the attestation artifact and subject digests, and update this report with the run/attempt and retained artifact identities. Provenance binds attested subject bytes and workflow identity; it does not prove dependency authors are trustworthy, determine license compliance or replace human review of the build/release process.

## 6. Open maintainer and legal review items

The following work remains before issue #23 can be accepted:

- Review direct and transitive dependency ownership, maintenance activity, pinned versions, optional/native packages, platform selection, transitive risk and package install behavior.
- Explain all local/file dependencies and confirm the vendored EnginEx submodule's exact commit, license files, notices and source availability.
- Review every SBOM license identifier/expression and resolve the LGPL and GPL distribution obligations for the actual product distribution and packaging model.
- Compare supported-runtime SBOMs, package-lock/SBOM hashes and normalized dependency graph results for the exact release candidate.
- Review the post-remediation npm audit outputs and CodeQL alerts for the exact candidate SHA; record accepted exceptions, owners and expiry rather than relying only on green job status.
- Validate the main-only attestation job on a successful exact-mainline run, verify its attestation bundles, and record their subject digests and provenance identity.
- Retain reviewer identity, date, exact source SHA, reviewed inputs, findings, dispositions and any required legal approval before creating formal gate evidence.

The release manifest intentionally continues to record `reviewedByMaintainer: false`. This report must not be used to flip that value or to mark `artifacts/evidence/dependency-sbom-codeql.json` as passed. Issue #23 remains OPEN / PARTIAL until the listed human review, exact-revision CI/provenance evidence and acceptance are completed.

## 7. Semantic versioning and release boundary

The lockfile now updates one optional transitive package family to remediate the published advisory and refreshes compatible nested versions; `package.json` and all direct dependency declarations remain unchanged. The SBOM generator now consistently inventories the lockfile rather than the incidental installed tree. No runtime behavior, public API, database schema or migration is intentionally changed. Package version remains **0.6.2**. No SemVer increment, tag, publication, release or deployment is authorized.

Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. Independent tenant-isolation review #14, broader independent security review #25, load/backup/restore #24, operations/release approval #26, release scope #13 and governance #32 remain separate gates.
