# F1.40 — Reusable-component mutation and audit atomicity (candidate report)

**Status:** Unmerged maintainer candidate; issue [#171](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/171) is OPEN.  
**Parent:** [#124 — tenant-isolation and authorization hardening](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124).  
**Candidate branch:** `security/f1-40-reusable-component-audit-atomicity-2026-11-16`.  
**Base:** current docs-synced main `b77505ef34507c8ba84152b47b3ebffb8f1420e7` (PR #170; exact-main workflow #685).  
**Package:** `virgoscorpio-hub@0.6.2`, private and unreleased.

## Scope and finding

The site-scoped `/api/v1/sites/{siteId}/reusable-components` route already applies site predicates, route-selector reconciliation, `content:read` / `content:edit` capabilities, document/metadata validation and optimistic version checks. Before this candidate, its POST/PUT/DELETE mutations used direct `localPool.query` calls and did not persist a correlated identity audit record in the same PostgreSQL transaction.

This is an audit-consistency and coverage gap, not a demonstrated cross-tenant IDOR. F1.40 preserves the current authorization and not-found/conflict behavior while making the mutation and audit atomic.

## Candidate implementation

The route now reuses the existing `withTransaction(localPool, work)` helper; it does not introduce a nested transaction abstraction. One local `auditMutation(action, component, queryable)` helper writes the metadata-only `reusable_component.created`, `reusable_component.updated`, or `reusable_component.deleted` event through the same checked-out queryable used for the component row mutation. The audit call is awaited before COMMIT.

Audit target type is `reusable-component`; the event includes site, actor, request and target correlation plus safe `slug` and `version` details. It does not persist component document bodies. Mutation SQL remains constrained by `site_id` and the item ID; updates retain the expected-version predicate. Existing validation, selector reconciliation, capability checks, status codes, response bodies and not-found/conflict handling remain unchanged. Audit persistence errors—including SQLSTATE 23505—are not remapped as component slug/version conflicts.

## Regression coverage

The new unit file `test/reusable-component-audit-atomicity.test.js` verifies successful create/update/delete audit calls receive the exact transaction client, happen after the row mutation and before COMMIT, and contain the expected action/target/request/version metadata. A simulated audit failure for each mutation rolls back the component row and audit insert; the original 23505 error identity is retained.

The existing route-capability test now explicitly covers denied GET, POST, PUT and DELETE requests for reusable components before protected data access.

The dedicated live PostgreSQL integration file `test/integration/reusable-component-audit-atomicity.integration.test.js` is gated by `DATABASE_URL` and `VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true`. It provisions two isolated sites and actors, writes Site A/Site B component controls, verifies Site A listing does not disclose Site B data, exercises foreign-ID update/delete denial and wrong-site route denial, then installs site/action-specific audit triggers. Create, update and delete audit failures must roll back state and audit rows; removing the trigger and retrying must create exactly one correlated record. Site A's control row remains unchanged throughout.

## Validation completed locally

On the Windows developer workstation using Node.js 26.12.1:

| Check | Result |
|---|---:|
| `npm run check` | 643 passed; 0 failed; 3 Windows-specific skips |
| Artifact/syntax verification | 238 required paths; 258 JavaScript files |
| Focused reusable-component unit + route-capability tests | 23/23 passed; 0 skipped |
| Tenant inventory regeneration | 27 families; 78 declared route patterns; 21 source files; 48 test files |
| `git diff --check` | PASS |

The first full `npm run check` attempt correctly detected stale generated tenant-inventory outputs after the catalog and route-test changes. `npm run security:tenant-inventory` regenerated the outputs; the subsequent full check passed with the counts above.

**Live PostgreSQL was not run locally.** Neither `TEST_DATABASE_URL` nor `DATABASE_URL` nor the integration opt-in flag was configured. The integration test therefore remains unvalidated against a live local database. Exact-head hosted CI must execute this test with its disposable PostgreSQL service and require zero skips before merge. The mainline workflow #685 is baseline evidence for SHA `b77505e`; it predates and does not validate F1.40.

## Generated tenant inventory

The candidate updates the source-anchored tenant route catalog with the shared audit helper anchor and new unit/integration test references, and expands route-capability denial coverage to all four reusable-component methods. The generator reports 27 families / 78 declared route patterns / 21 source files / 48 test files. The generated inventory remains a navigation and drift-detection aid, not independent security evidence or proof of exhaustive route discovery.

## Remaining acceptance gates

1. Review the complete branch diff, including generated inventory, for source/catalog/test consistency.
2. Push the exact candidate commit and require both push and pull-request CI on Node.js 22.23.4 and 24.22.1, focused regressions, live PostgreSQL/Memgraph with zero skips, 18/18 fresh and 18/18 idempotent migrations, browser/editor smoke, CodeQL, npm audit and evidence consolidation.
3. Confirm the live integration test proves actual PostgreSQL rollback/retry for all three write operations and unchanged cross-site controls.
4. Obtain human review before merge. Maintainer tests and automation are not independent approval.
5. After any merge, validate the exact resulting main SHA and refresh source-bound release evidence; do not promote candidate evidence to mainline prematurely.

## Release and assurance boundary

No schema, migration, dependency, public REST contract, lockfile, package-version, SemVer, tag, publication or deployment change is intended. No merge authorization is implied by this report. Package `virgoscorpio-hub@0.6.2` remains private and unreleased. Independent tenant review #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.
