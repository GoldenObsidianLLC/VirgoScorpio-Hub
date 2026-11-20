# F1.57 — Community group creation revalidates creator authorization at the write boundary

**Date:** 19 November 2026 America/Chicago<br>
**Status:** Merged to main through [PR #224](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/224); issue #222 CLOSED
**Issue:** [#222 - Revalidate creator authorization at the community group-create write boundary](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/222) - CLOSED by PR #224
**Parent:** [#124 — Continue maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)<br>
**Branch:** `security/f1-57-community-group-create-auth-2026-11-19`<br>
**F1.57 runtime merge SHA / mainline readiness source:** `f60d454e80273262c9020940575aae4328fb9149` (PR #224 squash merge)
**Previous runtime baseline:** `f789444d769e9adf94adb5ef494c1a038a0c7261` (F1.56 / PR #220)
**Post-merge exact-main validation:** [workflow #44638362224](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44638362224), 7/7 jobs; canonical artifact #14585192352

## Summary

F1.57 closes a reproduced time-of-check/time-of-use gap in the site-scoped community group-creation route. The original handler performed site membership and `content:create` capability checks before opening its PostgreSQL transaction. It then inserted the group and initial owner membership without revalidating the creator's active account, current site membership, or effective capability at the final write.

The corrected route retains the existing preflight and request validation, then performs a parameterized `INSERT ... SELECT` in the existing transaction. Before locking actor authorization rows, the transaction takes `FOR KEY SHARE` on the selected `sites` row. This matches the membership-removal path, which locks the site `FOR UPDATE` before deleting membership rows, so group creation cannot hold a membership lock while waiting on the site's foreign-key lock. Materialized CTEs then lock and revalidate the creator's user row, every selected-site membership row, and all associated role rows in deterministic site → user → membership → role order. The effective capability contract remains `content:create`, `site:manage`, or wildcard `*`. The initial `owner/active` group-membership insert remains in the same transaction as the group row.

## Reproduction

The pre-fix behavior was reproduced against a disposable PostgreSQL 18 database after applying the repository migrations. The existing two-site community-isolation fixture intercepted the final `INSERT INTO social_groups`, revoked the authenticated creator's Site B membership after route preflight, and allowed the original direct-value INSERT to execute.

**Before the correction:** the request returned HTTP **201** and created the group despite the creator's selected-site membership having been revoked. The regression expected the existing forbidden response and failed on the original route. Synthetic Site A/Site B fixture data was used; the injected authorization state was restored and the test-owned record was cleaned up.

Additional deterministic red/green cases inject account disablement and `content:create` removal at the same final-write boundary. The earlier 36-case focused suite covered the user, membership and role serialization paths. The final refinement fully consumes every materialized membership and role lock set and acquires the selected-site key-share lock before actor authorization locks, matching membership removal's site-before-membership order. The final exact-head PostgreSQL/Memgraph/Redis integration in PR run [#44629862297](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44629862297) passed 169/169 with zero skips, including the site-row ordering and later membership/role contention cases.

## Implementation

Changed runtime file: `apps/api/src/platform-routes.js`, community groups collection POST branch.

The route still performs `siteIdFor` and `requireCapability(actor, siteId, 'content:create')` as early denials. Inside the existing transaction:

1. A `SELECT id FROM sites WHERE id=$1 FOR KEY SHARE` locks the selected site before authorization rows. This is compatible with `packages/auth/src/service.js::removeMember`, which takes `FOR UPDATE` on the site before deleting membership rows, and avoids a site-FK/membership-row lock cycle.
2. `participant_users` materializes and locks the creator's user row and requires an active account.
3. `participant_memberships` locks every creator membership row for the requested site, ordered by user ID and role ID; at least one is required.
4. `participant_roles` locks all roles referenced by those selected-site membership rows, ordered by role ID.
5. Count aggregates exhaust both materialized CTEs before the final authorization decision, ensuring later membership and role rows are locked rather than relying on an early-exit `EXISTS` check. `authorized_actor` then permits the requested capability, `site:manage`, or `*`, matching `packages/auth/src/service.js` / `identity.authorizeSite`.
6. The final `INSERT INTO social_groups ... SELECT` writes only when the actor remains eligible and authorized.
7. The initial `owner/active` group-membership insert uses the same transaction client. Any failure rolls back both records.

When final eligibility is absent, the route returns the existing `403 ERR_VIRGOSCORPIO_HUB_FORBIDDEN` contract. No endpoint, request/response shape, schema, migration, runtime helper, dependency, lockfile, or package-version change was introduced.

The test change adds the reusable `waitForDatabaseWriteLock` integration helper and uses it for existing friendship concurrency checks as well as F1.57. This removes a duplicate polling implementation rather than adding another specialized concurrency helper.

## Regression coverage

The existing `test/integration/tenant-community-object-isolation.integration.test.js` fixture now covers:

- Selected-site membership revocation immediately before the group insert.
- Creator account disablement immediately before the group insert.
- Removal of the effective `content:create` permission immediately before the group insert.
- Real PostgreSQL lock contention for concurrent user disablement, membership revocation, and role-capability removal (covered by the earlier 36/36 focused run).
- A site-row contention case proves group creation takes its site key-share lock before membership locks, serializing against membership removal's site `FOR UPDATE` lock.
- Positive controls for `content:create`, `site:manage`, wildcard capability, and creators with multiple roles.
- The site-row ordering and later-membership/later-role contention cases passed in the exact-head live PostgreSQL suite (PR run #44629862297), confirming site-before-membership serialization and complete authorization lock-set consumption.
- A trigger-injected initial owner-membership insert failure proving the group row rolls back with it.
- Existing Site A/Site B deep snapshots, owner-role/status behavior, and the surrounding community/friendship isolation regressions.

Denied writes leave both site snapshots unchanged. Test-created roles, triggers, functions, memberships and groups are cleaned up in `finally` blocks.

## Validation

| Check | Result |
|---|---|
| Pre-fix red reproduction | Confirmed: membership revocation after preflight still returned HTTP 201 and persisted the group. |
| Earlier focused live PostgreSQL 18 community-isolation suite (before final refinements) | **36/36 passed; 0 failed, 0 skipped, 0 TODO.** Superseded by the final exact-head hosted integration result below. |
| Final exact-head PostgreSQL/Memgraph/Redis integration (PR #224, run #44629862297) | **169/169 passed; 0 failed, 0 skipped, 0 TODO.** This includes F1.57 creator revalidation, site-first lock serialization against membership removal, later-membership and later-role contention, capability controls, owner-insert rollback and two-site snapshots. Fresh migrations 18/18; idempotent second pass 18/18 skipped as expected. |
| Final exact-head candidate CI (push #44629850558 and PR #44629862297) | Both runs passed all six functional jobs: Node 22.23.4 and 24.22.1 (each 670/670 Hub + 94/94 EnginEx tests, zero skips), live database integration, browser smoke 9/9, CodeQL, and candidate evidence consolidation. Both npm audit scopes reported 0 vulnerabilities. Main-only SLSA lockfile/SBOM attestation was skipped as designed on non-main events. This is candidate evidence, not mainline readiness. |
| API runtime syntax | `node --check apps/api/src/platform-routes.js` passed. |
| Integration test syntax | `node --check test/integration/tenant-community-object-isolation.integration.test.js` passed. |
| Latest full local project check | `npm run check`: **667 passed, 0 failed, 3 Windows-specific skips** (670 total); final rerun passed after regenerating the tenant inventory. |
| Artifact verification | Passed: 238 required paths and 268 JavaScript files syntax-checked. |
| Tenant-isolation inventory | Regenerated successfully: 28 route/flow families, 80 declared route patterns, 21 implementation source files and 57 referenced test files. |
| Diff hygiene | `git diff --check` passed. |
| Canonical mainline readiness | Artifact #14585192352; archive SHA-256 `1fa3223aed7fab8c4f2b662105866da751d466f0fd43cbded0ab771769d56da5`; JSON SHA-256 `a4aa0cdd8f57d921b1e088909927b81e44df75f798a402431f849155f43ff95f`. |
| Post-merge exact-main CI | [workflow #44638362224](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44638362224) | **7/7 jobs passed** on F1.57 runtime SHA `f60d454e80273262c9020940575aae4328fb9149`: Node 22/24 each 670/670 Hub + 94/94 EnginEx; live PostgreSQL/Memgraph/Redis 169/169; 18/18 fresh and 18/18 idempotent migrations; browser smoke 9/9; CodeQL; mainline SLSA lockfile/SBOM attestation; exact-source consolidation. |
| Independent security review | Not performed by this maintainer change; issues #14 and #25 remain OPEN / NOT PERFORMED. |

The full local check ran on Node.js 26.12.1 / npm 11.19.1. Its three skips are Windows-specific platform skips, not passes. The earlier focused live PostgreSQL suite ran separately against the disposable PostgreSQL 18 database with zero skips, before the final all-row lock-set refinement, the site-first lock-order change, and the three added contention cases. The project `npm run check` itself does not validate live database migrations, provider behavior, or production security.

## Continuity, inventory and release boundary

- F1.56 is the previous merged runtime increment at `f789444d769e9adf94adb5ef494c1a038a0c7261` (PR #220; issue #219 CLOSED). It remains the predecessor runtime baseline for F1.57. The authoritative current-main readiness evidence is now F1.57 / workflow #44638362224 / artifact #14585192352.
- F1.57 merged to main at `f60d454e80273262c9020940575aae4328fb9149` through PR #224; issue #222 is CLOSED. Exact-main workflow #44638362224 and readiness artifact #14585192352 are the source-bound current runtime evidence.
- Source-anchored tenant inventory remains 28 families / 80 declared route patterns / 21 source files / 57 test files after regeneration.
- Independent tenant-isolation review #14 and platform-wide security assessment #25 remain OPEN / NOT PERFORMED. Dependency/license review #23 remains OPEN / PARTIAL.
- Package `0.6.2` remains private and unreleased. Production remains `NOT_PRODUCTION_CERTIFIED` / NO-GO.
- No SemVer increment, release tag, GitHub Release, npm publication, production deployment, production-data test, assessor engagement, spending or risk acceptance is authorized.

F1.57 is maintainer-authored implementation and regression evidence only. It is not independent security approval or production certification.
