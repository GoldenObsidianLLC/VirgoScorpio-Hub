# Tenant-Isolation and Release Continuation — 10 November 2026

**Repository:** [GoldenObsidianLLC/VirgoScorpio-Hub](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub)
**Candidate:** `0.6.2` — private, unreleased developer preview
**Assessment branch:** `security/tenant-isolation-pre-review-2026-11-10`
**Base main SHA:** `df1bf2b90d6eba96ec571a1ccab96f8d4354353f`
**Production decision:** **NO-GO — NOT_PRODUCTION_CERTIFIED**

## 1. Executive summary

The F1.20 bounded Redis shutdown correction has merged through PR [#115](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/115) at main commit `df1bf2b90d6eba96ec571a1ccab96f8d4354353f`. Hosted PR-head [workflow run #509](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/42767917251) passed all six required jobs on pre-merge head `44b087a7265c013cd75768f08c6828f6991d9113` (Node.js 22/24, PostgreSQL/Memgraph integration, browser smoke, CodeQL and consolidated evidence).

That six-job result is PR-head evidence. A separate passing workflow and accepted exact-source evidence bundle for the resulting main merge SHA have not yet been confirmed in this assessment. Keep F1.20 issue [#113](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/113) OPEN until that post-merge evidence is verified.

This continuation takes the next P0 development slice for issue [#14](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/14): add focused two-site, same-slug custom content-type registry and record isolation coverage, and extend the maintainer route/data-access inventory to expose relevant schema and database-query anchors. The result is review preparation, not independent security acceptance.

## 2. Development completed

### Two-site custom content-type isolation scenario

Added a nested live PostgreSQL test to `test/integration/tenant-content-object-isolation.integration.test.js` covering a custom content type whose slug exists in both Site A and Site B.

The scenario creates Site A's definition fixture directly, creates Site B's definition through the authenticated API, and then verifies:

- Site B's registry selects only Site B's same-slug definition and does not disclose Site A's label or report a cross-site slug conflict.
- Site B can create and list its own record, while Site A's same-type record is excluded from the Site B list.
- A Site B request for Site A's record ID returns 404 and does not disclose the foreign title or definition label.
- Site B can still read its own record and receives its own definition.
- A conflicting `siteId` query selector on registry read is rejected with `ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH`.
- A conflicting body `siteId` on record creation is rejected before persistence; the test checks that no rejected-write row exists.

The test deliberately reuses the existing integration harness, API composition policies, `siteIdFor` site-context validation, capability checks, and site-bound store methods. It introduces no new runtime helper, route, public contract, dependency, schema migration, or SemVer change.

### Maintainer inventory improvement

Updated `docs/security/tenant-isolation-route-inventory.catalog.json` for the content-type registry/records family. The catalog now includes the new integration test and source anchors in:

- `packages/db/src/postgres-store.js` for site-scoped detail, owner-detail and list predicates.
- `database/migrations/0001_initial.sql` for the site-scoped `content_type_definitions` table and uniqueness boundary.

The generator now emits `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md`. The 7 November dated inventory is retained as a historical snapshot. The current generated counts are:

| Inventory measure | Count |
|---|---:|
| Route/flow families | 27 |
| Declared route patterns | 78 |
| Implementation/source files | 21 |
| Referenced test files | 41 |

The inventory remains curated maintainer metadata. It is not automatic route discovery, an independent security opinion, a proof that all route methods are cataloged, or formal release evidence.

## 3. Validation performed

| Command / check | Result | Boundary |
|---|---|---|
| `npm run security:tenant-inventory` | **PASS** — generated 27 families, 78 route patterns, 21 source files and 41 test files | Generator output only. |
| `node scripts/generate-tenant-isolation-route-inventory.js --check` | **PASS** — inventory current; source digest `764475f6561a4a613c10dd133130f0fb91cb950cc9cec8ac3eb0a7c915e33bd4` | Checks generated outputs and declared anchors; does not establish completeness. |
| `node --check test/integration/tenant-content-object-isolation.integration.test.js` | **PASS** | Syntax only. |
| `node --test test/content-type-routes.test.js test/integration/tenant-content-object-isolation.integration.test.js` | **19 passed, 0 failed, 1 skipped** | The skipped result is the parent live PostgreSQL integration test. The new A/B live scenario did not execute locally. |

The local shell had no dedicated `DATABASE_URL` and did not set `VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true`. The integration harness intentionally skips without its explicit disposable PostgreSQL/Memgraph setup; it refuses to infer a destructive test target from an application database. Therefore the new live A/B scenario still requires the hosted `npm run test:integration:live` path against CI-owned disposable services.

The full repository `npm run check` subsequently passed on this worktree: artifact verification passed **235 required paths** and syntax-checked **243 JavaScript files**; the unit suite reported **586 total, 583 passed, 0 failed and 3 Windows-specific platform skips**. This command does not run the live PostgreSQL/Memgraph integration suite, so the new two-site A/B live scenario still requires CI execution against disposable services. Final staged/diff review remains required before merge.

## 4. Architecture and security boundaries preserved

PostgreSQL remains authoritative for tenant-owned content and content-type definitions. The site ID is supplied by the trusted API composition path and carried into storage queries. Same slugs across different sites remain valid; one site's admin definition must not shadow, conflict with, or disclose another site's definition.

The new test uses the existing content-type route module and PostgreSQL store boundary rather than adding duplicate authorization or SQL utilities. It exercises both positive controls (Site B can create/read its own definition and record) and negative controls (foreign ID is non-disclosing; conflicting selectors cause no write).

No attempt is made to reinterpret authorization failures as success, broaden cross-site privileges, or weaken the existing 404/selector-mismatch behavior. No direct/shared Redis, production database, provider, or external service was modified.

## 5. Remaining independent acceptance

Issue #14 remains **OPEN / NOT PERFORMED**. The new scenario covers a useful gap but does not complete the independent reviewer scope. An independent reviewer must still:

1. Independently enumerate deployed HTTP methods/routes, middleware, reverse-proxy rewrites, public assets, workers and operational entry points; compare omissions against the curated inventory.
2. Trace all route families through authentication, site selectors, capabilities, ownership filters, SQL joins/transactions, caches, object storage, provider callbacks, outbox, workers, graph and realtime side effects.
3. Test role/owner combinations, cross-site list/read/create/update/delete, revisions/history, exports/downloads, definition updates/deactivation, concurrent version replacement, search/count and background-worker paths.
4. Compare database rows, versions, audit, outbox/delivery, graph, cache, realtime state, stored bytes and provider calls before and after denied operations.
5. Record the exact reviewed commit, environment, test results, severity-ranked findings, remediation and retest evidence in the independent issue #14 evidence contract.

Do not write `artifacts/evidence/tenant-isolation-review.json` from maintainer tests or this inventory. That evidence belongs to a completed independent review.

Other production blockers remain open: #13 (authorized preview scope), #23 (human dependency/SBOM/provenance review), #24 (load/soak/fault injection/backup-restore), #25 (independent security assessment), #26 (operations/rollback/ownership) and #32 (governance and capital controls). F1.20 #113 also remains open pending exact-mainline qualification after the #115 merge.

## 6. Release and SemVer disposition

- Package version remains **0.6.2**, `private: true`, unreleased.
- No runtime dependency, route/API/protocol, migration/schema or public compatibility change is included in this pre-review increment.
- No SemVer bump is justified.
- No release tag, GitHub Release, package publication or production deployment is authorized.
- Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.

## 7. References

- [Current tenant-isolation route and data-access inventory](../security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-10.md)
- [Historical tenant-isolation inventory — 7 November 2026](../security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-07.md)
- [Tenant-isolation catalog](../security/tenant-isolation-route-inventory.catalog.json)
- [Release readiness](../RELEASE_READINESS.md)
- [Release evidence contract](../RELEASE-EVIDENCE.md)
- [Implementation roadmap](../IMPLEMENTATION-ROADMAP.md)
- [Documentation standards](../DOCUMENTATION_STANDARDS.md)
