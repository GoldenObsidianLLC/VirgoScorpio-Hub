# F1.45 — Mega-menu configuration audit atomicity implementation report

**Date:** 17 November 2026
**Issue:** #188
**Source baseline at finding identification:** 68cfd2f0e05e5c43ccb617770124a39c9226db9c
**Implementation branch base:** 0f5d12c1e5da98551c43690959201af21c0fe6cc (after documentation-only PR #187)
**Candidate commit:** 3fdd09a053c6a1252e1eb0bbb655b4e284b769ed
**Status:** Merged through PR #189 on 17 November 2026; issue #188 CLOSED. Mainline merge SHA `60cca7645dd5f65a2c459742b05af7eb9016eee5`. No formal human review was recorded.

## Executive summary

A source-anchored review found that the site-managed mega-menu POST, PUT, and DELETE routes wrote navigation configuration without a correlated identity audit event. The implementation now persists the menu change and one metadata-only audit event in the same PostgreSQL transaction.

The change reuses the existing withTransaction() and identity.audit(event, { queryable }) contracts. It shares the transaction helper with cloud-connection audit writes while retaining requireCloudConnectionAudit() as a compatibility wrapper. No schema, migration, public API, dependency, lockfile, or SemVer change is introduced.

## Source gap

In apps/api/src/platform-routes.js, the /api/v1/sites/{siteId}/mega-menus route requires site:manage for create, update, and delete. Before this increment, each path called localPool.query() directly and returned after the row mutation; none emitted identity.audit().

The existing two-site integration suite already verified site selector reconciliation, cross-site non-disclosure, same-slug isolation, CRUD, and optimistic-version concurrency. It did not verify the audit contract or inject audit failure into the actual routes.

## Implementation

Successful mutations now emit:

| Mutation | Audit action | Target | Safe details |
| --- | --- | --- | --- |
| POST | navigation.mega_menu_created | navigation-menu | slug, version |
| PUT | navigation.mega_menu_updated | navigation-menu | slug, version |
| DELETE | navigation.mega_menu_deleted | navigation-menu | slug, version |

The identity audit event carries the path site, authenticated actor, menu ID, request ID and success result. Menu items, arbitrary URLs, presentation values and user-supplied content are excluded from audit details.

The generic transaction helper checks identity audit availability before opening a transaction, runs the row mutation on the checked-out queryable, awaits identity.audit(event, { queryable }) on that exact queryable, and returns only after COMMIT. A mutation, audit, or COMMIT failure rolls back and preserves the original error. Stale updates retain the existing 409 behavior and missing deletes retain 404 behavior without emitting an event.

The same helper is now used by cloud-connection persistence. The cloud-specific availability wrapper and its pre-existing route semantics remain intact; the cloud regression suite passes unchanged.

## Validation

### Focused unit and route validation

- test/mega-menu-audit-atomicity.test.js plus test/cloud-connection-audit-atomicity.test.js: 19 passed, 0 failed.
- The mega-menu route tests cover successful event metadata, exact transaction queryable, all three mutation rollback/retry paths, fail-closed audit availability for create/update/delete, and stale-version no-event behavior.
- The existing cloud-connection audit tests pass unchanged, including probe ordering, concurrent-disable preservation, audit rollback and commit-failure behavior.

### Disposable PostgreSQL 18 validation

A disposable container with no persistent volume was used; no shared Compose database/service was changed.

- Fresh migration pass: all 18 migrations applied.
- Idempotent migration pass: all 18 migrations skipped as already applied.
- F1.45 route-level audit failure-injection test: 4/4 passed, zero failures/skips. Trigger-injected create/update/delete audit failures each rolled back the menu row/state and left no correlated audit event; after removing the trigger, retry committed the operation and exactly one event.
- Combined F1.45 audit and existing mega-menu tenant-isolation suite: 5/5 passed, zero failures/skips. The existing two-site same-slug CRUD and expected-version concurrency regression remained green.

The disposable container was removed after validation.

### Repository check and inventory

Final Windows / Node.js 26.12.1 npm run check passed 667 tests, failed 0, and skipped 3 platform-specific cases. The artifact check covered 238 required paths and 265 JavaScript files. The tenant-isolation inventory freshness check passes at 27 families, 78 declared route patterns, 21 implementation source files and 54 unique test files. Implementation-source digest: 8fca459b5deabee424e43e63eb95f425eb9874e8d0a501d0fd7e68583ba0e08e.


## Scope and release boundary

Runtime scope is limited to site-managed mega-menu create/update/delete audit persistence and the shared helper refactor that preserves cloud-connection behavior. Reads, route selectors, capabilities, validation, tenant predicates, optimistic versioning, response contracts and database schema remain unchanged.

No release, package publication, tag, deployment or production certification is authorized. Package 0.6.2 remains private/unreleased. Independent tenant/site assessment #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/SBOM/provenance/license review #23 and other operational, provider, governance and release gates remain separate. Maintainer tests and hosted CI are not independent security approval.

## Hosted validation and review

F1.45 implementation commit `3fdd09a053c6a1252e1eb0bbb655b4e284b769ed` merged through [PR #189](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/189) at main SHA `60cca7645dd5f65a2c459742b05af7eb9016eee5`; issue [#188](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/188) is CLOSED. Exact-head workflows [#725](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44136028844) and [#726](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44136258437), and exact-main [workflow #727](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/actions/runs/44139631658), each completed all seven required jobs successfully. On exact main, Node.js 22.23.4 and 24.22.1 each passed 670/670 Hub tests and 94/94 EnginEx tests with zero skips; both npm audit scopes reported zero vulnerabilities. The hosted PostgreSQL/Memgraph/Redis producer passed 124/124 integration tests with zero failures/skips/TODOs; all 18 fresh migrations applied and all 18 idempotent re-entry checks passed. PostgreSQL-backed collaboration Playwright passed 4/4, browser editor/accessibility smoke passed 9/9, CodeQL passed, signed mainline SLSA provenance and SBOM attestations were created and verified, and exact-source CI evidence consolidation passed. Attestations: [SLSA provenance #68741514](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68741514) and [CycloneDX SBOM #68741572](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/attestations/68741572). The lockfile SHA-256 remains `8f3786bcfcd03d0b63761c7107e4d757ae5b45171ba2f6c086ff38c027c8b086`; no dependency or lockfile change was introduced.

The source-bound per-runtime readiness snapshots still report 7 PASS / 2 PARTIAL / 1 BLOCKED / 14 MISSING_EVIDENCE / 0 NOT_RUN and `readyForProduction=false`; their migration-evidence classification is blocked by a retained record that does not satisfy the exact-current-SHA evidence contract, even though the dedicated workflow #727 fresh/idempotent migration and 124/124 live integration producers passed. The evidence consolidator explicitly reports `CI EVIDENCE: PASS`, `FINAL RELEASE READINESS: NOT_PRODUCTION_CERTIFIED`, and `PRODUCTION CERTIFICATION: NO`. Resolve the stale source-bound readiness record and complete independent/provider/operations gates before treating any release as production-ready. PR #189 recorded no formal review submission or inline review thread; maintainer/automation evidence is not independent security approval. Package 0.6.2 remains private and unreleased; no release, publication, deployment or SemVer change is authorized.
