# F1.26 Redis Pub/Sub Re-subscription After Service Restoration — Plan

**Date:** 12 November 2026

**Status:** Merged via PR #131 at main `0748f56e01421d13121ec08f7bc036579e5406835`; exact-head hosted Redis/PostgreSQL/Playwright validation complete; no formal review submission recorded.

**Tracking:** [Issue #124](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/124).

**Design:** [F1.26 design](../specs/2026-11-12-f1-26-redis-pubsub-resubscription-design.md).

## Objective

Prove that after the exact disposable Redis 7.4 service is stopped and restarted, both API nodes reconnect, the remote node's authorization pattern subscription resumes, and a new committed membership revocation is delivered to and closes only the affected remote collaboration socket.

## Work

- [x] Reuse the existing two-node PostgreSQL-backed collaboration fixture and Redis outage-container guard.
- [x] Require CI's explicit outage flag, a credential-free loopback Redis URL, and the exact full 64-character disposable Redis container ID.
- [x] Create Site A and Site B principals, sessions, documents, and browser WebSocket clients on the remote API node.
- [x] Stop only the inspected `redis:7.4-alpine` test container and assert both bridges leave ready state while existing sockets remain connected.
- [x] Restart the same container, wait for a successful Redis PING, then wait for both bridges to recover.
- [x] Assert the remote authorization callback has received no message before a new mutation is committed.
- [x] Remove the Site A membership via the real API on node A and assert the reconnected node B subscriber receives the new authorization event and closes the Site A socket with code 1008 before the test-only heartbeat.
- [x] Assert Site B's unrelated socket remains usable and neither collaboration document history was modified.
- [x] Keep Redis restoration in `finally` and clear the outage flag only after the Redis PING succeeds.
- [x] Rename test labels and browser globals to F1.26, avoiding collision with the F1.25 content-type registry increment.
- [x] Run syntax checks for the E2E spec and shared fixture.
- [x] Run focused Redis reconnect/bridge/outage-guard unit tests: **20/20 passed**.
- [x] Run `npm run check`: **594 tests, 591 passed, 0 failed, 3 Windows-specific skips**; artifact verification covered 235 required paths and syntax-checked 243 JavaScript files.
- [x] Execute exact PR-head workflows #580/#581 and exact-main workflow #582: each PostgreSQL/Memgraph suite passed 92/92 with zero failures/skips; the Redis stop/restore multi-node Playwright scenario passed; Node 22/24 each passed 594/594; CodeQL, browser/accessibility 9/9, collaboration Playwright 4/4, fresh migrations, main-only signed provenance/SBOM and evidence consolidation passed. Main-only attestation is skipped by design on feature-branch events #580/#581 and passed on main #582.
- [x] Reconcile current main #582, merged F1.26 PR #131, and F1.27 candidate status across implementation/product roadmaps, README/docs index, release scope/readiness/report, maintainer assurance policy, generated inventory, and this plan.
- [ ] Obtain human review; the change is maintainer-led test evidence, not independent security approval.

## Local validation boundary

The live outage case is deliberately CI-only. The Windows maintainer host is not used to stop or restart a Redis service. Syntax, unit, and full repository checks do not count as execution of the stop/restore browser scenario. Hosted CI must prove the exact test runs against its full-ID-verified disposable Redis 7.4 service, with PostgreSQL integration and Playwright assertions executed and no skips.

## Boundaries

This increment validates subscription recovery for **new** Pub/Sub events after reconnect. It does not provide durable Pub/Sub delivery or replay messages lost while Redis is down. Existing PostgreSQL command/heartbeat reauthorization fallbacks remain necessary. No production runtime, schema, API, dependency, provider, or SemVer change is proposed. Independent reviews #14/#25 remain OPEN / NOT PERFORMED; issue #23 remains OPEN / PARTIAL; package 0.6.2 remains private/unreleased and production remains **NO-GO**.
