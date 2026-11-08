# F1.17 Redis Authorization-Invalidation Loss and Command-Time Reauthorization — Plan

**Date:** 8 November 2026

**Status:** Test implementation and local validation complete; the new PostgreSQL/Redis browser regression passed **1/1**, the combined multi-node browser file passed **2/2**, the focused authorization suite passed **40/40**, and `npm run check` passed (566 tests, 563 passed, 0 failed, 3 platform skips). [PR #108](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/108) is open against `main`. Hosted PR CI run #461 (`42521278925`) and push CI run #462 (`42521284117`) both passed all six jobs for head `e44546e8e8353d5a7826fcdd00adffba9beab57b`. No formal review submissions or review threads are recorded.

**Branch:** `feat/f1-17-reauthorization-after-pubsub-loss-2026-11-08`

**Worktree:** `.worktrees/f1-17-reauthorization-after-pubsub-loss-2026-11-08`

**Design:** [F1.17 design](../specs/2026-11-08-f1-17-redis-invalidation-loss-reauthorization-design.md)

## Objective

Prove that when a node misses a Redis authorization-invalidation notification, its next WebSocket command is independently reauthorized against authoritative PostgreSQL membership state and denied before persistence.

## Work

- [x] Inspect event-hub reauthorization, WebSocket per-command authorization, default API identity-service composition, and Redis authorization subscription wiring.
- [x] Confirm the observability wrapper instruments `pSubscribe`; build the fault-injection wrapper before bridge instrumentation so the test retains the same Redis tracing behavior.
- [x] Add a one-shot, authorization-channel-only subscriber drop seam to the reusable multi-node fixture; preserve the existing document-relay fault injection.
- [x] Allow the browser helper to accept a caller-supplied session token while preserving its existing default fake-session behavior.
- [x] Add a separate two-node/two-browser-context integration using independent database pools/stores and the default database-backed identity services.
- [x] Authenticate disposable users through the real login route and remove the Site A editor through the real membership DELETE route.
- [x] Assert exactly one node B authorization notification is dropped and the old Site A socket remains open before a client command.
- [x] Send a valid collaboration operation and assert command-time database reauthorization closes the socket with code `1008`.
- [x] Assert no Site A operation is persisted and the unrelated Site B socket remains connected and responsive.
- [x] Preserve the existing F1.13–F1.16 four-browser-context regression unchanged.
- [x] Run the new dedicated local PostgreSQL/Redis browser scenario: **1/1 passed**.
- [x] Run the combined multi-node PostgreSQL/Redis browser spec: **2/2 passed**.
- [x] Run focused authorization/tenant/WebSocket/Redis regressions: **40/40 passed**, no skips.
- [x] Run `npm run security:tenant-inventory`: 27 flow families, 78 declared route patterns, 19 implementation source files, 41 test files.
- [x] Run `npm run check`: **566 tests, 563 passed, 0 failed, 3 platform skips**, 230 required artifact paths and 237 JavaScript files syntax-checked.
- [x] Run `git diff --check` and `node --check` for both changed JavaScript files.
- [x] Update the architecture, foundation, roadmap, F1.16 merge plan/spec, and add F1.17 design/plan documentation consistently.
- [x] Push branch and open [PR #108](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/108) against `main`.
- [x] Hosted PR CI run #461 (`42521278925`) and push CI run #462 (`42521284117`) both passed all six jobs for head `e44546e8e8353d5a7826fcdd00adffba9beab57b`.
- [ ] Obtain independent review where required; PR #108 has no review submissions or review threads. No release or production authorization is implied.

## Validation detail

The dedicated test uses the repository's existing integration guard, a dedicated loopback PostgreSQL test database, and credential-free loopback Redis at `127.0.0.1:6379`. The local parent-workspace environment file was loaded into the test process without copying or displaying credentials. A temporary, untracked Playwright configuration used the cached Chromium 1228 executable; it is not retained in the repository.

The first attempt was skipped because the integration flag/Redis endpoint had not been set in the child process. The subsequent run initially failed because the new worktree's `vendor/enginex` submodule had not yet been initialized. After checking out the exact repository-pinned submodule commit, the new scenario passed. These setup outcomes are not counted as passing test runs.

## Boundaries and release

F1.17 adds maintainer-authored regression evidence for command-time authorization after one intentionally dropped Pub/Sub invalidation. It does not qualify Redis service outage, Pub/Sub delivery guarantees, idle-socket immediate revocation, provider identity integration, production load/soak, restore/recovery, or independent security review.

Issues #14, #24, and #25 remain open under their existing acceptance criteria. Package version remains **0.6.2**. No release, tag, publication, deployment, or production approval is authorized. Production remains **NO-GO**.
