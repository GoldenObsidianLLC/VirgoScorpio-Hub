# F1.12 Studio collaborative editing client — implementation plan

**Date:** 2026-11-07
**Status:** Local implementation, verification, staged diff review and cross-instance/multi-node browser qualification complete. Focused unit tests, the full repository check, Studio editor browser smoke, two-session collaboration proof and the four-test multi-node suite pass locally. Clean hosted CI remains open before PR preparation.
**Design:** [F1.12 Studio collaborative editing client design](../specs/2026-11-07-f1-12-studio-collaboration-client-design.md)

## Scope guard

Integrate the existing F1.9/F1.10/F1.11 server-authoritative draft protocol into Studio. Do not add a CRDT, new database schema, new transport or dependency. Do not change published content, workflow authorization or canonical page-document v1.

## Work items

- [x] Add a browser/Node-compatible collaboration client module with secure client/op IDs, exact envelope validation, bounded page-tree structural checks, typed operation application, sequence buffering, bounded reconnect, canonical REST sync, reload handling and clean leave.
- [x] Load the collaboration module before Studio and add an explicit collaboration action/status indicator.
- [x] Map Studio title, structural, approved property/style and bounded text edits to existing semantic operations. Apply accepted server operations only.
- [x] Disable unsafe local mutation while connecting/reconnecting/synchronizing or while a write is pending. Block whole-document save, workflow actions, revision restore, JSON replacement and page/site switching during a live session.
- [x] Accept both site-level `content:edit` and `content:edit:own` as UI entry-point capabilities; the server remains responsible for verifying page ownership when own-content authority is used.
- [x] Update required-artifact verification for the new browser module and focused unit test.
- [x] Add deterministic client/unit tests for operation application, envelope/tree validation, WebSocket sequencing, REST snapshot recovery and close-before-join.
- [x] Add a Playwright editor assertion that a saved, clean draft enables the collaboration action and displays the ready status.
- [x] Document the feature scope, protocol, session restrictions, validation and production boundaries in the F1 foundation, real-time architecture, feature parity, roadmap addendum and changelog.
- [x] Run the updated Playwright editor suite: `test/e2e/editor.spec.js` passed **2/2** locally.
- [x] Run `test/e2e/collaboration.spec.js`: **1/1** real-browser two-session test passed using an isolated config (the spec starts its own in-process API server). It covers remote operation delivery, lost-ack reconnect/replay, idempotent retry, concurrent property edits and canonical reload. The fixture uses in-memory persistence, not PostgreSQL.
- [x] Run the full repository check: `npm run check` passed locally.
- The repository-wide Playwright config timed out waiting for its global API webServer when this in-process spec was first invoked. Rerunning it with a temporary isolated config (omitting the redundant global webServer) passed 1/1; the temporary config was removed after the run.
- [x] Run cross-instance/multi-node browser coverage on the candidate branch: `test/e2e/collaboration-multinode.spec.js` passed **4/4** locally across two API instances with loopback Redis and an in-memory collaboration store.
- [ ] Obtain clean hosted CI for the candidate branch before PR preparation.
- [x] Review the complete staged diff, including generated/required-artifact consistency; keep unrelated pre-existing local changes unstaged.
- [ ] Push the feature branch and open a PR only after the above checks and diff review pass. No release/tag/deploy is part of this plan.

## Current validation record

- Node.js syntax checks for `apps/admin/assets/studio-collaboration.js`, `apps/admin/assets/studio.js`, `scripts/verify.js` and `test/e2e/editor.spec.js`: PASS.
- `node --test test/studio-collaboration.test.js`: PASS, 6 tests, 0 failures, 0 skips.
- `node --test test/collaboration.test.js`: PASS, 12 tests, 0 failures, 0 skips.
- `node node_modules/@playwright/test/cli.js test test/e2e/editor.spec.js --reporter=list`: PASS, 2 tests, 0 failures. The ready-state assertion for a newly saved draft passed.
- `npm run check`: PASS on Node.js 26.12.1. Artifact verification passed **230 required paths** and syntax-checked **235 JavaScript files**. Full test summary: **565 tests, 562 passed, 0 failed, 3 skipped** (platform-dependent skips).
- The repository check explicitly does not validate database migrations, Memgraph Cypher, live provider calls or production security.
- The two-session real-browser `test/e2e/collaboration.spec.js` passed **1/1** using an isolated config because the spec provisions its API server in-process. It covers remote delivery, lost-ack replay/idempotency, concurrent property convergence and canonical reload with an in-memory store; it is not a PostgreSQL or cross-instance/multi-node test.
- The cross-instance/multi-node Playwright suite `test/e2e/collaboration-multinode.spec.js` passed **4/4** locally across two API instances with loopback Redis and an in-memory collaboration store. It covers document-scoped fan-out and heartbeat repair after a dropped hint; reordered/duplicate notifications and reconnect after node loss; the 2/5/10-editor matrix; and a ten-editor reconnect storm after loss of both nodes. The 2/5/10 matrix recorded 153 peer-delivery samples (p50 **1,329 ms**, p95 **2,548 ms**, p99 **2,577 ms**); dropped-hint recovery completed in **3,788 ms**, and the ten-editor survivor-node storm recovered in **420 ms** with 240 replay deliveries. These are local harness observations, not production benchmarks or SLOs. The fixture uses an in-memory document store and does not prove PostgreSQL reconciliation; production Redis Cluster/failover, sustained load, soak and orchestrator gates remain open.
- The pinned EnginEx submodule is initialized at `d99e021f55664f006b5e65b4a58202f9c7bc4f4b`. The checkout's pre-existing `vendor/enginex` placeholder contained empty directories only; they were preserved at `vendor/enginex.empty-preinit-backup` before initialization.
- Runtime Node.js 26.12.1 satisfies the repository's declared minimum `>=22.23.4`.
- No dependency, migration, product version, SemVer, release tag, package publication or deployment changed.

## Public asset delivery contract dependency

The provider-neutral Public Asset Delivery Deployment Contract, its implementation-plan scope, validator, template, tests and docs are already present on `main` via merged PR #100 (merge commit `5b2a56f76ae4ffec5c81eba4e6a081436aa2052d`). This increment does not reapply the overlay or duplicate the contract. The root `PUBLIC-ASSET-DELIVERY-IMPLEMENTATION-PLAN.md` has also been updated locally as the completed delivery record. Deployment evidence remains provider/operator supplied; the validator does not contact a cloud provider or certify production.

## Exit criteria

This implementation slice is ready for PR review only after the full multi-editor/browser validation and clean hosted CI pass, the required-artifact and full applicable checks remain green, and the complete diff is inspected. A green local test result is not production certification. ADR-019 remains the active collaboration decision; offline-first/CRDT work, shared undo/redo, cursors, comments and full collaborative UX remain deferred.
