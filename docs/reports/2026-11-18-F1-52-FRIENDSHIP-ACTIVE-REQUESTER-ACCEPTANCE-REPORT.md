# F1.52 — Community friendship active-requester acceptance report

- **Date:** 18 November 2026 UTC / 18 November America/Chicago
- **Issue:** [#207](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/207) — CLOSED
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Platform security-review gate:** [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) — OPEN / NOT PERFORMED
- **Merged branch:** `security/f1-52-friendship-acceptance-active-requester-2026-11-18`
- **Baseline main SHA:** `584831648b7e96d00ccec77bb4565d4bfb4730a6` (first parent before the F1.52 merge)
- **Pull request:** [#208 MERGED](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/208); implementation commit `99886cc4d8db22109bd036b80091fa4054387d93`, PR head `8230b9946d2edaf91039cdb878c2eb9e8d08d867`, merge commit `ccd454c0fa8bc49a91526756819af451c1a390d2`
- **Status:** Merged to main; issue #207 CLOSED. Exact-main workflow #44407304492 / run #765 passed 7/7 jobs on merge SHA `ccd454c0fa8bc49a91526756819af451c1a390d2`. No formal PR review submission or inline review thread was recorded; maintainer/automation evidence only.

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
| Hosted candidate CI | **PASS — push workflow #44389374850 / run 763 and PR workflow #44389545398 / run 764** | Both workflows validated the candidate implementation on head `8230b9946d2edaf91039cdb878c2eb9e8d08d867`; six applicable jobs succeeded in each; the mainline-only attestation job was skipped by design. |
| Hosted PR CI | **PASS — workflow #44389545398 / run 764** | Same exact head; six applicable jobs succeeded; the mainline-only attestation job was skipped by design. |
| Hosted live database suite | **PASS — 143/143, 0 failures, 0 skips, 0 TODOs** | PostgreSQL/Memgraph/Redis producer passed on the exact PR head. |
| Formal PR review | **NOT PROVIDED — 0 formal reviews / 0 inline threads** | PR #208 merged without a formal human review submission. The merge does not satisfy independent reviews #14/#25. |

The full local check includes three expected platform-specific skips on Windows; those are not failures. The focused local live database test is separate evidence and passed with zero skips.

The exact-head hosted PR workflow [#44389545398 / run 764](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44389545398) also completed successfully on the same head SHA. Both push run #763 and PR run #764 passed all six applicable jobs; the mainline-only signed-attestation job was skipped by design on candidate events. Their live PostgreSQL/Memgraph/Redis producer passed **143/143 tests, 0 failures, 0 skips, 0 TODOs**. Node.js 22.23.4 and 24.22.1 each passed **670/670 Hub tests**; both full and production npm audits reported **0 vulnerabilities**; browser/accessibility smoke and CodeQL passed. The PR workflow's consolidated readiness artifact is #14467064307 (SHA-256 `74748e9451476f7e6cde13f4ae2937ea2c1788dc8a25c1366dfb9d10076001b2`). The attestation job was skipped as designed because candidate branches do not receive mainline signing attestations. These are candidate maintainer/automation results, not independent security approval or production certification.

## Inventory and documentation

The existing source-anchored inventory generator was used; no parallel inventory mechanism was introduced. Its current counts remain 28 route/flow families, 80 declared route patterns, 21 implementation source files, and 57 referenced test files. The test-file digest changes to reflect the new regression coverage. The generated JSON inventory and route-capability map are retained as maintainer navigation/drift-detection aids only.

No new route family or route pattern was added. No schema, migration, public HTTP contract, dependency, lockfile, package version, or SemVer change is included.

## Merge and exact-main validation

PR [#208](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/208) merged to `main` at `ccd454c0fa8bc49a91526756819af451c1a390d2` on 18 November 2026; issue [#207](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/207) is CLOSED. The merge contains runtime implementation commit `99886cc4d8db22109bd036b80091fa4054387d93` and documentation commit `8230b9946d2edaf91039cdb878c2eb9e8d08d867`.

Exact-main [workflow #44407304492 / run #765](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44407304492) completed successfully on the exact merge SHA with 7/7 jobs passing. Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub tests and 94/94 EnginEx tests; the live PostgreSQL/Memgraph/Redis integration suite passed 143/143 with zero failures, skips or TODOs; all 18 fresh migrations applied and the idempotent second pass recognized all 18; browser smoke passed 9/9; CodeQL, signed mainline SLSA/SBOM attestations, dependency audit and exact-source evidence consolidation passed. Both full and production npm audit scopes reported zero vulnerabilities.

The exact-source final readiness artifact is #14476181217 (archive SHA-256 `36aadc37cea1c9684f9572d7ad9574d80e904a6`; readiness JSON SHA-256 `733972ee378321ebb34072b0789ca76a49c5951680cf863f9e5ddd90d79ffa22`). It records 8 PASS / 2 PARTIAL / 0 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN, `readyForProduction=false`, and `NOT_PRODUCTION_CERTIFIED`. PR #208 had zero formal review submissions and zero inline review threads. The maintainer merge and automated CI are not independent security/legal approval and do not close issues #14, #23 or #25.

## Assurance and release boundaries

F1.52 covers the active-requester predicate during friendship acceptance only. It does not establish exhaustive authorization for every friendship state transition, recipient revocation race, user deletion lifecycle, notification or event fan-out path, realtime delivery boundary, or every tenant-scoped API. These broader boundaries remain within independent review scope.

Independent tenant/site isolation review #14 remains OPEN / NOT PERFORMED. Platform security assessment #25 remains OPEN / NOT PERFORMED. F1.52 does not populate `artifacts/evidence/tenant-isolation-review.json` or satisfy either independent-review evidence contract.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No SemVer increment, release tag, GitHub Release, npm publication, deployment, provider qualification, paid engagement, spending, or risk acceptance is authorized.

## Subsequent release-gate work

1. Obtain the independent tenant-isolation review under issue #14 and the independent platform security assessment under issue #25; retain scope, reviewer identity/qualification, exact-SHA evidence, findings and remediation.
2. Complete qualified dependency/license/distribution review #23 and address the remaining provider, identity, malware, accessibility, product parity, plugin isolation, load/restore, observability and operations-approval gates.
3. Keep package 0.6.2 private/unreleased and production NO-GO until all mandatory evidence and authorized release-owner approval are present.
