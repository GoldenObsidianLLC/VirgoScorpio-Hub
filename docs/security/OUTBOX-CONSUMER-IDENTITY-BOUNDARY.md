# Outbox Consumer Identity Boundary

**Status:** F1.60 maintainer implementation candidate for VirgoScorpio Hub 0.6.2; not merged or production-certified.
**Tracking:** [P2 issue #233](https://github.com/GoldenObsidianLLC/VirgoScorpio-Hub/issues/233), parent platform-hardening issue #124.
**Canonical contract:** `packages/realtime/src/event-contract.js`.
**Delivery boundary:** `packages/db/src/outbox-delivery.js`.
**Direct graph boundary:** `packages/graph/src/memgraph-store.js`.

## Purpose and authority

PostgreSQL `outbox_events` is the durable source record. Its validated v1 envelope is the single authority for event, site and aggregate identity. A row's JSON payload may repeat identity fields to support existing domain and projection contracts; these duplicate values are assertions, not competing authorities.

For registered domain events, row-to-envelope conversion verifies those assertions before dispatch. The handler keeps the compatibility object shape `{ type, payload, envelope, delivery }`, but `type` is taken from `envelope.eventType` and `payload` is the envelope's checked, normalized payload copy. A handler cannot accidentally receive the raw database payload as a peer source of truth.

## Explicit identity registry

One immutable `DOMAIN_EVENT_DEFINITIONS` registry declares each registered event's classification, resource type and top-level payload resource key. The existing classification map and `EVENT_PAYLOAD_IDENTITY_BINDINGS` are derived from those definitions; event-family identity rules are not maintained in parallel.

| Registered event family | Event types | Envelope resource type | Top-level payload resource key | Required payload site key |
|---|---|---|---|---|
| Content | `content.upsert`, `content.publish`, `content.unpublish`, `content.delete`, `content.submitted_for_review`, `content.approved`, `content.rejected`, `content.scheduled`, `content.archived`, `content.unpublished` | `content` | `id` | `siteId` |
| Taxonomy | `taxonomy.upsert`, `taxonomy.delete` | `taxonomy-term` | `id` | `siteId` |
| Relationship | `relationship.upsert`, `relationship.delete` | `relationship` | `relationshipId` | `siteId` |

A newly introduced event family must be reviewed and explicitly added to the registry before the event can receive the registered `site-private` classification and identity binding. Unknown/internal event payloads remain opaque; arbitrary payload `id`, nested metadata identifiers or other identifier-looking values are not recursively interpreted.

Relationship `sourceId` and `targetId` are endpoint identifiers. They are not the relationship aggregate key and must not be overwritten or compared to `envelope.resource.id`.

## Validation and normalization

`bindEventPayloadIdentity(envelope, payload?, options?)` is the shared boundary helper.

1. Validate the existing v1 envelope with the current schema validator.
2. Look up the event's explicit identity binding. An unregistered/internal event preserves its payload semantics and does not infer identity fields.
3. Confirm the envelope resource type matches the registry entry.
4. For each registered payload copy, require a plain JSON object, require top-level `siteId` to match the envelope site UUID, and require the registered resource key to match the envelope aggregate UUID.
5. Compare UUID strings case-insensitively, then create a shallow-frozen payload copy with the canonical envelope UUID casing.
6. Do not mutate the original parsed row payload or recursively rewrite nested domain fields.

A missing or contradictory scope/resource assertion raises a typed contract error before the user-supplied handler is invoked. The current contract errors include:

- `ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_SCOPE_MISMATCH`
- `ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH`
- `ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_TYPE_MISMATCH`
- `ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_PAYLOAD_INVALID`

The durable delivery worker handles these through the existing failure/retry/dead-letter path. With the normal configured attempt policy a poison event can be retried; the identity assertion is checked again on every dispatch attempt. The handler never runs for an invalid registered identity.

## Consumer inventory and distinct transports

| Entry point | Status | Boundary |
|---|---|---|
| `apps/worker/src/outbox-worker.js` → `createOutboxDeliveryWorker` → `graph.projection.v1` | Active durable registration | PostgreSQL consumer-group ledger; receives the envelope and envelope-bound payload; graph projector independently retains its direct-call validation. |
| `packages/db/src/outbox-worker.js` → `createOutboxWorker` | Compatibility entry point used by legacy tests/integrations | Uses the shared row-to-envelope conversion; do not treat it as the production graph-worker registration. |
| `packages/realtime/src/redis-realtime.js` | Separate transient bridge | Carries bounded ephemeral presence, authorization and document-operation hints. It is not a PostgreSQL outbox consumer or durable event log. |

A consumer-group event-type allow-list is routing configuration, not an authorization boundary. A future network consumer must still authorize the site and any resource access independently before performing an external side effect.

## Delivery guarantees and unchanged behavior

This change does not modify the outbox schema, migrations, event schema, public HTTP/API, dependencies, lockfile or package version.

PostgreSQL remains the durable event source. Delivery remains at-least-once, with the existing group isolation, leases, `SKIP LOCKED` claiming, aggregate ordering, capped retry, dead-letter, bounded explicit-ID replay and acknowledgement state transitions. Consumers must continue to deduplicate using `envelope.eventId` or an equivalent idempotency record. Aggregate `resource.version` remains the projection ordering/reconciliation signal; no global order is implied.

The graph projector continues validating direct calls where a separately supplied payload may differ from `envelope.payload`. It reuses the shared registry and helper while preserving graph-specific public error codes and rejecting mismatches before Cypher writes.

## Regression and verification scope

- `test/outbox-contract.test.js`: all identity families, casing normalization, missing/mismatched site/resource IDs, resource-family mismatch, nested/end-point identifier preservation, immutability, internal-message behavior and row conversion.
- `test/outbox-delivery.test.js`: normalized handler input and proof a mismatched aggregate is rejected before handler side effects; existing retry/replay/group behavior remains covered.
- `test/memgraph-projector.test.js` and `test/graph-projection-worker.test.js`: direct graph boundary and existing graph consumer regression.
- `test/integration/postgres.integration.test.js`: real database delivery regression for a row whose canonical site column conflicts with its payload site assertion. This test is conditional on `DATABASE_URL` and `VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true`; a skipped local run is not live database evidence.
- Hosted PR CI remains required for the supported Node matrix and live PostgreSQL/Memgraph integration.

This maintainer implementation is not an independent tenant-isolation assessment. Issue #14 and broader independent security assessment #25 remain production gates. Production remains NO-GO until the current source-bound release-readiness and independent operational/security gates are closed.
