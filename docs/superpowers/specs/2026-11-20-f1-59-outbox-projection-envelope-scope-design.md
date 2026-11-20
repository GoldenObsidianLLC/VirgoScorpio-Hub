# F1.59 Graph Projection Envelope Scope — Design

**Status:** Proceeding under the user's standing instruction to continue autonomously.

**Date:** 20 November 2026

**Tracking:** [Issue #231](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/231), parent #124

**Baseline:** main `619819230dac2e8d169ce71af7c6a41f0630cf27`

## Intent

The validated PostgreSQL outbox envelope is the canonical source of tenant and aggregate identity. Graph projection must reject a payload whose duplicated identity disagrees with that envelope and must use normalized envelope values for all Memgraph identity parameters. This prevents payload metadata from choosing a different tenant when writing the rebuildable graph projection.

## Current behavior and defect

`eventEnvelopeFromOutboxRow` validates `site_id`, `aggregate_type`, `aggregate_id`, `aggregate_version`, event type and classification from PostgreSQL. The durable delivery worker passes both the payload and this validated envelope to `createMemgraphProjector`. The projector currently builds Cypher parameters from the payload's `siteId` and resource ID fields, while only taking the projection version from the envelope.

An exact-F1.58-main reproduction supplied envelope Site A and payload Site B to the real projector with a recording Memgraph driver. It issued a Cypher write with Site B. A compatibility scan also found that the full-rebuild path and direct tests call the projector without envelopes today. Those callers must use the same validated event contract; there will be no payload-only fallback.

## Goals

- Require a complete, valid v1 event envelope for every graph domain projection.
- Require `type === envelope.eventType` and the expected aggregate/resource type for the event family.
- Require payload site and resource identity fields to be valid UUIDs matching the envelope; compare UUID text case-insensitively, then pass normalized envelope values to Cypher.
- Use canonical envelope site/resource IDs in content, taxonomy and relationship projection writes.
- Preserve aggregate/projection version ordering and the existing content business-version distinction.
- Make full rebuilds construct envelopes through the existing `eventEnvelopeFromOutboxRow` helper from canonical PostgreSQL snapshot rows.
- Keep the generated tenant-isolation inventory current and explicitly describe the new guard.

## Non-goals

No schema, migration, event schema version, public HTTP contract, dependency, lockfile, worker lease/retry/replay, package version, SemVer, release or deployment change. Do not add a parallel event-contract implementation or a new general-purpose abstraction. This maintainer fix does not satisfy independent reviews #14 or #25 and does not certify production readiness.

## Approaches considered

1. **Keep a payload-only fallback when the envelope is absent.** Rejected: direct callers could still bypass the new control.
2. **Validate only in the durable worker.** Rejected: rebuild and direct projector callers would remain bypasses, splitting the invariant across entry points.
3. **Enforce the existing envelope contract at the projector and adapt rebuild to construct that contract from canonical database rows.** Chosen: one trust boundary shared by durable delivery and rebuild, using the existing event-contract helper; direct tests and integration calls will supply valid envelopes.

## Design decisions

- Reuse `validateEventEnvelope` / `eventEnvelopeFromOutboxRow` from `packages/realtime/src/event-contract.js`; do not implement a second UUID/schema validator.
- Map content event types to resource type `content` and payload key `id`; taxonomy events to `taxonomy-term` and `id`; relationship events to `relationship` and `relationshipId`.
- Compare site/resource UUIDs case-insensitively, then set query parameters from normalized envelope values.
- Reject invalid, missing, mismatched or wrong-family envelope identity before opening a Memgraph write.
- Preserve the current event-family-specific Cypher behavior, content business version and envelope aggregate projection version.
- Full rebuild emits synthetic v1 envelopes from the repeatable-read PostgreSQL snapshot. Event IDs may be generated locally; source row identity, site, resource version and classification remain canonical.

## Success criteria

Focused projector tests prove site, resource, event-type and resource-type mismatches reject with zero Cypher writes; positive controls prove all event families project with canonical envelope values. Rebuild tests prove rebuild still projects the same row families with valid envelopes. The full suite, tenant inventory freshness check and repository validation pass.
