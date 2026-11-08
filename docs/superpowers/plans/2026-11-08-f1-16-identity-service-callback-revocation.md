# F1.16 Identity-Service Membership Revocation Across Collaboration Nodes — Plan

**Date:** 8 November 2026

**Status:** Implementation and local validation complete; hosted CI and review pending.

**Branch:** `feat/f1-16-identity-callback-revocation-2026-11-08`

**Worktree:** `.worktrees/f1-16-identity-callback-revocation-2026-11-08`

## Objective

Replace F1.15's direct bridge-invalidation-only proof with an additional integration regression that drives the production API identity service through a real committed site-membership removal and verifies its configured callback closes a stale remote collaboration WebSocket through Redis.

## Work

- [x] Inspect `createApiServer` identity-service composition, `createIdentityService` authorization-change notification, site-membership DELETE route transaction/callback ordering, and the existing F1.13/F1.15 browser fixture.
- [x] Add optional PostgreSQL pool injection to the reusable collaboration API test fixture; preserve existing fake identity-service call sites.
- [x] Add a separate identity API instance with a dedicated PostgreSQL pool and omit the injected identity service so the normal production identity service and server callback are composed.
- [x] Seed a test Site A owner/editor relationship using the repository's existing `site-owner` and `editor` roles, then log in through the real API and obtain an opaque session cookie.
- [x] Remove the editor through the real site-membership DELETE route and verify the persisted membership row is gone.
- [x] Keep node B's collaboration identity fixture stale and prove that the real identity-service callback/Redis bridge path closes the matching remote Site A WebSocket.
- [x] Verify other Site A and Site B clients remain connected, Site B still answers ping, no operation is persisted for the revoked document, and existing F1.13/F1.15 history/replay/isolation assertions remain intact.
- [x] Preserve the established four-browser-context footprint and close the added API server and PostgreSQL pool during test cleanup.
- [x] Regenerate the source-anchored tenant-isolation inventory: 27 flow families, 78 route patterns, 19 source files, 41 test files.
- [x] Run focused authorization/tenancy/WebSocket/Redis regressions: **40/40 passed**.
- [x] Run the dedicated PostgreSQL/Redis real-browser scenario: **1/1 passed** locally.
- [x] Run `npm run check`: **566 tests, 563 passed, 0 failed, 3 platform skips**, 230 required artifact paths and 236 JavaScript files syntax-checked.
- [x] Run `node --check test/e2e/collaboration-postgres-multinode.spec.js`.
- [ ] Hosted CI for the final F1.16 PR head.
- [ ] Independent reviewer assessment and approval.
- [ ] Merge only after required checks/review and explicit authorization.

## Validation detail

The passing dedicated Playwright run used the dedicated loopback test database and the existing Memurai service bound to `127.0.0.1:6379`. The default local Playwright config selected system Chrome; an initial attempt timed out during creation of a browser page before reaching the new identity flow. A CI-mode attempt found that the exact pinned Playwright headless-shell browser was not cached. The successful local run therefore used a temporary local-only Playwright configuration pointing at the cached Chromium 1228 executable; that temporary file was removed afterwards and no repository Playwright configuration was changed. The successful scenario completed in 16.1 seconds with the test itself taking 11.9 seconds.

The full repository check ran after regenerating the tenant inventory. The check does not validate migrations, live Memgraph Cypher, external provider calls, Redis failover/partition behavior, production identity-provider wiring, or production security.

## GitHub / dependency state

- F1.13 PR #104 is merged to `main` at `c97a9273629bc55be42a4b9bf5239f4313a7e448`.
- F1.14 PR #105 is merged into the former F1.13 feature branch; the combined F1.14/F1.15 promotion PR #106 is merged to `main` at `66f7b10059e96d4cf4345ac75edbb03f0f5c3f4a`.
- PR #106 hosted run #452 (`42509378221`) passed all six jobs. No review submissions were recorded; this does not satisfy independent assessment issues #14/#25.
- F1.16 is developed directly from the updated `origin/main` in the branch listed above. Hosted CI and review for the F1.16 head remain pending until its PR is opened.

## Boundaries and release

F1.16 is maintainer-authored integration regression coverage using the real application login, membership route, identity service, PostgreSQL persistence, and Redis callback composition with disposable test users. It does not replace the independent tenant/security assessments required by issues #14 and #25, full provider integration qualification, Redis durability/failover testing, load/soak testing, accessibility acceptance, operational readiness, or release approval.

Issues #13, #14, #19, #24, #25, #26, and #32 remain open under their existing acceptance criteria. Production remains **NO-GO**. Package version remains **0.6.2**; no release, tag, publication, deployment, paid service, or vendor engagement is authorized.
