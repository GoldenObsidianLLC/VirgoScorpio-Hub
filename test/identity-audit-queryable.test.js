'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

test('identity audit uses an explicitly supplied transaction queryable and defaults to its pool', async () => {
  const poolCalls = [];
  const transactionCalls = [];
  const pool = {
    async query(sql, values) {
      poolCalls.push({ sql, values });
      return { rowCount: 1, rows: [] };
    },
  };
  const transactionClient = {
    async query(sql, values) {
      transactionCalls.push({ sql, values });
      return { rowCount: 1, rows: [] };
    },
  };
  const identity = createIdentityService({ pool, env: {} });
  const input = {
    siteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    action: 'design_system.updated',
    targetType: 'design_system',
    requestId: 'request-design-system-123',
    details: { version: 2 },
  };

  await identity.audit(input, { queryable: transactionClient });

  assert.equal(transactionCalls.length, 1);
  assert.equal(poolCalls.length, 0, 'transaction-bound audit must not escape to the service pool');
  assert.match(transactionCalls[0].sql, /INSERT INTO audit_events/);
  assert.deepEqual(transactionCalls[0].values, [
    input.siteId,
    input.actorId,
    input.action,
    input.targetType,
    null,
    'success',
    input.requestId,
    JSON.stringify(input.details),
  ]);

  await identity.audit(input);

  assert.equal(poolCalls.length, 1, 'the one-argument audit API remains pool-backed');
  assert.deepEqual(poolCalls[0].values, transactionCalls[0].values);
});
