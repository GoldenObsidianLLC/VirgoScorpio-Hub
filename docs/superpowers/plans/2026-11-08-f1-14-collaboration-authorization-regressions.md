# F1.14 Collaboration tenant and live-authorization regression — implementation plan

**Date:** 2026-11-08
**Status:** Implementation and local validation complete; hosted CI pending. PR is stacked on the F1.13 promotion branch while PR #104 remains open.
**Design:** [F1.14 collaboration authorization regression](../specs/2026-11-08-f1-14-collaboration-authorization-regressions-design.md)
**Base:** Stacked on F1.13 promotion branch commit `59ffa0d`; this PR targets that branch and must not merge ahead of PR #104.

## Scope guard

Strengthen application-level regressions for collaboration authorization using the real API routes and WebSocket gateway. Do not change authorization runtime code unless the test demonstrates a concrete defect. Do not treat these tests as an independent assessor report or close P0 issue #14.

## Work items

- [x] Add the two-site session fixture and real API server test in `test/realtime-tenant-isolation.test.js`.
- [x] Verify Site A REST read/write and WebSocket document join succeed for the authorized draft.
- [x] Verify Site A cannot select Site B REST endpoints or join a Site B document over its Site A WebSocket.
- [x] Verify a Site B WebSocket upgrade is rejected for a Site A-only identity without creating a subscriber.
- [x] Revoke `content:edit` while the presence socket remains active; verify the next WebSocket operation and REST write are rejected before persistence and the document subscription is closed.
- [x] Run focused realtime/tenant/collaboration tests and `npm run check`; refresh the generated tenant route inventory using its prescribed generator after adding the regression.
- [x] Update the realtime foundation, AI architecture, roadmap and this plan with exact evidence and explicit limitations.
- [x] Review `git diff --check` and the complete staged diff; keep pre-existing unrelated worktree files untouched.
- [ ] Push the branch and open a stacked PR targeting the F1.13 promotion branch; hosted CI and review remain pending. Do not merge ahead of #104. No release, tag or deployment is part of this plan.

## Local validation record (8 November 2026)

- Focused `node --test test/realtime-tenant-isolation.test.js test/collaboration-api.test.js test/realtime-websocket.test.js` passed **28/28**, including the new cross-site REST/WebSocket, denied-subscription and live edit-revocation scenario.
- `npm run security:tenant-inventory` regenerated the source-anchored inventory after the test file changed. It records 27 route/flow families, 78 declared patterns, 19 source files and 41 test files; the route capability map and JSON inventory digests are refreshed.
- `npm run check` passed on Node.js 26.12.1: **566 tests, 563 passed, 0 failed, 3 platform skips**, 230 required artifact paths and 237 JavaScript files syntax-checked.
- No runtime source or behavior changed. Hosted F1.14 CI remains pending; this targeted regression is not an independent security assessment.

## Validation boundaries

A green local/hosted test proves only these targeted application paths. It does not close issue #14 independent tenant isolation review, issue #25 independent security assessment, issue #19 manual accessibility, issue #24 load/soak/backup restore, or P0 release/operations/governance gates. Production remains NO-GO.

## SemVer and release

No dependency, schema, migration, public API, runtime protocol, SemVer, package release, tag, publication or deployment change is planned. Retain version `0.6.2`.
