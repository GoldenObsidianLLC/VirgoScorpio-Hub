# F1.18 Idle WebSocket Reauthorization After Lost Redis Invalidation — Design

**Date:** 8 November 2026

**Status:** Implemented and pushed in [PR #109](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/109), which remains open against `main`; the PostgreSQL/Redis multi-node browser spec passed **3/3** locally (F1.16 plus the F1.17 command-time and F1.18 idle-socket scenarios), the focused authorization/tenant/WebSocket/Redis suite passed **40/40**, and `npm run check` passed (**566 tests, 563 passed, 0 failed, 3 platform skips**). Hosted PR CI run #467 (`42529727055`) passed all six jobs for head `3da310665c761fede1d29d6ecda23a319e0b1139`; final hosted PR CI run #469 (`42532101361`) passed all six jobs for the F1.18 implementation head `6caccd1bf01ec4935e37aa2384ad9c9e14d0f714`. No formal review submissions or review threads are recorded; independent-review issues #14/#25 remain open.

## Context

F1.17 established that a WebSocket command is reauthorized against authoritative PostgreSQL membership when a node loses one Redis authorization-invalidation notification. That closes the gap for the next command, but an idle client sends no command to trigger that fallback. The existing event-hub heartbeat path also periodically reauthorizes active subscriptions; F1.18 qualifies that path against the same real identity-service and membership-removal composition.

## Objective

Prove that an already-connected, idle Site A editor socket is closed after its membership is removed even when the receiving API node intentionally misses the Redis authorization-invalidation callback, without requiring a subsequent client application command.

## Design

Extend the F1.17 PostgreSQL/Redis Playwright scenario into two explicit test cases using the same fixture and assertions:

1. **Command-time fallback (preserved):** use a deliberately long test heartbeat interval and send a valid document operation after membership removal. The gateway must reauthorize against the receiving node's database-backed identity service and close with WebSocket policy code `1008` before persistence.
2. **Idle-socket heartbeat fallback (new):** use a short, explicit test heartbeat interval of 5 seconds. After the real membership DELETE route commits and node B confirms it dropped exactly one authorization invalidation, send no client application command. The existing server heartbeat must reauthorize the subscription against PostgreSQL and close the revoked socket with policy code `1008`.

Both cases retain two independent API instances, PostgreSQL pools/stores, default database-backed identity services, real login sessions, the actual membership DELETE route, shared loopback Redis, and the test-only one-shot subscriber fault injection. Both assert the Site A collaboration sequence/history remain unchanged and the unrelated Site B socket remains connected and answers ping.

The close listener is installed before membership changes so the test cannot miss a heartbeat close that races database assertions. The idle scenario polls only the browser socket's ready state; it does not send a collaboration command, ping, or other application message on the revoked socket after membership removal.

## Compatibility and security boundaries

- No production runtime code, heartbeat policy, API contract, route, protocol, dependency, database schema, migration, or package version changes.
- The 5-second heartbeat is a test-only fixture setting. It is not a production default, latency commitment, or revocation SLA.
- This proves eventual reauthorization at the next configured heartbeat after one deliberately lost Pub/Sub hint. It does not prove instantaneous revocation, a bounded production revocation interval, Pub/Sub durability/retry, Redis service outage/partition/Cluster/failover behavior, or multi-region recovery.
- The test suppresses one authorization callback on node B; it does not simulate Redis being unavailable to either publisher or subscriber.
- The test remains maintainer-authored regression evidence. It does not satisfy independent tenant/site-isolation review (#14), independent security assessment (#25), or the broader load/soak/fault-injection/backup-restore evidence (#24). No assessor work is authorized without issue #32's transaction-specific funding approval, a funded statement of work, cleared funds, and written rules of engagement.
- PR #108 merged to `main` at `aaab380978edab446516fe92da99257e798a6200` without formal review submissions or review threads. That merge does not close the independent-review gates.

## Local validation record

- `test/e2e/collaboration-postgres-multinode.spec.js`: **3/3 passed** locally, including F1.16 successful invalidation delivery, F1.17 command-time reauthorization after a dropped hint, and F1.18 idle-socket heartbeat reauthorization.
- Focused authorization/tenant/WebSocket/Redis suite: **40/40 passed**, no skips.
- `npm run check`: **566 tests, 563 passed, 0 failed, 3 platform skips**; 230 required artifact paths and 236 JavaScript files syntax-checked.
- `node --check test/e2e/collaboration-postgres-multinode.spec.js`: passed.
- `git diff --check`: passed after final documentation and test naming edits.
- The browser run used the dedicated loopback PostgreSQL test database, credential-free loopback Redis at `127.0.0.1:6379`, and the existing ephemeral local Playwright configuration selecting cached Chromium 1228. No temporary config was added to the repository.

## Release

Package version remains **0.6.2**. No release, tag, publication, deployment, production approval, or issue closure is implied. Production remains **NO-GO**.
