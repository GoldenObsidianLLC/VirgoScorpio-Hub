'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { orderLiveIntegrationFiles } = require('../scripts/order-live-integration-files');

test('live integration order prioritizes the stateful tenant isolation suite', () => {
  const input = [
    'test/integration/tenant-content-object-isolation.integration.test.js',
    'test/integration/postgres.integration.test.js',
    'test/integration/tenant-isolation.integration.test.js',
    'test/integration/community-workflows.integration.test.js',
  ];
  const ordered = orderLiveIntegrationFiles(input);

  assert.deepEqual(ordered, [
    'test/integration/tenant-isolation.integration.test.js',
    'test/integration/community-workflows.integration.test.js',
    'test/integration/postgres.integration.test.js',
    'test/integration/tenant-content-object-isolation.integration.test.js',
  ]);
  assert.deepEqual(input, [
    'test/integration/tenant-content-object-isolation.integration.test.js',
    'test/integration/postgres.integration.test.js',
    'test/integration/tenant-isolation.integration.test.js',
    'test/integration/community-workflows.integration.test.js',
  ], 'ordering must not mutate the caller-owned file list');
});

test('live integration order preserves every file, including duplicates', () => {
  const files = [
    'test/integration/tenant-isolation.integration.test.js',
    'test/integration/tenant-isolation.integration.test.js',
    'test/integration/postgres.integration.test.js',
  ];
  const ordered = orderLiveIntegrationFiles(files);

  assert.equal(ordered.length, files.length);
  assert.equal(ordered.filter(file => file.endsWith('/tenant-isolation.integration.test.js')).length, 2);
  assert.equal(ordered[0], files[0]);
  assert.equal(ordered[1], files[1]);
});
