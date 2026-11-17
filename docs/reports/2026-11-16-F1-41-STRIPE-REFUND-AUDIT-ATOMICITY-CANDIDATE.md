# F1.41 Candidate — Stripe Refund Audit Atomicity

**Status:** Candidate implementation committed locally; issue [#175](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/175) remains OPEN. No pull request has been opened yet. This report is maintainer-prepared candidate evidence, not merged-main, independent-review, live-provider, or production acceptance.

- **Branch:** `security/f1-41-stripe-refund-audit-atomicity-2026-11-16`
- **Base main:** `7f8de5d07687aa0526e7a152d831a88be64389c8`
- **Implementation commit:** `c60c044` — `fix(commerce): persist refund audit atomically`
- **Package:** `virgoscorpio-hub@0.6.2` (unchanged)

## Problem and scope

The refund route reserved an idempotent refund and called Stripe before it persisted the provider response and transitioned local refund/order state. The Stripe call correctly remained outside a PostgreSQL transaction, but the correlated `commerce.refund_requested` audit was written after the local provider-response transaction committed. An audit failure could therefore leave a locally successful refund without its required audit record.

F1.41 brings the audit write into the existing provider-response PostgreSQL transaction. It does not attempt to make Stripe and PostgreSQL a distributed transaction and does not claim that a PostgreSQL rollback can reverse a refund already accepted by Stripe.

## Implementation

1. The existing refund reservation and public idempotency-key behavior remain intact.
2. The Stripe refund request still executes outside the PostgreSQL transaction and uses the stable provider key `vsh_refund_<local refund id>`.
3. The provider response is reconciled under the existing refund/order locking and persistence path.
4. The refund provider ID/status, any full-order transition, and metadata-only `commerce.refund_requested` audit are written through the same checked-out transaction queryable. The audit callback is awaited before `COMMIT`.
5. An audit or persistence failure rolls back local provider binding/status/order transition while retaining the original durable reservation. A retry with the same public idempotency key reuses the same Stripe idempotency key so Stripe can return the same provider-side refund rather than creating a second one.
6. A terminal local replay returns the established sanitized response without another provider call or duplicate audit.

The implementation reuses the existing transaction boundary and identity audit service; it introduces no new transaction abstraction, migration, table, index, API contract, public dependency, or provider SDK.

## Validation evidence

All local results below were produced on Windows with Node.js 26.12.1 in the isolated candidate worktree.

| Check | Result |
|---|---|
| `npm run check` | PASS — 643 passed, 0 failed, 3 Windows-specific skips (646 tests total). Artifact verification covered 238 required paths and syntax-checked 259 JavaScript files. |
| Focused unit + live PostgreSQL integration | PASS — 17/17, zero failures/skips. 13 refund unit tests plus the integration parent and its three subtests. |
| Fresh PostgreSQL migration setup | PASS — all 18 migrations applied to a newly created isolated PostgreSQL 18 test database. |
| Failure-injection integration | PASS — audit trigger failure leaves the reservation `requested`, provider refund ID unset, order `paid`, and no refund audit row. |
| Same-key recovery integration | PASS — retry uses the same Stripe idempotency key/provider refund ID, commits the local `succeeded` refund and order transition, and records exactly one audit correlated to the retry request. |
| Terminal replay integration | PASS — no additional Stripe call and no duplicate audit. |
| Tenant route inventory | PASS — regenerated and freshness-checked: 27 families, 78 declared route patterns, 21 source files, 49 referenced test files. |
| `git diff --check` | PASS. |
| `npm audit --audit-level=low` | PASS — 0 vulnerabilities. |
| `npm audit --omit=dev --audit-level=low` | PASS — 0 vulnerabilities. |

The integration fixture used a fresh database named `virgoscorpio_hub_f1_41_test` on the existing loopback-only PostgreSQL 18 test container. It installs a uniquely named trigger that rejects only `commerce.refund_requested` audit inserts for the test's random site ID, then removes the trigger and fixture data in teardown. The test intercepts the exact Stripe refunds endpoint with a deterministic provider stub; it does not make a live Stripe request.

## Limitations and remaining acceptance

- The Stripe API is mocked. Live Stripe credentials, real provider idempotency behavior, webhook races, provider-side reconciliation, and the full refund lifecycle remain unvalidated and stay under the existing `stripe-live-lifecycle` production gate.
- The complete PostgreSQL/Memgraph integration matrix was not rerun locally. Only the focused PostgreSQL failure-injection test was run live; no shared Memgraph data was touched.
- Hosted exact-head CI, Node.js 22/24 matrices, CodeQL, browser/accessibility acceptance, and formal human review remain pending.
- This is maintainer-prepared evidence only. It is not an independent security assessment and does not satisfy tenant review #14, platform security review #25, supply-chain review #23, or any other production gate.

## Compatibility and release impact

No database schema or migration changed. No public API or response contract changed. No dependency, lockfile, package metadata, or feature manifest changed. Package version remains `0.6.2`; no SemVer increment, tag, publication, GitHub Release, or deployment is proposed.

The last verified mainline release-readiness baseline remains exact-main workflow #693 on `ac6658e9aeeb5a7fe880450932cafe9a8e518ff9`: 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `readyForProduction: false`, `NOT_PRODUCTION_CERTIFIED`, production NO-GO. Local F1.41 candidate results do not alter that mainline snapshot.

## Next step

Push the candidate branch, open a PR linked to issue #175, and require exact-head hosted CI plus human review. Do not merge the PR or close #175 until its acceptance criteria are met and review is complete.
