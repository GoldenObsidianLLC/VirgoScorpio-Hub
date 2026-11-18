# F1.52 — Community friendship active-requester acceptance report

- **Date:** 18 November 2026 UTC / 18 November America/Chicago
- **Issue:** [#207](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/207) — OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Platform security-review gate:** [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-52-friendship-acceptance-active-requester-2026-11-18`
- **Baseline main SHA:** `584831648b7e96d00ccec77bb4565d4bfb4730a6`
- **Pull request:** Pending exact-head hosted CI and PR creation
- **Status:** Candidate implemented locally; focused PostgreSQL regression passes; hosted candidate validation and human review pending

> **Assurance boundary:** This is maintainer-authored regression hardening. It is not an independent security assessment, risk acceptance, waiver, provider acceptance, or production-certification evidence.

## Executive summary

F1.52 closes a demonstrated requester-lifecycle gap in the site-scoped community friendship acceptance route:

`PUT /api/v1/sites/{siteId}/community/friends/{requesterId}`.

Friendship creation already requires the recipient to be an active user with membership in the selected site. Acceptance previously checked only that a matching pending friendship existed for the selected site/requester/addressee. If the requester account became disabled after creating the request, the active addressee could still accept the pending friendship.

The existing UPDATE now has an additional eligibility predicate requiring an active user row joined to a membership for the same site. If no eligible pending request exists, the route retains the existing generic, non-disclosing `404 ERR_VIRGOSCORPIO_HUB_FRIEND_REQUEST_NOT_FOUND` behavior. No endpoint, helper, schema, migration, dependency, lockfile, or response-contract change was introduced.

## Scope and implementation

Runtime change: `apps/api/src/platform-routes.js`.

The acceptance UPDATE retains its existing site, requester, addressee, and `pending` predicates and adds an `EXISTS` subquery joining `site_memberships` to `users` by user ID, constraining membership to the same `site_id`, and requiring `users.status = 'active'`.

This keeps requester eligibility in the same SQL statement as the state transition. It reuses the existing route and query pattern rather than adding a new authorization abstraction or helper. The generic 404 remains unchanged, so missing, foreign, and no-longer-eligible requests share the same non-disclosing result.

Regression change: `test/integration/tenant-community-object-isolation.integration.test.js`.

The existing two-site community object-isolation fixture now proves:
- An active Site B requester can create a pending request and the intended active addressee can accept it successfully.
- A second request is created while its requester is active; the requester's user status is then changed to `disabled` before acceptance.
- Acceptance of that now-inactive request returns the existing generic 404 code.
- The error payload does not contain the disabled requester's ID or display name.
- Full Site A and Site B community snapshots remain unchanged by the denied acceptance; the pending friendship is not transitioned.
- Existing foreign-recipient, invited/disabled-recipient creation, group, conversation, report, moderation, and notification isolation cases remain in the same fixture.

## Reproduction and validation

The regression was first run against the original route implementation on a disposable PostgreSQL 18 database. The disabled requester's acceptance returned HTTP **200**, while the new assertion expected the safe **404**. This reproduced the pre-fix defect against the live route and database, not only a mocked query.

After the SQL eligibility predicate was applied:

| Check | Result | Qualification |
|---|---|---|
| Pre-fix regression reproduction | **FAIL as expected** | Disabled requester was accepted with HTTP 200; the regression expected 404. |
| Focused live PostgreSQL integration | **PASS — 10/10, 0 failures, 0 skips, 0 TODOs** | Existing two-site community object-isolation integration fixture. |
| Fresh migrations | PASS — 18/18 | All 18 versioned migrations applied to a newly created disposable PostgreSQL 18 test database. |
| Changed source syntax | PASS | `node --check apps/api/src/platform-routes.js`. |
| Changed integration test syntax | PASS | `node --check test/integration/tenant-community-object-isolation.integration.test.js`. |
| Full local `npm run check` | **PASS — 670 tests, 667 passed, 0 failed, 3 Windows-specific skips** | Windows / Node.js 26.12.1; artifact verification passed 238 required paths and syntax-checked 268 JavaScript files. |
| Tenant-isolation inventory | PASS | Regenerated to 28 families / 80 route patterns / 21 source files / 57 referenced test files; full suite inventory test passed. |
| `git diff --check` | PASS | No whitespace errors in the runtime/test candidate before documentation updates. |
| Hosted exact-head CI | PENDING | Candidate push/PR workflows have not yet been run at this report snapshot. |
| Formal PR review | PENDING | No review submission or approval is claimed. |

The full local check includes three expected platform-specific skips on Windows; those are not failures. The focused live database test is separate evidence and passed with zero skips. A live hosted PostgreSQL/Memgraph/Redis matrix on supported Node.js 22/24 remains required before merge.

## Inventory and documentation

The existing source-anchored inventory generator was used; no parallel inventory mechanism was introduced. Its current counts remain 28 route/flow families, 80 declared route patterns, 21 implementation source files, and 57 referenced test files. The test-file digest changes to reflect the new regression coverage. The generated JSON inventory and route-capability map are retained as maintainer navigation/drift-detection aids only.

No new route family or route pattern was added. No schema, migration, public HTTP contract, dependency, lockfile, package version, or SemVer change is included.

## Assurance and release boundaries

F1.52 covers the active-requester predicate during friendship acceptance only. It does not establish exhaustive authorization for every friendship state transition, recipient revocation race, user deletion lifecycle, notification or event fan-out path, realtime delivery boundary, or every tenant-scoped API. These broader boundaries remain within independent review scope.

Independent tenant/site isolation review #14 remains OPEN / NOT PERFORMED. Platform security assessment #25 remains OPEN / NOT PERFORMED. F1.52 does not populate `artifacts/evidence/tenant-isolation-review.json` or satisfy either independent-review evidence contract.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, release tag, GitHub Release, npm publication, deployment, provider qualification, paid engagement, spending, or risk acceptance is authorized.

## Next validation

1. Complete documentation/link and inventory freshness checks on the candidate branch.
2. Run exact-head push and pull-request workflows on the same candidate SHA.
3. Review all changed files and the resulting hosted evidence before merge.
4. Keep the issue and PR explicit that F1.52 is maintainer evidence only; do not close or claim satisfaction of #14 or #25.
