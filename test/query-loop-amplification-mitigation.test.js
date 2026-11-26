'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePageDocument } = require('../packages/domain/src/page-document');

// Security mitigation tests for: Published query-loop pages allow bounded anonymous database-work amplification
// The mitigation enforces a MAX_QUERY_LOOPS = 5 limit at validation time and MAX_PUBLIC_QUERY_LOOP_QUERIES = 5
// at delivery time, with query batching by content type to prevent amplification attacks.

test('validation rejects page documents with more than 5 query-loop widgets', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'amplification-test',
    type: 'page',
    title: 'Amplification Test Page',
    children: []
  };

  // Add 6 query-loop widgets to exceed the MAX_QUERY_LOOPS = 5 limit
  for (let i = 1; i <= 6; i++) {
    document.children.push({
      id: `query-loop-${i}`,
      type: 'widget.query-loop',
      props: {
        source: 'latest-published',
        contentType: 'post',
        limit: 12,
        columns: 1,
        emptyText: 'No content.'
      },
      children: []
    });
  }

  const result = validatePageDocument(document);
  assert.equal(result.valid, false, 'Document with 6 query loops should be rejected');
  assert.ok(
    result.errors.some(e => e.includes('query-loop count exceeds 5')),
    'Error message should mention query-loop count limit'
  );
});

test('validation accepts page documents with exactly 5 query-loop widgets', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'max-loops-test',
    type: 'page',
    title: 'Max Loops Test Page',
    children: []
  };

  // Add exactly 5 query-loop widgets (at the limit)
  for (let i = 1; i <= 5; i++) {
    document.children.push({
      id: `query-loop-${i}`,
      type: 'widget.query-loop',
      props: {
        source: 'latest-published',
        contentType: `type-${i}`,
        limit: 12,
        columns: 1,
        emptyText: 'No content.'
      },
      children: []
    });
  }

  const result = validatePageDocument(document);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.nodeCount, 5);
});

test('validation accepts page documents with fewer than 5 query-loop widgets', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'few-loops-test',
    type: 'page',
    title: 'Few Loops Test Page',
    children: [
      {
        id: 'query-loop-1',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'post',
          limit: 3,
          columns: 2,
          emptyText: 'No posts.'
        },
        children: []
      },
      {
        id: 'query-loop-2',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'article',
          limit: 6,
          columns: 1,
          emptyText: 'No articles.'
        },
        children: []
      }
    ]
  };

  const result = validatePageDocument(document);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.nodeCount, 2);
});

test('validation rejects 250 query-loop widgets (worst-case pre-mitigation scenario)', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'worst-case-test',
    type: 'page',
    title: 'Worst Case Test Page',
    children: []
  };

  // Add 250 query-loop widgets (the old MAX_NODES limit, before query-loop-specific limit)
  // This would have been accepted before the mitigation but should now be rejected
  for (let i = 1; i <= 250; i++) {
    document.children.push({
      id: `query-loop-${i}`,
      type: 'widget.query-loop',
      props: {
        source: 'latest-published',
        contentType: 'post',
        limit: 12,
        columns: 1,
        emptyText: 'No content.'
      },
      children: []
    });
  }

  const result = validatePageDocument(document);
  assert.equal(result.valid, false, 'Document with 250 query loops should be rejected');
  assert.ok(
    result.errors.some(e => e.includes('query-loop count exceeds 5')),
    'Error message should mention query-loop count limit'
  );
});

test('validation counts nested query-loop widgets correctly', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'nested-loops-test',
    type: 'page',
    title: 'Nested Loops Test Page',
    children: [
      {
        id: 'section-1',
        type: 'section',
        props: { className: 'main' },
        children: [
          {
            id: 'query-loop-1',
            type: 'widget.query-loop',
            props: {
              source: 'latest-published',
              contentType: 'post',
              limit: 3,
              columns: 1,
              emptyText: 'No posts.'
            },
            children: []
          },
          {
            id: 'container-1',
            type: 'container',
            props: {},
            children: [
              {
                id: 'query-loop-2',
                type: 'widget.query-loop',
                props: {
                  source: 'latest-published',
                  contentType: 'article',
                  limit: 3,
                  columns: 1,
                  emptyText: 'No articles.'
                },
                children: []
              },
              {
                id: 'query-loop-3',
                type: 'widget.query-loop',
                props: {
                  source: 'latest-published',
                  contentType: 'news',
                  limit: 3,
                  columns: 1,
                  emptyText: 'No news.'
                },
                children: []
              }
            ]
          }
        ]
      },
      {
        id: 'query-loop-4',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'event',
          limit: 3,
          columns: 1,
          emptyText: 'No events.'
        },
        children: []
      },
      {
        id: 'query-loop-5',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'product',
          limit: 3,
          columns: 1,
          emptyText: 'No products.'
        },
        children: []
      },
      {
        id: 'query-loop-6',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'review',
          limit: 3,
          columns: 1,
          emptyText: 'No reviews.'
        },
        children: []
      }
    ]
  };

  const result = validatePageDocument(document);
  assert.equal(result.valid, false, 'Document with 6 nested query loops should be rejected');
  assert.ok(
    result.errors.some(e => e.includes('query-loop count exceeds 5')),
    'Error message should mention query-loop count limit'
  );
});

test('validation allows mixed widget types with 5 query loops among other widgets', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'mixed-widgets-test',
    type: 'page',
    title: 'Mixed Widgets Test Page',
    children: [
      {
        id: 'heading-1',
        type: 'widget.heading',
        props: { text: 'Welcome', level: 1 },
        children: []
      },
      {
        id: 'query-loop-1',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'post',
          limit: 12,
          columns: 1,
          emptyText: 'No posts.'
        },
        children: []
      },
      {
        id: 'text-1',
        type: 'widget.text',
        props: { text: 'Some text content' },
        children: []
      },
      {
        id: 'query-loop-2',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'article',
          limit: 6,
          columns: 1,
          emptyText: 'No articles.'
        },
        children: []
      },
      {
        id: 'button-1',
        type: 'widget.button',
        props: { text: 'Click me', url: '/action' },
        children: []
      },
      {
        id: 'query-loop-3',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'news',
          limit: 3,
          columns: 1,
          emptyText: 'No news.'
        },
        children: []
      },
      {
        id: 'query-loop-4',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'event',
          limit: 9,
          columns: 1,
          emptyText: 'No events.'
        },
        children: []
      },
      {
        id: 'divider-1',
        type: 'widget.divider',
        props: {},
        children: []
      },
      {
        id: 'query-loop-5',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'product',
          limit: 4,
          columns: 1,
          emptyText: 'No products.'
        },
        children: []
      }
    ]
  };

  const result = validatePageDocument(document);
  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.nodeCount, 9, 'Should count all 9 nodes');
});

test('validation rejects 6th query loop even with many other widget types', () => {
  const document = {
    schemaVersion: 1,
    documentId: 'mixed-overflow-test',
    type: 'page',
    title: 'Mixed Overflow Test Page',
    children: [
      {
        id: 'heading-1',
        type: 'widget.heading',
        props: { text: 'Welcome', level: 1 },
        children: []
      },
      {
        id: 'query-loop-1',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'post',
          limit: 12,
          columns: 1,
          emptyText: 'No posts.'
        },
        children: []
      },
      {
        id: 'query-loop-2',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'article',
          limit: 6,
          columns: 1,
          emptyText: 'No articles.'
        },
        children: []
      },
      {
        id: 'query-loop-3',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'news',
          limit: 3,
          columns: 1,
          emptyText: 'No news.'
        },
        children: []
      },
      {
        id: 'query-loop-4',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'event',
          limit: 9,
          columns: 1,
          emptyText: 'No events.'
        },
        children: []
      },
      {
        id: 'query-loop-5',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'product',
          limit: 4,
          columns: 1,
          emptyText: 'No products.'
        },
        children: []
      },
      {
        id: 'text-1',
        type: 'widget.text',
        props: { text: 'Some text content' },
        children: []
      },
      {
        id: 'query-loop-6',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'review',
          limit: 3,
          columns: 1,
          emptyText: 'No reviews.'
        },
        children: []
      }
    ]
  };

  const result = validatePageDocument(document);
  assert.equal(result.valid, false, 'Document with 6 query loops should be rejected');
  assert.ok(
    result.errors.some(e => e.includes('query-loop count exceeds 5')),
    'Error message should mention query-loop count limit'
  );
});

test('validation security property: MAX_QUERY_LOOPS prevents amplification attack', () => {
  // This test verifies the core security property:
  // No valid page document can contain more than 5 query-loop widgets,
  // which bounds the maximum database work per anonymous request.
  
  // Test boundary: exactly at limit (should pass)
  const atLimit = {
    schemaVersion: 1,
    documentId: 'at-limit',
    type: 'page',
    title: 'At Limit',
    children: Array.from({ length: 5 }, (_, i) => ({
      id: `loop-${i}`,
      type: 'widget.query-loop',
      props: {
        source: 'latest-published',
        contentType: `type-${i}`,
        limit: 12,
        columns: 1,
        emptyText: 'Empty'
      },
      children: []
    }))
  };
  assert.equal(validatePageDocument(atLimit).valid, true, 'Should accept exactly 5 query loops');

  // Test boundary: one over limit (should fail)
  const overLimit = {
    schemaVersion: 1,
    documentId: 'over-limit',
    type: 'page',
    title: 'Over Limit',
    children: Array.from({ length: 6 }, (_, i) => ({
      id: `loop-${i}`,
      type: 'widget.query-loop',
      props: {
        source: 'latest-published',
        contentType: `type-${i}`,
        limit: 12,
        columns: 1,
        emptyText: 'Empty'
      },
      children: []
    }))
  };
  const overResult = validatePageDocument(overLimit);
  assert.equal(overResult.valid, false, 'Should reject 6 query loops');
  assert.ok(
    overResult.errors.some(e => e.includes('query-loop count exceeds 5')),
    'Should report query-loop limit violation'
  );

  // Security assertion: The validation layer enforces a hard limit that prevents
  // publishing pages with excessive query loops, which would enable amplification attacks
  // where anonymous users could trigger hundreds of database queries per request.
});

test('validation security property: limit applies regardless of nesting depth', () => {
  // Verify that deeply nested query loops are still counted toward the limit
  const deeplyNested = {
    schemaVersion: 1,
    documentId: 'deeply-nested',
    type: 'page',
    title: 'Deeply Nested',
    children: [
      {
        id: 'section-1',
        type: 'section',
        props: {},
        children: [
          {
            id: 'container-1',
            type: 'container',
            props: {},
            children: [
              {
                id: 'loop-1',
                type: 'widget.query-loop',
                props: {
                  source: 'latest-published',
                  contentType: 'post',
                  limit: 12,
                  columns: 1,
                  emptyText: 'Empty'
                },
                children: []
              }
            ]
          }
        ]
      },
      {
        id: 'section-2',
        type: 'section',
        props: {},
        children: [
          {
            id: 'loop-2',
            type: 'widget.query-loop',
            props: {
              source: 'latest-published',
              contentType: 'article',
              limit: 12,
              columns: 1,
              emptyText: 'Empty'
            },
            children: []
          },
          {
            id: 'container-2',
            type: 'container',
            props: {},
            children: [
              {
                id: 'loop-3',
                type: 'widget.query-loop',
                props: {
                  source: 'latest-published',
                  contentType: 'news',
                  limit: 12,
                  columns: 1,
                  emptyText: 'Empty'
                },
                children: []
              },
              {
                id: 'loop-4',
                type: 'widget.query-loop',
                props: {
                  source: 'latest-published',
                  contentType: 'event',
                  limit: 12,
                  columns: 1,
                  emptyText: 'Empty'
                },
                children: []
              }
            ]
          }
        ]
      },
      {
        id: 'loop-5',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'product',
          limit: 12,
          columns: 1,
          emptyText: 'Empty'
        },
        children: []
      },
      {
        id: 'loop-6',
        type: 'widget.query-loop',
        props: {
          source: 'latest-published',
          contentType: 'review',
          limit: 12,
          columns: 1,
          emptyText: 'Empty'
        },
        children: []
      }
    ]
  };

  const result = validatePageDocument(deeplyNested);
  assert.equal(result.valid, false, 'Should reject 6 query loops regardless of nesting');
  assert.ok(
    result.errors.some(e => e.includes('query-loop count exceeds 5')),
    'Should report query-loop limit violation'
  );
});

// Note: Integration tests that verify the delivery-time mitigation
// (MAX_PUBLIC_QUERY_LOOP_QUERIES = 5 and query batching by content type)
// are in test/integration/tenant-public-query-loop-isolation.integration.test.js
// Those tests require a full database setup and are skipped unless
// VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true is set.
