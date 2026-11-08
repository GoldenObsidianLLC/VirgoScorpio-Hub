# F1.18 Idle WebSocket Reauthorization After Lost Redis Invalidation — Plan

**Date:** 8 November 2026

**Status:** Test implementation and local validation complete; [PR #109](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/109) is open against `main`. Hosted PR CI run #467 (`42529727055`) passed all six jobs for head `3da310665c761fede1d29d6ecda23a319e0b1139`; no formal review submissions or review threads are recorded.

**Branch:** `feat/f1-18-idle-socket-reauth-after-pubsub-loss-2026-11-08`

**Worktree:** `.worktrees/f1-18-idle-socket-reauth-after-pubsub-loss-2026-11-08`

**Design:** [F1.18 design](../specs/2026-11-08-f1-18-idle-socket-reauth-after-pubsub-loss-design.md)

## Objective

Close the remaining test-coverage gap from F1.17: prove an idle, already-connected WebSocket is reauthorized by the existing server heartbeat after membership removal, even when the receiving node misses the Redis authorization-invalidation callback and the client sends no further application command.

## Work

- [x] Inspect the existing periodic event-hub reauthorization path and F1.17's real database-backed identity/membership integration.
- [x] Preserve the F1.17 command-time fallback as a separate regression case.
- [x] Add the idle-socket case using the same two-node PostgreSQL/Redis fixture and a test-only 5-second heartbeat interval.
- [x] Capture the WebSocket close event before membership removal to avoid racing or missing the heartbeat close.
- [x] Assert the idle client sends no application command after revocation and closes with policy code `1008` on heartbeat reauthorization.
- [x] Assert the revoked Site A collaboration sequence/history remain empty and the unrelated Site B socket remains connected and responsive.
- [x] Keep production runtime code, API, protocol, dependency, schema, migration, and SemVer unchanged.
- [x] Run the combined PostgreSQL/Redis browser spec: **3/3 passed** (F1.16 plus both lost-invalidation scenarios).
- [x] Run focused authorization/tenant/WebSocket/Redis regressions: **40/40 passed**, no skips.
- [x] Run `npm run check`: **566 tests, 563 passed, 0 failed, 3 platform skips**, 230 required paths and 236 JavaScript files syntax-checked.
- [x] Regenerate the tenant-isolation inventory and verify its source anchors.
- [x] Reconcile the F1.17 merge state across architecture, foundation, roadmap, and F1.17 design/plan documentation.
- [x] Rerun syntax, integration, full checks, inventory freshness, and diff validation after final documentation/test naming edits.
- [x] Push the feature branch and open [PR #109](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/109) against `main`.
- [x] Verify hosted PR CI run #467 (`42529727055`) passed all six jobs for head `3da310665c761fede1d29d6ecda23a319e0b1139`.
- [x] Reconcile hosted CI evidence and PR #109 state in the architecture, foundation, roadmap, design, and plan Markdown files.
- [ ] Obtain independent review; maintainer-authored tests do not satisfy issues #14 or #25. PR #109 currently has no formal review submissions or review threads.

## Validation detail

The browser scenario uses the dedicated loopback PostgreSQL test database, credential-free Redis at `127.0.0.1:6379`, and the existing ephemeral local Playwright configuration selecting cached Chromium 1228. The 5-second heartbeat exists only in the idle-socket test case; the command-time scenario retains a 30-second heartbeat to isolate its fallback. The test does not send a client application message on the revoked idle socket after membership removal.

## Boundaries and release

F1.18 qualifies the existing periodic heartbeat reauthorization path after one deliberately dropped Pub/Sub invalidation. It does not prove immediate revocation, a production revocation SLA, Redis outage/partition/failover, Pub/Sub durability/retry, load/soak, restore/recovery, or independent security certification.

PR #108 merged to `main` at `aaab380978edab446516fe92da99257e798a6200` without formal review submissions or review threads. Issues #14, #24, and #25 remain open under their existing acceptance criteria. Package version remains **0.6.2**. No release, tag, publication, deployment, or production approval is authorized. Production remains **NO-GO**.
