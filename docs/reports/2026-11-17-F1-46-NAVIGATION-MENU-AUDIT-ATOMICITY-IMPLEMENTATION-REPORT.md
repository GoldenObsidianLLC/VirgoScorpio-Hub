# F1.46 — Regular navigation-menu audit atomicity implementation report

**Date:** 17 November 2026
**Issue:** [#190](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/190) — CLOSED (completed)
**Original baseline main SHA:** `60cca7645dd5f65a2c459742b05af7eb9016eee5` (F1.45 / PR #189)
**Merged main SHA:** `54b766b05db51640281840607df7e16e09da699e`
**Merge:** [PR #191](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/191), merge commit `54b766b05db51640281840607df7e16e09da699e`
**Status:** Merged to main; exact-main [workflow #732](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44182949889) passed all seven jobs. Issue #190 is closed as completed. No package release or production certification is claimed.

## Executive summary

F1.46 closes the regular-navigation-menu audit gap discovered after F1.45. The site-managed `/api/v1/sites/{siteId}/menus` create, update and delete operations reuse the existing `withIdentityAuditTransaction()` abstraction and persist metadata-only identity audit events on the same transaction queryable as the `navigation_menus` mutation.

This is separate from F1.45, which covers `/mega-menus`. F1.46 adds no second transaction helper, schema, migration, public API, dependency, lockfile change or SemVer change.

## Source finding

At original baseline main `60cca7645dd5f65a2c459742b05af7eb9016eee5`, the regular `/menus` route already reconciled path/header/query/body site selectors, required `content:read` for GET and `site:manage` for mutations, bounded request bodies, validated menu items and presentation data, scoped SQL by `site_id`, and retained expected-version updates. Its POST/PUT/DELETE writes nevertheless used `localPool.query()` directly and did not persist correlated identity audit events.

F1.45 addressed `/mega-menus` in `apps/api/src/platform-routes.js`; it did not cover this separate route in `apps/api/src/server.js`. The source-anchored catalog therefore keeps distinct `mega-menus` and `navigation-menus` families.

## Implementation

Successful regular-navigation mutations emit:

| Method | Audit action | Target type | Allow-listed details |
|---|---|---|---|
| POST | `navigation.menu_created` | `navigation-menu` | `slug`, `version` |
| PUT | `navigation.menu_updated` | `navigation-menu` | `slug`, `version` |
| DELETE | `navigation.menu_deleted` | `navigation-menu` | `slug`, `version` |

Each event includes the selected site, authenticated actor, menu target ID and request ID. Menu items, labels, URLs, presentation content and other user-supplied data are excluded from audit details.

Implementation reuses `withIdentityAuditTransaction()` from `apps/api/src/platform-routes.js`, exporting the existing generic helper for the API composition layer. The helper verifies audit availability before acquiring the transaction client, runs the mutation and awaits `identity.audit(event, { queryable })` against the same queryable, then returns only after COMMIT. Mutation or audit failure rolls back the paired write.

Existing route authorization, site selector reconciliation, GET behavior, SQL tenant predicates, input bounds, version checks, response shapes and status contracts remain intact. Stale update continues to return 409 without an audit event; missing delete returns 404 without an audit event.

## Test coverage

Added `test/integration/navigation-menu-audit-atomicity.integration.test.js`, based on the F1.45 live PostgreSQL trigger-injection pattern. Its PostgreSQL test group covers:

- Missing identity audit capability fails closed before mutation and leaves neither a menu nor audit row.
- Create audit failure rolls back the menu and audit row; safe retry commits exactly one event.
- Update audit failure restores the prior version/content; safe retry commits exactly one event.
- Delete audit failure restores the menu; safe retry commits exactly one event.
- Stale expected-version update preserves 409 and emits no update event.
- Missing-menu delete preserves 404 and emits no delete event.
- Audit details are restricted to `slug` and `version`, with site/actor/target/request correlation checked.

The tenant-isolation route inventory was regenerated: 28 route/flow families, 80 declared route patterns, 21 implementation source files and 55 test references. The navigation-menus family points at the new integration test and records the transaction/audit behavior. F1.45's mega-menu family remains separate.

## Local validation

| Check | Result | Qualification |
|---|---|---|
| Windows / Node.js 26.12.1 `npm run check` | PASS — 667 passed, 0 failed, 3 platform-specific skips | Post-inventory-refresh run used `NODE_OPTIONS=--max-old-space-size=4096`. |
| Artifact verifier | PASS — 238 required paths and 266 JavaScript files | Local worktree. |
| New integration test `node --check` | PASS | Syntax check only. |
| Tenant inventory generation | PASS — 28 / 80 / 21 / 55 | JSON, catalog and generated Markdown refreshed. |
| `git diff --check` | PASS | No whitespace errors. |
| Focused local live PostgreSQL route test | NOT RUN / BLOCKED LOCALLY | Disposable Docker PostgreSQL was ready inside the container, but Windows-host Node.js connections to the published port terminated during startup. No shared database was changed and the disposable containers were removed. |

No local live-pass is claimed; the live behavior was subsequently validated by the dedicated hosted CI database producer.

## Hosted candidate and exact-main CI

Initial push/PR workflows [#728](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44155254865) and [#729](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44155764226) exposed fixture-only failures: the existing regular-menu PUT contract requires `slug` in the body, and the request-ID assertion expected five although six correlated requests were issued. Commit `f23afa8fda7f40b7210ee06336519a70ec686b5a` corrected both PUT fixtures and the six-ID assertion.

Corrected exact-head push workflow [#730](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44179904351) and PR workflow [#731](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44179917962) passed all six applicable jobs. PR #191 then merged at main SHA `54b766b05db51640281840607df7e16e09da699e`. Exact-main push [workflow #732](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44182949889) completed all seven jobs successfully, including mainline attestations and source-bound evidence consolidation.

On exact main:

- Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub tests and 94/94 EnginEx tests with zero failures or skips; both npm audit scopes reported zero vulnerabilities.
- PostgreSQL/Memgraph/Redis passed 129/129 live integration tests with zero failures, skips or TODOs. The F1.46 navigation-menu group passed all four subtests described above.
- Fresh PostgreSQL migrations applied 18/18; the idempotent second pass recognized 18/18 as already applied.
- Browser/editor smoke passed 9/9; CodeQL passed.
- Signed mainline attestations were published: [SLSA provenance #68832685](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68832685) and [CycloneDX SBOM #68832701](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68832701). The lockfile SHA-256 is `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`; the SBOM SHA-256 is `887dcd07398edb37c36c6c48572594d484d5e2e1f007b55bdd8596f89b10f5f2`.
- Exact-main consolidated readiness artifact [14372653774](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44182949889) has archive SHA-256 `f24ba5765160fdd91902a6fb1523c3952d92befe9e993e98d01019b3891e948c`. It reports `CI EVIDENCE: PASS`, `FINAL RELEASE READINESS: NOT_PRODUCTION_CERTIFIED` and `PRODUCTION CERTIFICATION: NO`. The consolidated source-current classification is 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN; `readyForProduction` remains false.

## Merge and assurance boundary

PR #191 merged through commit `54b766b05db51640281840607df7e16e09da699e`; issue #190 was closed as completed after the exact-main producer passed. GitHub records no formal PR review submissions or inline review threads for #191. The merge and CI are maintainer/automation evidence, not independent security approval.

Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; qualified dependency/SBOM/license review #23, authorized scope #13, load/backup/restore #24, operations/release ownership #26 and governance #32 remain separate gates.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No SemVer increment, release tag, GitHub Release, npm publication or production deployment is authorized. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.