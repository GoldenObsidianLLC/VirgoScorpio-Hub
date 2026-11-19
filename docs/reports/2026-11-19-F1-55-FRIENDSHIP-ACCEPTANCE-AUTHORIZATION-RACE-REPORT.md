# F1.55 — Friendship acceptance authorization-race report

**Date:** 19 November 2026
**Status:** In-progress maintainer candidate; not merged
**Issue:** [#215 — Revalidate friendship acceptance addressee at the write boundary](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/215)
**Parent:** [#124 — maintainer hardening tracker](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Branch:** `security/f1-55-community-friendship-acceptance-revocation-2026-11-19`
**Base:** main `91a93f370205335321c65d68e706f830251936c3`

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
| Candidate hosted CI / exact-head evidence | Pending; mainline workflow #782 is baseline evidence only and does not validate this branch. |

The focused integration ran on Node.js 26.12.1 against a disposable PostgreSQL 18 container bound to loopback with a temporary in-memory data directory. It used the existing project test fixture and migrations; no persistent application data or production endpoint was used.

## Source and assurance boundaries

The branch starts from repository main `91a93f370205335321c65d68e706f830251936c3`. Exact-main workflow [#782](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44472194473) passed 7/7 jobs on that baseline after documentation-only PR #214. The latest merged runtime increment remains F1.54 / PR #213 at runtime merge SHA `c247e1cb1daa5683c3a74aa6856e9718d92b4557`. Workflow #782 is not candidate CI and must not be represented as validating F1.55.

This is maintainer-led regression hardening, not an independent security assessment or risk acceptance. Independent tenant-isolation review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and platform security assessment [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remain open and not performed. No formal review of this candidate has occurred while it remains unmerged.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No SemVer increment, tag, GitHub Release, npm publication, deployment, waiver, or production certification is authorized. The current mainline readiness baseline remains **8 PASS / 2 PARTIAL / 14 MISSING_EVIDENCE**, `readyForProduction=false`, production **NO-GO / NOT_PRODUCTION_CERTIFIED**.
