# VirgoScorpio Hub 0.6.2 — Release Gate and Open PR Review

**Report date:** 25 November 2026 (America/Chicago)

**Current main:** bc80a3389fd6d61ef951dd15b019a5d235539d42

**Exact-main workflow:** [Run #45700172560](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45700172560) — completed successfully, 7/7 jobs.

**Canonical readiness artifact:** [#15062831822](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45700172560/artifacts/15062831822), generated from the exact main SHA above.

**Package:** 0.6.2 (private, unreleased)

**Disposition:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

## Executive decision

The current mainline is healthy under its hosted CI evidence, but the canonical release-readiness record is still **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**. The artifact explicitly records readyForProduction=false and NOT_PRODUCTION_CERTIFIED.

All seven exact-main workflow jobs passed. The Node 22/24 test and dependency checks, live PostgreSQL/Memgraph integration, migration replay, browser smoke, CodeQL, signed dependency/SBOM provenance, and evidence aggregation are green. These results establish a strong maintainer/CI baseline; they do not replace independent assessment, external-provider validation, operational recovery evidence, or release-owner approval.

F1.72 / PR #253 is now merged into main. The next implementation increment is F1.73 / draft PR #304, which enforces per-site retained library-storage quotas and preserves the already-merged source-version-bound media-variant lifecycle. Its hosted retest is in progress after the first live-integration attempts hit the test-runner timeout; it is not mainline and is not included in the main readiness artifact.

**No release tag, GitHub Release, package publication, SemVer increment, production deployment, or promotion is authorized.** Keep package version 0.6.2 unchanged and unreleased.

## Exact-main evidence

| Evidence | Verified result |
|---|---|
| Source baseline | main at bc80a3389fd6d61ef951dd15b019a5d235539d42 |
| Exact-main workflow | [Run #45700172560](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45700172560), 7/7 jobs successful |
| Canonical readiness | [Artifact #15062831822](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45700172560/artifacts/15062831822), bound to the exact main SHA |
| Node.js 22.23.4 | 975/975 Hub tests and 94/94 EnginEx tests; zero failures or skips |
| Node.js 24.22.1 | 975/975 Hub tests and 94/94 EnginEx tests; zero failures or skips |
| Dependency audit | Both supported-runtime jobs reported zero npm audit vulnerabilities |
| PostgreSQL/Memgraph | 195/195 hosted integration tests; zero failures or skips |
| Database migrations | 19/19 applied fresh; second pass confirmed 19/19 already applied |
| Browser smoke | Chromium/Playwright smoke suite passed 9/9 |
| CodeQL | Completed successfully; 294 JavaScript and 2 HTML files scanned |
| Supply chain | CycloneDX 1.5 SBOM: 200 components / 201 dependency records; signed mainline provenance verification succeeded |
| Evidence aggregation | Canonical readiness producer evidence was consolidated against the exact source/run |

The separate service-less integration diagnostic remains PARTIAL: 50 tests were observed, 1 passed and 49 were skipped because its execution context did not provide hosted services. Those skips are not counted as the separate zero-skip PostgreSQL/Memgraph producer result.

## Formal release-gate disposition

| Status | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

The two PARTIAL gates are not eligible to be promoted to PASS by inference:

1. **Qualified human dependency / license / SBOM review — PARTIAL.** Lockfile installation, automated audit, CodeQL and signed provenance have passed. A qualified human assessment of dependency licensing, supply-chain risk, and SBOM/provenance remains outstanding under issue #23.
2. **Service-less integration diagnostic — PARTIAL.** The diagnostic context skips 49 of 50 service-dependent tests. The independent hosted PostgreSQL/Memgraph suite passed 195/195; do not combine or misstate the two results.

The following fourteen production evidence records remain missing:

| # | Required evidence | Remaining gap / owner reference |
|---:|---|---|
| 1 | Independent tenant-isolation and authorization review | Accepted independent assessment is missing; issue [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14). |
| 2 | OIDC/SAML, email delivery, and MFA recovery end-to-end | Live identity-provider, mailbox, recovery, and failure-path acceptance is not evidenced. |
| 3 | ClamAV, malicious-file corpus, and legacy-asset quarantine | Live scanner/corpus validation and legacy quarantine evidence are missing. |
| 4 | Live S3/GCS/Azure/S3-compatible provider operations | Real credentials, least-privilege configuration, lifecycle and failure-path validation are missing. |
| 5 | Stripe webhook and inventory lifecycle | Live replay/order/idempotency, ambiguous outcomes, reservation and inventory acceptance are missing. |
| 6 | Full browser editor and accessibility acceptance | Smoke is green; full user journeys and manual WCAG/screen-reader acceptance remain missing. |
| 7 | Commerce parity acceptance | Tax, shipping, discounts, refunds, fulfillment, downloads and subscriptions remain unaccepted. |
| 8 | Community parity acceptance | Privacy, abuse, search, export/deletion and forum acceptance remain unaccepted. |
| 9 | Signed plugin pipeline and adversarial container isolation | Signing/provenance and adversarial runtime-isolation evidence remain unaccepted. |
| 10 | Human-reviewed dependency/SBOM/provenance/CodeQL assessment | Automated evidence exists; qualified human assessment remains missing (issue [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)). |
| 11 | Load/soak, fault injection, backup/restore and recovery drills | Reproducible capacity, failure and recovery evidence is missing (issue [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24)). |
| 12 | Independent platform security assessment and severe-finding remediation | Independent assessment is not accepted (issue [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25)). |
| 13 | Deployment runbooks, secrets, rollback, monitoring and release approval | Operational controls and explicit release-owner approval remain missing (issues [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) and [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13)). |
| 14 | Production OTLP observability backend, security, governance and delivery | Deployment-approved production backend and accepted operational evidence are missing. |

Evidence must be generated for the exact candidate version and full source SHA. Any source change invalidates source-bound candidate evidence and requires regeneration. Maintainer-created inventories and CI do not constitute independent security review.

## Mainline engineering changes

The following security increments are already merged into main and included in the exact-main source:

| Increment | PR | Mainline result |
|---|---:|---|
| F1.69 — revalidate direct-conversation participants after lock acquisition | [#299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) | Merged; participant account and selected-site membership are revalidated transactionally after pair-lock acquisition. |
| F1.70 — library route authorization before body parsing | [#252](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/252) | Merged; selected-site authorization precedes request-body parsing on library write routes. |
| F1.71 — MFA enrollment step-up reauthentication | [#256](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/256) | Merged; password and existing MFA proof are required for enrollment/replacement. |
| F1.72 — public query-loop amplification containment | [#253](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/253) | Merged; repeated content types are grouped and public delivery is bounded to five scoped queries per request, max 12 results per group. |

F1.72 is no longer an active PR candidate. It is part of main SHA bc80a3389fd6d61ef951dd15b019a5d235539d42 and its mainline evidence is included in run #45700172560.

## F1.73 candidate — retained library quotas and derivative lifecycle

**PR:** [#304](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/304) — draft, not merged
**Branch:** security/f1-73-library-storage-quota-variant-2026-11-25
**Head:** d33f565059a54b25ff52d0e61e8715ec0bde6669
**Base:** main at bc80a3389fd6d61ef951dd15b019a5d235539d42

The candidate implements:

- Default per-site ceilings of 5 GiB retained object bytes and 10,000 distinct retained storage objects. The existing 50 MiB per-file default remains independent.
- Accounting across distinct storage keys referenced by current assets, historical version snapshots and media variants. Soft-deleted/quarantined references continue to count while retained; legacy snapshots without byteSize are conservatively charged at the configured per-file maximum.
- A common transaction-scoped site advisory lock for upload, source replacement and derivative allocation, so competing allocations for one site cannot all consume the same remaining quota. Usage/lock verification fails closed.
- Transactional retirement of stale variant rows on source replacement, with storage-object deletion after commit. Metadata-only versions carry forward only source-version-bound derivatives.
- Conservative handling of ambiguous COMMIT acknowledgements: potentially referenced objects are preserved for reconciliation rather than deleted based on an uncertain transaction outcome.
- Documentation and deterministic plus opt-in live-PostgreSQL regression coverage.

Local validation in the isolated feature worktree:

| Check | Result |
|---|---|
| npm run security:tenant-inventory | Passed; source-anchored inventory regenerated |
| npm run check | **Passed: 991 tests, 988 passed, 0 failed, 3 conditional skips** |
| git diff --check | Passed |
| Live PostgreSQL integration | Not run locally; environment did not provide the opt-in database. The new tests are enabled by the repository's hosted live-integration workflow. |

Hosted F1.73 CI status at report capture (25 November 2026):

- Initial push run #45709778051 and PR run #45709943564 both reached the new quota integration cases; the test log records both quota scenarios passing. The overall live-integration child process then exceeded the runner 240-second spawnSync timeout (ETIMEDOUT), so neither run produced a successful full PostgreSQL/Memgraph result.
- F1.73 corrects the bounded live-test harness timeout from 240 to 360 seconds in follow-up commit d33f565059a54b25ff52d0e61e8715ec0bde6669 (test(ci): extend live integration timeout). The hang guard remains finite; the timeout is not removed and no test was waived.
- Replacement push run #45711333570 and PR run #45711343166 both passed Node.js 22, Node.js 24, CodeQL and browser/accessibility jobs. Their live PostgreSQL/Memgraph jobs were still in progress at report capture. Mainline-only signed lockfile/SBOM attestation was skipped by design on PR branch/push events and remains a post-merge mainline check.

**Do not promote draft PR #304 or claim full hosted acceptance until both replacement PostgreSQL/Memgraph jobs complete successfully and the PR has received review.** Candidate CI is not mainline release evidence and does not change the canonical main readiness result.
## Current open pull-request inventory

GitHub reported ten open pull requests at the time of this review. The inventory is a triage queue, not a recommendation to merge bot proposals in bulk.

| PR | Area | Recommended next review |
|---:|---|---|
| [#304](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/304) | F1.73 retained library quotas | Complete hosted live integration, review the transaction/retention semantics, then decide whether to mark ready and merge. |
| [#246](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/246) | Older per-site library quota proposal | Stale base and superseded by #304; leave open until #304 passes and merges, then close as superseded without merge. |
| [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257) | Tenant-scoped firewall policy, quotas and cache safety | Rebase/compare to current main; verify policy generation, cache invalidation and tenant isolation. |
| [#264](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/264) | Stripe webhook unauthenticated resource consumption | Inspect signature verification, bounded parsing, request admission and retry semantics. |
| [#265](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/265) | Per-customer checkout reservation limits | Verify transaction-level quota enforcement, idempotency and cross-request races. |
| [#266](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/266) | Public media-download resource exhaustion | Verify bounded ranges/bytes, streaming backpressure, rate limits and cache behavior. |
| [#267](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/267) | Stripe checkout reservation expiry | Verify provider idempotency, inventory release and concurrent webhook/expiry outcomes. |
| [#269](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/269) | Password-reset and mail-worker DoS/retry | Verify enumeration resistance, bounded queues, rate limits and retry ceilings. |
| [#270](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/270) | Plugin-registry resource exhaustion | Verify per-tenant limits, size bounds, pagination and fail-closed behavior. |
| [#274](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/274) | Password-reset timing/rate limiting | Verify comparable authentication work, observable response behavior and abuse controls. |

PR #247 was closed without merge; its source-version-bound public derivative protection is already present through merged F1.67 / PR #293. PR #302 was closed without merge as a redundant alternative to F1.70. These are repository-PR dispositions only. They do not resolve or suppress individual Aikido fingerprints.

Issue #277 remains an umbrella triage record; its older PR inventory must not be mistaken for a current repository-wide count. Aikido fingerprint mapping, independent validation, regression and rescanning remain required under the applicable security issues. A merged hardening PR or a clean aggregate CI run is not scanner-finding closure.

## Recommended execution sequence

1. Finish PR #304 hosted PostgreSQL/Memgraph and Node checks; inspect the exact test output and review threads before promoting the draft.
2. After #304 is accepted and merged, close stale PR #246 as superseded without merge. Do not merge its old-base patch separately.
3. Review #257 and the payment/media/plugin/authentication proposals individually against current main, reproducing the specific behavior and rejecting unsafe or redundant portions.
4. Progress independent evidence issues #14, #23 and #25, then provider-specific acceptance, full browser/accessibility, load/soak/recovery and production OTLP/deployment evidence.
5. Regenerate canonical readiness and supply-chain evidence from the exact release candidate only after the source is stable. Keep release-owner approval as a separate explicit gate.

## SemVer and release controls

Package.json and RELEASE-MANIFEST remain at 0.6.2. The package remains private and unreleased. F1.73 introduces no public API, migration, dependency or compatibility contract change and does not justify a version bump on its own. Do not create a tag, publish a package, create a GitHub Release, deploy, or promote until all 14 missing evidence records and both partial gates are resolved and canonical readiness explicitly reports readyForProduction=true.
