'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  EVENT_SCHEMA_VERSION,
  DOMAIN_EVENT_DEFINITIONS,
  EVENT_PAYLOAD_IDENTITY_BINDINGS,
  bindEventPayloadIdentity,
  eventEnvelopeFromOutboxRow,
  validateEventEnvelope
} = require('../packages/realtime/src/event-contract');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const RESOURCE_ID = '33333333-3333-4333-8333-333333333333';

function makeOutboxRow(overrides = {}) {
  return {
    id: randomUUID(),
    aggregate_type: 'content',
    aggregate_id: RESOURCE_ID,
    aggregate_version: 7,
    event_type: 'content.publish',
    payload: { id: RESOURCE_ID, siteId: SITE_ID, slug: 'launch', status: 'published' },
    schema_version: EVENT_SCHEMA_VERSION,
    site_id: SITE_ID,
    actor_id: ACTOR_ID,
    correlation_id: 'req_2026-10-30_abc123',
    causation_id: null,
    classification: 'site-private',
    created_at: new Date('2026-10-30T16:30:00.000Z'),
    ...overrides
  };
}

test('outbox rows normalize into the versioned site-scoped event envelope', () => {
  const row = makeOutboxRow();
  const event = eventEnvelopeFromOutboxRow(row);

  assert.equal(event.eventId, row.id);
  assert.equal(event.eventType, 'content.publish');
  assert.equal(event.schemaVersion, 1);
  assert.equal(event.occurredAt, '2026-10-30T16:30:00.000Z');
  assert.equal(event.siteId, SITE_ID);
  assert.deepEqual(event.actor, { type: 'user', id: ACTOR_ID });
  assert.deepEqual(event.resource, { type: 'content', id: RESOURCE_ID, version: 7 });
  assert.equal(event.correlationId, row.correlation_id);
  assert.equal(event.classification, 'site-private');
  assert.deepEqual(event.payload, row.payload);
  assert.equal(event.idempotencyKey, 'content:' + RESOURCE_ID + ':7:content.publish');
});

test('domain event identity binding normalizes content, taxonomy and relationship families', () => {
  const cases = [
    { eventType: 'content.publish', resourceType: 'content', key: 'id' },
    { eventType: 'taxonomy.upsert', resourceType: 'taxonomy-term', key: 'id' },
    { eventType: 'relationship.upsert', resourceType: 'relationship', key: 'relationshipId' }
  ];

  assert.deepEqual(
    Object.keys(EVENT_PAYLOAD_IDENTITY_BINDINGS).sort(),
    Object.keys(DOMAIN_EVENT_DEFINITIONS).sort()
  );

  for (const item of cases) {
    const payload = {
      [item.key]: RESOURCE_ID.toUpperCase(),
      siteId: SITE_ID.toUpperCase(),
      sourceId: '44444444-4444-4444-8444-444444444444',
      targetId: '55555555-5555-4555-8555-555555555555',
      metadata: {
        id: '66666666-6666-4666-8666-666666666666',
        siteId: '77777777-7777-4777-8777-777777777777'
      },
      status: 'published'
    };
    const envelope = validateEventEnvelope({
      eventId: randomUUID(),
      eventType: item.eventType,
      schemaVersion: EVENT_SCHEMA_VERSION,
      occurredAt: '2026-11-21T00:00:00.000Z',
      siteId: SITE_ID,
      actor: { type: 'system', id: null },
      resource: { type: item.resourceType, id: RESOURCE_ID, version: 1 },
      correlationId: null,
      causationId: null,
      classification: 'site-private',
      payload
    });

    const bound = bindEventPayloadIdentity(envelope, payload);
    assert.equal(bound.envelope.eventType, item.eventType);
    assert.equal(bound.envelope.siteId, SITE_ID);
    assert.equal(bound.envelope.resource.id, RESOURCE_ID);
    assert.equal(bound.envelope.payload[item.key], RESOURCE_ID);
    assert.equal(bound.envelope.payload.siteId, SITE_ID);
    assert.equal(bound.payload[item.key], RESOURCE_ID);
    assert.equal(bound.payload.siteId, SITE_ID);
    assert.equal(bound.payload.sourceId, payload.sourceId);
    assert.equal(bound.payload.targetId, payload.targetId);
    assert.deepEqual(bound.payload.metadata, payload.metadata);
    assert.equal(payload[item.key], RESOURCE_ID.toUpperCase(), 'the original payload must not be mutated');
    assert.equal(payload.siteId, SITE_ID.toUpperCase(), 'the original site ID must not be mutated');
    assert.ok(Object.isFrozen(bound.payload));
    assert.ok(Object.isFrozen(bound.envelope));
  }
});

test('domain event identity binding rejects missing and mismatched site/resource identities', () => {
  const cases = [
    { eventType: 'content.upsert', resourceType: 'content', key: 'id' },
    { eventType: 'taxonomy.delete', resourceType: 'taxonomy-term', key: 'id' },
    { eventType: 'relationship.delete', resourceType: 'relationship', key: 'relationshipId' }
  ];

  for (const item of cases) {
    const payload = { [item.key]: RESOURCE_ID, siteId: SITE_ID };
    const envelope = validateEventEnvelope({
      eventId: randomUUID(),
      eventType: item.eventType,
      schemaVersion: EVENT_SCHEMA_VERSION,
      occurredAt: '2026-11-21T00:00:00.000Z',
      siteId: SITE_ID,
      actor: { type: 'system', id: null },
      resource: { type: item.resourceType, id: RESOURCE_ID, version: 1 },
      correlationId: null,
      causationId: null,
      classification: 'site-private',
      payload
    });

    assert.throws(
      () => bindEventPayloadIdentity(envelope, { ...payload, siteId: null }),
      { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_SCOPE_MISMATCH' }
    );
    assert.throws(
      () => bindEventPayloadIdentity(envelope, { ...payload, [item.key]: undefined }),
      { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH' }
    );
    assert.throws(
      () => bindEventPayloadIdentity(envelope, { ...payload, [item.key]: '88888888-8888-4888-8888-888888888888' }),
      { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH' }
    );
    assert.throws(
      () => bindEventPayloadIdentity({
        ...envelope,
        resource: { ...envelope.resource, type: 'unrelated-resource' }
      }, payload),
      { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_TYPE_MISMATCH' }
    );
  }
});

test('internal outbox messages do not interpret arbitrary payload identifiers as tenant or aggregate identity', () => {
  const payload = {
    id: '88888888-8888-4888-8888-888888888888',
    siteId: '77777777-7777-4777-8777-777777777777',
    relationshipId: '99999999-9999-4999-8999-999999999999',
    metadata: { id: '66666666-6666-4666-8666-666666666666' }
  };
  const envelope = validateEventEnvelope({
    eventId: randomUUID(),
    eventType: 'integration.noop',
    schemaVersion: EVENT_SCHEMA_VERSION,
    occurredAt: '2026-11-21T00:00:00.000Z',
    siteId: null,
    actor: { type: 'system', id: null },
    resource: { type: 'integration', id: RESOURCE_ID, version: 1 },
    correlationId: null,
    causationId: null,
    classification: 'internal',
    payload
  });

  const bound = bindEventPayloadIdentity(envelope, payload);
  assert.deepEqual(bound.payload, payload);
  assert.equal(bound.envelope.siteId, null);
});

test('outbox row conversion rejects domain payload identity that diverges from the canonical envelope', () => {
  assert.throws(
    () => eventEnvelopeFromOutboxRow(makeOutboxRow({
      payload: { id: '88888888-8888-4888-8888-888888888888', siteId: SITE_ID }
    })),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH' }
  );
  assert.throws(
    () => eventEnvelopeFromOutboxRow(makeOutboxRow({
      payload: { id: RESOURCE_ID, siteId: '77777777-7777-4777-8777-777777777777' }
    })),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_SCOPE_MISMATCH' }
  );
});

test('system-originated events and internal worker messages remain unscoped', () => {
  const row = makeOutboxRow({
    aggregate_type: 'integration-outbox',
    event_type: 'integration.noop',
    site_id: null,
    actor_id: null,
    correlation_id: null,
    classification: 'internal',
    payload: { probe: 'ready' }
  });
  const event = eventEnvelopeFromOutboxRow(row);

  assert.equal(event.siteId, null);
  assert.deepEqual(event.actor, { type: 'system', id: null });
  assert.equal(event.classification, 'internal');
  assert.equal(event.eventId, row.id);
});

test('domain events fail closed when site scope or classification is missing', () => {
  assert.throws(
    () => eventEnvelopeFromOutboxRow(makeOutboxRow({ site_id: null, classification: 'internal' })),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_EVENT_CLASSIFICATION_MISMATCH' ||
      error.code === 'ERR_VIRGOSCORPIO_HUB_EVENT_SITE_REQUIRED'
  );

  assert.throws(
    () => eventEnvelopeFromOutboxRow(makeOutboxRow({ classification: 'internal' })),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_CLASSIFICATION_MISMATCH' }
  );
});

test('unsupported schema versions fail rather than being interpreted as v1', () => {
  assert.throws(
    () => eventEnvelopeFromOutboxRow(makeOutboxRow({ schema_version: 2 })),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_SCHEMA_UNSUPPORTED' }
  );
});

test('envelope validation rejects unsafe identifiers, invalid actors and invalid resources', () => {
  const base = eventEnvelopeFromOutboxRow(makeOutboxRow());

  assert.throws(
    () => validateEventEnvelope({ ...base, eventId: 'not-a-uuid' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_ID_INVALID' }
  );
  assert.throws(
    () => validateEventEnvelope({ ...base, actor: { type: 'user', id: null } }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_ACTOR_INVALID' }
  );
  assert.throws(
    () => validateEventEnvelope({ ...base, resource: { type: 'content', id: RESOURCE_ID, version: 0 } }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_RESOURCE_INVALID' }
  );
  assert.throws(
    () => validateEventEnvelope({ ...base, correlationId: 'bad\r\nheader' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTIFIER_INVALID' }
  );
});

test('event payloads are bounded and must be JSON objects', () => {
  const base = eventEnvelopeFromOutboxRow(makeOutboxRow());
  assert.throws(
    () => validateEventEnvelope({ ...base, payload: [] }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_PAYLOAD_INVALID' }
  );
  assert.throws(
    () => validateEventEnvelope({ ...base, payload: { text: 'x'.repeat(70 * 1024) } }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_PAYLOAD_TOO_LARGE' }
  );
});

test('public and site-private classifications require a valid site UUID', () => {
  const base = eventEnvelopeFromOutboxRow(makeOutboxRow());
  assert.throws(
    () => validateEventEnvelope({ ...base, eventType: 'announcement.created', classification: 'public', siteId: null }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_SITE_REQUIRED' }
  );
  assert.throws(
    () => validateEventEnvelope({ ...base, siteId: null }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_SITE_REQUIRED' }
  );
  assert.throws(
    () => validateEventEnvelope({ ...base, siteId: 'wrong-site-id' }),
    { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_SITE_INVALID' }
  );
});


test('outbox worker passes the stable canonical envelope to consumers', async () => {
  const { createOutboxWorker } = require('../packages/db/src/outbox-worker');
  const row = makeOutboxRow();
  const statements = [];
  let applied = null;
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('SELECT id,aggregate_type')) return { rows: [row] };
      return { rows: [], rowCount: 1 };
    },
    release() {}
  };
  const pool = {
    async connect() { return client; },
    async query(sql, params) {
      statements.push(sql);
      assert.equal(params[0], row.id);
      return { rows: [], rowCount: 1 };
    }
  };
  const worker = createOutboxWorker({
    pool,
    projector: {
      async apply(input) { applied = input; }
    },
    workerId: 'contract-test-worker'
  });

  const result = await worker.runOnce();
  assert.equal(result.claimed, 1);
  assert.equal(result.results[0].ok, true);
  assert.equal(result.results[0].eventId, row.id);
  assert.equal(applied.type, row.event_type);
  assert.deepEqual(applied.payload, row.payload);
  assert.equal(applied.envelope.eventId, row.id);
  assert.equal(applied.envelope.resource.id, row.aggregate_id);
  assert.ok(statements.some(sql => sql === 'COMMIT'));
});
