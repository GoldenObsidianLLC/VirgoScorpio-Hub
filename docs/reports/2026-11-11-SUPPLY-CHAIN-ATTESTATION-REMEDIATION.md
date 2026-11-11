# VirgoScorpio Hub 0.6.2 — Supply-Chain Attestation and CodeQL Remediation

> **Status: REMEDIATION IN REVIEW.** This report records the first exact-mainline execution of the main-only attestation controls after PR #119 merged, the concrete verification and CodeQL failures, and the focused corrective patch. It is not human dependency/license acceptance, a legal opinion, an independent security assessment, or production approval.

- **Snapshot:** 11 November 2026 (America/Chicago)
- **Package:** virgoscorpio-hub 0.6.2, private and unreleased
- **Main baseline:** 97f11434a211f982b539ef11effd5b7432b5e4a9 (PR #119 merge)
- **Post-merge CI:** [workflow #527](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42964407873)
- **Issue:** [#23 — dependency, SBOM, provenance and CodeQL review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)
- **Corrective branch:** security/supply-chain-attestation-codeql-2026-11-11
- **Production disposition:** **NO-GO / NOT_PRODUCTION_CERTIFIED**

## 1. What the first mainline run established

PR [#119](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/119) merged at main SHA 97f11434a211f982b539ef11effd5b7432b5e4a9. Exact-mainline workflow #527 executed the new signer job for the first time.

The Node.js 22.23.4 and 24.22.1 dependency/unit/security jobs, PostgreSQL/Memgraph/Redis integration, browser smoke and CodeQL analysis completed successfully. The attestation job generated and uploaded SLSA provenance for the lockfile and CycloneDX SBOM, and a signed SBOM attestation. The Sigstore transparency-log uploads completed. However, the subsequent verification step exited before invoking the GitHub CLI verification command, and the evidence aggregator failed closed because the required attestation job did not succeed.

**Do not describe run #527 as a successful attestation verification.** The artifacts were signed and uploaded, but the workflow did not finish its configured local-bundle, signer/source/digest and CycloneDX predicate checks. The aggregation failure was expected fail-closed behavior, not an independent defect.

## 2. Root cause A — mutually exclusive GitHub CLI flags

The three attestation verification invocations supplied both the signer-workflow and cert-identity options. GitHub CLI treats those as mutually exclusive members of the actor-identity flag group. The command exited with:

> if any flags in the group [cert-identity cert-identity-regex signer-repo signer-workflow] are set none of the others can be; [cert-identity signer-workflow] were all set

The workflow already computes the exact certificate SubjectAlternativeName identity, including repository, workflow file and refs/heads/main. The corrective patch therefore removes the redundant signer-workflow option from all three invocations and retains exact certificate identity, repository, source ref, full source digest, hosted-runner restriction, and CycloneDX predicate checks. This follows the [GitHub CLI verification contract](https://cli.github.com/manual/gh_attestation_verify): use either exact certificate identity or signer-workflow, not both.

This removes an invalid duplicate constraint; it does not relax the intended signer, source revision, repository, runner or predicate requirements.

## 3. Root cause B — CodeQL indirect command-line injection

The exact-mainline CodeQL analysis raised medium-severity alert [#38](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/security/code-scanning/38), rule js/indirect-command-line-injection, in scripts/generate-sbom.js. The prior command builder allowed the npm_execpath and ComSpec environment variables to select the executable or command processor passed to spawnSync.

The correction removes both environment-derived executable paths. SBOM execution now uses fixed command names (npm on POSIX and cmd.exe on Windows), a single frozen shared argument list, and shell:false for process spawning. The Windows command string contains only fixed npm command text and repository-owned constant flags. Error formatting no longer echoes the removed environment override. Windows/POSIX command shapes, the lockfile-only flag, spawn diagnostics and adversarial environment overrides are covered by focused tests.

The change adds no dependencies and modifies no runtime APIs, schema, migrations, provider contracts or architecture. PATH itself is not treated as a trust boundary: supported CI must continue to install and pin npm before invoking the SBOM generator.

## 4. Local validation on the corrective worktree

- Focused node --test test/sbom-normalization.test.js: **6/6 passed**, zero failures/skips.
- npm run check: artifact validation passed (**235 required paths**, **243 JavaScript files syntax-checked**); unit tests **590 total, 587 passed, 0 failed, 3 Windows-specific skips**.
- npm run sbom: passed; CycloneDX **1.5**, **200 components**, **201 dependency records**, zero unidentified licenses, root PURL pkg:npm/virgoscorpio-hub@0.6.2.
- Full-tree and production-only npm audit --audit-level=high: **0 vulnerabilities** each.
- git diff --check: clean before documentation updates.

Local Windows SBOM/lockfile byte hashes are workstation diagnostics; do not substitute them for clean hosted-runner artifact digests. The vendored EnginEx submodule worktree remains locally marked dirty and was not staged or altered.

## 5. Exact evidence still required

The corrective branch received push workflow #42983499337 and exact PR-head workflow #42983649410 on commit d2245d127a42eb054eca68d012cce005986c3ec5. Both passed all six non-attestation jobs: Node 22/24, live PostgreSQL/Memgraph/Redis, browser smoke, CodeQL and consolidated evidence. The main-only signer was skipped by design on feature/PR events. GitHub returned no open CodeQL alerts for the PR merge ref, while default-main alert #38 remains open until the correction is merged and the main-branch scan refreshes the alert. After an authorized merge, the resulting exact main revision must run the signer job to completion and verify: provenance for lockfile and SBOM; exact main certificate identity, refs/heads/main, full source SHA and hosted-runner constraint; CycloneDX predicate type; provenance subject digests matching exact lockfile/SBOM bytes; signed predicate equality with the generated SBOM; and retained bundles/verification summary bound to the exact run, attempt and SHA. The consolidated evidence job must also pass.

CodeQL must rerun on the corrective commit. Alert #38 must be reviewed on the exact updated revision and its disposition recorded; a successful CodeQL job alone is not human security review. Issue #23 remains OPEN / PARTIAL until qualified maintainer review of direct/transitive/native/optional dependencies, maintenance posture, GPL/LGPL distribution implications, exact-SHA CodeQL disposition, retained attestation evidence and reviewer identity/date is complete.

Do not populate artifacts/evidence/dependency-sbom-codeql.json or close issue #23 on maintainer-authored remediation and green PR checks alone.

## 6. Architecture, SemVer and release boundary

PostgreSQL remains authoritative application state; Memgraph remains a rebuildable projection through the PostgreSQL transactional outbox; Redis Pub/Sub and presence remain ephemeral. Tenant and capability checks still precede side effects. This corrective patch is limited to SBOM process invocation, tests and attestation verification flags.

No product dependency declaration, public API, database schema, migration or package version changed. The package remains **0.6.2**, private and unreleased. No SemVer bump, tag, package publication, release or production deployment is proposed. Independent tenant-isolation #14, broader platform security #25, load/restore #24, operations/release ownership #26, scope #13 and governance #32 remain separate gates.

**Disposition: corrective code is locally validated and awaiting hosted PR/mainline evidence; supply-chain acceptance remains OPEN / PARTIAL and production remains NO-GO.**