# F1.47 — Regular navigation-menu tenant-isolation regression report

- **Date:** 17 November 2026
- **Issue:** [#193](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/193) — OPEN
- **Parent maintainer-hardening tracker:** [#124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124)
- **Independent tenant-review gate:** [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14) — OPEN / NOT PERFORMED
- **Candidate branch:** `security/f1-47-tenant-isolation-review-prep-2026-11-17`
- **Baseline main SHA:** `4ad1117fbe235fdc4cc879c8ccde775bb5241482`
- **Status:** Local implementation and focused disposable-PostgreSQL validation complete; candidate not yet hosted-validated, reviewed, or merged.

> **Assurance boundary:** This is maintainer-authored regression coverage and inventory maintenance. It is not an independent security assessment, a risk acceptance, a waiver, or production-certification evidence.

## Executive summary

F1.47 adds a dedicated two-site same-slug isolation regression for regular site navigation menus at `/api/v1/sites/{siteId}/menus`. It closes a specific gap in the maintainer-prepared route inventory: F1.46 already tested transactional audit rollback/retry for the regular menu route, and the existing general tenant test already checks selector mismatches, but neither supplied a dedicated two-site same-slug regular-menu CRUD fixture. The analogous mega-menu test exercises the separate `/mega-menus` route and does not stand in for this route family.

No application runtime, public API, schema, migration, dependency, lockfile, or package-version change was needed.

## Scope and implementation

Added `test/integration/tenant-navigation-menu-isolation.integration.test.js`, gated by the existing disposable PostgreSQL integration environment variables.

The fixture creates two synthetic sites with the same menu slug and separate site-owner accounts, then authenticates only the Site A owner. It verifies:

- Site A list/read returns only Site A's menu and does not expose Site B's marker.
- Site A's actor receives a non-disclosing 403 when attempting Site B list, same-slug update, or same-slug delete.
- The regular-menu route retains its established `ERR_VIRGOSCORPIO_HUB_FORBIDDEN` response code. The first local execution surfaced that the route's existing code differs from the mega-menu route's `ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN`; the test was corrected to assert the regular-menu contract. No runtime behavior was changed.
- Before/after snapshots of both sites' menu rows, navigation audit rows, and site-scoped outbox rows are identical across the denied requests.
- Positive Site A create/update/delete operations work, while Site B's same-slug row remains unchanged.
- Positive Site A CRUD produces the expected five metadata-only navigation audit events associated with Site A's actor and target type.
- Menu CRUD does not enqueue unrelated outbox work.

The fixture uses unique synthetic data and deterministic cleanup. It introduces no new testing framework, runtime helper, or authorization abstraction.

## Inventory and documentation

The existing source-anchored catalog was updated in the `navigation-menus` family to reference the new integration test and distinguish the F1.46 transactional audit coverage from the F1.47 two-site isolation regression. The existing generator refreshed both outputs:

- `artifacts/security/tenant-isolation-route-inventory.json`
- `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md`

Generated inventory: **28 route/flow families, 80 declared route patterns, 21 implementation source files, and 56 referenced test files**. The generator's `--check` freshness verification passed.

The changelog, implementation roadmap, project roadmap, maintainer security-assurance notes, and assessor hand-off materials were reconciled. The assessor engagement document now reflects the current 0.6.2 context and the issue #32 zero-reserve boundary: it is non-binding procurement preparation only, with no authorized outreach, spending, testing, or unpaid assessor work.

The generated inventory remains explicitly maintainer-prepared, not independently reviewed. Historical source baselines remain historical and are not presented as current review pins.

## Local validation

| Check | Result | Qualification |
|---|---|---|
| New test syntax check | PASS | Node.js 26.12.1 `node --check`. |
| Focused live PostgreSQL integration | PASS — 1/1, 0 failures, 0 skips, 0 TODOs | Disposable PostgreSQL 18 container; test-only database name ends in `_test`; all 18 migrations applied fresh. |
| Tenant-isolation inventory generation | PASS | 28 families / 80 route patterns / 21 source files / 56 referenced tests. |
| Inventory freshness | PASS | `node scripts/generate-tenant-isolation-route-inventory.js --check`. |
| Artifact verifier | PASS | 238 required paths and 267 JavaScript files syntax-checked. |
| Full `npm run check` | PASS — 670 tests, 667 passed, 0 failed, 3 Windows-specific skips | Windows / Node.js 26.12.1. |
| Hosted exact-head CI | NOT RUN | Required before merge; no hosted validation is claimed here. |

The focused PostgreSQL test was executed against a newly created disposable local PostgreSQL 18 instance, not a shared or production database. The initial run exposed only the expected-code assertion mismatch described above; after correcting the assertion to the unchanged route contract, the live test passed. A final rerun after adding outbox snapshot assertions also passed 1/1 with zero skips.

## Assurance and release boundaries

F1.47 expands one maintainer-authored regression scenario. It does not establish complete route enumeration, exhaustive role/capability coverage, cache or rendering isolation, provider IAM, asynchronous/realtime security, or production deployment controls.

Issue #14 remains OPEN / NOT PERFORMED. Platform-wide security assessment #25 remains OPEN / NOT PERFORMED. F1.47 does not populate `artifacts/evidence/tenant-isolation-review.json` and must not be represented as satisfying the independent-review acceptance criteria.

Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**. No release tag, GitHub Release, npm publication, deployment, spending, risk acceptance, or SemVer increment is authorized.
