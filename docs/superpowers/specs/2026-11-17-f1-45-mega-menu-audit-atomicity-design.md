# F1.45 — Mega-menu configuration audit atomicity design

**Date:** 17 November 2026
**Status:** Candidate implemented; local validation complete; hosted PR validation and human review pending
**Issue:** https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/188
**Baseline:** 68cfd2f0e05e5c43ccb617770124a39c9226db9c

## Context and source-confirmed gap

The site-scoped mega-menu route is implemented in apps/api/src/platform-routes.js. It resolves the path/header/query/body site context and requires site:manage for POST, PUT, and DELETE. Its three mutation paths previously wrote directly through localPool.query():

- POST creates a navigation_menus row.
- PUT conditionally updates by site ID, slug, and expected version.
- DELETE removes a row by site ID and slug where the stored presentation marks it as a mega menu.

These writes had no corresponding identity.audit() event. The route already receives the identity service, identity.audit supports an explicitly supplied transaction queryable, and the module already imports withTransaction(). Nearby firewall and cloud configuration mutations demonstrate state-plus-audit transaction behavior.

The existing two-site integration suite covers route scoping, CRUD, conflicting site selectors, and optimistic update concurrency, but it did not assert mega-menu audit events or prove rollback when audit persistence fails.

## Decision

Use one small route-local withIdentityAuditTransaction() helper for mega-menu writes and the existing cloud-connection helper. The generic helper must:

1. Fail closed with ERR_VIRGOSCORPIO_HUB_AUDIT_UNAVAILABLE when identity.audit is unavailable, before acquiring a transaction client.
2. Enter the existing withTransaction(localPool, work) boundary.
3. Execute the row mutation through the supplied transaction-owned queryable.
4. Await identity.audit(event, { queryable }) on that exact queryable.
5. Return the mutation result only after audit persistence and COMMIT complete. Mutation, audit, or COMMIT failure rejects and rolls back through the shared helper while preserving the original error.

Retain requireCloudConnectionAudit() as a compatibility wrapper around the generic audit-availability check so existing cloud route behavior remains unchanged.

## Audit events

Emit exactly one event for each successful mutation:

| Route action | Audit action | Target type | Safe details |
| --- | --- | --- | --- |
| POST collection | navigation.mega_menu_created | navigation-menu | { slug, version } |
| PUT item | navigation.mega_menu_updated | navigation-menu | { slug, version } |
| DELETE item | navigation.mega_menu_deleted | navigation-menu | { slug, version } |

Each event carries the existing site ID, authenticated actor ID, returned menu row ID, request ID, and successful result. Details must not include menu item documents, arbitrary URLs, presentation payloads, user text, or any other supplied content.

For DELETE, return id, slug, and version from the DELETE statement solely to construct the event. The API response remains { deleted: true, requestId }.

## Compatibility constraints

- Keep public endpoints, methods, response status/body contracts, validation, site selector reconciliation, authorization order, capability names, route regex, tenant predicates, slug key, and expected-version predicate unchanged.
- GET remains read-only and outside the audit transaction.
- Preserve 409 on stale/missing conditional update and 404 on missing delete; neither case emits an event.
- Preserve 23505 and other database errors rather than remapping audit failures to a mega-menu conflict.
- Use the existing transaction/audit service. Do not add a table, migration, outbox, dependency, parallel audit writer, event registry, or public API.
- Do not broaden the route to other navigation menu types or add new authorization behavior.

## Validation strategy

### Unit/route tests

Add test/mega-menu-audit-atomicity.test.js for:

- Successful create/update/delete, exactly one correlated event each, action/target/site/actor/request metadata, version metadata, content minimization, and transaction-owned queryable.
- Injected audit failure for each mutation, rollback of menu state and audit row, followed by successful retry with exactly one event.
- Missing identity audit service failing closed before transaction acquisition.
- Stale update retaining the existing 409 contract and producing no event.

Run test/cloud-connection-audit-atomicity.test.js alongside it to protect the shared-helper refactor.

### Live PostgreSQL integration

Add test/integration/mega-menu-audit-atomicity.integration.test.js. For each of create, update, and delete, create a disposable audit_events trigger that raises for the test site/action. Assert the request fails, menu state is unchanged, and no correlated audit row exists. Remove the trigger, retry the same operation/request ID, and assert the desired menu state plus exactly one metadata-only audit row.

Retain test/integration/tenant-mega-menu-isolation.integration.test.js as the A/B and concurrent optimistic-version regression boundary.

## Non-goals and release boundary

This increment does not claim independent tenant-isolation approval, provider qualification, production readiness, or operational certification. Independent review issues #14 and #25 and dependency/license review #23 remain separate gates. Package 0.6.2 remains private and unreleased; no release, tag, publication, or deployment is authorized.
