# F1.56 — Community friendship-removal authorization-race report

**Date:** 19 November 2026
**Status:** Merged to main through PR #220; exact-main workflow #794 passed 7/7 jobs. Maintainer/automation evidence only; the PR had no formal review submissions.
**Issue:** [#219](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/219) — CLOSED by [PR #220](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/220)
**Parent:** [#124 — Continue maintainer-led tenant isolation hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
**Branch:** `security/f1-56-community-friendship-removal-2026-11-19`
**PR base:** main at branch creation `54bd8112f571c5ce623c6780600bb7fc9806e8cd`
**Latest merged runtime baseline:** F1.56 / PR #220, merge `f789444d769e9adf94adb5ef494c1a038a0c7261`; previous increment F1.55 / PR #216
**Implementation commit:** `032122c5377712ae76d2ef9c8327c6e3aa43f883`; merge commit `f789444d769e9adf94adb5ef494c1a038a0c7261`. Exact-main hosted validation is recorded separately below.

## Summary

F1.56 closes a reproduced time-of-check/time-of-use gap in the site-scoped friendship-removal route. The API authenticates the actor and resolves/authorizes the selected site before executing `DELETE FROM social_friendships`, but the original final write did not revalidate the actor's active account or current membership in that site. A disablement or membership revocation after preflight could therefore leave a stale request able to remove the relationship.

The final DELETE now uses materialized participant-user and selected-site-membership CTEs. It locks the authenticated actor's user row first and that actor's selected-site membership rows second, in the established deterministic user-then-membership order. The DELETE is constrained on the actor still being active and retaining at least one membership in the selected site at the write boundary.

Only the actor is revalidated. A friendship remains removable when the counterpart is disabled or has left the site; relationship removal is a user-controlled unlink operation and must not require the other party to remain eligible.

## Reproduction

The defect was reproduced against an isolated disposable PostgreSQL 18 database, after applying the repository migrations. The two-site integration fixture injected lifecycle changes after route preflight and immediately before the final `DELETE FROM social_friendships`:

1. Disable the authenticated actor's account.
2. Revoke the authenticated actor's membership in the selected site.

Before the fix, both stale requests returned HTTP 200 with `removed: true`. The concurrent variants also proved that the DELETE did not wait on the actor's user or membership row locks. The regression now expects the existing idempotent HTTP 200 response with `removed: false` for an ineligible actor and verifies the relationship remains present.

The other-party positive controls deliberately expect successful removal when the counterpart is disabled or their membership is revoked.

## Implementation

In `apps/api/src/platform-routes.js`, the friendship DELETE branch now performs one parameterized SQL DELETE:

- `participant_users` selects and locks only the authenticated actor's user row.
- `participant_memberships` selects and locks the actor's membership rows for the requested site, ordered by user ID and role ID.
- The final DELETE matches only the selected site and the two friendship participants, and requires the actor row to remain `active` plus at least one selected-site membership.
- The counterpart is not joined or required to be active/member, so stale or departed friendships can still be removed by an eligible actor.

The statement is atomic; no separate read-then-write window is introduced. The lock order matches F1.53/F1.55 participant authorization and the group-join pattern. No schema, migration, endpoint, runtime helper, dependency, lockfile, route shape, response contract, or package-version change is introduced.

The existing integration helpers were generalized and reused. `assertFriendshipWriteRace` now supports method, target user, headers, write statement, expected response and the optional `removed` value. The existing PostgreSQL lock-serialization helper is reused for DELETE as well as friendship create/accept, avoiding a second copy of its transaction and `pg_stat_activity` wait checks.

## Regression coverage

The two-site community integration fixture now covers:

- Actor account disablement after site authorization.
- Actor site-membership revocation after site authorization.
- Concurrent account disablement waiting on the locked actor user row.
- Concurrent membership revocation waiting on the locked actor membership row.
- Successful unlink when the counterpart account is disabled.
- Successful unlink when the counterpart's site membership is revoked.
- Idempotent retry after successful removal.
- Generic responses that do not disclose the actor or counterpart identifiers.
- Unchanged Site A and Site B community snapshots for denied writes.
- Existing friendship create/accept, cross-site, blocked-state and multiple-role controls.

The test fixture now sets its own bounded `RATE_LIMIT_MAX_REQUESTS=1000` value. This keeps the expanded scenario from exhausting the API test server's unrelated default request budget; production rate-limit defaults are unchanged.

## Validation

| Check | Result |
|---|---|
| Pre-fix red reproduction | Both post-preflight actor mutations still removed the friendship; both concurrent lifecycle changes failed the row-lock wait assertion. |
| Focused two-site PostgreSQL 18 integration | **35/35 passed; 0 failed, 0 skipped, 0 TODO** after the fix. |
| JavaScript syntax | `node --check apps/api/src/platform-routes.js` passed; the integration test file loaded and executed all 35 tests. |
| Full local `npm run check` | **667/670 passed; 0 failed; 3 Windows-specific skips.** |
| Artifact verification | Passed: 238 required paths and 268 JavaScript files syntax-checked. |
| Tenant-isolation inventory | Regenerated successfully and verified current: 28 families / 80 declared route patterns / 21 implementation source files / 57 referenced test files. |
| PostgreSQL setup | Disposable PostgreSQL 18 container bound to loopback on a dynamically assigned host port, with a temporary in-memory data directory; 18 repository migrations applied. |
| Exact-main hosted CI | **PASS** — workflow #794 / run 44566086887 passed 7/7 jobs on merge SHA `f789444d769e9adf94adb5ef494c1a038a0c7261`: both Node matrices, 168/168 live PostgreSQL/Memgraph/Redis tests, 18/18 fresh and idempotent migrations, browser smoke 9/9, CodeQL, SLSA lockfile/SBOM attestation and evidence consolidation. |
| Independent review | Not performed by this maintainer change; issues #14 and #25 remain OPEN / NOT PERFORMED. |

The first post-edit full check correctly detected stale generated inventory files. The project inventory generator was run, refreshed the artifact and source-derived capability map, and the repeat full check passed. The initial focused red run also exposed the fixture's request-rate ceiling; the fixture-only limit was then raised and the final focused suite passed. Neither finding changed the production rate-limiting policy.

## Source and assurance boundaries

F1.56 is a maintainer-led authorization regression fix. It is not an independent tenant-isolation review, a platform security assessment, a risk acceptance, or production certification. PR #220 had no formal review submissions. Exact-main workflow #794 passed 7/7 jobs, but maintainer/automation evidence does not replace independent assurance #14/#25 or qualified dependency/license review #23.

The current exact-main readiness artifact is source-bound to F1.56 merge `f789444d769e9adf94adb5ef494c1a038a0c7261`, finalized by workflow #794 / run 44566086887. Canonical readiness artifact #14552870585 has SHA-256 `f163616fabae6e3ad704158c8c3f208a0e043370180398c451d88aae3f4cc31a`; readiness JSON SHA-256 is `4d6bb9ad49f260a94574149d49f055a25c827f405c702c43914fbd7ad08804c7`. Readiness remains 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `NOT_PRODUCTION_CERTIFIED`, production NO-GO.

Independent tenant-isolation review [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) and platform-wide security assessment [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) remain OPEN / NOT PERFORMED. Dependency/license review [#23](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/23) remains OPEN / PARTIAL. The other product/provider, load/restore, observability, operational and governance gates remain separate.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. F1.56 does not warrant a SemVer increment. No tag, GitHub Release, npm publication, deployment, production-data testing, paid engagement or production risk acceptance is authorized.
