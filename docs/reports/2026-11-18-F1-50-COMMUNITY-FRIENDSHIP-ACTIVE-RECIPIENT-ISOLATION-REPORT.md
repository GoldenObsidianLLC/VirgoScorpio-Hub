# F1.50 — Community friendship active-recipient isolation report

- **Date:** 18 November 2026 UTC / 18 November America/Chicago
- **Issue:** [#201](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/201) — OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Platform security-review gate:** [#25](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/25) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-50-community-friendship-recipient-state-2026-11-18`
- **Baseline main SHA:** `1c9b9c8b23e5e3cffe8f8a67aca4f55cbb8d1623`
- **Status:** Runtime correction and focused local disposable-PostgreSQL validation complete; full-project validation, hosted exact-head CI, review and merge pending.

> **Assurance boundary:** This is maintainer-authored route hardening and regression coverage. It is not an independent security assessment, risk acceptance, waiver, or production-certification evidence.

## Executive summary

F1.50 closes a reproduced recipient-eligibility gap in friendship creation:

`POST /api/v1/sites/{siteId}/community/friends/{userId}`.

The route previously treated any `site_memberships` row as sufficient recipient eligibility. Site membership rows can remain when the associated user account is `invited` or `disabled`; the community direct-message and block recipient paths already require the account to be active.

The disposable PostgreSQL regression reproduced this difference before the route change: both an invited and a disabled Site B account that retained Site B membership were accepted with **201 Created**. The route now requires an active user joined to the membership for the requested site. It preserves the existing generic, non-disclosing `404 ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND` response for foreign-site and inactive recipients.

## Scope and implementation

Updated the existing two-site fixture in `test/integration/tenant-community-object-isolation.integration.test.js`. No new test framework, fixture helper, authorization abstraction, or endpoint was introduced.

The fixture now gives Site B membership rows to:
- an active actor and an active positive-control recipient;
- an invited recipient;
- a disabled recipient.

The regression proves:
- a foreign Site A recipient remains non-disclosing and rejected;
- invited and disabled recipients are rejected even though they deliberately retain Site B membership rows;
- the existing active same-site recipient path still creates exactly one pending friendship;
- before/after community snapshots for both sites remain unchanged across the denied inactive-recipient requests, including friendship state;
- the response does not disclose the inactive recipient ID or display name.

The runtime change is intentionally small: the friendship target lookup now joins `users` by ID, constrains the membership by the route `site_id`, and requires `users.status` to equal the bound `active` parameter. Existing route path, HTTP method, generic 404 code/message, active-recipient behavior, and site scope remain unchanged.

No database schema, migration, public API contract, dependency, lockfile or package-version change is included.

## Local validation

A newly created disposable PostgreSQL 18 container and isolated test database were used. All 18 migrations applied successfully to that fresh database.

| Check | Result | Qualification |
|---|---|---|
| Pre-fix regression reproduction | **FAIL as expected** | Both invited and disabled recipients returned 201, proving the prior eligibility gap. |
| Changed source syntax | PASS | `node --check apps/api/src/platform-routes.js`. |
| Changed integration-test syntax | PASS | `node --check test/integration/tenant-community-object-isolation.integration.test.js`. |
| Focused live PostgreSQL integration | **PASS — 9/9, 0 failures, 0 skips, 0 TODOs** | Existing two-site community object-isolation suite, including inactive-recipient denials and active same-site positive control. |
| Fresh migrations | PASS — 18/18 | Applied to the isolated PostgreSQL 18 database. |
| Tenant inventory generation | PASS | 28 route/flow families, 80 declared route patterns, 21 implementation source files, 57 referenced test files. |
| Inventory freshness check | PASS | `node scripts/generate-tenant-isolation-route-inventory.js --check` confirmed 28 families / 80 route patterns. |
| Full `npm run check` | PASS — 670 tests, 667 passed, 0 failed, 3 Windows-specific skips | Windows / Node.js 26.12.1; artifact verification passed 238 required paths and 268 JavaScript syntax checks. |
| Hosted exact-head CI | PENDING | Required before merge; no hosted validation is claimed. |

The pre-fix failure is recorded as regression evidence, not a final test failure. The post-fix live test passes on the same disposable database and route/API setup.

## Inventory and documentation

The source-anchored `community-conversations-moderation-notifications` catalog family now includes the friendship route source anchor in `apps/api/src/platform-routes.js` and describes the active-recipient eligibility and two-site no-side-effect regression. The existing generator refreshed:

- `artifacts/security/tenant-isolation-route-inventory.json`
- `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md`

The generated inventory currently records **28 route/flow families, 80 route patterns, 21 implementation source files and 57 referenced tests**.

The changelog, current project/implementation roadmaps, maintainer assurance notes and assessor hand-off materials are being reconciled to the F1.49 mainline baseline and F1.50 candidate state. Historical baselines remain historical; F1.50 is not described as merged or independently reviewed.

## Assurance and release boundaries

F1.50 covers one recipient-state predicate in friendship creation. It does not establish exhaustive friendship lifecycle authorization, role combinations, membership teardown/revocation races, every notification or event fan-out path, realtime delivery security, provider security, or independent adversarial coverage.

Independent tenant/site review #14 remains OPEN / NOT PERFORMED. Platform security assessment #25 remains OPEN / NOT PERFORMED. F1.50 does not populate `artifacts/evidence/tenant-isolation-review.json` or satisfy either independent-review evidence contract.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, npm publication, deployment, provider qualification, spending, assessor engagement, risk acceptance, or SemVer increment is authorized.
