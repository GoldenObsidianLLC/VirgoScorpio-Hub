# F1.36 Firewall Rule and Security Event Atomicity Implementation Plan

> **For agentic workers:** Execute tasks sequentially using the repository's established test-first workflow. Every implementation task must establish its regression test before production changes.

**Goal:** Make site-scoped firewall-rule create/delete mutations atomic with correlated security events and delay cache invalidation until commit.

**Completion:** Merged through PR #160 at main SHA 460eff191d84fe422ed4ac15260a8fd6d9100d77; issue #159 CLOSED; exact-main workflow #661 passed 7/7 jobs.

**Architecture:** Reuse `packages/db/src/transaction.js` and the existing `site_security_events` table. Keep all database writes on the transaction client; clear the in-memory firewall cache after commit, outside the transaction.

**Tech Stack:** Node.js CommonJS, node:test, PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-11-15-f1-36-firewall-rule-audit-atomicity-design.md`

## Global Constraints

- Package version remains 0.6.2; do not create a release, tag or publication.
- Preserve `security:manage`, site scoping, request validation and existing response contracts.
- No schema/migration/dependency/public-route changes.
- Do not claim independent security review or production certification.
- Preserve the #658 canonical mainline evidence as a prior baseline, not as candidate-head evidence.

## Review Focus

- Event insert fails on POST: rule must roll back and cache must not be invalidated.
- Event insert fails on DELETE: rule must remain and cache must not be invalidated.
- Requested rule belongs to another site: return the existing not-found contract with no event or cache change.
- Rule does not exist: preserve not-found response and no cache change.
- A client COMMIT failure: shared transaction helper must propagate the failure; route must not clear cache.

---

### Task 1: Route-level transaction and side-effect contract

**Files:**
- Create: `test/platform-routes.test.js`
- Modify: `apps/api/src/platform-routes.js`

**Interfaces:**
- Use the existing exported `handlePlatformRoute(ctx)` interface.
- Use existing `withTransaction(localPool, work)`; do not add a new abstraction.
- Event schema: `site_security_events(site_id,request_id,event_type,severity,actor_id,details)`.

- [x] Write tests for POST/DELETE successful transactional query ordering and cache invalidation after COMMIT.
- [x] Write tests for create/delete event-write failure rollback and no cache invalidation.
- [x] Verify tests fail for the current split-write/create-only-event behavior.
- [x] Implement transaction-backed mutation/event pairs and post-commit cache invalidation.
- [x] Run focused route tests.

### Task 2: PostgreSQL failure-injection and tenant regression

**Files:**
- Create: `test/integration/platform-firewall-audit-atomicity.integration.test.js`

**Interfaces:**
- Use `createPostgresPool`, disposable UUID site/user fixtures, and the existing `node:test` integration enablement convention.
- Install narrowly scoped temporary PostgreSQL triggers on `site_security_events`; remove all triggers/functions in teardown.

- [x] Inject create-event failure and assert no rule/event persists.
- [x] Retry create and assert one rule/one event.
- [x] Inject delete-event failure and assert rule remains/no event.
- [x] Retry delete and assert rule removed/one event.
- [x] Prove cross-site and missing-rule deletes do not mutate state or invalidate cache.
- [x] Run the integration test against a real disposable PostgreSQL database in exact-head hosted CI (101/101 live tests; F1.36 trigger-based rollback/retry subtest passed).

### Task 3: Repository documentation and roadmap reconciliation

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION-ROADMAP.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/README.md` and root `README.md` if current-state summaries require it
- Modify: `docs/RELEASE_READINESS.md`, `docs/RELEASE-EVIDENCE.md`, `RELEASE-MANIFEST.json`, and current dated release report only when their current snapshot needs reconciliation.
- Modify: parent issue #124 description after issue #159 exists.

- [x] Preserve immutable #658 baseline details and distinguish source SHA, workflow number/ID, and runtime F1.35 code baseline from docs-only PR #158.
- [x] Record F1.36 candidate/merge evidence only after it exists; do not invent a workflow result, artifact digest, producer pass or certification.
- [x] Keep readiness counts/gates, package version, NOT_PRODUCTION_CERTIFIED and NO-GO unchanged.
- [x] Check for contradictory current-status references across affected Markdown and JSON.

### Task 4: Verification and handoff

- [x] Run focused unit tests and full `npm run check`.
- [x] Run PostgreSQL/Memgraph integration with zero unintended skips, migrations and browser/CodeQL/evidence workflows where available (exact-head push #659 / PR #660).
- [x] Review diff for site scope, parameterized queries, transaction boundaries, cache timing, unnecessary refactors and SemVer drift.
- [x] Commit, push and open PR #160; leave it unmerged and do not request independent review without explicit follow-up.
