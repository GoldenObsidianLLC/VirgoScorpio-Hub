'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const CONTENT_ID = '33333333-3333-4333-8333-333333333333';

test('page draft route writes one correlated audit through the store transaction callback', async () => {
  const transactionClient = { query: async () => ({ rows: [] }) };
  const auditCalls = [];
  let storeReturned = false;
  let storeInput;
  const identityService = {
    async authenticate(token) {
      if (token !== 'draft-audit-session') return null;
      return {
        sessionId: 'draft-audit-session',
        user: { id: ACTOR_ID, email: 'owner@example.test', displayName: 'Owner', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'draft-site', siteName: 'Draft Site', role: 'owner', roles: ['owner'], capabilities: ['*'] }],
      };
    },
    async authorizeSite(userId, siteId) { return userId === ACTOR_ID && siteId === SITE_ID; },
    async audit(event, options = {}) {
      assert.equal(storeReturned, false, 'audit must be awaited inside saveDraft before it returns');
      auditCalls.push({ event, queryable: options.queryable });
    },
  };
  const contentStore = {
    async saveDraft(input) {
      storeInput = input;
      assert.equal(typeof input.onDraftSaved, 'function', 'route must provide the transaction callback for an authenticated actor');
      const result = { id: CONTENT_ID, site_id: SITE_ID, title: 'Atomic Draft', slug: 'atomic-draft', locale: 'en', content_type: 'page', status: 'draft', version: 3, lock_version: 9, published_version: null };
      await input.onDraftSaved({ queryable: transactionClient, result, previous: null });
      storeReturned = true;
      return result;
    },
  };
  const server = createApiServer({
    env: { NODE_ENV: 'test', AI_PROVIDER: 'mock', MAX_REQUEST_BYTES: '16384' },
    logger: { error() {} },
    identityService,
    contentStore,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/drafts', {
      method: 'POST',
      headers: {
        authorization: 'Bearer draft-audit-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ document: { schemaVersion: 1, documentId: 'draft-audit-test', type: 'page', title: 'Atomic Draft', children: [] } }),
    });
    const payload = await response.json();
    assert.equal(response.status, 201);
    assert.equal(payload.status, 'draft');
    assert.equal(payload.persisted, true);
    assert.equal(payload.content.id, CONTENT_ID);
    assert.equal(auditCalls.length, 1, 'route must write one and only one audit event');
    assert.equal(auditCalls[0].queryable, transactionClient);
    assert.deepEqual(auditCalls[0].event, {
      siteId: SITE_ID, actorId: ACTOR_ID, action: 'content.draft_saved', targetType: 'content',
      targetId: CONTENT_ID, requestId: payload.requestId, details: { version: 3 },
    });
    assert.equal(storeInput.correlationId, payload.requestId);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page draft route keeps unauthenticated developer-token audit behavior optional', async () => {
  const devToken = 'draft-audit-developer-token';
  let saveInput;
  const contentStore = {
    async saveDraft(input) {
      saveInput = input;
      return { id: CONTENT_ID, site_id: SITE_ID, title: 'Developer Draft', slug: 'developer-draft', locale: 'en', content_type: 'page', status: 'draft', version: 1, lock_version: 1, published_version: null };
    },
  };
  const server = createApiServer({
    env: { NODE_ENV: 'test', VIRGOSCORPIO_HUB_API_TOKEN: devToken, VIRGOSCORPIO_HUB_DEFAULT_SITE_ID: SITE_ID, AI_PROVIDER: 'mock', MAX_REQUEST_BYTES: '16384' },
    logger: { error() {} },
    contentStore,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/drafts', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + devToken, 'content-type': 'application/json' },
      body: JSON.stringify({ document: { schemaVersion: 1, documentId: 'developer-draft-test', type: 'page', title: 'Developer Draft', children: [] } }),
    });
    assert.equal(response.status, 201);
    assert.equal(Object.hasOwn(saveInput, 'onDraftSaved'), true);
    assert.equal(saveInput.onDraftSaved, undefined, 'developer token has no persisted actor audit callback');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});
