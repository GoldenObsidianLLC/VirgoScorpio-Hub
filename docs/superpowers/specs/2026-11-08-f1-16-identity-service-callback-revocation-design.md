# F1.16 Identity-Service Membership Revocation Across Collaboration Nodes — Design

**Date:** 8 November 2026

**Status:** Implemented; focused, PostgreSQL/Redis browser, and full local checks passed.

**Scope:** Test-only qualification of the production API identity-service callback wiring for site-membership revocation across independent API nodes.

## Problem

F1.14 verifies same-node tenant and live edit authorization boundaries. F1.15 verifies cross-node Redis authorization-invalidation delivery, but it directly invokes the bridge invalidation method from a test fixture after mutating a fake identity snapshot. That leaves the application composition path from a committed membership change through the default identity service callback to the Redis bridge unqualified.

## Design

Extend the existing PostgreSQL-backed F1.13/F1.15 Playwright scenario without adding production behavior, routes, schema, migrations, dependencies, or browser contexts.

The test fixture's `createRedisApiInstance` accepts an optional PostgreSQL `pool` and passes it into `createApiServer`. When the API instance receives a pool but no injected `identityService`, the production server composition creates its normal identity service and wires its `onAuthorizationChange` callback to the supplied realtime bridge. Existing callers that inject a fake identity service are unchanged.

The integration adds a separate API instance with its own small PostgreSQL pool and shared test Redis bridge prefix. It uses database-backed fixture users and the actual login and site-membership DELETE routes:

1. Create a Site A owner and Site A editor in the dedicated test database, with the normal `site-owner` and `editor` role records.
2. Authenticate the owner through `POST /api/v1/auth/login` and extract the opaque session cookie from the response.
3. Remove the editor through `DELETE /api/v1/sites/:siteId/members/:userId`.
4. Confirm the membership row is committed as deleted and the DELETE route reports success.
5. Keep node B's collaboration identity fixture intentionally stale. The matching Site A WebSocket on node B must close only after node A's real identity service callback publishes the committed authorization change through node A's Redis bridge.
6. Confirm unrelated Site A and Site B clients remain connected, the Site B client still answers ping, the revoked document history remains empty, and the established primary document history is unchanged.

The test reuses the F1.15 other-document browser context and retains its four-browser-context footprint. The extra identity-service API process has its own PostgreSQL pool and is closed with the other test-owned resources.

## Security and correctness boundaries

- The login, membership administration route, identity service, PostgreSQL persistence, and API-to-Redis invalidation callback are the real application implementations, exercised with disposable test users/roles and the dedicated loopback test database.
- The collaboration clients' identity fixture remains deliberately stale on node B. This makes the remote socket closure evidence of the production API composition callback and Redis invalidation path rather than a fresh node B authorization read independently denying the socket.
- The test uses the application's local session/password identity flow; it does not qualify external OIDC/SAML providers, an external identity directory, production secrets, or production user provisioning.
- This proves successful Redis Pub/Sub invalidation delivery only. It does not prove delivery durability, Redis outage/failover/partition behavior, Redis Cluster, PostgreSQL failover, or recovery from a lost authorization invalidation.
- F1.14 still covers same-node live edit denial. F1.15 still covers the lower-level bridge delivery contract. F1.16 adds the real membership route → committed DB mutation → default identity-service callback → Redis bridge composition.
- This is maintainer-authored regression coverage, not the independent reviews required by issues #14 and #25, a full tenant assessment, or production security certification.

## Validation

- Focused authorization, tenancy, WebSocket, and Redis regression suite: **40/40 passed**, no skips.
- Dedicated PostgreSQL/Redis real-browser integration scenario: **1/1 passed** locally using the dedicated loopback test database, the loopback Memurai service at `127.0.0.1:6379`, and a cached Chromium executable with an ephemeral local-only Playwright configuration. The repository Playwright configurations were not changed.
- `npm run security:tenant-inventory`: **27 route/flow families, 78 declared route patterns, 19 implementation source files, 41 test files**.
- `npm run check`: **566 tests, 563 passed, 0 failed, 3 platform skips**; 230 required artifact paths and 236 JavaScript files syntax-checked.
- `node --check test/e2e/collaboration-postgres-multinode.spec.js`: passed.

## Compatibility and release

No production runtime behavior, API contract, dependency, route, protocol, database schema, migration, or package version changed. Package version remains **0.6.2**. No release, tag, publication, deployment, or production approval is implied. Production remains **NO-GO**.
