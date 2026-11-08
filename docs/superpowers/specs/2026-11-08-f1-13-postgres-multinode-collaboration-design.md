# F1.13 PostgreSQL-backed multi-node collaboration qualification — design

**Date:** 2026-11-08
**Status:** Implemented and locally validated (1/1 PostgreSQL-backed real-browser test); hosted CI pending. This is not production qualification.
**Dependency:** F1.12, ADR-019, durable semantic-OT persistence and Redis cross-instance reconciliation.

## Problem

The existing multi-node Playwright suite uses an in-memory collaboration store. A separate PostgreSQL integration test exercises durable collaboration persistence, but it does not combine independent API nodes, real browser clients and separate PostgreSQL pools. The two suites therefore do not prove that independent API replicas observe one durable operation history when Redis hints are lost or delayed.

## Goal

Add a bounded developer-preview qualification using two API instances, separate PostgreSQL pools and `createPostgresStore` instances pointed at the same isolated test database, plus separate Redis bridge clients under a unique test channel prefix. Real browser sessions connect to different API nodes. PostgreSQL remains authoritative; Redis Pub/Sub remains an ephemeral notification path.

## Scope

- Require an explicit `TEST_DATABASE_URL`; accept only a loopback host and a database name ending in `_test` or `-test`. Never fall back to `DATABASE_URL`.
- Require a credential-free loopback Redis URL and isolate the channel prefix per test run.
- Create disposable sites, users and drafts using real database IDs. Use fake test identity sessions with explicit site-scoped capabilities.
- Run each API node with a separate PostgreSQL pool and store instance; use an independent fixture pool for setup/cleanup.
- Verify browser operation acknowledgement and cross-node delivery, then read the same sequence/history through the other node's pool.
- Drop one Redis document hint and verify heartbeat reconciliation repairs the gap from shared PostgreSQL history.
- Close one API node and its pool, then reconnect its former browser session to the surviving node and replay operations in order.
- Prove another document and another site do not receive the primary document's events.
- Verify canonical document state and durable operation rows through the surviving node's pool.
- Close all browser contexts, API servers, Redis bridge connections and PostgreSQL pools in `finally` cleanup.

## Non-goals

No production load, capacity/SLO, soak, Redis Cluster/provider failover, production deployment or security certification. No protocol, runtime behavior, schema, migration, dependency, API route or SemVer change. This test does not replace independent tenant/site authorization review, independent security review or manual accessibility acceptance. Shared undo/redo, cursors, comments, offline-first editing and rich-text AST remain deferred.

## Test isolation and safety

The test must fail closed in CI when the explicit PostgreSQL flag, loopback test database or credential-free loopback Redis endpoint is missing/unsafe. Outside CI, it may be skipped if the integration environment is not explicitly enabled. It must never create a database, apply migrations, fall back to the application database, or use external Redis. Use unique fixture slugs/emails and delete only rows created by the test. Never log connection strings or credentials.

## Acceptance criteria

1. CI executes this Playwright spec after the dedicated PostgreSQL integration migrations and live integration checks pass.
2. Two independent API nodes use separate PostgreSQL pools/stores against one dedicated test database.
3. Real browser clients on different nodes commit and observe the same durable sequence.
4. A dropped Redis hint is repaired via PostgreSQL-backed heartbeat reconciliation without a second write or duplicate sequence.
5. A browser reconnects to the surviving node after node loss and replays canonical durable history in order.
6. Delivery remains scoped to the target document and site.
7. The surviving pool confirms the persisted sequence, materialized document and operation rows.
8. No production behavior, schema, dependencies, routes, migrations or SemVer change.
9. Production remains NO-GO pending the separate release/security/accessibility/operations gates.

## Local validation record (8 November 2026)

The dedicated Playwright spec passed **1/1 locally** using system Chrome, the loopback `TEST_DATABASE_URL` and credential-free loopback Redis. It exercised two API nodes with independent PostgreSQL pools/stores, cross-node delivery, durable replay, dropped-hint heartbeat repair, node-A shutdown and node-B replay/write, and document/site isolation. `npm run check` passed with 565 tests (562 passed, zero failed, three platform skips), 230 required artifact paths and 237 JavaScript files syntax-checked. Hosted CI remains pending; this local correctness run is not production qualification.
