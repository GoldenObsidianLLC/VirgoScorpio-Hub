# F1.57 — Community group creation revalidates creator authorization at the write boundary

**Date:** 19 November 2026 America/Chicago<br>
**Status:** Local maintainer implementation candidate; not merged<br>
**Issue:** [#222 — Revalidate creator authorization at the community group-create write boundary](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/222) — OPEN<br>
**Parent:** [#124 — Continue maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)<br>
**Branch:** `security/f1-57-community-group-create-auth-2026-11-19`<br>
**Base main:** `f789444d769e9adf94adb5ef494c1a038a0c7261` (F1.56 / PR #220)<br>
**Package:** `virgoscorpio-hub@0.6.2`, private and unreleased

## Summary

F1.57 closes a reproduced time-of-check/time-of-use gap in the site-scoped community group-creation route. The original handler performed site membership and `content:create` capability checks before opening its PostgreSQL transaction. It then inserted the group and initial owner membership without revalidating the creator's active account, current site membership, or effective capability at the final write.

The corrected route retains the existing preflight and request validation, then performs a parameterized `INSERT ... SELECT` in the existing transaction. Materialized CTEs lock and revalidate the creator's user row, every selected-site membership row, and all associated role rows in deterministic user → membership → role order. The existing effective capability contract remains `content:create`, `site:manage`, or wildcard `*`. The initial `owner/active` group-membership insert remains in the same transaction as the group row.

## Reproduction

The pre-fix behavior was reproduced against a disposable PostgreSQL 18 database after applying the repository migrations. The existing two-site community-isolation fixture intercepted the final `INSERT INTO social_groups`, revoked the authenticated creator's Site B membership after route preflight, and allowed the original direct-value INSERT to execute.

**Before the correction:** the request returned HTTP **201** and created the group despite the creator's selected-site membership having been revoked. The regression expected the existing forbidden response and failed on the original route. Synthetic Site A/Site B fixture data was used; the injected authorization state was restored and the test-owned record was cleaned up.

Additional deterministic red/green cases now inject account disablement and `content:create` removal at the same final-write boundary. Concurrent variants hold the relevant PostgreSQL row lock while the route reaches its final write, then commit the authorization change and verify that the request observes the new state.

## Implementation

Changed runtime file: `apps/api/src/platform-routes.js`, community groups collection POST branch.

The route still performs `siteIdFor` and `requireCapability(actor, siteId, 'content:create')` as early denials. Inside the existing transaction:

1. `participant_users` materializes and locks the creator's user row and requires an active account.
2. `participant_memberships` locks every creator membership row for the requested site, ordered by user ID and role ID; at least one is required.
3. `participant_roles` locks all roles referenced by those selected-site membership rows, ordered by role ID.
4. `authorized_actor` permits the requested capability, `site:manage`, or `*`, matching `packages/auth/src/service.js` / `identity.authorizeSite`.
5. The final `INSERT INTO social_groups ... SELECT` writes only when the actor remains eligible and authorized.
6. The initial `owner/active` group-membership insert uses the same transaction client. Any failure rolls back both records.

When final eligibility is absent, the route returns the existing `403 ERR_VIRGOSCORPIO_HUB_FORBIDDEN` contract. No endpoint, request/response shape, schema, migration, runtime helper, dependency, lockfile, or package-version change was introduced.

The test change adds the reusable `waitForDatabaseWriteLock` integration helper and uses it for existing friendship concurrency checks as well as F1.57. This removes a duplicate polling implementation rather than adding another specialized concurrency helper.

## Regression coverage

The existing `test/integration/tenant-community-object-isolation.integration.test.js` fixture now covers:

- Selected-site membership revocation immediately before the group insert.
- Creator account disablement immediately before the group insert.
- Removal of the effective `content:create` permission immediately before the group insert.
- Real PostgreSQL lock contention for concurrent user disablement, membership revocation, and role-capability removal.
- Positive controls for `content:create`, `site:manage`, wildcard capability, and creators with multiple roles.
- A trigger-injected initial owner-membership insert failure proving the group row rolls back with it.
- Existing Site A/Site B deep snapshots, owner-role/status behavior, and the surrounding community/friendship isolation regressions.

Denied writes leave both site snapshots unchanged. Test-created roles, triggers, functions, memberships and groups are cleaned up in `finally` blocks.

## Validation

| Check | Result |
|---|---|
| Pre-fix red reproduction | Confirmed: membership revocation after preflight still returned HTTP 201 and persisted the group. |
| Focused live PostgreSQL 18 community-isolation suite | **36/36 passed; 0 failed, 0 skipped, 0 TODO.** |
| API runtime syntax | `node --check apps/api/src/platform-routes.js` passed. |
| Integration test syntax | `node --check test/integration/tenant-community-object-isolation.integration.test.js` passed. |
| Full local project check | `npm run check`: **667 passed, 0 failed, 3 Windows-specific skips** (670 total). |
| Artifact verification | Passed: 238 required paths and 268 JavaScript files syntax-checked. |
| Tenant-isolation inventory | Regenerated successfully: 28 route/flow families, 80 declared route patterns, 21 implementation source files and 57 referenced test files. |
| Diff hygiene | `git diff --check` passed. |
| Hosted exact-head CI | Pending branch publication and PR workflow. Candidate CI must not be described as mainline evidence. |
| Independent security review | Not performed by this maintainer change; issues #14 and #25 remain OPEN / NOT PERFORMED. |

The full local check ran on Node.js 26.12.1 / npm 11.19.1. Its three skips are Windows-specific platform skips, not passes. The focused live PostgreSQL suite ran separately against the disposable PostgreSQL 18 database with zero skips. The project `npm run check` itself does not validate live database migrations, provider behavior, or production security.

## Continuity, inventory and release boundary

- F1.56 remains the latest merged runtime increment on main at `f789444d769e9adf94adb5ef494c1a038a0c7261` (PR #220; issue #219 CLOSED). Exact-main workflow #794 / run 44566086887 and canonical readiness artifact #14552870585 remain the authoritative mainline evidence.
- F1.57 is a local maintainer candidate on this branch, based on the F1.56 merge SHA. It does not update or replace mainline readiness.
- Source-anchored tenant inventory remains 28 families / 80 declared route patterns / 21 source files / 57 test files after regeneration.
- Independent tenant-isolation review #14 and platform-wide security assessment #25 remain OPEN / NOT PERFORMED. Dependency/license review #23 remains OPEN / PARTIAL.
- Package `0.6.2` remains private and unreleased. Production remains `NOT_PRODUCTION_CERTIFIED` / NO-GO.
- No SemVer increment, release tag, GitHub Release, npm publication, production deployment, production-data test, assessor engagement, spending or risk acceptance is authorized.

F1.57 is maintainer-authored implementation and regression evidence only. It is not independent security approval or production certification.
