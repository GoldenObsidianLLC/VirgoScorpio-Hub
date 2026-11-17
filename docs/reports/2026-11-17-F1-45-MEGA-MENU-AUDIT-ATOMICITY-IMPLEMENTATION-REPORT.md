# F1.45 — Mega-menu configuration audit atomicity implementation report

**Date:** 17 November 2026
**Issue:** #188
**Source baseline at finding identification:** 68cfd2f0e05e5c43ccb617770124a39c9226db9c
**Current base after documentation-only PR #187:** 0f5d12c1e5da98551c43690959201af21c0fe6cc; the F1.45 branch was rebased onto this mainline before candidate review.
**Status:** Candidate implementation and local validation complete; hosted PR validation and human review pending.

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

Final Windows / Node.js 26.12.1 npm run check passed 666 tests, failed 0, and skipped 3 platform-specific cases. The artifact check covered 238 required paths and 265 JavaScript files. The tenant-isolation inventory freshness check passes at 27 families, 78 declared route patterns, 21 implementation source files and 54 unique test files.


## Scope and release boundary

Runtime scope is limited to site-managed mega-menu create/update/delete audit persistence and the shared helper refactor that preserves cloud-connection behavior. Reads, route selectors, capabilities, validation, tenant predicates, optimistic versioning, response contracts and database schema remain unchanged.

No release, package publication, tag, deployment or production certification is authorized. Package 0.6.2 remains private/unreleased. Independent tenant/site assessment #14 and platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/SBOM/provenance/license review #23 and other operational, provider, governance and release gates remain separate. Maintainer tests and hosted CI are not independent security approval.

## Hosted validation and review

Pending: exact-head pull-request workflow results, hosted zero-skip PostgreSQL/Memgraph/Redis integration, CodeQL, browser/accessibility checks, consolidated evidence, human review and exact-main verification after an approved merge.
