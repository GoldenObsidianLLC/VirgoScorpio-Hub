# F1.12 Studio collaborative editing client — design

**Date:** 2026-11-07
**Status:** Merged through PR #101 on 2026-11-08 at merge commit `5339de89e4c1d86d78291f348d03bfb4876b13a5`. Hosted push CI run #42480014817 and PR CI run #42480292203 both passed. Full manual accessibility acceptance and production gates remain open.
**Decision basis:** ADR-019, F1.9 semantic-OT persistence, F1.10 cross-instance operation delivery, and F1.11 collaboration resilience.
**Scope:** A thin Studio browser client for the existing server-authoritative, draft-only collaboration protocol. This does not introduce a new persistence model or transport.

## Intent

Connect Studio to the already implemented semantic-OT backend. A user can explicitly join a saved page draft, make supported edits, and see accepted operations from other connected editors applied in server sequence order. PostgreSQL remains the authority for accepted content, operation identity, sequence, replay history, revisions, workflow evidence and outbox publication.

## Goals

- Use the existing authenticated, same-origin WebSocket route at `/api/v1/sites/:siteId/realtime/ws`.
- Join one page draft with a last-observed collaboration sequence and recover through the existing REST sync route when required.
- Apply only server-accepted operations in sequence order; buffer out-of-order notifications and use canonical REST sync for sequence gaps or reload-required responses.
- Map Studio structural, title, property/style and supported text edits to the existing semantic operation vocabulary.
- Keep whole-document saves, restore, editorial workflow actions and document JSON replacement outside a live session so they cannot bypass the collaboration sequence.
- Preserve the current page-document v1 representation and the existing non-collaborative Studio workflow.
- Validate received operation envelopes and materialized document structure before applying server messages to the browser model.
- Provide clear connection/synchronization state and safe reconnect/leave behavior.

## Non-goals

- CRDT, offline-first or multi-master editing.
- Shared undo/redo, cursor/selection broadcast, collaborator roster, comments, annotations or review threads.
- A rich-text AST or full concurrent text-replacement algorithm. Simple prefix/suffix-only insertion and deletion can use text-range operations; replacement or complex edits use the existing allow-listed property operation.
- Publishing, approval, workflow transitions or changes to `published_snapshot` from a live collaboration session.
- Production certification, provider selection, infrastructure configuration or a production capacity claim.

## Protocol and authority

The client opens the existing same-origin WebSocket route and sends:

- `document.join` with `contentId` and `afterSequence`.
- `document.operation` with the existing schema-version-1 operation envelope.
- `document.leave` when the editor leaves the session.

The server derives principal, actor, site and authorization from the authenticated session and route context. Client identifiers are idempotency/correlation data only; they are not authorization claims.

The durable recovery endpoint is:

`GET /api/v1/pages/:contentId/collaboration/sync?afterSequence=:n`

It is called with the active site header and same-origin credentials. When replay history has expired, the server returns the canonical document snapshot and current sequence. The browser validates the response, installs that snapshot, then rejoins from the returned sequence.

The client handles operation, acknowledgement, sync, reload-required, reload, error and sync-degraded messages. It accepts only the next contiguous sequence into the local document. Gaps trigger REST synchronization rather than guessing an order.

## Studio operation mapping

| Studio action | Server operation |
| --- | --- |
| Change page title | `document.set_title` |
| Add component | `node.insert` with stable parent and sibling anchor |
| Duplicate component | `node.insert` with newly generated IDs throughout the subtree |
| Delete component | `node.delete` |
| Move / reorder component | `node.move` |
| Change approved property or style set | `node.set_prop` |
| Simple text insertion/deletion | `text.insert` / `text.delete` using Unicode code-point offsets |
| Text replacement or non-text property edit | `node.set_prop` |

The browser applies the accepted/transformed operation returned by the server, not its pre-commit local guess. One in-flight edit per browser client bounds pending state and keeps the existing server sequence authoritative.

## Session safety

Collaboration is opt-in and requires a persisted, clean draft and either the site-level `content:edit` or `content:edit:own` capability. The server continues to enforce that the authenticated actor owns the requested page when only own-content edit authority is present. Draft creation remains the ordinary save operation.

While a session is connecting, reconnecting, synchronizing or committing, mutation controls are disabled. Once synchronized, supported edits use the collaboration protocol. Whole-document save, workflow transitions, revision restore, JSON replacement, page/site switching and page creation are blocked until the session is left. Leaving closes the document subscription and reloads the canonical draft before the normal editor workflow resumes.

A failed or revoked connection cannot be treated as permission to save locally. The editor reports the connection state and keeps the session controls disabled until synchronization succeeds or the user leaves. A malformed operation or canonical document fails closed. Session and operation data do not store credentials in browser storage.

## Validation

Automated coverage exercises page-operation application, code-point text behavior, invalid envelopes and trees, stable-ID mutations, WebSocket join/ack/remote delivery/leave, canonical reload recovery, and close-before-join behavior. The Studio browser smoke asserts that a saved draft exposes the collaboration action and ready state.

This is local developer-preview validation. The Studio client unit suite passed 6/6 and the existing semantic-OT unit suite passed 12/12 on Node.js 26.12.1. The Studio editor Playwright suite passed 2/2, including the saved-draft collaboration-ready assertion. The two-session real-browser `test/e2e/collaboration.spec.js` passed 1/1 under an isolated config because it creates its API server in-process; it proves remote delivery, replay/retry, concurrent property convergence and canonical reload using an in-memory collaboration store, not PostgreSQL. `npm run check` passed: artifact verification covered 230 required paths and syntax-checked 235 JavaScript files; the repository test run reported 565 tests, 562 passed, 0 failed and 3 platform skips. The check does not validate database migrations, Memgraph Cypher, live provider calls or production security. The cross-instance/multi-node Playwright suite passed **4/4** locally across two API instances with loopback Redis and an in-memory document store. Its 2/5/10-editor matrix recorded 153 peer-delivery samples (p50 **1,329 ms**, p95 **2,548 ms**, p99 **2,577 ms**); dropped-hint recovery completed in **3,788 ms** and the ten-editor survivor-node storm recovered in **420 ms** with 240 replay deliveries. These are local harness observations, not production benchmarks or SLOs, and the in-memory fixture does not prove PostgreSQL reconciliation. Hosted push CI run #42480014817 and PR CI run #42480292203 both passed; PR #101 merged to `main` on 2026-11-08 at `5339de89e4c1d86d78291f348d03bfb4876b13a5`. The CI editor/accessibility smoke does not replace full manual accessibility acceptance or production qualification.

## Acceptance and remaining gates

F1.12 is acceptable as a local client integration when:

1. The collaboration module is loaded before Studio and required by artifact verification.
2. A saved clean draft enables the collaboration action, while unsaved/new/non-draft content does not.
3. Join, sequence application, acknowledgement, reconnect sync, canonical reload and leave follow the existing backend protocol.
4. Supported Studio edits are emitted as typed semantic operations and only accepted operations are applied.
5. Whole-document and editorial workflow paths cannot bypass the live sequence.
6. Focused tests and the editor browser smoke pass, with the exact source revision retained.

Before production use, continue to require the F1.8–F1.11 deployment, security, accessibility, load/soak, Redis Cluster/failover, orchestrator node-loss/rolling-deploy, backup/retention and runbook gates. F1.12 does not close any of them. Production remains NO-GO.
