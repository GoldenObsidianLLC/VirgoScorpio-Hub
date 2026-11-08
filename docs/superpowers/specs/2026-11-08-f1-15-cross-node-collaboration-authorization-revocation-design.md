# F1.15 Cross-Node Collaboration Authorization Revocation — Design

**Date:** 8 November 2026

**Status:** Implemented; focused local integration qualification passed.

**Scope:** Test-only qualification of existing Redis authorization-invalidation fan-out across independent API nodes.

## Problem

F1.14 covers tenant boundaries and live edit-authorization rechecks on one API node. The F1.13 browser integration harness covers durable collaboration across independent API nodes, but it did not prove that an authorization invalidation published by one node closes an already-connected collaboration WebSocket on another node.

A remote node can temporarily hold a stale identity/authorization snapshot. The existing invalidation message is intended to remove matching subscriptions from the remote event hub; the WebSocket gateway then observes the invalidated base subscription on its normal heartbeat/reauthorization path and closes the stale connection. This interaction needs an integration regression using independent node state, not two bridges sharing one mutable identity fixture.

## Design

Extend the existing PostgreSQL/Redis Playwright collaboration scenario. Reuse its four browser contexts, independent PostgreSQL pools/stores, and independent Redis bridge clients. Do not add dependencies, production routes, storage changes, migrations, or runtime authorization behavior.

The test creates independent fake identity snapshots for API node A and API node B. It changes the Site A membership snapshot on node A while intentionally leaving node B's snapshot stale, then publishes the site/principal-scoped authorization invalidation through node A's Redis bridge.

The existing Site A client on node B for a different document is used as the revocation probe. The test waits for its WebSocket to close, confirms another Site A principal remains connected, confirms the Site B WebSocket remains connected and answers a ping, and verifies that the revoked client's document history remains empty. The primary collaboration history also remains at its pre-revocation sequence.

Using an already-existing browser context avoids increasing the established four-context browser footprint. The node B heartbeat remains at the gateway's enforced 5-second minimum; the test uses a bounded 7.5-second close window.

## Security and correctness boundaries

- The separate fake identity snapshots deliberately keep node B stale. Therefore the remote WebSocket closure demonstrates receipt and application of the Redis invalidation, rather than a fresh node B authorization lookup independently denying the connection.
- The F1.15 test mutates the node A fixture snapshot and calls the bridge invalidation method directly. It does not exercise a production identity provider, production membership persistence, or the real identity service's callback wiring end-to-end. F1.16 adds a separate follow-on regression for the real API identity-service callback and membership DELETE route composition.
- This proves the successful-delivery path only. Redis Pub/Sub remains best-effort; this is not a durability guarantee for invalidation messages or a test of Redis outage/failover, Redis Cluster, or delivery loss.
- F1.14 continues to cover same-node REST and WebSocket edit denial before persistence. F1.15 adds the separate remote subscription-invalidation path; it does not replace fresh per-command/per-heartbeat authorization checks.
- These maintainer-authored regression tests do not constitute the independent reviews required by issues #14 and #25, production identity-provider qualification, load/soak testing, operational readiness, or release approval.

## Validation

- Dedicated PostgreSQL-backed, two-node real-browser Playwright scenario: **1/1 passed** using the loopback test database and a temporary loopback-only Redis-compatible service.
- `npm run security:tenant-inventory`: generated 27 route/flow families, 78 declared route patterns, 19 source files, and 41 test files.
- `npm run check`: passed after the final source-anchored inventory regeneration; 566 tests (563 passed, 0 failed, 3 platform skips), 230 required artifact paths and 236 JavaScript files syntax-checked.
- `node --check test/e2e/collaboration-postgres-multinode.spec.js` and `git diff --check`: recorded in the implementation plan after final reconciliation.

## Compatibility and release

No production code, dependencies, API contract, protocol, schema, migration, or package version changed. Package version remains **0.6.2**. No release, tag, publication, deployment, or production approval is implied. Production remains **NO-GO**.
