'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCollaborationOperation,
  transformCollaborationOperation,
  applyCollaborationOperation
} = require('../packages/collaboration/src');
const { createPostgresStore } = require('../packages/db/src/postgres-store');

function fixture() {
  return {
    schemaVersion: 1,
    documentId: 'page-test',
    type: 'page',
    title: 'Test Page',
    children: [{
      id: 'section-1',
      type: 'section',
      props: {},
      children: [
        { id: 'heading-1', type: 'widget.heading', props: { text: 'Hello', level: 1 }, children: [] },
        { id: 'text-1', type: 'widget.text', props: { text: 'abcdef' }, children: [] },
        { id: 'button-1', type: 'widget.button', props: { text: 'Explore', url: '/explore' }, children: [] },
        { id: 'quote-1', type: 'widget.quote', props: { text: 'A quote', cite: 'Editor' }, children: [] }
      ]
    }]
  };
}

function op(type, payload, overrides = {}) {
  return {
    schemaVersion: 1,
    opId: '11111111-1111-4111-8111-111111111111',
    clientId: 'editor-a',
    baseSequence: 0,
    type,
    payload,
    ...overrides
  };
}

test('validates collaboration envelopes and rejects malformed or oversized inputs', () => {
  const valid = op('document.set_title', { title: 'Updated title' });
  assert.deepEqual(validateCollaborationOperation(valid), { valid: true, errors: [] });
  assert.equal(validateCollaborationOperation({ ...valid, opId: 'not-a-uuid' }).valid, false);
  assert.equal(validateCollaborationOperation({ ...valid, clientId: 'x'.repeat(200) }).valid, false);
  assert.equal(validateCollaborationOperation({ ...valid, baseSequence: -1 }).valid, false);
  assert.equal(validateCollaborationOperation({ ...valid, type: 'document.patch' }).valid, false);
  assert.equal(validateCollaborationOperation({ ...valid, payload: { title: 'x'.repeat(181) } }).valid, false);
});

test('applies title and approved property changes without mutating the input tree', () => {
  const source = fixture();
  const titled = applyCollaborationOperation(source, op('document.set_title', { title: 'New title' }));
  assert.equal(titled.document.title, 'New title');
  assert.equal(source.title, 'Test Page');
  const changed = applyCollaborationOperation(titled.document, op('node.set_prop', {
    nodeId: 'heading-1', key: 'level', value: 2
  }));
  assert.equal(changed.document.children[0].children[0].props.level, 2);
  assert.equal(changed.changed, true);
});

test('inserts, moves, and deletes nodes using stable sibling and parent IDs', () => {
  const source = fixture();
  const inserted = applyCollaborationOperation(source, op('node.insert', {
    parentId: 'section-1',
    afterNodeId: 'heading-1',
    node: { id: 'new-text', type: 'widget.text', props: { text: 'New' }, children: [] }
  }));
  assert.deepEqual(inserted.document.children[0].children.map(node => node.id), [
    'heading-1', 'new-text', 'text-1', 'button-1', 'quote-1'
  ]);
  const moved = applyCollaborationOperation(inserted.document, op('node.move', {
    nodeId: 'button-1', parentId: 'section-1', afterNodeId: 'new-text'
  }));
  assert.deepEqual(moved.document.children[0].children.map(node => node.id), [
    'heading-1', 'new-text', 'button-1', 'text-1', 'quote-1'
  ]);
  const deleted = applyCollaborationOperation(moved.document, op('node.delete', { nodeId: 'new-text' }));
  assert.equal(deleted.document.children[0].children.some(node => node.id === 'new-text'), false);
});

test('rejects moves into descendants and node edits after the target was deleted', () => {
  const source = fixture();
  assert.throws(
    () => applyCollaborationOperation(source, op('node.move', {
      nodeId: 'section-1', parentId: 'section-1', afterNodeId: null
    })),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_OT_CYCLE'
  );
  const deleted = applyCollaborationOperation(source, op('node.delete', { nodeId: 'heading-1' }));
  assert.throws(
    () => applyCollaborationOperation(deleted.document, op('node.set_prop', {
      nodeId: 'heading-1', key: 'text', value: 'Late edit'
    })),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_OT_TARGET_DELETED'
  );
});

test('transforms concurrent inserts at the same stable anchor in accepted sequence order', () => {
  const first = op('node.insert', {
    parentId: 'section-1', afterNodeId: 'heading-1',
    node: { id: 'insert-a', type: 'widget.text', props: { text: 'A' }, children: [] }
  }, { opId: '11111111-1111-4111-8111-111111111111' });
  const second = op('node.insert', {
    parentId: 'section-1', afterNodeId: 'heading-1',
    node: { id: 'insert-b', type: 'widget.text', props: { text: 'B' }, children: [] }
  }, { opId: '22222222-2222-4222-8222-222222222222', clientId: 'editor-b' });
  const transformed = transformCollaborationOperation(second, [{ sequence: 1, operation: first, appliedOperation: first }]);
  assert.equal(transformed.payload.afterNodeId, 'insert-a');
});

test('allows independent property edits and deterministically keeps the later same-key write', () => {
  const level = op('node.set_prop', { nodeId: 'heading-1', key: 'level', value: 2 });
  const text = op('node.set_prop', { nodeId: 'heading-1', key: 'text', value: 'Latest text' }, {
    opId: '22222222-2222-4222-8222-222222222222', clientId: 'editor-b'
  });
  const transformed = transformCollaborationOperation(text, [{ sequence: 1, operation: level }]);
  assert.equal(transformed.payload.key, 'text');
  const first = applyCollaborationOperation(fixture(), level);
  const second = applyCollaborationOperation(first.document, text);
  assert.equal(second.document.children[0].children[0].props.level, 2);
  assert.equal(second.document.children[0].children[0].props.text, 'Latest text');
});

test('transforms same-offset text inserts in accepted sequence order using code-point offsets', () => {
  const first = op('text.insert', { nodeId: 'text-1', key: 'text', offset: 2, text: '😀' });
  const second = op('text.insert', { nodeId: 'text-1', key: 'text', offset: 2, text: 'B' }, {
    opId: '22222222-2222-4222-8222-222222222222', clientId: 'editor-b'
  });
  const transformed = transformCollaborationOperation(second, [{ sequence: 1, operation: first }]);
  assert.equal(transformed.payload.offset, 3);
  const result = applyCollaborationOperation(fixture(), first);
  const next = applyCollaborationOperation(result.document, transformed);
  assert.equal(next.document.children[0].children[1].props.text, 'ab😀Bcdef');
});

test('maps text deletions through prior deletes and preserves Unicode code points', () => {
  const previous = op('text.delete', { nodeId: 'text-1', key: 'text', offset: 1, length: 2 });
  const stale = op('text.delete', { nodeId: 'text-1', key: 'text', offset: 3, length: 2 }, {
    opId: '22222222-2222-4222-8222-222222222222', clientId: 'editor-b'
  });
  const transformed = transformCollaborationOperation(stale, [{ sequence: 1, operation: previous }]);
  assert.deepEqual({ offset: transformed.payload.offset, length: transformed.payload.length }, { offset: 1, length: 2 });

  const unicode = fixture();
  unicode.children[0].children[1].props.text = 'A😀BC';
  const result = applyCollaborationOperation(unicode, op('text.delete', {
    nodeId: 'text-1', key: 'text', offset: 1, length: 1
  }));
  assert.equal(result.document.children[0].children[1].props.text, 'ABC');
});

test('rejects overlapping concurrent text insertions inside a stale delete range', () => {
  const inserted = op('text.insert', { nodeId: 'text-1', key: 'text', offset: 3, text: 'X' });
  const staleDelete = op('text.delete', { nodeId: 'text-1', key: 'text', offset: 1, length: 4 }, {
    opId: '22222222-2222-4222-8222-222222222222', clientId: 'editor-b'
  });
  assert.throws(
    () => transformCollaborationOperation(staleDelete, [{ sequence: 1, operation: inserted }]),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_OT_CONFLICT'
  );
});

test('rejects missing or non-sibling anchors and invalid final documents', () => {
  assert.throws(
    () => applyCollaborationOperation(fixture(), op('node.insert', {
      parentId: 'section-1', afterNodeId: 'missing-node',
      node: { id: 'new-node', type: 'widget.text', props: { text: 'X' }, children: [] }
    })),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_OT_CONFLICT'
  );
  assert.throws(
    () => applyCollaborationOperation(fixture(), op('node.set_prop', {
      nodeId: 'button-1', key: 'url', value: 'javascript:alert(1)'
    })),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_INVALID_DOCUMENT'
  );
});

test('PostgreSQL store rejects invalid collaboration envelopes before acquiring a client', async () => {
  let acquired = false;
  const store = createPostgresStore({
    pool: {
      async connect() { acquired = true; throw new Error('connection should not be acquired'); }
    }
  });
  await assert.rejects(
    store.applyCollaborationOperation({
      siteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      contentId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      actorId: null,
      operation: op('document.set_title', { title: '' })
    }),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_INVALID_COLLABORATION_OPERATION'
  );
  assert.equal(acquired, false);
});

test('rejects collaboration payload values that cannot round-trip through JSON', () => {
  const undefinedValue = op('node.set_prop', {
    nodeId: 'heading-1', key: 'text', value: undefined
  });
  const bigintValue = op('node.set_prop', {
    nodeId: 'heading-1', key: 'text', value: 1n
  });
  assert.equal(validateCollaborationOperation(undefinedValue).valid, false);
  assert.equal(validateCollaborationOperation(bigintValue).valid, false);
});

test('rejects operations with extra envelope keys to prevent client replay blocking', () => {
  // Pentest finding: extra envelope keys should be rejected to prevent DoS
  const validOp = op('document.set_title', { title: 'Valid Title' });
  
  // Extra envelope key should be rejected
  const withExtraEnvelopeKey = { ...validOp, extraKey: 'malicious' };
  const result = validateCollaborationOperation(withExtraEnvelopeKey);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(err => err.includes('exactly the supported envelope keys')));
  
  // Multiple extra envelope keys should also be rejected
  const withMultipleExtraKeys = { ...validOp, extra1: 'a', extra2: 'b' };
  const result2 = validateCollaborationOperation(withMultipleExtraKeys);
  assert.equal(result2.valid, false);
  assert.ok(result2.errors.some(err => err.includes('exactly the supported envelope keys')));
});

test('rejects operations with missing envelope keys', () => {
  // Missing envelope keys should be rejected
  const validOp = op('document.set_title', { title: 'Valid Title' });
  
  // Missing schemaVersion
  const { schemaVersion, ...withoutSchemaVersion } = validOp;
  const result1 = validateCollaborationOperation(withoutSchemaVersion);
  assert.equal(result1.valid, false);
  assert.ok(result1.errors.some(err => err.includes('exactly the supported envelope keys')));
  
  // Missing opId
  const { opId, ...withoutOpId } = validOp;
  const result2 = validateCollaborationOperation(withoutOpId);
  assert.equal(result2.valid, false);
  assert.ok(result2.errors.some(err => err.includes('exactly the supported envelope keys')));
  
  // Missing clientId
  const { clientId, ...withoutClientId } = validOp;
  const result3 = validateCollaborationOperation(withoutClientId);
  assert.equal(result3.valid, false);
  assert.ok(result3.errors.some(err => err.includes('exactly the supported envelope keys')));
  
  // Missing baseSequence
  const { baseSequence, ...withoutBaseSequence } = validOp;
  const result4 = validateCollaborationOperation(withoutBaseSequence);
  assert.equal(result4.valid, false);
  assert.ok(result4.errors.some(err => err.includes('exactly the supported envelope keys')));
  
  // Missing type
  const { type, ...withoutType } = validOp;
  const result5 = validateCollaborationOperation(withoutType);
  assert.equal(result5.valid, false);
  assert.ok(result5.errors.some(err => err.includes('exactly the supported envelope keys')));
  
  // Missing payload
  const { payload, ...withoutPayload } = validOp;
  const result6 = validateCollaborationOperation(withoutPayload);
  assert.equal(result6.valid, false);
  assert.ok(result6.errors.some(err => err.includes('exactly the supported envelope keys')));
});

test('rejects operations with extra payload keys for all operation types', () => {
  // document.set_title with extra payload key
  const setTitleOp = op('document.set_title', { title: 'Valid', extraPayloadKey: 'bad' });
  const result1 = validateCollaborationOperation(setTitleOp);
  assert.equal(result1.valid, false);
  assert.ok(result1.errors.some(err => err.includes('payload') || err.includes('title')));
  
  // node.insert with extra payload key
  const insertOp = op('node.insert', {
    parentId: 'section-1',
    afterNodeId: 'heading-1',
    node: { id: 'new-node', type: 'widget.text', props: { text: 'X' }, children: [] },
    extraPayloadKey: 'bad'
  });
  const result2 = validateCollaborationOperation(insertOp);
  assert.equal(result2.valid, false);
  assert.ok(result2.errors.some(err => err.includes('payload') || err.includes('invalid')));
  
  // node.delete with extra payload key
  const deleteOp = op('node.delete', { nodeId: 'heading-1', extraPayloadKey: 'bad' });
  const result3 = validateCollaborationOperation(deleteOp);
  assert.equal(result3.valid, false);
  assert.ok(result3.errors.some(err => err.includes('nodeId') || err.includes('invalid')));
  
  // node.move with extra payload key
  const moveOp = op('node.move', {
    nodeId: 'heading-1',
    parentId: 'section-1',
    afterNodeId: null,
    extraPayloadKey: 'bad'
  });
  const result4 = validateCollaborationOperation(moveOp);
  assert.equal(result4.valid, false);
  assert.ok(result4.errors.some(err => err.includes('nodeId') || err.includes('invalid')));
  
  // node.set_prop with extra payload key
  const setPropOp = op('node.set_prop', {
    nodeId: 'heading-1',
    key: 'text',
    value: 'New text',
    extraPayloadKey: 'bad'
  });
  const result5 = validateCollaborationOperation(setPropOp);
  assert.equal(result5.valid, false);
  assert.ok(result5.errors.some(err => err.includes('nodeId') || err.includes('invalid')));
  
  // text.insert with extra payload key
  const textInsertOp = op('text.insert', {
    nodeId: 'text-1',
    key: 'text',
    offset: 0,
    text: 'Hello',
    extraPayloadKey: 'bad'
  });
  const result6 = validateCollaborationOperation(textInsertOp);
  assert.equal(result6.valid, false);
  assert.ok(result6.errors.some(err => err.includes('nodeId') || err.includes('invalid')));
  
  // text.delete with extra payload key
  const textDeleteOp = op('text.delete', {
    nodeId: 'text-1',
    key: 'text',
    offset: 0,
    length: 1,
    extraPayloadKey: 'bad'
  });
  const result7 = validateCollaborationOperation(textDeleteOp);
  assert.equal(result7.valid, false);
  assert.ok(result7.errors.some(err => err.includes('nodeId') || err.includes('invalid')));
});

test('rejects operations with missing required payload keys', () => {
  // document.set_title missing title
  const setTitleOp = op('document.set_title', {});
  const result1 = validateCollaborationOperation(setTitleOp);
  assert.equal(result1.valid, false);
  assert.ok(result1.errors.some(err => err.includes('payload') || err.includes('title')));
  
  // node.insert missing node
  const insertOp1 = op('node.insert', {
    parentId: 'section-1',
    afterNodeId: 'heading-1'
  });
  const result2 = validateCollaborationOperation(insertOp1);
  assert.equal(result2.valid, false);
  assert.ok(result2.errors.some(err => err.includes('payload') || err.includes('invalid')));
  
  // node.delete missing nodeId
  const deleteOp = op('node.delete', {});
  const result3 = validateCollaborationOperation(deleteOp);
  assert.equal(result3.valid, false);
  assert.ok(result3.errors.some(err => err.includes('nodeId') || err.includes('invalid')));
  
  // text.insert missing text
  const textInsertOp = op('text.insert', {
    nodeId: 'text-1',
    key: 'text',
    offset: 0
  });
  const result4 = validateCollaborationOperation(textInsertOp);
  assert.equal(result4.valid, false);
  assert.ok(result4.errors.some(err => err.includes('nodeId') || err.includes('invalid') || err.includes('text')));
});

test('validates that transformed operations preserve exact key sets', () => {
  // Verify that transformation doesn't introduce or remove keys
  const validOp = op('document.set_title', { title: 'Test Title' });
  const transformed = transformCollaborationOperation(validOp, []);
  
  // Transformed operation should still validate
  const result = validateCollaborationOperation(transformed);
  assert.equal(result.valid, true);
  
  // Transformed operation should have exactly the same envelope keys
  const expectedKeys = ['schemaVersion', 'opId', 'clientId', 'baseSequence', 'type', 'payload'];
  const actualKeys = Object.keys(transformed);
  assert.equal(actualKeys.length, expectedKeys.length);
  assert.ok(expectedKeys.every(key => actualKeys.includes(key)));
});
