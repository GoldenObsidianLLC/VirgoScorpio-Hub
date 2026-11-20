# F1.59 Graph Projection Envelope Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Bind every graph projection write to a validated outbox envelope and reject contradictory payload identity before Memgraph mutation.

**Architecture:** The graph projector validates the existing v1 envelope and checks event/resource family identity, then uses normalized envelope values in Cypher parameters. The full-rebuild path creates equivalent envelopes from canonical PostgreSQL snapshot rows using the existing event-contract helper.

**Tech Stack:** Node.js CommonJS, node:test, PostgreSQL outbox event contract, Memgraph/Neo4j driver.

**Spec:** `docs/superpowers/specs/2026-11-20-f1-59-outbox-projection-envelope-scope-design.md`

## Global Constraints

- No database schema/migration, HTTP/API, event schema version, dependency, lockfile or package-version change.
- Preserve aggregate/projection version ordering and the content business-version versus projection-version distinction.
- Reuse `packages/realtime/src/event-contract.js`; do not add a parallel validator or identity model.
- No payload-only compatibility fallback from the graph projector.
- PostgreSQL is canonical; Memgraph remains a rebuildable projection.

## Review Focus

- Missing/partial envelope and event-type mismatch must fail before opening a Memgraph write.
- Invalid/mismatched UUID text, including case differences, must not reject valid equivalent UUIDs or accept different identities.
- Taxonomy uses aggregate type `taxonomy-term`, not `taxonomy`.
- Relationship envelope identity is `relationshipId`, while its endpoints remain independently site-scoped by the canonical site parameter.
- Rebuild must retain content `lock_version` as projection version even when business `version` differs.
- Retry/dead-letter behavior remains unchanged when projection validation fails.

---

### Task 1: Enforce envelope-bound graph projection and preserve rebuild compatibility

**Files:**
- Modify: `packages/graph/src/memgraph-store.js`
- Modify: `packages/graph/src/rebuild-projection.js`
- Modify: `test/memgraph-projector.test.js`
- Modify: `test/graph.test.js`
- Modify: `test/integration/memgraph.integration.test.js`
- Create: `test/graph-rebuild.test.js` (the repository has no existing direct test for `rebuildGraphProjection`; keep the new test focused on envelope construction and actual projector writes).
- Modify: `docs/security/tenant-isolation-route-inventory.catalog.json`
- Generate: `artifacts/security/tenant-isolation-route-inventory.json`, `docs/security/TENANT-ISOLATION-ROUTE-CAPABILITY-MAP-2026-11-14.md`
- Create: `docs/reports/2026-11-20-F1-59-OUTBOX-PROJECTION-ENVELOPE-SCOPE-REPORT.md`

**Interfaces:**
- Projector retains `apply({ type, payload, envelope })`; the envelope is mandatory for supported graph domain event types.
- Rebuild constructs envelopes via `eventEnvelopeFromOutboxRow({ id, aggregate_type, aggregate_id, aggregate_version, event_type, payload, schema_version, site_id, classification, created_at })`.
- Content family: `content.*` â†’ resource type `content`, payload identity key `id`.
- Taxonomy family: `taxonomy.*` â†’ resource type `taxonomy-term`, payload identity key `id`.
- Relationship family: `relationship.*` â†’ resource type `relationship`, payload identity key `relationshipId`.
- Projector errors use stable codes for invalid envelope/family, site-scope mismatch and resource-identity mismatch; tests assert behavior and zero Cypher writes, not private source text.

- [x] **Step 1: Write a failing site-scope regression.** In `test/memgraph-projector.test.js`, supply a valid content envelope with Site A and a payload with Site B; assert rejection and zero Cypher statements.
- [x] **Step 2: Verify RED.** Run `node --test test/memgraph-projector.test.js`; the test must fail because the current projector writes using payload Site B.
- [x] **Step 3: Add resource/event-family regressions.** Independently test resource ID mismatch, event-type mismatch and wrong envelope resource type; each must reject before any Cypher call.
- [x] **Step 4: Verify RED.** Confirm these tests fail against the current implementation for the intended reason.
- [x] **Step 5: Implement one projector-boundary validator.** Reuse `validateEventEnvelope`, map event families to their resource type and payload identity key, validate UUID parity, and return payload parameters with canonical envelope `siteId` and resource ID. Preserve `payload.version`; use `envelope.resource.version` as projection version.
- [x] **Step 6: Verify GREEN.** Run `node --test test/memgraph-projector.test.js`; positive and negative cases must pass.
- [x] **Step 7: Adapt full rebuild.** Construct v1 envelopes from the PostgreSQL snapshot via `eventEnvelopeFromOutboxRow`; use content `lock_version`, taxonomy `version`, and relationship `version` as aggregate versions.
- [x] **Step 8: Update all direct projector callers.** Use `git grep 'projector.apply' -- test packages apps`; update graph unit tests and direct Memgraph integration cases to supply valid envelopes. The durable worker already supplies one and should not change.
- [x] **Step 9: Run focused graph/rebuild tests.** Include projector, graph, rebuild, outbox-contract and outbox-delivery tests that exercise the boundary.
- [x] **Step 10: Update generated tenant-isolation inventory.** Revise graph projection coverage note and exact source/test references; run `npm run security:tenant-inventory` and `node scripts/generate-tenant-isolation-route-inventory.js --check`.
- [x] **Step 11: Write the F1.59 report.** Record baseline SHA, reproduction, source-of-truth rule, focused regression evidence, inventory digest, limitations and unchanged release boundary. Do not claim independent review or production readiness.
- [x] **Step 12: Validate.** Run `git diff --check`, `npm run check`, focused graph/outbox tests, inventory freshness and Markdown link audit for changed docs. Confirm no schema, migration, dependency, lockfile, API or SemVer files changed. Record the two live Memgraph integration skips caused by absent local service configuration; hosted CI must exercise the live integration path.
- [x] **Step 13: Commit and publish.** Review the final diff, stage only F1.59 source/tests/inventory/report/spec/plan files, create `fix(graph): bind projections to validated outbox identity`, push the feature branch, open a PR that closes #231, then verify hosted CI. Do not merge without a distinct independent human approval.

## Completion contract

Mismatched tenant/resource/event identity rejects before Memgraph calls; rebuild and all direct projector callers use valid envelopes with no unsafe fallback; focused tests and `npm run check` pass; generated inventory is fresh; the implementation report is committed; no version or release mutation occurs.
