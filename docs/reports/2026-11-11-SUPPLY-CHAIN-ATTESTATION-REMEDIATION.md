# VirgoScorpio Hub 0.6.2 — Supply-Chain Attestation and CodeQL Remediation

> **Status: PR #121 MERGED; EXACT-MAIN ATTESTATION AND FULL CI PASSED IN #538.** Current main is `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d`. Workflow #538 passed all seven jobs, including exact-main SLSA provenance and signed CycloneDX SBOM verification, both Node matrices, live PostgreSQL/Memgraph/Redis and browser qualification, CodeQL and evidence aggregation. CodeQL alert #38 is fixed and no open main alerts remain. The earlier #532/#533 Ubuntu apt/mirror DNS failures are historical pre-fix results; PR #121 removed that Playwright setup dependency and is merged. This report is not qualified human dependency/license acceptance, a legal opinion, an independent security assessment, or production approval.

- **Snapshot:** 11 November 2026 (America/Chicago)
- **Package:** virgoscorpio-hub 0.6.2, private and unreleased
- **Current main baseline:** `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d` (PR #121 merge)
- **Final mainline CI:** [workflow #538](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43068232804) (push on exact main SHA; all seven jobs passed)
- **Issue:** [#23 — dependency, SBOM, provenance and CodeQL review](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)
- **Merged remediation:** [PR #120](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/120)
- **Merged hosted-runner follow-up:** [PR #121](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/121), branch head `fc2fb4241b8704223ce63e94650e79031b723762`, merge commit `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d`
- **Production disposition:** **NO-GO / NOT_PRODUCTION_CERTIFIED**

## Final mainline verification — workflow #538

Mainline push workflow [#538](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43068232804) completed successfully on exact main SHA `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d`; all seven jobs passed. The main-only signer generated and verified SLSA provenance for the exact `package-lock.json` and CycloneDX SBOM bytes, the signed SBOM attestation, exact repository/workflow certificate identity, `refs/heads/main`, the full source SHA and both subject digests. It checked predicate type `https://cyclonedx.org/bom` and confirmed the signed predicate equals the generated SBOM document.

| Exact mainline evidence | Value |
|---|---|
| Lockfile SHA-256 | `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086` |
| Signed CycloneDX SBOM SHA-256 | `7a8883f03fd4c350986a6ed9ec8d8b8c4a1a7fa1f31e03cb3381950cd8be0ba2` |
| SBOM format / component inventory | CycloneDX 1.5; 200 components; 201 dependency records |
| SBOM predicate type / equality | `https://cyclonedx.org/bom`; exact predicate equals generated SBOM (`true`) |
| Attestation artifact | ID `13875954614`, archive digest `sha256:099cca5a896e6695adbecd678167235b93a9287bc6cb0275761337277e8b7872`; expires 9 February 2027 |
| Source ref / revision | `refs/heads/main`; `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d` |

Both Node matrices passed 590/590 Hub tests and 94/94 EnginEx tests; full and production-only npm audits each reported zero vulnerabilities on both runtimes. PostgreSQL/Memgraph/Redis live integration passed 82/82 with zero failures/skips; fresh migrations passed and the idempotent second pass skipped all 18; PostgreSQL collaboration Playwright passed 3/3; browser/accessibility smoke passed 9/9. Real Memgraph outage/outbox replay and canonical graph rebuild passed. CodeQL passed, alert #38 is fixed and the open main-alert query returned an empty set. The evidence aggregator verified revision-bound artifacts/checksums and reported `CI EVIDENCE: PASS`.

PR [#121](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/121) merged at this SHA. Its final branch head `fc2fb4241b8704223ce63e94650e79031b723762` also passed push workflow [#43065225829](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43065225829) and pull-request workflow [#43065234386](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43065234386), each with all six non-attestation jobs and evidence aggregation successful. The signer skip on those non-main events was expected; the exact-main signer then ran and passed in #538.

The original workflows #532/#533 on main SHA `85ca5ea531ba5f71278f725dac096ee628053d63` remain a historical pre-fix failure record: they successfully signed/verified the main attestation but full CI failed closed when Playwright's apt-based `--with-deps` setup hit Ubuntu mirror DNS failure. PR #121 removes the apt-based dependency installation while leaving the browser and all downstream tests enabled. This infrastructure correction is merged and verified on main.

**Human acceptance remains open:** issue #23 stays OPEN / PARTIAL until a qualified reviewer completes dependency maintenance and GPL/LGPL license/distribution analysis, reviews the exact-main retained attestation and CodeQL evidence, records exact-SHA findings/dispositions, and formally accepts the evidence. Do not populate `artifacts/evidence/dependency-sbom-codeql.json` or close issue #23 from maintainer CI alone.

## Historical post-merge attestation verification — workflow #533 (PR #120 main SHA)

The main-only signer job for workflow #533 (run 43044726474, attempt 1) completed successfully on exact main SHA `85ca5ea531ba5f71278f725dac096ee628053d63` with source ref `refs/heads/main`. The job generated SLSA provenance for the package lockfile and CycloneDX SBOM, created the signed SBOM attestation, verified the bundles with the exact repository/workflow certificate identity, checked the source SHA and hosted-runner restriction, matched both provenance subject digests, confirmed predicate type `https://cyclonedx.org/bom`, and verified that the signed predicate equals the generated SBOM document.

The retained `virgoscorpio_hub-supply-chain-attestations` artifact is ID `13866578378`, run-bound to #533 and SHA `85ca5ea531ba5f71278f725dac096ee628053d63`. Archive digest: `sha256:d5d36adfff4d11a6c71bda0ea1cd30e2f9045dde716c5e9a06888f7f76cff95d`; expiration: 9 February 2027. The downloaded verification summary records:

| Evidence field | Exact value |
|---|---|
| Lockfile SHA-256 | `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086` |
| CycloneDX SBOM SHA-256 | `60d1dbc76e4ea3a7d8f661280b9ae1ec4bb159304ded39e49018df1272b0fdd8` |
| SBOM predicate type | `https://cyclonedx.org/bom` |
| Predicate equals generated SBOM | `true` |

GitHub reports CodeQL alert #38 as `fixed` (not dismissed) on main as of 11 November 2026, and the open-alert query for `refs/heads/main` returns an empty set. Issue #23 remains OPEN / PARTIAL because qualified human dependency/license/distribution review and formal reviewer acceptance are still outstanding.

The full mainline workflows #532 and #533 did not pass on their pre-fix main SHA: `npx playwright install --with-deps chromium` attempted to install OS packages through Ubuntu mirrors and failed with temporary DNS resolution errors for `azure.archive.ubuntu.com`. The Chromium failure skipped browser and downstream DB/graph-recovery steps; the evidence aggregator correctly failed closed. This is retained as the historical failure that motivated the correction, not a reason to waive qualification.

The merged correction in [PR #121](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/121) now runs `npx playwright install chromium` in both hosted Chromium steps, while browser startup and all downstream tests remain enabled. The initial correction commit `85b39b2388ea65e397ef4502eb961c486ff8e823` passed branch push workflow [#43062643567](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43062643567); the final PR head `fc2fb4241b8704223ce63e94650e79031b723762` passed push [#43065225829](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43065225829) and PR [#43065234386](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43065234386), each with all six non-attestation jobs and evidence aggregation. Validation included 590/590 Hub and 94/94 EnginEx tests on each Node 22.23.4/24.22.1 matrix, zero npm audit vulnerabilities in both scopes on both runtimes, CycloneDX 1.5 (200 components / 201 dependency records), 82/82 live integration tests with zero failures/skips, PostgreSQL collaboration Playwright 3/3, browser/accessibility smoke 9/9, real Memgraph outage/outbox replay, deterministic graph rebuild, CodeQL and consolidated revision/checksum evidence. The signer was skipped by design on these branch/PR events; exact-main signing was verified separately in #533. PR #121 is merged at main SHA `6f661a9cf76dfa5c377ed5c65995a7e1554d3f4d`; the remaining issue #23 human supply-chain acceptance gate remains open.

## Hosted-runner follow-up validation — PR #121

The correction replaces only the two `npx playwright install --with-deps chromium` commands with `npx playwright install chromium`. Playwright still downloads Chromium; all actual browser startup, smoke, collaboration, Redis, Memgraph outage/replay and graph rebuild steps remain enabled. No runtime package, lockfile, application API, schema, migration, provider contract or product architecture changed.

The branch push [workflow #43062643567](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43062643567) and pull-request [workflow #535](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43063552026) both passed all six non-attestation jobs and the consolidated evidence aggregator on exact branch commit `85b39b2388ea65e397ef4502eb961c486ff8e823`:

| Check | Result |
|---|---|
| Node.js 22.23.4 | 590/590 Hub tests; 94/94 EnginEx tests; 0 vulnerabilities in both npm audit scopes; CycloneDX 1.5 with 200 components / 201 dependency records |
| Node.js 24.22.1 | 590/590 Hub tests; 94/94 EnginEx tests; 0 vulnerabilities in both npm audit scopes; CycloneDX 1.5 with 200 components / 201 dependency records |
| Live PostgreSQL/Memgraph/Redis integration | 82/82; zero failures/skips; fresh migrations and idempotency pass |
| PostgreSQL-backed collaboration browser | 3/3 |
| Browser editor/accessibility smoke | 9/9 |
| Real Memgraph outage/outbox replay | PASS; pending event replayed after service restart without duplicate delivery |
| Canonical graph rebuild | PASS; tombstones/stale nodes handled and repeated rebuild deterministic |
| CodeQL | PASS |
| Consolidated CI evidence | PASS; exact revision and evidence checksums verified |

The corrected push run retained 10 non-expired run-bound CI artifacts (including Node 22/24 test and dependency evidence, browser/accessibility evidence, live integration, CodeQL, release readiness and consolidated evidence); they expire 9 February 2027. The main-only signer was skipped as designed on the branch/PR events; signed exact-main provenance/SBOM remains verified separately in workflow #533. The PR workflow #535 also passed against the pull request merge ref. PR #121 is merged and exact-main workflow #538 passed; this resolves the hosted-runner CI setup issue but does not close the human supply-chain/release gate.

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