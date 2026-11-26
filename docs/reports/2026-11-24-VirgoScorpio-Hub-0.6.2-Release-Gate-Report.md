# VirgoScorpio Hub 0.6.2 — Release Gate and Open PR Review

**Report date:** 25 November 2026 (America/Chicago)

**Latest verified mainline evidence:** Exact-main workflow #1372 completed successfully on 25 November 2026.

**Source baseline:** `main` at `9d60df85a3c160f54c27b822d72053fe3dd38d4f`

**Package:** `0.6.2` (private, unreleased)

**Disposition:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

## Executive decision

The latest exact-main GitHub Actions run completed successfully on the exact `main` SHA. The canonical post-producer readiness artifact records **8 PASS, 2 PARTIAL, 0 BLOCKED, 14 MISSING_EVIDENCE, and 0 NOT_RUN**. Its `readyForProduction` value is `false`; the release classification is `NOT_PRODUCTION_CERTIFIED`.

The source, supported-runtime test matrices, hosted PostgreSQL/Memgraph integration, migration replay, browser smoke, CodeQL, signed lockfile/SBOM attestation, and evidence consolidation are green. These results establish a strong maintainer/CI baseline, not production certification. The two partial checks and fourteen missing independent/external evidence gates remain release blockers.

**No release tag, GitHub Release, package publication, SemVer increment, production deployment, or promotion is authorized.** Keep package version `0.6.2` unchanged and unreleased.

## Exact-main evidence

| Evidence | Verified result |
|---|---|
| Main source | `9d60df85a3c160f54c27b822d72053fe3dd38d4f` |
| Exact-main workflow | [Run #45643744686](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45643744686), 7/7 jobs successful |
| Canonical readiness artifact | [Artifact #15036303131](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45643744686/artifacts/15036303131); source 9d60df85a3c160f54c27b822d72053fe3dd38d4f; 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN |
| Readiness JSON | SHA-256 `05351a05118092679be2fc57bcfb9d9e74dcaf377a2287aab70f9abdea32c1da` |
| Readiness Markdown | SHA-256 `8786620244c7a4979010d5938d803e44f6559a7d554c9b58cf70ef161fc3ce9e` |
| Node.js 22.23.4 | 938/938 Hub tests and 94/94 EnginEx tests; zero failures/skips |
| Node.js 24.22.1 | 938/938 Hub tests and 94/94 EnginEx tests; zero failures/skips |
| npm audit | Both supported-runtime jobs reported 0 vulnerabilities at the high-severity threshold |
| PostgreSQL/Memgraph | 195/195 hosted integration tests; zero failures/skips, including F1.69 participant-revocation races |
| Database migrations | 19/19 applied to a fresh database; second pass skipped all 19 as already applied; disposable database removed |
| Memgraph recovery | Real outage left the event pending and released the lease; replay succeeded after restart without duplicate delivery |
| Graph rebuild | Canonical content/relationships rebuilt; tombstones preserved, stale nodes removed, safety limit respected, and second rebuild deterministic |
| Browser smoke | Chromium Playwright suite passed 9/9 |
| Static analysis | CodeQL job succeeded |
| Supply-chain | Mainline lockfile/SBOM provenance and signature verification succeeded |
| Evidence aggregation | Five producer bundles were verified against the exact run, attempt, source revision, manifests and checksums before canonical readiness finalization |

### Source-bound supply-chain evidence

Mainline supply-chain artifact [#14979123447](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45518406995/artifacts/14979123447) has ZIP SHA-256 `8f1d7208b49fb528099cfb4a49671f1407a47a81207a82133e9e937e122b272a`. The attestation verification is bound to `refs/heads/main` and source revision `425162a9c9a297301a1aecb61fc96fbbd4ce8cf9`.

Verified subjects include:

- `package-lock.json`: SHA-256 `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`.
- CycloneDX SBOM: SHA-256 `e702b18a794edce714d0cf7e956643517f9eaff5e7c0c5c7432155a669a17397`.
- SBOM format: CycloneDX 1.5; 200 components and 201 dependency records.
- Node 22/24 SBOM inventories and dependency graphs matched using the pinned npm CLI.

This is cryptographic provenance and automated audit evidence; it is **not** qualified human dependency/license approval. The mainline evidence bundle is retained by GitHub Actions through 23 February 2027, subject to repository retention settings.

### Capture-time distinction

The consolidated `release-readiness-ci.json` records the aggregate workflow as `in_progress` because it is generated while the aggregate job is executing. The canonical `release-readiness.json` separately records `FINALIZED_AFTER_PRODUCER_VALIDATION` and binds all producers to run `45518406995`, attempt 1, and the exact source SHA. GitHub records the completed workflow as successful with all seven jobs successful. Do not mistake the intermediate capture-time workflow status for the final run conclusion.

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

The previous report used main SHA `287508b16d9c7d3156fab07f975413de2c659ae0`. The current mainline has since incorporated the following security and release-integrity work:

| PR | Mainline result | Change |
|---:|---|---|
| [#239](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/239) | Merged | Bounded plugin-runner admission control. |
| [#240](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/240) | Merged | Bounded container concurrency and awaited orphan cleanup. |
| [#242](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/242) | Merged at current main tip | Enforced content-type capabilities and publication policy on record/workflow routes, with the selected type pinned through the locked transition. |
| [#248](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/248) | Merged | Replaced duplicated release gate metadata with one immutable 15-record registry shared by the report generator and CI validator; added cross-check coverage. |
| [#250](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/250) | Merged | Added login CSRF protections and Origin/content-type validation. |
| [#251](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/251) | Merged | Revalidated site-management authority inside the membership mutation transaction to close a stale-authorization race. |

These changes supersede the previous report's pending work on PRs #239, #240, #242, #248 and #251. The merged code is included in the current exact-main tests; none of these changes independently closes the external evidence gates above.

## F1.69 merged — PR #299

F1.69 PR [#299](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/299) merged to main at `9d60df85a3c160f54c27b822d72053fe3dd38d4f` on 25 November 2026; issue [#298](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/298) is CLOSED. The transaction revalidates both participants’ active-account status and selected-site memberships after the direct-pair advisory lock, under deterministic site → user → membership lock ordering, before block checks or conversation/member/notification side effects. Existing generic non-disclosing 404 behavior and API/wire contract remain unchanged.

Exact-head push/PR runs [#45637000522](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45637000522) / [#45637014263](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45637014263) passed, including the recipient-membership, recipient-account and actor-membership revocation races. Post-merge exact-main [workflow #1372](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/45643744686) passed 7/7, including Node 22/24 (938/938 Hub and 94/94 EnginEx), PostgreSQL/Memgraph (195/195), 19/19 fresh/idempotent migrations, browser 9/9, CodeQL, signed lockfile/SBOM attestation and exact-source readiness consolidation. Canonical readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, readyForProduction=false, NOT_PRODUCTION_CERTIFIED / NO-GO.

The PR also updates session last_seen_at throttling to skip redundant fresh-session writes while preserving guarded best-effort stale-session touches. Its PostgreSQL lock observer has a relation-aware mode that confirms blocker PID plus relation/tuple/transaction-ID wait evidence when query text is stale; the default query-fragment mode remains. Local Node.js 26.12.1 npm run check passed 938 tests (935 pass, 0 fail, three conditional Windows skips); artifact verification passed 241 required paths / 292 JavaScript files; tenant inventory regenerated at 28 families / 80 route patterns / 22 source files / 61 test references. Maintainer technical self-review is recorded in PR #299; this does not replace independent tenant/site review #14, platform security assessment #25 or dependency/license review #23. No schema, migration, dependency, lockfile, API or SemVer change; package 0.6.2 remains private/unreleased.

## Open pull-request inventory

GitHub currently reports **13 open pull requests**. The workflow results in this table are not represented as current-head passes; each candidate must be rebased/merged with current main and revalidated on its final head before merge.

| PR | Area | Next review / engineering action |
|---:|---|---|

| [#257](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/257) | Tenant-scoped firewall, quotas and cache safety | Review policy generation/cache invalidation, tenant context, fail-closed refresh and multi-replica behavior as one consolidated change. |
| [#246](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/246) | Per-site storage quotas | Validate cumulative legacy/versioned object accounting across every storage adapter and transactional replace/delete behavior. |
| [#252](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/252) | Library-route request body limits | Confirm limits apply before buffering and do not bypass site/tenant authorization or legitimate large-upload workflows. |
| [#264](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/264) | Stripe webhook resource bounds | Verify signature validation precedes body processing; test bounded reads, connection cleanup and timeout semantics. |
| [#265](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/265) | Checkout reservation limits | Verify customer normalization, advisory lock order and product/stock reservation invariants. |
| [#267](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/267) | Stripe checkout expiry | Reconcile provider-authoritative expiry and webhook outcomes before releasing stock holds. |
| [#266](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/266) | Public media download limits | Ensure concurrency controls cover public asset/variant delivery and preserve correct 404/503 behavior. |
| [#269](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/269) | Password-reset/mail-worker bounds | Verify durable enqueue-before-acknowledge and retryable terminal/transient delivery semantics. |
| [#274](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/274) | Password-reset timing/rate limits | Ensure user enumeration is bounded and mail work is durably queued; validate interactions with already merged auth changes. |
| [#258](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/258) | Email-verification rate limit | Test per-IP limits, shared connection-pool pressure and tenant-safe keying. |
| [#256](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/256) | MFA enrollment credential guard | Verify password/TOTP/recovery reauthentication, re-enrollment and recovery paths. |
| [#253](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/253) | Query-loop resource bounds | Validate bounded work, result pagination and compatibility with large legitimate collections. |
| [#270](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/270) | Plugin registry limits | Verify manifest and registry size/entry quotas, pagination compatibility and tenant isolation. |

## Recommended development sequence

1. **Review the remaining runtime security candidates.** F1.69 / PR #299 is merged. Start with PR #252 (library-route authorization before body parsing), then review the auth/resource bounds and storage quotas against current main. Resolve #246 and #257 merge conflicts manually; never discard either side of tenant/security changes.
2. **Continue the resource-exhaustion/security backlog by threat surface.** Review #257, #246 and #252 first for tenant policy and unbounded request/storage surfaces; then webhook/checkout/media PRs (#264, #265, #267, #266), mail/auth (#269, #274, #258, #256), query-loop (#253), and plugin registry (#270). Revalidate each on current main, regenerate source-anchored inventories only after integration, and fix behavioral failures rather than refreshing generated inventory alone.
3. **Keep independent assurance separate from implementation.** Arrange qualified reviewers for #14, #23 and #25; run load/restore drills for #24; obtain explicit operations and release-owner approvals for #26/#13; complete governance controls tracked by #32; and obtain the deployment-controlled OTLP/observability evidence.
4. **Re-run the exact-main release workflow after every merge.** The current readiness snapshot is bound to `425162a9c9a297301a1aecb61fc96fbbd4ce8cf9`; any new source SHA requires fresh evidence. Never copy old evidence or edit a SHA into an old record.

## Release boundary

Package `0.6.2` remains private and unreleased. No SemVer increment is justified by this documentation refresh or authorized by the release gate. No release tag, GitHub Release, npm publication, production deployment, or promotion is permitted while the canonical report remains `NOT_PRODUCTION_CERTIFIED`.
