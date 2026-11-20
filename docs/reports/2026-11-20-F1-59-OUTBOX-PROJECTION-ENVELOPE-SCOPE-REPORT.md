# F1.59 — Graph Projection Envelope Scope

**Date:** 20 November 2026

**Tracking:** [Issue #231](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/231) · parent #124

**Branch:** `security/f1-59-outbox-projection-envelope-scope-2026-11-20`

**Baseline main SHA:** `619819230dac2e8d169ce71af7c6a41f0630cf27`

**Status:** Local implementation, focused tests and full repository check pass. Hosted PR CI remains pending.

## Summary

F1.59 binds every graph-domain projection write to the validated PostgreSQL outbox event envelope. The projector now rejects payload/envelope disagreement for tenant site, aggregate identity, event type or resource family before opening a Memgraph write. Canonical envelope IDs, normalized by the existing event contract, are used for the projected identity parameters.

The full-rebuild path now constructs validated v1 envelopes from its repeatable-read canonical PostgreSQL snapshot. Direct graph unit and integration fixtures use the same event contract. There is no payload-only projector fallback.

## Reproduced defect

On exact F1.58 main, the outbox delivery boundary passed a validated event envelope and its payload separately to the graph projector. The envelope derived tenant and aggregate identity from PostgreSQL columns, but the projector used duplicate `payload.siteId` and resource ID fields when binding Cypher parameters.

A local recording-driver reproduction supplied:

- Canonical envelope site: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` (Site A).
- Payload site: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb` (Site B).

The pre-fix projector performed a graph write using Site B rather than rejecting the mismatch. This was a source-of-truth violation at the projection boundary: untrusted duplicate payload identity could redirect tenant-scoped graph state away from the validated outbox row.

## Implementation

### Shared validation and canonical identity

`packages/graph/src/memgraph-store.js` reuses `validateEventEnvelope` from `packages/realtime/src/event-contract.js`. A single projector-boundary input helper maps supported event families:

| Event family | Required envelope resource type | Payload identity |
|---|---|---|
| Content upsert/delete/status transitions | `content` | `id` |
| Taxonomy upsert/delete | `taxonomy-term` | `id` |
| Relationship upsert/delete | `relationship` | `relationshipId` |

The projector fails before Cypher execution when the envelope is absent/invalid, the event type or resource type disagrees with the handler family, payload site differs from envelope site, or payload resource identity differs from the envelope resource ID. UUID comparisons are case-insensitive; the normalized envelope values are passed into the Cypher parameters.

Content `payload.version` remains the business/editorial version. `envelope.resource.version` remains the aggregate projection version used to preserve monotonic projection ordering. The fix does not change relationship tombstones, graph reads, worker leases, retries, dead-lettering or replay mechanics.

### Canonical rebuild path

`packages/graph/src/rebuild-projection.js` now creates v1 envelopes through the existing `eventEnvelopeFromOutboxRow` helper. Envelopes are derived from canonical snapshot rows, with:

- Content aggregate version sourced from `lock_version`, preserving projection order independently of editorial `version`.
- Taxonomy aggregate version sourced from `version`.
- Relationship aggregate version sourced from `version`.

This keeps live outbox delivery and rebuilds on one validation boundary instead of introducing an unsafe legacy payload-only path.

### Regression coverage

New and updated tests:

- `test/memgraph-projector.test.js`: rejection for missing envelope, site mismatch, resource ID mismatch, event type mismatch and resource-family mismatch; UUID case normalization; existing content version/projection-version behavior.
- `test/graph-rebuild.test.js`: exercises the real rebuild orchestration with a controlled canonical PostgreSQL snapshot and recording Memgraph driver; verifies content, taxonomy and relationship rows use envelope-derived identity and preserves content business version 5 versus projection version 8.
- `test/graph.test.js`: direct relationship and taxonomy projectors now use complete validated envelopes.
- `test/integration/memgraph.integration.test.js`: direct live Memgraph projection fixtures construct v1 envelopes through the shared event-contract helper. The durable outbox worker already supplied validated envelopes and was not changed.
- Existing outbox contract, delivery and graph worker tests remain in the focused regression set.

## Validation evidence

Fresh local focused command after the no-envelope regression was added:

```text
node --test test/graph.test.js test/memgraph-projector.test.js test/graph-rebuild.test.js test/integration/memgraph.integration.test.js test/outbox-contract.test.js test/outbox-delivery.test.js test/graph-projection-worker.test.js
```

Result:

- 31 tests discovered.
- 29 passed.
- 0 failed.
- 2 skipped: both live Memgraph integration tests, because the local environment did not have the required Memgraph/PostgreSQL integration environment enabled.

Additional focused checks:

- `node --test test/memgraph-projector.test.js`: 9/9 passed.
- `node --test test/graph-rebuild.test.js test/memgraph-projector.test.js`: 10/10 passed.
- `node --test test/graph.test.js`: 5/5 passed.
- `npm run security:tenant-inventory`: regenerated the catalog-derived JSON and Markdown inventory, reporting 28 families, 80 declared route patterns, 22 source files and 59 referenced test files.
- `node scripts/generate-tenant-isolation-route-inventory.js --check`: passed. Implementation-source digest: `82f38c78ee897998e0774de688c36eef9f56e7217d26d6e807b7d35695fe1bd4`.

The full `npm run check` completed successfully after the final regression and inventory regeneration: **677 tests, 674 passed, 0 failed and 3 conditional skips**. The script completed both `node scripts/verify.js` and `npm test`. The focused live Memgraph integration cases are among the skipped checks because the local environment did not have the required service configuration; the hosted live PostgreSQL/Memgraph CI path must exercise them.

`node scripts/generate-tenant-isolation-route-inventory.js --check` and `git diff --check` pass. A relative-link scan covered all 10 changed Markdown files and checked 159 relative inline destinations; no broken targets were found. Hosted PR CI remains pending.

## Scope and release boundary

No PostgreSQL schema/migration, HTTP/API contract, event schema version, dependency, lockfile, package version or SemVer changes are intended. Package `virgoscorpio-hub@0.6.2` remains private and unreleased. No release, publication, deployment or production certification is authorized.

This is maintainer implementation and regression evidence only. Independent tenant-isolation review #14 and independent platform security assessment #25 remain OPEN / NOT PERFORMED; dependency/license review #23 remains OPEN / PARTIAL. This change does not close or substitute for those assurance obligations. Production remains **NO-GO / NOT_PRODUCTION_CERTIFIED**.
