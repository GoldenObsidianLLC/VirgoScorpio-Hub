# F1.17 Redis Authorization-Invalidation Loss and Command-Time Reauthorization — Design

**Date:** 8 November 2026

**Status:** Implemented; the dedicated PostgreSQL/Redis browser regression passed **1/1** locally, the combined multi-node browser file passed **2/2**, the focused authorization/tenant/WebSocket/Redis suite passed **40/40**, and `npm run check` passed (566 tests, 563 passed, 0 failed, 3 platform skips). Hosted CI is pending.

**Scope:** Test-only qualification of the existing command-time WebSocket authorization check after one remote Redis authorization-invalidation delivery is intentionally dropped.

## Problem

F1.16 proves that a committed site-membership removal flows through the default API identity service callback and successfully invalidates a stale collaboration socket on another API node through Redis Pub/Sub. That verifies the happy delivery path, but it does not prove that the receiving node independently rechecks authoritative membership when the invalidation hint is lost.

Redis Pub/Sub remains an ephemeral notification path. Authorization correctness must not depend on the notification being delivered: a later client command must be checked against the database-backed identity service before it can mutate collaboration state.

## Design

Extend the existing reusable Redis multi-node fixture with a narrowly scoped subscriber fault-injection seam. The publisher path and all non-authorization subscriptions retain their existing behavior. The subscriber wrapper may discard exactly one callback for the test bridge's authorization channel and exposes a counter so the test proves that the delivery was actually suppressed.

Add a separate PostgreSQL-backed Playwright scenario using two independent API instances, two independent PostgreSQL pools/stores, and a shared loopback Redis channel prefix. Both API instances omit an injected identity service, so `createApiServer` composes the normal database-backed identity service. The test:

1. Creates disposable Site A owner/editor accounts and an unrelated Site B editor, with the repository's existing `site-owner` and `editor` roles.
2. Creates one draft in each site and authenticates all users through the real login route to obtain database-backed sessions.
3. Connects the Site A editor and Site B editor to node B using their real session cookies.
4. Arms node B to drop exactly its next authorization-channel notification.
5. Removes the Site A editor through node A's real membership DELETE route using the Site A owner's bearer session. The membership deletion commits and the identity service callback publishes the normal Redis invalidation.
6. Asserts node B's subscriber dropped one invalidation and the Site A socket is still open before any client command is sent. The test's extended heartbeat interval prevents timer-based reauthorization from obscuring the command-time behavior.
7. Sends a valid document-operation command over the still-open Site A socket. The WebSocket gateway must reauthorize the subscription against node B's database-backed identity service, deny the now-removed membership, and close the socket with policy code `1008` before collaboration persistence.
8. Verifies the removed membership is absent, the Site A collaboration sequence/history remain at zero, and the unrelated Site B socket stays open and answers ping.

The new scenario uses two browser contexts and leaves the existing four-context F1.13–F1.16 regression unchanged.

## Security and correctness boundaries

- The API login, session resolution, membership removal, identity-service authorization query, WebSocket command gate, and PostgreSQL collaboration store are real application code, exercised with disposable test data in a dedicated loopback database.
- Redis is not stopped and no outage is induced. The test subscriber suppresses one authorization-pattern callback only on node B; the publisher and node A's local delivery remain operational.
- The test proves command-time fail-closed reauthorization after a dropped hint. It does **not** prove immediate remote revocation while the client sends no further messages, Pub/Sub durability, retry/outbox delivery, Redis outage/partition/Cluster/failover recovery, or a bounded revocation SLA.
- The longer heartbeat setting is test isolation, not a production configuration recommendation. In a quiet connection, the existing periodic reauthorization path is the next fallback; its outage/latency behavior is not qualified by this scenario.
- The test does not replace load/soak, fault-injection, backup/restore, or RPO/RTO evidence required by issue #24, nor the independent tenant/security reviews required by #14 and #25.
- No production runtime, API contract, route, protocol, dependency, schema, migration, or package version is changed.

## Validation

- New dedicated PostgreSQL/Redis real-browser scenario: **1/1 passed** locally (6.5 seconds in the focused run).
- Combined `test/e2e/collaboration-postgres-multinode.spec.js`: **2/2 passed** locally (16.9 seconds), including the F1.16 successful-delivery regression.
- JavaScript syntax checks for the changed fixture and E2E spec: passed.
- Focused authorization/tenant/WebSocket/Redis regression suite: **40/40 passed**, no skips.
- `npm run check`: **566 tests, 563 passed, 0 failed, 3 platform skips**, with **230 required artifact paths** and **237 JavaScript files** syntax-checked.
- `npm run security:tenant-inventory`: **27 flow families, 78 declared route patterns, 19 implementation source files, 41 test files**.
- Hosted CI: pending.

The local run used the repository's dedicated loopback test database and the existing Memurai service bound to `127.0.0.1:6379`. It used an ephemeral local-only Playwright configuration pointing to the cached Chromium 1228 executable because the installed browser revision did not match the repository's pinned Playwright revision. That temporary configuration is not part of the repository.

## Compatibility and release

Package version remains **0.6.2**. No release, tag, publication, deployment, production approval, or issue closure is implied. Production remains **NO-GO**.
