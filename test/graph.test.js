'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createMemgraphProjector } = require('../packages/graph/src/memgraph-store');
const { createWidgetRegistry } = require('../packages/widgets/src/registry');

const SITE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RELATIONSHIP_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_RELATIONSHIP_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TERM_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SOURCE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TARGET_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

function fakeDriver() {
  const calls = [];
  return {
    calls,
    session() {
      return {
        async executeWrite(fn) {
          return fn({
            async run(cypher, params) {
              calls.push({ cypher, params });
              return { records: [] };
            }
          });
        },
        async run(cypher, params) {
          calls.push({ cypher, params });
          return { records: [] };
        },
        async close() {}
      };
    },
    async close() {}
  };
}

function makeProjectionEnvelope({ type, resourceType, resourceId, siteId = SITE_ID, version = 1, payload }) {
  return {
    eventId: randomUUID(),
    eventType: type,
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

test('Memgraph projector constrains relationship writes to the validated envelope identity', async () => {
  const driver = fakeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = {
    relationshipId: RELATIONSHIP_ID,
    siteId: SITE_ID,
    sourceId: SOURCE_ID,
    targetId: TARGET_ID,
    kind: 'RELATED_TO',
    version: 1
  };
  await projector.apply({
    type: 'relationship.upsert',
    payload,
    envelope: makeProjectionEnvelope({
      type: 'relationship.upsert',
      resourceType: 'relationship',
      resourceId: RELATIONSHIP_ID,
      payload
    })
  });
  assert.ok(driver.calls[0].cypher.includes(':RELATED_TO'));
  assert.equal(driver.calls[0].params.relationshipId, RELATIONSHIP_ID);
  assert.equal(driver.calls[0].params.siteId, SITE_ID);

  const invalidPayload = {
    ...payload,
    relationshipId: OTHER_RELATIONSHIP_ID,
    kind: 'BAD) MATCH (n) DELETE n //'
  };
  await assert.rejects(() => projector.apply({
    type: 'relationship.upsert',
    payload: invalidPayload,
    envelope: makeProjectionEnvelope({
      type: 'relationship.upsert',
      resourceType: 'relationship',
      resourceId: OTHER_RELATIONSHIP_ID,
      payload: invalidPayload
    })
  }), { code: 'ERR_GRAPH_RELATION_KIND' });
  assert.equal(driver.calls.length, 1);
});

test('core widget registry lists required widget types', () => {
  const widgets = createWidgetRegistry();
  assert.equal(widgets.has('widget.heading'), true);
  assert.equal(widgets.has('widget.button'), true);
  assert.ok(widgets.list().length >= 7);
});

test('relationship reads exclude draft content even when a relationship exists', async () => {
  const driver = fakeDriver();
  const projector = createMemgraphProjector({ driver });
  await projector.findRelated({ id: 'source', siteId: 'site' });
  assert.match(driver.calls[0].cypher, /s\.status='published'/);
  assert.match(driver.calls[0].cypher, /t\.status='published'/);
});

test('related-content limits use a bounded integer literal accepted by Memgraph', async () => {
  const driver = fakeDriver();
  const projector = createMemgraphProjector({ driver });
  await projector.findRelated({ id: 'source', siteId: 'site', limit: 12.8 });
  assert.match(driver.calls[0].cypher, /LIMIT 12$/);
  assert.equal(Object.hasOwn(driver.calls[0].params, 'limit'), false);

  await projector.findRelated({ id: 'source', siteId: 'site', limit: 1000 });
  assert.match(driver.calls[1].cypher, /LIMIT 100$/);

  await projector.findRelated({ id: 'source', siteId: 'site', limit: 'invalid' });
  assert.match(driver.calls[2].cypher, /LIMIT 20$/);
});

test('taxonomy graph projection stores metadata as bounded scalar JSON text', async () => {
  const driver = fakeDriver();
  const projector = createMemgraphProjector({ driver });
  const payload = {
    id: TERM_ID,
    siteId: SITE_ID,
    taxonomy: 'category',
    slug: 'news',
    label: 'News',
    metadata: { description: 'Example' },
    version: 1
  };
  await projector.apply({
    type: 'taxonomy.upsert',
    payload,
    envelope: makeProjectionEnvelope({
      type: 'taxonomy.upsert',
      resourceType: 'taxonomy-term',
      resourceId: TERM_ID,
      payload
    })
  });
  assert.ok(driver.calls[0].cypher.includes(':TaxonomyTerm'));
  assert.ok(driver.calls[0].cypher.includes('n.metadataJson=$metadataJson'));
  assert.equal(driver.calls[0].params.id, TERM_ID);
  assert.equal(driver.calls[0].params.siteId, SITE_ID);
  assert.equal(typeof driver.calls[0].params.metadataJson, 'string');
  assert.deepEqual(JSON.parse(driver.calls[0].params.metadataJson), { description: 'Example' });
});
