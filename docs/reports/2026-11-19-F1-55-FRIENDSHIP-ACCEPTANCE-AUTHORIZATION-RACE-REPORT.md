# F1.55 — Friendship acceptance authorization-race report

**Date:** 19 November 2026
**Status:** Merged maintainer hardening; [PR #216 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/216)
**Issue:** [#215 — Revalidate friendship acceptance addressee at the write boundary](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/215) — CLOSED
**Parent:** [#124 — maintainer hardening tracker](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Branch:** `security/f1-55-community-friendship-acceptance-revocation-2026-11-19`
**Base:** main `91a93f370205335321c65d68e706f830251936c3`
**Implementation commit:** `84ce5eb71127411573d4a0b5e81dda94ecef3f81`
**Merge commit / exact-main source:** `db0b641880a5c842ffdcc2cf1dda6bedde58d033` via [PR #216](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/216), merged 19 November 2026 07:51:37 UTC

## Summary

F1.55 closes a reproduced time-of-check/time-of-use gap in the site-scoped friendship-acceptance route. The authenticated addressee was checked during route preflight, but the final friendship update did not revalidate that addressee's account status or membership in the selected site. If either eligibility condition changed after preflight, the request could still transition from pending to accepted.

The candidate updates the final write to lock both participants and their selected-site memberships in the established deterministic order, then recheck both active-account and site-membership predicates within the same SQL statement. It preserves the existing route, response payload, success status, and generic non-disclosing 404 contract.

## Reproduction

The original behavior was reproduced against the exact main baseline above using an isolated disposable PostgreSQL 18 database. The live integration test injected each change after route authorization and immediately before the final `UPDATE social_friendships`:

1. Disable the authenticated addressee's user account.
2. Delete the authenticated addressee's membership in the selected site.

Both pre-fix scenarios returned HTTP **200** and accepted the pending friendship. This is the defect: the route should not accept a request when the addressee is no longer eligible in that site.

The regression expects the existing HTTP **404** response with code `ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND`, no participant identifiers or names in the response, and the friendship left pending.

## Implementation

In `apps/api/src/platform-routes.js`, the acceptance branch now performs a single parameterized UPDATE using two materialized CTEs:

- `participant_users` selects and locks the requester and authenticated addressee in deterministic user-ID order.
- `participant_memberships` selects and locks their memberships for the requested site in deterministic user-ID and role-ID order.
- The final UPDATE remains constrained by the site ID, requester ID, addressee ID, and pending state. It also requires both participant user rows to remain active and each participant to retain at least one membership in the selected site.

The lock order matches the adjacent friendship-creation and group-join hardening patterns: participant user rows first, then selected-site membership rows. No schema or migration is needed. There is no new endpoint, helper in the runtime route, dependency, lockfile, public API contract, or package-version change.

The integration suite's existing PostgreSQL lock-contention helper was generalized and reused by both friendship creation and acceptance. The helper now accepts the HTTP method, target user, request headers, monitored write statement, and expected error code. This avoids duplicating the transaction/lock-wait coordination logic between the POST and PUT regressions.

## Regression coverage

The two-site tenant/community integration fixture now covers:

- Post-preflight addressee account disablement and site-membership revocation.
- Concurrent user-row and membership-row locks proving the acceptance write waits for lifecycle mutations and denies after those changes commit.
- Generic non-disclosing 404 behavior, including absence of requester/addressee IDs and display names.
- Pending friendship preservation after a denied acceptance.
- Unchanged Site A and Site B community snapshots for denied writes.
- Successful active same-site acceptance.
- Multiple membership roles for both participants, proving acceptance updates exactly one friendship row.
- Existing friendship-creation lifecycle, lock-contention, multi-role, and cross-site controls.

## Validation

| Check | Result |
|---|---|
| Focused two-site PostgreSQL 18 integration | **26/26 passed; 0 failed, 0 skipped, 0 TODO** |
| Pre-fix red reproduction | Both injected eligibility changes returned HTTP 200, reproducing the defect |
| JavaScript syntax checks | Passed for `apps/api/src/platform-routes.js` and `test/integration/tenant-community-object-isolation.integration.test.js` |
| Tenant-isolation inventory regeneration | Passed; 28 families / 80 route patterns / 21 implementation sources / 57 referenced test files |
| Full `npm run check` | **667/670 passed; 0 failed; 3 Windows-specific skips.** The inventory is current. An initial post-refresh full run encountered an unrelated transient loopback `bad port` in an observability test; that test passed 1/1 when isolated, and the subsequent complete `npm run check` passed. |
| Candidate push workflow #783 | Passed six applicable functional jobs; exact implementation head `84ce5eb71127411573d4a0b5e81dda94ecef3f81`; live PostgreSQL/Memgraph 159/159; fresh/idempotent migrations 18/18. |
| Candidate pull-request workflow #784 | Passed six applicable functional jobs; exact implementation head `84ce5eb71127411573d4a0b5e81dda94ecef3f81`; live PostgreSQL/Memgraph 159/159; fresh/idempotent migrations 18/18. |
| Exact-main workflow #785 | **7/7 jobs passed** on merge commit `db0b641880a5c842ffdcc2cf1dda6bedde58d033`; Node 22/24 matrix, live database, migrations, browser, CodeQL, signed attestations and evidence consolidation passed. |

The focused integration ran on Node.js 26.12.1 against a disposable PostgreSQL 18 container bound to loopback with a temporary in-memory data directory. It used the existing project test fixture and migrations; no persistent application data or production endpoint was used.

## Source and assurance boundaries

Implementation commit `84ce5eb71127411573d4a0b5e81dda94ecef3f81` merged through [PR #216](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/216) at exact main SHA `db0b641880a5c842ffdcc2cf1dda6bedde58d033`; issue #215 is CLOSED. Candidate push [workflow #783](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44481965771) and pull-request [workflow #784](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44482025200) each passed all six applicable functional jobs. Exact-main [workflow #785](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44482863945) passed all seven jobs on the merged SHA. This exact-main run, not the earlier baseline workflow #782, validates F1.55 on main.

Workflow #785 reports Node.js 22.23.4 and 24.22.1 each passing 670/670 Hub tests and 94/94 EnginEx tests; the live PostgreSQL/Memgraph suite passed 159/159 with zero failures, skips, or TODOs; 18/18 migrations applied fresh and 18/18 were skipped on idempotent re-entry; browser smoke passed 9/9; CodeQL, signed mainline provenance/SBOM, and exact-source evidence consolidation passed. The service-less diagnostic remains PARTIAL (47 cases: 1 pass / 46 skipped per runtime) and is not a substitute for the live 159-test integration result.

The exact-source readiness artifact #14508174935 is bound to `db0b641880a5c842ffdcc2cf1dda6bedde58d033` (archive SHA-256 `b4bedbc44d9067d04f5327cc57337f94238c6d18cd93fe1aff2beb74574bc786`; readiness JSON SHA-256 `47c6a13ea9f4ca49449a618d20dfcf5c6094def7b92d930b7399886513976ea9`). It remains **8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN**, `readyForProduction=false`, `NOT_PRODUCTION_CERTIFIED`, production **NO-GO**.

PR #216 merged with zero formal review submissions and zero inline review threads. This remains maintainer-led regression hardening, not an independent security assessment or risk acceptance. Independent tenant-isolation review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and platform security assessment [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remain open and not performed.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No SemVer increment, tag, GitHub Release, npm publication, deployment, waiver, risk acceptance, or production certification is authorized.
