'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMemgraphProjector } = require('../packages/graph/src/memgraph-store');
const { rebuildGraphProjection } = require('../packages/graph/src/rebuild-projection');

const SITE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CONTENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TERM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const RELATIONSHIP_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONTENT_ROWS = [{
  id: CONTENT_ID,
  site_id: SITE_ID,
  content_type: 'page',
  slug: 'canonical-page',
  locale: 'en',
  title: 'Canonical page',
  status: 'draft',
  version: 5,
  lock_version: 8,
  deleted_at: null
}];
const TAXONOMY_ROWS = [{
  id: TERM_ID,
  site_id: SITE_ID,
  taxonomy: 'category',
  slug: 'news',
  label: 'News',
  version: 3,
  metadata: { description: 'Canonical term' }
}];
const RELATIONSHIP_ROWS = [{
  id: RELATIONSHIP_ID,
  site_id: SITE_ID,
  source_id: CONTENT_ID,
  target_id: TERM_ID,
  kind: 'HAS_TERM',
  metadata: {},
  version: 2,
  deleted_at: null
}];

function makePool() {
  return {
    async connect() {
      return {
        async query(statement) {
          const sql = String(statement);
          if (sql.includes('content_count')) {
            return { rows: [{ content_count: '1', taxonomy_count: '1', relationship_count: '1' }] };
          }
          if (sql.includes('content_type')) return { rows: CONTENT_ROWS };
          if (sql.includes('taxonomy, slug')) return { rows: TAXONOMY_ROWS };
          if (sql.includes('source_id')) return { rows: RELATIONSHIP_ROWS };
          return { rows: [] };
        },
        release() {}
      };
    }
  };
}

function makeDriver() {
  const cleanupStatements = [];
  const projectionStatements = [];
  return {
    cleanupStatements,
    projectionStatements,
    session() {
      return {
        async run(statement, params) {
          cleanupStatements.push({ statement, params });
          return { records: [] };
        },
        async executeWrite(callback) {
          return callback({
            async run(statement, params) {
              projectionStatements.push({ statement, params });
              return { records: [] };
            }
          });
        },
        async close() {}
      };
    }
  };
}

test('graph rebuild constructs validated envelopes from canonical PostgreSQL rows', async () => {
  const driver = makeDriver();
  const projector = createMemgraphProjector({ driver });

  const result = await rebuildGraphProjection({
    pool: makePool(),
    driver,
    projector,
    maxRows: 10
  });

  assert.deepEqual(result, {
    content: 1,
    deletedContent: 0,
    taxonomy: 1,
    deletedTaxonomy: 0,
    relationships: 1,
    deletedRelationships: 0,
    total: 3
  });
  assert.equal(driver.cleanupStatements.length, 3);
  assert.equal(driver.projectionStatements.length, 3);

  const [content, taxonomy, relationship] = driver.projectionStatements;
  assert.equal(content.params.id, CONTENT_ID);
  assert.equal(content.params.siteId, SITE_ID);
  assert.equal(content.params.version, 5);
  assert.equal(content.params.projectionVersion, 8);

  assert.equal(taxonomy.params.id, TERM_ID);
  assert.equal(taxonomy.params.siteId, SITE_ID);
  assert.equal(taxonomy.params.version, 3);

  assert.equal(relationship.params.relationshipId, RELATIONSHIP_ID);
  assert.equal(relationship.params.siteId, SITE_ID);
  assert.equal(relationship.params.sourceId, CONTENT_ID);
  assert.equal(relationship.params.targetId, TERM_ID);
  assert.equal(relationship.params.version, 2);
});
