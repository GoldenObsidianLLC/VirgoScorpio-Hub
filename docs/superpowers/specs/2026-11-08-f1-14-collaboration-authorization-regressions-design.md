# F1.14 Collaboration tenant and live-authorization regression — design

**Date:** 2026-11-08
**Status:** Implemented and locally validated (focused regression suite 28/28; full repository check 566 tests, 563 passed, 0 failed, 3 platform skips). Hosted PR #105 run #441 (`42496533962`) passed all six jobs; PR #105 merged into the former F1.13 feature branch. The combined F1.14/F1.15 promotion [PR #106](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/pull/106) subsequently merged to `main` at `66f7b10059e96d4cf4345ac75edbb03f0f5c3f4a`, with hosted CI run #452 passing all six jobs. No review submissions or independent security-review claim.
**Dependencies:** F1.9–F1.13 server-authoritative collaboration, site-bound real-time routes, and ADR-019.

## Problem

Existing tests separately cover REST collaboration edit/own-content checks, WebSocket active-session/edit-own checks, and site-bound presence/SSE/WebSocket authorization. F1.13 establishes PostgreSQL-backed multi-node persistence and document/site delivery scope. The missing focused regression composes these controls for a real API server and proves that a Site A-only editor cannot cross into Site B collaboration, that a denied WebSocket join creates no document subscription, and that revoking edit authority prevents the next operation from reaching the store.

This remains targeted application regression coverage. It is not the independent tenant/site isolation assessment required by issue #14.

## Goal

Add a deterministic Node integration-style test around `createApiServer`, its real HTTP/WebSocket routing and authorization flow, a fake session identity service, and a site-scoped content-store fixture. Avoid PostgreSQL, Redis or external providers; F1.13 already covers the live multi-node persistence composition.

## Acceptance criteria

1. A session with `content:read` and `content:edit` on Site A can sync, write and join a Site A draft.
2. The same session's REST sync/write request selected for Site B is rejected with `403 ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN` before content lookup, operation persistence or fan-out.
3. A Site A WebSocket cannot join a Site B document ID; the gateway emits `ERR_VIRGOSCORPIO_HUB_REALTIME_FORBIDDEN` and does not create a document subscription.
4. The Site A session cannot upgrade a WebSocket against Site B; authorization rejects the upgrade before creating a subscriber.
5. After Site A edit capability is revoked while the presence socket remains authorized, a subsequent collaboration operation is denied, the document subscription is closed, and the store receives no additional write.
6. A subsequent REST collaboration write after that revocation is denied and does not reach the store.
7. All assertions use the real API route and gateway; the fake identity/store only replace external persistence/provider boundaries.
8. Existing tests and the full repository check remain green.
9. No runtime behavior, public route, database schema, migration, dependency, protocol, SemVer or production claim changes.

## Local validation record (8 November 2026)

The focused REST/WebSocket/site-bound test set passed **28/28**. The new test proves Site A REST read/write and document join for an authorized editor, Site B REST denials before content lookup/write, cross-site WebSocket document-join and upgrade denials without subscription side effects, and operation/REST-write denial after Site A edit capability revocation while the presence session remains active. The full `npm run check` passed with **566 tests, 563 passed, 0 failed, 3 platform skips**, 230 required artifact paths and 237 JavaScript files syntax-checked. The generated tenant-isolation inventory was refreshed with 27 families, 78 route patterns, 19 source files and 41 test files. Hosted PR #105 run #441 passed all six jobs; PR #105 is merged into the F1.13 feature branch but remains unpromoted to `main`, and no review submissions were recorded. This evidence does not replace independent review under issue #14 or issue #25.

## Security boundaries

The fixture tests one session/site capability matrix and intentionally does not attempt to enumerate every route, object, worker, projection, cache, storage provider or administrative path. It does not establish production authentication/identity-provider correctness and does not close issue #14 or #25. Do not record credentials, secrets or private customer data. Production remains NO-GO pending the independent reviews and all other release gates.

## Implementation notes

Reuse existing `connectWebSocket` and `nextWebSocketMessage` helpers in `test/realtime-tenant-isolation.test.js`. Keep the fake store deterministic and explicitly keyed by both site ID and document ID. Assert negative side effects (store reads/writes, hub subscribers) as well as HTTP/WebSocket status codes. Keep the test within the existing default `node --test test/*.test.js` suite; no new Playwright or service dependency is needed.
