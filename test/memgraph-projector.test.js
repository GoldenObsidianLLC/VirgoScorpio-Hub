'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createMemgraphProjector } = require('../packages/graph/src/memgraph-store');

function makeDriver() {
  const statements = [];
  return {
    statements,
    session() {
      return {
        async executeWrite(callback) {
          return callback({
            async run(statement, params) {
              statements.push({ statement, params });
              return { records: [] };
            }
          });
        },
        async close() {}
      };
    },
    async close() {}
  };
}

const SITE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SITE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONTENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_CONTENT_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeEnvelope({
  type,
  eventType = type,
  resourceType = 'content',
  resourceId = CONTENT_ID,
  siteId = SITE_A,
  version = 1,
  payload
}) {
  return {
    eventId: randomUUID(),
    eventType,
    schemaVersion: 1,
    occurredAt: '2026-11-20T00:00:00.000Z',
    siteId,
    actor: { type: 'system', id: null },
    resource: { type: resourceType, id: resourceId, version },
    correlationId: null,
    causationId: null,
    classification: 'site-private',
    payload
  };
}

test('projector rejects payload site scope that differs from the validated event envelope', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = { id: CONTENT_ID, siteId: SITE_B, status: 'published', version: 1 };

  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', payload })
  }), { code: 'ERR_GRAPH_PROJECTION_SCOPE_MISMATCH' });
  assert.equal(driver.statements.length, 0);
});

test('projector rejects a missing envelope instead of falling back to payload identity', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = { id: CONTENT_ID, siteId: SITE_A, status: 'published', version: 1 };

  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload
  }), { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_INVALID' });
  assert.equal(driver.statements.length, 0);
});

test('projector rejects payload resource identity that differs from the validated event envelope', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = { id: OTHER_CONTENT_ID, siteId: SITE_A, status: 'published', version: 1 };

  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', payload })
  }), { code: 'ERR_GRAPH_PROJECTION_RESOURCE_MISMATCH' });
  assert.equal(driver.statements.length, 0);
});

test('projector rejects an event type that differs from the validated envelope', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = { id: CONTENT_ID, siteId: SITE_A, status: 'published', version: 1 };

  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', eventType: 'content.unpublish', payload })
  }), { code: 'ERR_GRAPH_PROJECTION_EVENT_MISMATCH' });
  assert.equal(driver.statements.length, 0);
});

test('projector rejects an envelope resource type that does not match the event family', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = { id: CONTENT_ID, siteId: SITE_A, status: 'published', version: 1 };

  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', resourceType: 'taxonomy-term', payload })
  }), { code: 'ERR_GRAPH_PROJECTION_RESOURCE_TYPE_MISMATCH' });
  assert.equal(driver.statements.length, 0);
});

test('projector uses normalized envelope identity when payload UUIDs differ only by case', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = {
    id: CONTENT_ID.toUpperCase(),
    siteId: SITE_A.toUpperCase(),
    status: 'published',
    version: 1
  };

  await projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', payload })
  });
  assert.equal(driver.statements.length, 1);
  assert.equal(driver.statements[0].params.id, CONTENT_ID);
  assert.equal(driver.statements[0].params.siteId, SITE_A);
});

test('content workflow events update graph status using aggregate projection version', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = {
    id: CONTENT_ID,
    siteId: SITE_A,
    status: 'published',
    version: 7
  };
  await projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', payload, version: 12 })
  });
  assert.equal(driver.statements.length, 1);
  assert.match(driver.statements[0].statement, /projectionVersion/);
  assert.match(driver.statements[0].statement, /< \$projectionVersion/);
  assert.equal(driver.statements[0].params.projectionVersion, 12);
  assert.equal(driver.statements[0].params.version, 7);
  assert.equal(driver.statements[0].params.status, 'published');
});

test('content status projection rejects unknown states and malformed aggregate versions', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = {
    id: CONTENT_ID,
    siteId: SITE_A,
    status: 'unsafe',
    version: 1
  };
  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload,
    envelope: makeEnvelope({ type: 'content.publish', payload, version: 2 })
  }), { code: 'ERR_GRAPH_CONTENT_STATUS' });
  await assert.rejects(() => projector.apply({
    type: 'content.publish',
    payload: { ...payload, status: 'published' },
    envelope: makeEnvelope({ type: 'content.publish', payload, version: 0 })
  }), { code: 'ERR_VIRGOSCORPIO_HUB_EVENT_RESOURCE_INVALID' });
  assert.equal(driver.statements.length, 0);
});

test('content draft projection preserves editorial version separately from projection sequence', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = {
    id: CONTENT_ID,
    siteId: SITE_A,
    contentType: 'page',
    slug: 'draft',
    locale: 'en',
    title: 'Draft',
    status: 'draft',
    version: 7
  };
  await projector.apply({
    type: 'content.upsert',
    payload,
    envelope: makeEnvelope({ type: 'content.upsert', payload, version: 12 })
  });
  assert.equal(driver.statements[0].params.version, 7);
  assert.equal(driver.statements[0].params.projectionVersion, 12);
});
