# F1.46 — Regular navigation-menu audit atomicity implementation report

**Date:** 17 November 2026
**Issue:** [#190](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/190) — OPEN
**Baseline main SHA:** `60cca7645dd5f65a2c459742b05af7eb9016eee5` (F1.45 / PR #189 merged)
**Branch:** `security/f1-46-navigation-menu-audit-atomicity-2026-11-17`
**Status:** Local implementation and static/unit checks complete; focused live PostgreSQL validation and exact-head CI are pending. No PR has been opened yet.

## Executive summary

F1.46 closes the separate regular-navigation-menu audit gap discovered after F1.45. The site-managed `/api/v1/sites/{siteId}/menus` create, update and delete operations now reuse the existing `withIdentityAuditTransaction()` abstraction and persist their metadata-only identity audit event on the same transaction queryable as the `navigation_menus` mutation.

This is intentionally separate from F1.45, which covers the `/mega-menus` route family. It does not add a second transaction helper, schema, migration, public API, dependency, lockfile change or SemVer change.

## Source finding

At baseline main `60cca7645dd5f65a2c459742b05af7eb9016eee5`, the regular `/menus` route already reconciled path/header/query/body site selectors, required `content:read` for GET and `site:manage` for mutations, bounded request bodies, validated menu items and presentation data, scoped SQL by `site_id`, and retained expected-version updates. Its POST/PUT/DELETE writes nevertheless used `localPool.query()` directly and did not persist correlated identity audit events.

F1.45 addressed `/mega-menus` in `apps/api/src/platform-routes.js`; it did not cover this separate route in `apps/api/src/server.js`. The source-anchored catalog therefore keeps distinct `mega-menus` and `navigation-menus` families.

## Implementation

Successful regular-navigation mutations now emit:

| Method | Audit action | Target type | Allow-listed details |
|---|---|---|---|
| POST | `navigation.menu_created` | `navigation-menu` | `slug`, `version` |
| PUT | `navigation.menu_updated` | `navigation-menu` | `slug`, `version` |
| DELETE | `navigation.menu_deleted` | `navigation-menu` | `slug`, `version` |

Each event includes the selected site, authenticated actor, menu target ID and request ID. Menu items, labels, URLs, presentation content and other user-supplied data are excluded from audit details.

Implementation reuses `withIdentityAuditTransaction()` from `apps/api/src/platform-routes.js`, exporting the existing generic helper for the API composition layer. The helper verifies audit availability before acquiring the transaction client, runs the mutation and awaits `identity.audit(event, { queryable })` against the same queryable, then returns only after COMMIT. Mutation or audit failure rolls back the paired write.

Existing route authorization, site selector reconciliation, GET behavior, SQL tenant predicates, input bounds, version checks, response shapes and status contracts remain intact. Stale update continues to return 409 without an audit event; missing delete returns 404 without an audit event.

## Test coverage

Added `test/integration/navigation-menu-audit-atomicity.integration.test.js`, based on the F1.45 live PostgreSQL trigger-injection pattern. It covers:

- Trigger-injected audit failure for create/update/delete, proving the menu mutation and audit row roll back together.
- Retry after removing the trigger, proving the mutation and exactly one correlated event commit.
- Metadata minimization and request/site/actor/target correlation.
- Missing identity audit capability fails closed before a mutation.
- Stale expected-version update preserves 409 with no event.
- Missing-menu delete preserves 404 with no event.

The tenant-isolation route inventory was regenerated: 28 route/flow families, 80 declared route patterns, 21 implementation source files and 55 test references. The navigation-menus family now points at the new integration test and records the transaction/audit behavior. F1.45's mega-menu family remains separate.

## Local validation

| Check | Result | Qualification |
|---|---|---|
| Windows / Node.js 26.12.1 `npm run check` | PASS — 667 passed, 0 failed, 3 platform-specific skips | Post-inventory-refresh run passed with `NODE_OPTIONS=--max-old-space-size=4096`; artifact verifier passed 238 required paths / 266 JavaScript files. |
| Artifact verifier | PASS — 238 required paths and 266 JavaScript files syntax-checked | Local worktree. |
| New integration test `node --check` | PASS | Syntax only; not a live PostgreSQL execution. |
| Tenant inventory generation | PASS — 28 / 80 / 21 / 55 | Generated JSON, catalog and Markdown map refreshed after adding the separate regular navigation-menus family. |
| `git diff --check` | PASS | Whitespace check; Windows line-ending normalization warnings only. |
| Focused live PostgreSQL route test | NOT RUN / BLOCKED LOCALLY | Disposable Docker PostgreSQL was ready inside the container, but Windows-host Node.js connections to the published port terminated during startup. No shared database was changed and the disposable containers were removed. Hosted exact-head PostgreSQL validation is required. |

The local root unit suite does not include `test/integration/**`; the new test is syntax-checked and is wired into the existing live integration runner by file discovery. No local live-pass is claimed for F1.46.

## Release and assurance boundary

F1.46 is a maintainer engineering candidate, not a merge, release waiver or independent security assessment. PR/hosted validation and human review remain pending. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; qualified dependency/SBOM/license review #23, authorized scope #13, load/backup/restore #24, operations/release ownership #26 and governance #32 remain separate.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No schema or migration change, API contract change, dependency/lockfile change, SemVer increment, release tag, GitHub Release, npm publication or production deployment is authorized. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

## Next steps

1. Open a draft PR for F1.46 and run exact-head CI.
2. Require the dedicated PostgreSQL/Memgraph/Redis producer to execute the new create/update/delete rollback-and-retry integration test with zero skips, alongside both Node 22/24 matrices, CodeQL, browser smoke, signing and evidence consolidation.
3. Obtain human review; after an approved merge, require exact-main CI and refresh the source-bound release evidence.
4. Do not close issue #190 or claim production readiness until those criteria and independent review boundaries are satisfied.
