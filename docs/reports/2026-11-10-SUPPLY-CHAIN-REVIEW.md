# VirgoScorpio Hub 0.6.2 — Maintainer Supply-Chain Review

> **STATUS: PARTIAL MAINTAINER REVIEW — NOT A COMPLETED RELEASE GATE, LEGAL OPINION, OR PRODUCTION APPROVAL.** This report records reproducible maintainer checks and open review work. It does not substitute for qualified legal review or an independent assessment.

- **Snapshot date:** 10 November 2026
- **Repository:** `GoldenObsidianLLC/VirgoScorpio-Hub`
- **Package:** `virgoscorpio-hub@0.6.2` — private, unreleased developer-preview candidate
- **Node engine floor:** `>=22.23.4`
- **Pinned package manager:** `npm@11.19.1`
- **Current main baseline:** `c7653bb433ae8b363925d13babf239e64b2b5125` (PR #118 merge)
- **Exact-mainline CI:** [workflow #522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42879875157) — all six jobs passed
- **Formal gate:** [Issue #23 — Review lockfile, SBOM, provenance, dependency scan and CodeQL evidence](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)
- **Production disposition:** **NO-GO / NOT_PRODUCTION_CERTIFIED**

**Current branch validation:** Windows x64, Node.js 26.12.1 and npm 11.19.1. A clean `npm ci --ignore-scripts --no-audit --no-fund` completed successfully, followed by the repository `npm run postinstall` and `npm run sbom`. `npm run check` passed **584/587** tests (0 failures, 3 Windows-specific skips), checked 235 required artifacts and syntax-checked 243 JavaScript files. Both full-tree and production-only npm audits reported **0 vulnerabilities**. These are local maintainer results on this follow-up branch, not the declared Node.js support-matrix evidence or production certification.

## 1. Scope and evidence boundary

This review covers the committed package manifest and lockfile, the generated CycloneDX inventory, npm's advisory database results, install-script and package-resolution metadata, vendored EnginEx licensing metadata, and the existing hosted Node.js 22/24 dependency/CodeQL workflow.

The current-main workflow #522 completed both Node.js dependency/unit/security jobs, PostgreSQL/Memgraph integration, browser/accessibility smoke, CodeQL, and evidence consolidation. It is evidence for the source revision and lockfile that existed on current main before this follow-up branch added the attestation job. The exact-mainline run did not execute the new attestation job described in this branch; that job still requires PR review and a successful post-merge mainline run.

No dependencies, package manifest, lockfile, runtime API, database schema, migrations, or version fields were changed for this review. No registry publication or release action was performed.

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

The lockfile root package version is 0.6.2 and the three direct dependency groups match `package.json`. The 203 remote package records resolve to the npm registry over HTTPS and include integrity hashes. The two other lock entries are not remote registry resolutions; the vendored `enginex-ai-native` package is supplied from `vendor/enginex`.

The lockfile package record for `enginex-ai-native` does not itself carry a `license` field. The vendored EnginEx 7.0.0 package manifest declares `GPL-2.0-or-later`, and the repository's `THIRD-PARTY-NOTICES.md` points to the submodule's LICENSE, COPYRIGHT and NOTICE files. This is a metadata-reconciliation observation, not a license clearance.

The exact-mainline workflow #522 successfully ran the repository's pinned npm 11.19.1 install and verification jobs on Node.js 22.23.4 and 24.22.1. In this separate Windows worktree, `npm ci --ignore-scripts --no-audit --no-fund` also completed successfully and added 178 packages. The command did not change `package-lock.json`; its SHA-256 remains the value recorded above. Dependency lifecycle scripts were suppressed during installation, and the repository-owned `npm run postinstall` asset-materialization step was run explicitly afterward. The lockfile scan found zero packages marked with `hasInstallScript`. npm emitted a deprecation warning for optional transitive `node-domexception@1.0.0`, reached through optional `@google-cloud/storage@8.4.0` and its `node-fetch`/`fetch-blob` dependencies. `npm explain` identifies the path; this is an upstream maintenance warning, not an npm audit vulnerability, and should be revisited when the optional cloud-storage dependency is next upgraded.

## 3. CycloneDX SBOM

A local maintainer SBOM was generated from the checked-out lockfile using `npm run sbom` on Windows x64, Node.js 26.12.1 and npm 11.19.1.

| Field | Recorded value |
|---|---|
| Format | CycloneDX 1.5 |
| Components | 174 |
| Dependency records | 175 |
| Components without identified license | 0 |
| `package-lock.json` SHA-256 | `bd81531382652ce4be00e6dd279bd126dc9140243ae1ee67dfb975bfd4234199` |
| Local SBOM SHA-256 | `c0d6ced39fbc25ef137daa179df70ecb2862aa8d84b16c2e959e850702b017ae` |

A directory-name variance was found during this review: npm initially emitted the root component's display name from the current worktree basename even though its `bom-ref` and PURL were stable. The repository already contained `scripts/normalize-sbom.js`, but `scripts/generate-sbom.js` did not call it before hashing and writing the generated SBOM. This branch wires the existing normalizer into generation, requires an exact root PURL match, serializes the normalized document before computing the SBOM digest, and logs the digest of those exact bytes. A regression test now proves the root component name becomes `virgoscorpio-hub` while dependency components and edges are preserved. The post-change SBOM root is `virgoscorpio-hub@0.6.2`, and the SHA-256 above is the normalized artifact. This is an artifact reproducibility correction only; dependency identities, versions and dependency edges were not altered.

The SBOM license expressions were summarized as follows:

| License identifier / expression | Components |
|---|---:|
| 0BSD | 1 |
| Apache-2.0 | 57 |
| Apache-2.0 AND LGPL-3.0-or-later | 1 |
| BlueOak-1.0.0 | 1 |
| BSD-3-Clause | 2 |
| GPL-2.0-or-later | 1 |
| ISC | 6 |
| MIT | 105 |

The optional native package `@img/sharp-win32-x64@0.35.5` is identified as `Apache-2.0 AND LGPL-3.0-or-later`. The vendored EnginEx component uses `GPL-2.0-or-later`. These licenses, combined-license terms, notices, source-offer and distribution obligations, linking/packaging model, optional-platform artifacts, and downstream redistribution conditions require a human license reviewer and, where appropriate, qualified counsel. This automated report does not determine legal compliance.

The local Windows SBOM is a diagnostic snapshot, not the final release SBOM or a substitute for the supported-runtime CI artifacts. The hosted workflow generates and compares normalized CycloneDX inventories on both supported Node.js runtimes; the mainline #522 consolidated job passed.

## 4. npm advisory results

Both `npm audit --json` and `npm audit --omit=dev --json` completed successfully against the checked-out lockfile on 10 November 2026.

| Scope | Info | Low | Moderate | High | Critical | Total |
|---|---:|---:|---:|---:|---:|---:|
| Full dependency tree | 0 | 0 | 0 | 0 | 0 | 0 |
| Production dependencies | 0 | 0 | 0 | 0 | 0 | 0 |

Machine-readable outputs are retained alongside this report:

- `artifacts/evidence/supply-chain-review-2026-11-10/npm-audit-all.json`
- `artifacts/evidence/supply-chain-review-2026-11-10/npm-audit-production.json`
- `artifacts/evidence/supply-chain-review-2026-11-10/virgoscorpio-hub.sbom.cdx.json` — exact normalized CycloneDX bytes corresponding to the digest above.
- `artifacts/evidence/supply-chain-review-2026-11-10/sbom-generation.log` — generation command, runtime, package-manager, component/license counts and input/output digests.

The result means npm reported no advisories for this dependency graph at the time of the checks. It is not proof that all packages are secure, maintained, non-malicious, correctly configured, or free from vulnerabilities not represented in the npm advisory database.

## 5. CI and provenance follow-up

The existing mainline #522 checks passed on exact main SHA `c7653bb433ae8b363925d13babf239e64b2b5125`, including the pinned Node.js/npm dependency jobs, npm audits, SBOM generation, CodeQL execution, and consolidated evidence. Successful CodeQL workflow execution is not an independent security assessment and does not imply that every alert has been reviewed or resolved.

This follow-up branch adds a main-only `attest-supply-chain` job to `.github/workflows/ci.yml`. After the Node.js 22 dependency job succeeds on `main`, it:

1. Downloads that run's dependency evidence artifact.
2. Verifies the lockfile root identity, CycloneDX version and SBOM package identity.
3. Recomputes SHA-256 digests for the downloaded lockfile and SBOM and checks them against the SBOM-generation log.
4. Uses a commit-pinned `actions/attest@v4.2.2` action to generate SLSA provenance for the lockfile and SBOM.
5. Generates a signed SBOM attestation using the lockfile as subject and the CycloneDX document as the SBOM predicate.
6. Installs GitHub CLI [`2.103.3`](https://github.com/cli/cli/releases/tag/v2.103.3) from the official Linux x64 release archive after checking its pinned SHA-256 (`4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d`), rather than trusting the runner-image version. This is newer than the `2.102.0` security-fix floor for the case-insensitive `--source-ref` ([GHSA-4mq3-hpgx-9cx8](https://github.com/cli/cli/security/advisories/GHSA-4mq3-hpgx-9cx8)) and prefix-matching `--signer-workflow` ([GHSA-wjmr-j3rp-mh2g](https://github.com/cli/cli/security/advisories/GHSA-wjmr-j3rp-mh2g)) verification advisories. It then verifies both provenance subjects and the CycloneDX SBOM attestation with `gh attestation verify`, constraining the exact certificate identity, signer workflow, `refs/heads/main`, full source commit SHA, and hosted-runner requirement.
7. Compares the signed CycloneDX predicate with the exact generated SBOM document and records the verified lockfile/SBOM digests in a machine-readable summary.
8. Uploads the bundles and verification results as a workflow artifact for retention and inspection.

The job runs only on a successful push or manual workflow run targeting `main`; it deliberately does not request OIDC/attestation write permission for pull-request workflows. Its permissions are limited to `actions: read`, `contents: read`, `id-token: write`, and `attestations: write`. It sets `create-storage-record: false`; it does not publish a package, push an image, or create an artifact registry storage record.

This attestation mechanism is implemented in the current unmerged review branch but has not yet been exercised by a successful hosted mainline run. The pull-request workflow intentionally skips the main-only signer job. After an authorized merge, verify the exact-mainline run, inspect the generated attestation artifact and subject digests, and update this report with the run/attempt and retained artifact identities. Provenance binds the attested subject bytes and workflow identity; it does not prove the dependency authors are trustworthy, determine license compliance, or replace a human review of the build/release process.

## 6. Open maintainer and legal review items

The following work remains before issue #23 can be accepted:

- Review direct and transitive dependency ownership, maintenance activity, pinned versions, optional/native packages, platform selection, transitive risk and package install behavior.
- Explain all local/file dependencies and confirm the vendored EnginEx submodule's exact commit, license files, notices and source availability.
- Review every SBOM license identifier/expression and resolve the LGPL and GPL distribution obligations for the actual product distribution and packaging model.
- Compare supported-runtime SBOMs, package-lock/SBOM hashes and normalized dependency graph results for the exact release candidate.
- Review npm audit outputs and CodeQL alerts for the exact candidate SHA; record any accepted exceptions, owners and expiry rather than relying only on green job status.
- Validate the main-only attestation job on a successful exact-mainline run, verify its attestation bundles and record their subject digests and provenance identity.
- Retain reviewer identity, date, exact source SHA, reviewed inputs, findings, dispositions and any required legal approval before creating formal gate evidence.

The release manifest intentionally continues to record `reviewedByMaintainer: false`. This report must not be used to flip that value or to mark `artifacts/evidence/dependency-sbom-codeql.json` as passed. Issue #23 remains OPEN / PARTIAL until the listed human review and exact-revision evidence are completed and accepted.

## 7. Semantic versioning and release boundary

No package or lockfile dependency changes were made; no runtime behavior, public API, migrations or schema were changed. Package version remains **0.6.2**. No SemVer increment, tag, publication, release or deployment is authorized.

Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. Independent tenant-isolation review #14, broader independent security review #25, load/backup/restore #24, operations/release approval #26, release scope #13 and governance #32 remain separate gates.
