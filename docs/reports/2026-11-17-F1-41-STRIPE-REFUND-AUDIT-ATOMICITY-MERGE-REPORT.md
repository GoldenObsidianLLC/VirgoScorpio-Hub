# F1.41 — Stripe Refund Audit Atomicity (merged implementation report)

**Assessment date:** 16 November 2026 (America/Chicago); GitHub CI/evidence timestamps are UTC on 17 November 2026.
**Status:** Merged to main through [PR #176](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/176).
**Issue:** [#175](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/175) remains OPEN pending maintainer close-out.
**Implementation commit:** `c60c0448de676e06f7b22b399107a8e61674b8af`.
**Merge / current main SHA:** `eb6fe4c8672dadd98892a62062ecf718ce9393b6`.
**Exact-main CI:** [workflow #703](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43996617110), run ID `43996617110`, all 7/7 jobs successful.
**Decision:** Engineering increment accepted by exact-main CI; **PRODUCTION NO-GO / NOT_PRODUCTION_CERTIFIED** remains unchanged.

## Executive summary

F1.41 makes the local persistence of a Stripe refund provider response and its correlated `commerce.refund_requested` audit atomic. The external Stripe request remains outside PostgreSQL; this is not a distributed transaction and PostgreSQL rollback cannot reverse a refund Stripe has already accepted.

The route now writes provider refund ID/status, any corresponding fully-refunded order transition, and the metadata-only audit event using the same checked-out PostgreSQL transaction queryable, awaiting the audit before COMMIT. On audit failure, local provider binding/status/order changes roll back while the durable refund reservation remains available for recovery. Retrying the same public idempotency key reuses the stable `vsh_refund_<local refund id>` Stripe idempotency key. Terminal replay does not make another provider call or emit a second audit.

No database schema or migration, public API/response contract, runtime dependency, lockfile, package version, or SemVer change was required.

## Implementation and regression scope

- Reuse the existing provider-response transaction boundary; no new transaction abstraction or second database connection was introduced.
- Preserve the established Stripe request placement outside PostgreSQL, stable provider idempotency key, order-then-refund lock order, terminal-state guard, reservation behavior, site scoping, capability checks, response shape, and error identity.
- Pass the exact provider-response transaction queryable into `identity.audit(..., { queryable })`; await it before COMMIT.
- Add a route-level unit regression asserting the exact transaction client reaches the audit callback and audit precedes COMMIT.
- Add `test/integration/stripe-refund-audit-atomicity.integration.test.js` with a uniquely site-scoped PostgreSQL trigger failure. It proves rollback of the local provider ID/status/order transition, same-key recovery to one provider refund and one correlated audit row, and side-effect-free terminal replay.
- Stripe is stubbed in the regression. This validates local persistence/recovery semantics, not live Stripe provider behavior.

## Local validation

Local candidate validation on Windows / Node.js 26.12.1:

| Check | Result |
|---|---|
| `npm run check` | PASS — 643 passed, 0 failed, 3 Windows-specific skips (646 registered). |
| Focused refund unit + dedicated PostgreSQL regression | PASS — 17/17, zero skips (13 unit tests plus the integration parent and three subtests). |
| Fresh PostgreSQL 18 setup | PASS — all 18 migrations applied to a new disposable database. |
| Failure-injection / retry / replay | PASS — audit failure leaves the durable reservation `requested`, no provider refund ID bound locally, the order `paid`, and no refund audit row; same-key retry recovers the same stubbed provider refund and commits one correlated audit; terminal replay adds no call or audit. |
| Tenant inventory | PASS — 27 families, 78 route patterns, 21 source files, 49 test files. |
| Full and production-only npm audit | PASS — zero vulnerabilities in each audit scope. |
| Markdown links / whitespace | PASS — 538 relative links across 176 Markdown files, zero broken; `git diff --check` clean. Final docs-branch `npm run check` also passed 643 tests / 0 failed / 3 Windows-specific skips. |

## Exact-main hosted validation — workflow #703

PR #176's exact-head CI [workflow #702](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43991407172) completed successfully on the PR head. The mainline merge was then independently validated by exact-main push [workflow #703](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/43996617110) against merge SHA `eb6fe4c8672dadd98892a62062ecf718ce9393b6`. All seven jobs completed successfully:

| Producer / job | Result |
|---|---|
| Node.js 22.23.4 | PASS — Hub 646/646; EnginEx 94/94; zero failures/skips. |
| Node.js 24.22.1 | PASS — Hub 646/646; EnginEx 94/94; zero failures/skips. |
| PostgreSQL / Memgraph | PASS — 115/115 live integration tests; zero failures/skips, including F1.41 failure-injection, same-key recovery, and terminal replay. |
| Fresh and idempotent migrations | PASS — 18/18 migrations applied; 18/18 second-pass idempotency checks passed. |
| PostgreSQL-backed collaboration browser suite | PASS — 4/4. |
| Browser editor/accessibility smoke | PASS — 9/9 Playwright smoke tests; this is not full manual WCAG or assistive-technology acceptance. |
| CodeQL | PASS — static analysis succeeded; this is not an independent application-security assessment. |
| Signed mainline attestations | PASS — SLSA build provenance and CycloneDX SBOM attestations were created, signed, uploaded to the transparency log/repository, and verified. |
| Evidence consolidation | PASS — source-bound producer evidence and canonical readiness were finalized. |

The integration job also passed real Memgraph outage/replay and canonical graph rebuild checks. Both full and production-only npm audit scopes reported zero vulnerabilities for each runtime.

Mainline attestations: [SLSA build provenance](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68411563) and [CycloneDX SBOM](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68411568). Lockfile SHA-256 remains `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`.

### Retained workflow #703 artifacts

The SHA-256 values below are GitHub ZIP archive digests, not hashes of files inside each archive.

| Evidence | Artifact ID | Archive SHA-256 |
|---|---:|---|
| Canonical release-readiness CI bundle | 14290516898 | `1e9cf157025b2fc0338c624b28a971993152f441e732d2d5251c1b938583ba16` |
| Node.js 22 CI evidence | 14290272065 | `05785f5049800e39dc258b6ac9c4fc73a116dd910adf4a38152daf51ca0e4f19` |
| Node.js 24 CI evidence | 14289227766 | `ed11682abce36f2b385a82ac88914f85ac201777b1b8a00f516994f87b858b7f` |
| PostgreSQL/Memgraph producer evidence | 14289519267 | `411bc3769c9ec9b5ae69eedf4b9c50119121a13c68505c8a774b956de8614715` |
| Live integration Node.js 22 evidence | 14290022564 | `62350aa70bbc9158c2296f170e6a665029f27f331c56106457f737ebdf29727b` |
| Browser/accessibility smoke evidence | 14290366833 | `900e1f67cdb96cc9995ab7d414f70e793ea78148356ef56ab96e7871574f4f5d` |
| CodeQL evidence | 14290810676 | `1c9a68d02ad3ce152d730021499cbf8216ef106cf30c8f30396ac6fef21af0b8` |
| Signed supply-chain attestation bundle | 14289509139 | `62bad3d08f0aba4a711bf5d7975de9e06327afbbb05915c37550149ee22b6329` |
| Node.js 22 dependency evidence | 14290242144 | `e4cabd6d8eb773a54fd4e2b9dbdcf1d0a281481e3cff5c4caaa9bb361e82fee3` |
| Node.js 24 dependency evidence | 14289622488 | `22b725d587224e41cdb33310a9979e2ea7d788b78d0274f843945542d6056428` |

## Release readiness and remaining gates

The canonical readiness artifact was generated at `2026-11-17T01:38:09.077Z`, source-bound to merge SHA `eb6fe4c8672dadd98892a62062ecf718ce9393b6`. Its final aggregate is:

| Classification | Count |
|---|---:|
| PASS | 8 |
| PARTIAL | 2 |
| BLOCKED | 0 |
| MISSING_EVIDENCE | 14 |
| NOT_RUN | 0 |

`readyForProduction` remains `false`; release classification remains `NOT_PRODUCTION_CERTIFIED`. The PARTIAL classifications remain human lockfile/dependency/license review and service-less integration diagnostics (40 skips per supported Node runtime); those skipped diagnostics are distinct from the 115/115 live database integration tests.

The 14 missing production gates remain: tenant-isolation-review, identity-provider-e2e, clamav-corpus, cloud-live-providers, stripe-live-lifecycle, browser-accessibility, commerce-parity-acceptance, community-parity-acceptance, plugin-container-isolation, dependency-sbom-codeql, load-backup-restore, independent-security-review, operations-release-approval, and observability-production.

F1.41 does not satisfy live Stripe lifecycle/webhook/provider qualification. The hosted Stripe refund regression still uses a deterministic provider stub. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; qualified dependency/license review #23 remains OPEN / PARTIAL. CodeQL, CI, and maintainer merges do not constitute independent security or legal approval.

## Governance, compatibility, and next steps

PR #176 merged at `2026-11-17T01:34:31Z` from implementation head `f15af08e8a0647da56328a8be2717ea41c674ae0`; mainline workflow #703 then passed on merge commit `eb6fe4c8672dadd98892a62062ecf718ce9393b6`. GitHub records zero formal review submissions and zero inline review threads for PR #176. The merge and CI are maintainer/automation evidence only. Issue #175 remains OPEN for maintainer close-out; do not treat it as independent review or production approval.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No schema/migration, API, dependency, lockfile or SemVer change occurred. No tag, GitHub Release, npm publication or production deployment is proposed. Production remains NO-GO until the missing gates are formally satisfied.

Recommended next engineering step: complete maintainer review/close-out of issue #175, then inspect the remaining open items under parent #124 and the source-anchored tenant inventory to choose one bounded F1.42 increment based on a confirmed code-level gap. Continue to keep independent reviews #14/#25 and dependency/license review #23 visible as separate assurance gates.
