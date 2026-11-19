# F1.54 — Community group join revalidates site membership at the write boundary

**Date:** 18 November 2026 America/Chicago  
**Status:** Local implementation and PostgreSQL regression validated; candidate not yet committed, pushed or opened as a pull request.  
**Parent:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)  
**Tracking:** [Issue #212](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/212)  
**Base main:** e8913fa812304e80dc4c8846f7ea637a2fa4e4d1 (F1.53 / PR #211 merged)

## Finding and reproduction

The POST /api/v1/sites/{siteId}/community/groups/{groupId}/join route authorized the request through siteIdFor, queried the group, and then performed a separate value-based INSERT into social_group_memberships. A user account or its same-site membership could change after the authorization check and before the INSERT. The final write did not revalidate either condition.

The existing two-site PostgreSQL fixture now injects a site-membership deletion immediately before the group-membership INSERT. Against the original route, the regression went red: the join persisted one social_group_memberships row after the actor's site_memberships row had been removed. The injected mutation is restored in test cleanup. The test also injects user disablement at the same boundary.

## Bounded implementation

The join mutation is now a single parameterized INSERT ... SELECT whose materialized CTEs acquire locks in a stable order:

1. The participant user row, ordered by user ID, and require status = 'active'.
2. Every matching membership row for the requested site, ordered by user ID and role ID, and require at least one to remain.
3. The target group row, constrained by both requested site and group ID, to read and lock its current privacy setting.

The final INSERT source rechecks the active user and site membership. If eligibility or the site-scoped group is no longer present, no row is written and the existing generic 404 ERR_VIRGOSCORPIO_HUB_GROUP_NOT_FOUND contract is returned.

The existing conflict behavior remains intact: stored active and banned states are preserved; public first-time joins become active; private first-time joins become pending; existing pending joins remain pending. The current banned-member 403, route, HTTP response shape, and tenant boundaries are unchanged. Role multiplicity cannot duplicate the INSERT source because membership eligibility is tested with EXISTS.

No new helper, endpoint, schema, migration, dependency, lockfile, package version, API response contract, or SemVer change was introduced.

## Regression and validation

The focused live PostgreSQL suite was run against a loopback disposable test database after the fix:

    node --test --test-concurrency=1 test/integration/tenant-community-object-isolation.integration.test.js

**Result: 20/20 passed; zero failures, skips or TODOs.** The suite includes:
- Revocation of the actor's site membership after route authorization but before the final INSERT.
- User disablement after route authorization but before the final INSERT.
- Actual PostgreSQL row-lock contention: a join request waits while another transaction holds the actor's site-membership row, then fails closed after that transaction deletes and commits the row.
- Existing private/public join, active/pending/banned retry, cross-site denial, and Site A/Site B before/after snapshot controls.

The repository check npm run check completed successfully on Node.js 26.12.1:
- Artifact verification: 238 required paths and 268 JavaScript files syntax-checked.
- Unit/API suite: 670 tests; 667 passed, 0 failed, 3 Windows-specific skips.
- The initial full-check run correctly detected stale generated tenant inventory; after running npm run security:tenant-inventory, the full check passed.

The generated tenant-isolation inventory is current: 28 route/flow families, 80 declared route patterns, 21 implementation source files and 57 referenced test files. Node syntax checks and git diff --check passed after the source/test edits.

## Evidence and release boundary

The implementation is a maintainer-led regression hardening item. Focused local PostgreSQL and the full local check are green; hosted candidate workflows have not yet run because this working tree has not yet been committed or pushed. This report is not independent security approval.

Independent tenant/site review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED. Qualified dependency/license review #23 remains OPEN / PARTIAL; other production evidence gates remain open. Package 0.6.2 remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, npm publication, deployment, production-data testing, assessor engagement, spending or risk acceptance is authorized.