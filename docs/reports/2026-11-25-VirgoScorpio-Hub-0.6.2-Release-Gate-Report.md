# VirgoScorpio Hub 0.6.2 — Release Gate and Open PR Review

**Report date:** 25 November 2026 (America/Chicago)

**Latest verified mainline evidence:** Exact-main workflow #1396 / run 45693182743 completed successfully on 25 November 2026.

**Source baseline:** `main` at `de16a4275828fa6411800bbaf20c16b51186dc05`

**Package:** `0.6.2` (private, unreleased)

**Disposition:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

## Executive decision

The latest exact-main GitHub Actions run completed successfully on the exact `main` SHA. The canonical post-producer readiness artifact records **8 PASS, 2 PARTIAL, 0 BLOCKED, 14 MISSING_EVIDENCE, and 0 NOT_RUN**. Its `readyForProduction` value is `false`; the release classification is `NOT_PRODUCTION_CERTIFIED`.

The source, supported-runtime test matrices, hosted PostgreSQL/Memgraph integration, migration replay, browser smoke, CodeQL, signed lockfile/SBOM attestation, and evidence consolidation are green. These results establish a strong maintainer/CI baseline, not production certification. The two partial checks and fourteen missing independent/external evidence gates remain release blockers.

**No release tag, GitHub Release, package publication, SemVer increment, production deployment, or promotion is authorized.** Keep package version `0.6.2` unchanged and unreleased.

## Exact-main evidence

| Evidence | Verified result |
|---|---|
| Main source | `de16a4275828fa6411800bbaf20c16b51186dc05` |
| Exact-main workflow | [Run #45693182743](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743), 7/7 jobs successful |
| Canonical readiness artifact | [Artifact #15060181017](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743/artifacts/15060181017), ZIP SHA-256 `9470f180a43286e223177d46c15cf4ae13483cee4c3401d1a7b748aea8e12aae`; source de16a4275828fa6411800bbaf20c16b51186dc05; 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN |
| Readiness JSON / Markdown | Included in source-bound artifact #15060181017; hashes are recorded in the artifact manifest. |
| Node.js 22.23.4 | 965/965 Hub tests and 94/94 EnginEx tests; zero failures/skips; both npm audits reported 0 vulnerabilities |
| Node.js 24.22.1 | Supported-runtime workflow passed; npm audit reported 0 vulnerabilities |
| npm audit | Both supported-runtime jobs reported 0 vulnerabilities at the high-severity threshold |
| PostgreSQL/Memgraph | 195/195 hosted integration tests; zero failures/skips |
| Database migrations | 19/19 applied fresh; second pass skipped all 19 as already applied; disposable database removed |
| Memgraph recovery | Real outage left the event pending and released the lease; replay succeeded after restart without duplicate delivery |
| Graph rebuild | Canonical content/relationships rebuilt; tombstones preserved, stale nodes removed, safety limit respected, and second rebuild deterministic |
| Browser smoke | Chromium Playwright suite passed 9/9 |
| Static analysis | CodeQL job succeeded |
| Supply-chain | Mainline lockfile/SBOM provenance and signature verification succeeded |
| Evidence aggregation | Five producer bundles were verified against the exact run, attempt, source revision, manifests and checksums before canonical readiness finalization |

### Source-bound supply-chain evidence

Mainline supply-chain artifact [#15060225901](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743/artifacts/15060225901) has ZIP SHA-256 `01df4d2557f132c4fa4afd74fd41349b95131bc3cdff8c1d8e7c9c9c8184cff7`. Attestation verification is bound to `refs/heads/main` and exact source revision `de16a4275828fa6411800bbaf20c16b51186dc05`.

Verified subjects include the unchanged `package-lock.json` and CycloneDX 1.5 SBOM; the bundle contains signed provenance verification results for the lockfile and generated SBOM. Node 22/24 dependency inventories and audits passed; PR #256 introduced no dependency or lockfile change.

This is cryptographic provenance and automated audit evidence; it is **not** qualified human dependency/license approval. Human review issue #23 remains open. The exact-main readiness and supply-chain artifacts are retained by GitHub Actions subject to repository retention settings.

### Capture-time distinction

The consolidated `release-readiness-ci.json` records the aggregate workflow as `in_progress` because it is generated while the aggregate job is executing. The canonical `release-readiness.json` separately records `FINALIZED_AFTER_PRODUCER_VALIDATION` and binds all producers to run `45655407126`, attempt 1, and the exact source SHA. GitHub records the completed workflow as successful with all seven jobs successful. Do not mistake the intermediate capture-time workflow status for the final run conclusion.

## Formal gate disposition

The canonical artifact's exact classification is:

| Status | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

The two partial checks are intentional and must not be promoted to PASS by inference:

1. **Reviewed lockfile / dependency review — PARTIAL.** A tracked lockfile and fresh isolated `npm ci` are verified; npm audit reported zero high/critical vulnerabilities and signed provenance is green. Qualified human review of dependency licenses, risk and SBOM remains outstanding (issue #23).
2. **Service-less integration diagnostic — PARTIAL.** Each Node matrix diagnostic reports 50 integration tests, 1 pass and 49 skipped because hosted services are not available in that test context. Those skips are not counted as live integration evidence. The separate hosted PostgreSQL/Memgraph producer passed 194/194 with zero skips.

The following fourteen production evidence records are still missing:

| # | Required evidence | Current gap / owner reference |
|---:|---|---|
| 1 | Independent tenant-isolation and authorization review | No accepted independent assessment; issue [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) remains open. |
| 2 | OIDC/SAML, email delivery and MFA recovery end-to-end | Live identity-provider, mailbox, recovery and failure-path acceptance not evidenced. |
| 3 | ClamAV, malicious-file corpus and legacy-asset quarantine | Live scanner/corpus and quarantine behavior not evidenced. |
| 4 | Live S3/GCS/Azure/S3-compatible provider operations | Real credentials, least-privilege access and lifecycle tests not evidenced. |
| 5 | Stripe webhook and inventory lifecycle | Replay/order/idempotency, ambiguous outcomes and reservation lifecycle not evidenced against live Stripe. |
| 6 | Full browser editor and accessibility acceptance | Smoke is green; full Playwright journeys and manual WCAG/screen-reader acceptance remain missing. |
| 7 | Commerce parity acceptance | Tax, shipping, discounts, refund, fulfillment, download and subscription scenarios not accepted. |
| 8 | Community parity acceptance | Privacy, abuse, search, export/deletion and forum acceptance not evidenced. |
| 9 | Signed plugin pipeline and adversarial container isolation | Signing/provenance and adversarial runtime-isolation evidence not accepted. |
| 10 | Human-reviewed dependency/SBOM/provenance/CodeQL assessment | Automated checks and attestation passed; qualified human review remains missing (issue [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23)). |
| 11 | Load/soak, fault injection, backup/restore and recovery drills | Reproducible operational capacity and recovery evidence missing; issue [#24](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/24). |
| 12 | Independent platform security assessment and severe-finding remediation | No independent assessment accepted; issue [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25). |
| 13 | Deployment runbooks, secrets, rollback, monitoring and release approval | Operational controls and explicit release-owner approval missing; issues [#26](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/26) and [#13](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/13). |
| 14 | Production OTLP observability backend, security, governance and delivery | No deployment-approved production backend manifest or accepted operational evidence. |

The current missing-gate filenames and strict source-revision contract remain defined by `scripts/release-readiness-gates.js`, `scripts/release-readiness.js`, and [RELEASE-EVIDENCE.md](../RELEASE-EVIDENCE.md). Every external evidence record must be bound to the exact candidate version and full source SHA; evidence must be regenerated after source changes. Do not backfill a stale record by editing its `sourceRevision`.

## Mainline changes since the previous report baseline

The previous report predates the F1.70 and F1.71 security increments. Current main is `de16a4275828fa6411800bbaf20c16b51186dc05`; mainline includes the F1.70 library-route authorization fix and F1.71 MFA enrollment step-up reauthentication.

| PR | Mainline result | Change |
|---:|---|---|
| [#239](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/239) | Merged | Bounded plugin-runner admission control. |
| [#240](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/240) | Merged | Bounded container concurrency and awaited orphan cleanup. |
| [#242](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/242) | Merged at current main tip | Enforced content-type capabilities and publication policy on record/workflow routes, with the selected type pinned through the locked transition. |
| [#248](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/248) | Merged | Replaced duplicated release gate metadata with one immutable 15-record registry shared by the report generator and CI validator; added cross-check coverage. |
| [#250](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/250) | Merged | Added login CSRF protections and Origin/content-type validation. |
| [#251](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/251) | Merged | Revalidated site-management authority inside the membership mutation transaction to close a stale-authorization race. |

These changes supersede the previous report's pending work on PRs #239, #240, #242, #248 and #251. The merged code is included in the current exact-main tests; none of these changes independently closes the external evidence gates above.

## F1.70 merged — library route authorization before body parsing (PR #252)

F1.70 / [PR #252](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/252) merged at main SHA `7a99e93471bb6e49376e2568544fe44aac484b47` on 25 November 2026. The library route now authorizes selected-site membership and `library:manage` before `readJson`; unauthorized callers cannot trigger request-body buffering or JSON parsing through these library write routes. Once authorized and parsed, a non-empty optional body `siteId` is reconciled against route/header/query selectors before persistence using `requireMembership: false` so membership is not redundantly queried. GET/list and download routes remain parser-free.

Regression coverage verifies pre-parser denials for upload, version replacement, metadata update and deletion; authorized upload ordering; GET/download parser avoidance; and conflicting body-site rejection. Prior 50-75 MiB test-string allocations were replaced by small parser-observation sentinels. The source-anchored tenant-isolation inventory was regenerated (28 families / 80 route patterns / 22 source files / 61 referenced test files); libraries/media and security/threat-model docs now state the same control.

Exact-main [workflow #1385 / run 45655407126](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45655407126) passed all seven jobs: Node 22/24 each 946/946 Hub and 94/94 EnginEx tests; PostgreSQL/Memgraph 195/195 with zero failures/skips; 19/19 fresh migrations and 19/19 idempotent second-pass checks; browser/accessibility smoke 9/9; CodeQL; signed lockfile/SBOM attestation; and exact-source evidence consolidation. Local Node.js 26.12.1 npm run check passed 943/946 (zero failures, three conditional Windows skips); artifact verification passed 241 required paths / 292 JavaScript files.

Canonical readiness [artifact #15042921303](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45655407126/artifacts/15042921303) is source-bound to `7a99e93471bb6e49376e2568544fe44aac484b47`, ZIP SHA-256 `3a6d315c802fba0baebfa9126a0e468a89b77c08495604b245df47ff8ff69be1`, with 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `readyForProduction=false`, NOT_PRODUCTION_CERTIFIED / NO-GO. Mainline signed supply-chain [artifact #15042467676](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45655407126/artifacts/15042467676) has ZIP SHA-256 `b706d946edba9883c25811c4fd86addf58fc790f002e2103009a8ae15ff813e6`; verified subjects include unchanged package-lock and CycloneDX 1.5 SBOM (200 components / 201 dependency records).

PR #302 was closed without merge as a redundant/superseded alternative; it is not an additional mainline change. This mitigation does not close or map an Aikido scanner fingerprint: issues #234/#235/#277 remain separate. Maintainer code review and CI do not replace independent tenant review #14, human dependency/license review #23 or platform assessment #25. No schema, migration, API response, dependency, lockfile, package version or SemVer change; package 0.6.2 remains private/unreleased.

## F1.71 merged — MFA enrollment step-up reauthentication (PR #256)

PR [#256](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/256) merged to main at `de16a4275828fa6411800bbaf20c16b51186dc05` on 25 November 2026. The service requires the current account password for MFA enrollment and, if MFA is already enabled, also requires current TOTP or an unused recovery code before generating a replacement secret. Proof validation and recovery-code consumption run transactionally while the active user record is locked. Pending, unconfirmed secrets cannot authenticate login. The authenticated route reads a bounded 16 KiB body and rejects developer actors before parsing; the Studio UI uses masked, cleared inputs instead of browser prompts.

Exact-head PR workflow [#1395 / run 45691406209](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45691406209) passed both Node matrices, PostgreSQL/Memgraph 195/195, browser/accessibility 9/9, CodeQL and candidate evidence consolidation. Focused local auth route/service tests passed 32/32. Post-merge exact-main workflow [#1396 / run 45693182743](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45693182743) passed 7/7: Node 22/24, PostgreSQL/Memgraph 195/195, 19/19 fresh/idempotent migrations, browser 9/9, CodeQL, signed lockfile/SBOM attestations and exact-source evidence aggregation. Readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; readyForProduction=false; NO-GO. No schema, migration, dependency, lockfile, HTTP response or SemVer change.

## F1.72 active candidate — public query-loop amplification containment (PR #253)

PR [#253](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/253) is synchronized with main `de16a4275828fa6411800bbaf20c16b51186dc05`. Public page delivery groups duplicate query-loop content types and runs at most five selected-site/locale/excluded-page-scoped published-content queries per response, with no more than 12 results per type. Each widget consumes the requested prefix from the shared group result. New page documents retain the five-loop validator cap; a narrowly enabled legacy published-page renderer mode relaxes only that count check after the same route-level query ceiling has been enforced. Node/depth and rendered-output limits remain active.

Exact-head PR workflow [#1398 / run 45695665362](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45695665362) passed Node 22/24 (975/975 each, zero failures/skips), PostgreSQL/Memgraph (195/195, zero failures/skips), 19/19 fresh and idempotent migrations, browser/accessibility (9/9), CodeQL and candidate evidence consolidation (CI EVIDENCE: PASS). PR-context lockfile/SBOM attestation is skipped by design and remains required after merge on main. Local Node.js 26.12.1 npm run check passed 975 tests (972 passed, zero failures, three conditional Windows skips); artifact verification passed 241 required paths / 294 JavaScript files. EnginEx 7.0.0 passed 94 tests (91 passed, zero failures, three conditional Windows skips). npm ci installed 178 packages and npm audit reported zero vulnerabilities (one deprecated transitive package warning only). Tenant inventory is current at 28 families / 80 route patterns / 22 source files / 61 test references. The aggregate Aikido source does not provide this candidate’s fingerprint; the PR does not resolve or disposition an individual scanner finding.

## F1.69 merged — PR #299

F1.69 PR [#299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) merged to main at `9d60df85a3c160f54c27b822d72053fe3dd38d4f` on 25 November 2026; issue [#298](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/298) is CLOSED. The transaction revalidates both participants’ active-account status and selected-site memberships after the direct-pair advisory lock, under deterministic site → user → membership lock ordering, before block checks or conversation/member/notification side effects. Existing generic non-disclosing 404 behavior and API/wire contract remain unchanged.

Exact-head push/PR runs [#45637000522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45637000522) / [#45637014263](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45637014263) passed, including the recipient-membership, recipient-account and actor-membership revocation races. Post-merge exact-main [workflow #1372](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45643744686) passed 7/7, including Node 22/24 (938/938 Hub and 94/94 EnginEx), PostgreSQL/Memgraph (195/195), 19/19 fresh/idempotent migrations, browser 9/9, CodeQL, signed lockfile/SBOM attestation and exact-source readiness consolidation. Canonical readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

The PR also updates session last_seen_at throttling to skip redundant fresh-session writes while preserving guarded best-effort stale-session touches. Its PostgreSQL lock observer has a relation-aware mode that confirms blocker PID plus relation/tuple/transaction-ID wait evidence when query text is stale; the default query-fragment mode remains. Local Node.js 26.12.1 npm run check passed 938 tests (935 pass, 0 fail, three conditional Windows skips); artifact verification passed 241 required paths / 292 JavaScript files; tenant inventory regenerated at 28 families / 80 route patterns / 22 source files / 61 test references. Maintainer technical self-review is recorded in PR #299; this does not replace independent tenant/site review #14, platform security assessment #25 or dependency/license review #23. No schema, migration, dependency, lockfile, API or SemVer change; package 0.6.2 remains private/unreleased.

## Open pull-request inventory

GitHub currently reports **10 open pull requests**.

| PR | Area | Next review / engineering action |
|---:|---|---|

| [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257) | Tenant-scoped firewall, quotas and cache safety | Review policy generation/cache invalidation, tenant context, fail-closed refresh and multi-replica behavior as one consolidated change. |
| [#246](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/246) | Per-site storage quotas | Validate cumulative legacy/versioned object accounting across every storage adapter and transactional replace/delete behavior. |
| [#264](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/264) | Stripe webhook resource bounds | Verify signature validation precedes body processing; test bounded reads, connection cleanup and timeout semantics. |
| [#265](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/265) | Checkout reservation limits | Verify customer normalization, advisory lock order and product/stock reservation invariants. |
| [#267](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/267) | Stripe checkout expiry | Reconcile provider-authoritative expiry and webhook outcomes before releasing stock holds. |
| [#266](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/266) | Public media download limits | Ensure concurrency controls cover public asset/variant delivery and preserve correct 404/503 behavior. |
| [#269](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/269) | Password-reset/mail-worker bounds | Verify durable enqueue-before-acknowledge and retryable terminal/transient delivery semantics. |
| [#274](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/274) | Password-reset timing/rate limits | Ensure user enumeration is bounded and mail work is durably queued; validate interactions with already merged auth changes. |
| [#256](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/256) | MFA enrollment credential guard | Verify password/TOTP/recovery reauthentication, re-enrollment and recovery paths. |
| [#253](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/253) | Query-loop resource bounds | Validate bounded work, result pagination and compatibility with large legitimate collections. |
| [#270](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/270) | Plugin registry limits | Verify manifest and registry size/entry quotas, pagination compatibility and tenant isolation. |

PR #302 was closed without merge as a redundant alternative superseded by the merged PR #252. PR #256 and #258 have merged; the current open inventory contains 10 pull requests.

## Recommended development sequence

1. **Finish F1.72 / PR #253 after maintainer self-review.** Exact-head hosted workflow #1398 passed every applicable job and local Node 26 / EnginEx checks passed with only documented Windows conditional skips. The Aikido fingerprint mapping remains unverified. After merge, require exact-main signed provenance/readiness; then review #246 library quotas and #257 firewall/cache/resource-boundary consolidation one increment at a time.
2. **Continue the remaining resource-exhaustion backlog by threat surface.** After #246/#257, review webhook/checkout/media PRs (#264, #265, #267, #266), mail/auth (#269, #274) and plugin registry (#270). Revalidate each on current main and regenerate inventories only after integration.
3. **Keep independent assurance separate from implementation.** Arrange qualified reviewers for #14, #23 and #25; run load/restore drills for #24; obtain explicit operations and release-owner approvals for #26/#13; complete governance controls tracked by #32; and obtain the deployment-controlled OTLP/observability evidence.
4. **Re-run the exact-main release workflow after every merge.** The current readiness snapshot is bound to `de16a4275828fa6411800bbaf20c16b51186dc05` by workflow #1396; any new source SHA requires fresh evidence. Never copy old evidence or edit a SHA into an old record.

## Release boundary

Package `0.6.2` remains private and unreleased. No SemVer increment is justified by this documentation refresh or authorized by the release gate. No release tag, GitHub Release, npm publication, production deployment, or promotion is permitted while the canonical report remains `NOT_PRODUCTION_CERTIFIED`.
