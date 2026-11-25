'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  createOutboxDeliveryWorker,
  replayOutboxDeliveries,
  validateConsumerGroup,
  validateEventTypes
} = require('../packages/db/src/outbox-delivery');

const EVENT_ID = randomUUID();
const AGGREGATE_ID = randomUUID();
const EVENT_ROW = {
  id: EVENT_ID,
  aggregate_type: 'integration',
  aggregate_id: AGGREGATE_ID,
  aggregate_version: 3,
  event_type: 'integration.delivery',
  payload: { value: 'ok' },
  schema_version: 1,
  site_id: null,
  actor_id: null,
  correlation_id: null,
  causation_id: null,
  classification: 'internal',
  created_at: new Date('2026-10-30T16:30:00.000Z'),
  delivery_attempts: 1
};

test('consumer groups and event subscriptions are constrained and fail closed', () => {
  assert.equal(validateConsumerGroup('graph.projection-v1'), 'graph.projection-v1');
  for (const value of ['', 'UpperCase', 'bad group', '../unsafe', 42]) {
    assert.throws(() => validateConsumerGroup(value), {
      code: 'ERR_VIRGOSCORPIO_HUB_CONSUMER_GROUP_INVALID'
    });
  }
  assert.deepEqual(validateEventTypes(['content.publish', 'content.upsert']), ['content.publish', 'content.upsert']);
  for (const value of [[], ['Bad.Event'], ['content.upsert', 'content.upsert'], ['bad event'], null]) {
    assert.throws(() => validateEventTypes(value), {
      code: 'ERR_VIRGOSCORPIO_HUB_CONSUMER_EVENT_TYPES_INVALID'
    });
  }
});

test('delivery worker dispatches and acknowledges a canonical event envelope', async () => {
  const queries = [];
  let applied;
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('SELECT event_types FROM outbox_consumer_groups')) return { rowCount: 1, rows: [{ event_types: ['integration.delivery'] }] };
      if (sql.includes('INSERT INTO outbox_deliveries')) return { rowCount: 1, rows: [{ event_id: EVENT_ID }] };
      if (sql.includes('WITH candidates AS')) return { rowCount: 1, rows: [EVENT_ROW] };
      if (sql.includes("SET status = 'processed'")) return { rowCount: 1, rows: [] };
      return { rowCount: 1, rows: [] };
    }
  };
  const worker = createOutboxDeliveryWorker({
    pool,
    consumerGroup: 'test.delivery',
    eventTypes: ['integration.delivery'],
    workerId: 'unit-worker',
    handler: async input => { applied = input; }
  });

  const result = await worker.runOnce();
  assert.equal(result.dispatched, 1);
  assert.equal(result.claimed, 1);
  assert.equal(result.results[0].ok, true);
  assert.equal(applied.type, EVENT_ROW.event_type);
  assert.deepEqual(applied.payload, EVENT_ROW.payload);
  assert.equal(applied.envelope.eventId, EVENT_ID);
  assert.equal(applied.envelope.resource.version, 3);
  assert.deepEqual(applied.delivery, { consumerGroup: 'test.delivery', attempt: 1 });
  assert.ok(queries.some(query => query.sql.includes('FOR UPDATE OF d SKIP LOCKED')));
  assert.ok(queries.some(query => query.sql.includes('prior_delivery.status')));
});

test('delivery handler receives canonical envelope-bound domain identity', async () => {
  const siteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const resourceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const row = {
    ...EVENT_ROW,
    id: randomUUID(),
    aggregate_type: 'content',
    aggregate_id: resourceId,
    aggregate_version: 5,
    event_type: 'content.upsert',
    payload: {
      id: resourceId.toUpperCase(),
      siteId: siteId.toUpperCase(),
      title: 'Draft',
      metadata: { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }
    },
    site_id: siteId,
    classification: 'site-private'
  };
  let applied;
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT event_types FROM outbox_consumer_groups')) return { rowCount: 1, rows: [{ event_types: ['content.upsert'] }] };
      if (sql.includes('INSERT INTO outbox_deliveries')) return { rowCount: 1, rows: [{ event_id: row.id }] };
      if (sql.includes('WITH candidates AS')) return { rowCount: 1, rows: [row] };
      if (sql.includes("SET status = 'processed'")) return { rowCount: 1, rows: [] };
      return { rowCount: 1, rows: [] };
    }
  };
  const worker = createOutboxDeliveryWorker({
    pool,
    consumerGroup: 'test.content-identity',
    eventTypes: ['content.upsert'],
    handler: async input => { applied = input; }
  });

  const result = await worker.runOnce();
  assert.equal(result.results[0].ok, true);
  assert.equal(applied.payload.id, resourceId);
  assert.equal(applied.payload.siteId, siteId);
  assert.equal(applied.envelope.payload.id, resourceId);
  assert.equal(applied.envelope.payload.siteId, siteId);
  assert.notStrictEqual(applied.payload, row.payload);
  assert.equal(row.payload.id, resourceId.toUpperCase(), 'the claimed row payload remains untouched');
  assert.equal(row.payload.siteId, siteId.toUpperCase(), 'the claimed row site ID remains untouched');
  assert.equal(applied.type, 'content.upsert');
});

test('delivery rejects mismatched aggregate identity before handler side effects', async () => {
  const siteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const resourceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const row = {
    ...EVENT_ROW,
    id: randomUUID(),
    aggregate_type: 'content',
    aggregate_id: resourceId,
    aggregate_version: 5,
    event_type: 'content.upsert',
    payload: {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      siteId,
      title: 'Mismatched draft'
    },
    site_id: siteId,
    classification: 'site-private'
  };
  let handlerCalls = 0;
  let failureUpdate;
  const pool = {
    async query(sql, params) {
      if (sql.includes('SELECT event_types FROM outbox_consumer_groups')) return { rowCount: 1, rows: [{ event_types: ['content.upsert'] }] };
      if (sql.includes('INSERT INTO outbox_deliveries')) return { rowCount: 1, rows: [{ event_id: row.id }] };
      if (sql.includes('WITH candidates AS')) return { rowCount: 1, rows: [row] };
      if (sql.includes('SET status = $4')) { failureUpdate = { sql, params }; return { rowCount: 1, rows: [] }; }
      return { rowCount: 1, rows: [] };
    }
  };
  const worker = createOutboxDeliveryWorker({
    pool,
    consumerGroup: 'test.content-identity-rejected',
    eventTypes: ['content.upsert'],
    maxAttempts: 1,
    handler: async () => { handlerCalls += 1; }
  });

  const result = await worker.runOnce();
  assert.equal(handlerCalls, 0);
  assert.equal(result.results[0].ok, false);
  assert.equal(result.results[0].dead, true);
  assert.equal(result.results[0].errorCode, 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH');
  assert.equal(failureUpdate.params[3], 'dead');
  assert.equal(failureUpdate.params[5], 'ERR_VIRGOSCORPIO_HUB_EVENT_IDENTITY_RESOURCE_MISMATCH');
});

test('failed delivery is marked dead after the configured attempt limit', async () => {
  let failureUpdate;
  const pool = {
    async query(sql, params) {
      if (sql.includes('SELECT event_types FROM outbox_consumer_groups')) return { rowCount: 1, rows: [{ event_types: ['integration.delivery'] }] };
      if (sql.includes('INSERT INTO outbox_deliveries')) return { rowCount: 1, rows: [] };
      if (sql.includes('WITH candidates AS')) return { rowCount: 1, rows: [EVENT_ROW] };
      if (sql.includes("SET status = $4")) { failureUpdate = { sql, params }; return { rowCount: 1, rows: [] }; }
      return { rowCount: 1, rows: [] };
    }
  };
  const worker = createOutboxDeliveryWorker({
    pool,
    consumerGroup: 'test.poison',
    eventTypes: ['integration.delivery'],
    maxAttempts: 1,
    handler: async () => { throw Object.assign(new Error('unavailable'), { code: 'ERR_TEST_DOWN' }); }
  });
  const result = await worker.runOnce();
  assert.equal(result.results[0].dead, true);
  assert.equal(failureUpdate.params[3], 'dead');
  assert.equal(failureUpdate.params[5], 'ERR_TEST_DOWN');
});

test('replay resets only explicitly selected dead/processed deliveries', async () => {
  let queryParams;
  const pool = {
    async query(sql, params) {
      assert.match(sql, /status = ANY\(\$3::text\[\]\)/);
      queryParams = params;
      return { rowCount: 1, rows: [{ event_id: EVENT_ID }] };
    }
  };
  const result = await replayOutboxDeliveries({
    pool,
    consumerGroup: 'test.replay',
    eventIds: [EVENT_ID]
  });
  assert.equal(result.replayed, 1);
  assert.deepEqual(result.eventIds, [EVENT_ID]);
  assert.deepEqual(queryParams[2], ['dead']);
  await assert.rejects(() => replayOutboxDeliveries({
    pool, consumerGroup: 'test.replay', eventIds: ['not-a-uuid']
  }), { code: 'ERR_VIRGOSCORPIO_HUB_REPLAY_EVENT_IDS_INVALID' });
  await assert.rejects(() => replayOutboxDeliveries({
    pool, consumerGroup: 'test.replay', eventIds: [EVENT_ID], statuses: ['processing']
  }), { code: 'ERR_VIRGOSCORPIO_HUB_REPLAY_STATUS_INVALID' });
});


test('worker refuses to silently change a persisted consumer-group subscription', async () => {
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT event_types FROM outbox_consumer_groups')) {
        return { rowCount: 1, rows: [{ event_types: ['integration.other'] }] };
      }
      return { rowCount: 1, rows: [] };
    }
  };
  const worker = createOutboxDeliveryWorker({
    pool,
    consumerGroup: 'test.stable-config',
    eventTypes: ['integration.delivery'],
    handler: async () => {}
  });
  await assert.rejects(() => worker.runOnce(), {
    code: 'ERR_VIRGOSCORPIO_HUB_CONSUMER_EVENT_TYPES_MISMATCH'
  });
});
