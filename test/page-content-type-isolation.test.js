'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const PAGE_ID = '33333333-3333-4333-8333-333333333333';
const CUSTOM_RECORD_ID = '44444444-4444-4444-8444-444444444444';

/**
 * Security test suite: Page endpoints must reject custom records
 * 
 * Pentest finding: Page draft and workflow handlers did not enforce the target content type.
 * Custom records share the content_items table with pages but use a custom slug as content_type.
 * Before the fix, page endpoints could be used to convert custom records into pages, bypassing
 * custom record validation and publication policies.
 * 
 * This test suite verifies that all page endpoints now properly check content_type='page'
 * and reject custom records with 404 errors.
 */

test('page draft save rejects custom record by UUID with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'editor-session') return null;
      return {
        sessionId: 'editor-session',
        user: { id: ACTOR_ID, email: 'editor@example.test', displayName: 'Editor', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'editor', roles: ['editor'], capabilities: ['content:edit'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:edit';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      // Return a custom record (not a page)
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'product', // Custom content type, not 'page'
        status: 'draft',
        title: 'Custom Product Record',
        slug: 'custom-product',
        locale: 'en',
        body: { schemaVersion: 1, documentType: 'custom:product', fields: { name: 'Widget', price: 99.99 } },
      };
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
        authorization: 'Bearer editor-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: CUSTOM_RECORD_ID, // Attempting to update a custom record via page endpoint
        document: {
          schemaVersion: 1,
          documentId: 'malicious-page',
          type: 'page',
          title: 'Converted Page',
          children: [],
        },
      }),
    });
    const payload = await response.json();
    // Security assertion: Must reject with 404, not allow the conversion
    assert.equal(response.status, 404, 'Page draft endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
    assert.match(payload.error, /page not found/i);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page detail GET rejects custom record with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'reader-session') return null;
      return {
        sessionId: 'reader-session',
        user: { id: ACTOR_ID, email: 'reader@example.test', displayName: 'Reader', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'member', roles: ['member'], capabilities: ['content:read'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:read';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      // Return a custom record
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'article', // Custom content type
        status: 'published',
        title: 'Custom Article',
        slug: 'custom-article',
        locale: 'en',
        body: { schemaVersion: 1, documentType: 'custom:article', fields: { summary: 'Test article' } },
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID, {
      method: 'GET',
      headers: {
        authorization: 'Bearer reader-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
      },
    });
    const payload = await response.json();
    // Security assertion: Must not expose custom record through page endpoint
    assert.equal(response.status, 404, 'Page detail endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page revisions list rejects custom record with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'reader-session') return null;
      return {
        sessionId: 'reader-session',
        user: { id: ACTOR_ID, email: 'reader@example.test', displayName: 'Reader', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'member', roles: ['member'], capabilities: ['content:read'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:read';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'event', // Custom content type
        status: 'draft',
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID + '/revisions', {
      method: 'GET',
      headers: {
        authorization: 'Bearer reader-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
      },
    });
    const payload = await response.json();
    // Security assertion: Must not list revisions for custom records
    assert.equal(response.status, 404, 'Page revisions endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page revision restore rejects custom record with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'editor-session') return null;
      return {
        sessionId: 'editor-session',
        user: { id: ACTOR_ID, email: 'editor@example.test', displayName: 'Editor', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'editor', roles: ['editor'], capabilities: ['content:edit'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:edit';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'faq', // Custom content type
        status: 'draft',
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID + '/restore/1', {
      method: 'POST',
      headers: {
        authorization: 'Bearer editor-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    const payload = await response.json();
    // Security assertion: Must not restore custom records as pages
    assert.equal(response.status, 404, 'Page restore endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page workflow submit-review rejects custom record with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'editor-session') return null;
      return {
        sessionId: 'editor-session',
        user: { id: ACTOR_ID, email: 'editor@example.test', displayName: 'Editor', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'editor', roles: ['editor'], capabilities: ['content:submit-review'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:submit-review';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'testimonial', // Custom content type
        status: 'draft',
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID + '/submit-review', {
      method: 'POST',
      headers: {
        authorization: 'Bearer editor-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ note: 'Ready for review' }),
    });
    const payload = await response.json();
    // Security assertion: Must not allow workflow transitions on custom records via page endpoint
    assert.equal(response.status, 404, 'Page workflow endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page workflow publish via /api/v1/pages/ rejects custom record with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'publisher-session') return null;
      return {
        sessionId: 'publisher-session',
        user: { id: ACTOR_ID, email: 'publisher@example.test', displayName: 'Publisher', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'publisher', roles: ['publisher'], capabilities: ['content:publish'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:publish';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'portfolio', // Custom content type
        status: 'in-review',
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID + '/publish', {
      method: 'POST',
      headers: {
        authorization: 'Bearer publisher-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ note: 'Publishing now' }),
    });
    const payload = await response.json();
    // Security assertion: Must not publish custom records via page-scoped workflow endpoint
    assert.equal(response.status, 404, 'Page-scoped publish endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page workflow approve via /api/v1/pages/ rejects custom record with 404', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'approver-session') return null;
      return {
        sessionId: 'approver-session',
        user: { id: ACTOR_ID, email: 'approver@example.test', displayName: 'Approver', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'approver', roles: ['approver'], capabilities: ['content:approve'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:approve';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'case-study', // Custom content type
        status: 'in-review',
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID + '/approve', {
      method: 'POST',
      headers: {
        authorization: 'Bearer approver-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ note: 'Approved' }),
    });
    const payload = await response.json();
    // Security assertion: Must not approve custom records via page-scoped workflow endpoint
    assert.equal(response.status, 404, 'Page-scoped approve endpoint must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page endpoints accept actual page content without rejection', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'editor-session') return null;
      return {
        sessionId: 'editor-session',
        user: { id: ACTOR_ID, email: 'editor@example.test', displayName: 'Editor', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'editor', roles: ['editor'], capabilities: ['content:edit', 'content:read'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId === ACTOR_ID && siteId === SITE_ID && ['content:edit', 'content:read'].includes(capability);
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, PAGE_ID);
      // Return an actual page (content_type='page')
      return {
        id: PAGE_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'page', // Correct content type
        status: 'draft',
        title: 'Valid Page',
        slug: 'valid-page',
        locale: 'en',
        version: 1,
        body: { schemaVersion: 1, documentId: 'valid-page', type: 'page', title: 'Valid Page', children: [] },
      };
    },
    async saveDraft(input) {
      assert.equal(input.siteId, SITE_ID);
      assert.equal(input.id, PAGE_ID);
      assert.equal(input.contentType, 'page');
      return {
        id: PAGE_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'page',
        status: 'draft',
        title: input.title,
        slug: input.slug,
        locale: input.locale,
        version: 2,
        lock_version: 2,
        body: input.document,
      };
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
    // Test 1: Page draft save should succeed for actual pages
    const draftResponse = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/drafts', {
      method: 'POST',
      headers: {
        authorization: 'Bearer editor-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: PAGE_ID,
        document: {
          schemaVersion: 1,
          documentId: 'valid-page',
          type: 'page',
          title: 'Updated Page',
          children: [],
        },
      }),
    });
    const draftPayload = await draftResponse.json();
    assert.equal(draftResponse.status, 201, 'Page draft save should succeed for actual pages');
    assert.equal(draftPayload.status, 'draft');
    assert.equal(draftPayload.content.content_type, 'page');

    // Test 2: Page detail GET should succeed for actual pages
    const detailResponse = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + PAGE_ID, {
      method: 'GET',
      headers: {
        authorization: 'Bearer editor-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
      },
    });
    const detailPayload = await detailResponse.json();
    assert.equal(detailResponse.status, 200, 'Page detail GET should succeed for actual pages');
    assert.equal(detailPayload.content.id, PAGE_ID);
    assert.equal(detailPayload.content.content_type, 'page');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('page detail GET with own-only permission rejects custom record', async () => {
  const identityService = {
    async authenticate(token) {
      if (token !== 'owner-session') return null;
      return {
        sessionId: 'owner-session',
        user: { id: ACTOR_ID, email: 'owner@example.test', displayName: 'Owner', status: 'active' },
        memberships: [{ siteId: SITE_ID, siteSlug: 'test-site', siteName: 'Test Site', role: 'contributor', roles: ['contributor'], capabilities: ['content:read:own'] }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      // Only has own-only read permission
      return userId === ACTOR_ID && siteId === SITE_ID && capability === 'content:read:own';
    },
  };
  const contentStore = {
    async getById({ siteId, id }) {
      assert.equal(siteId, SITE_ID);
      assert.equal(id, CUSTOM_RECORD_ID);
      return {
        id: CUSTOM_RECORD_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID, // Owned by the actor
        content_type: 'blog-post', // Custom content type
        status: 'draft',
      };
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
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/pages/' + CUSTOM_RECORD_ID, {
      method: 'GET',
      headers: {
        authorization: 'Bearer owner-session',
        'x-virgoscorpio-hub-site-id': SITE_ID,
      },
    });
    const payload = await response.json();
    // Security assertion: Even with own-only permission, must not expose custom records via page endpoint
    assert.equal(response.status, 404, 'Page detail with own-only permission must reject custom records');
    assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});
