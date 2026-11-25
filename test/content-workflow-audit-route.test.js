'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApiServer } = require('../apps/api/src/server');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const CONTENT_ID = '33333333-3333-4333-8333-333333333333';

test('all editorial workflow routes hand audit persistence to their store transaction callback', async () => {
  const transactionClient = { query: async () => ({ rows: [] }) };
  const storeCalls = [];
  const audits = [];
  const identityService = {
    async authenticate(token) {
      if (token !== 'workflow-audit-session') return null;
      return {
        sessionId: 'workflow-audit-session',
        user: { id: ACTOR_ID, email: 'owner@example.test', displayName: 'Owner', status: 'active' },
        memberships: [{
          siteId: SITE_ID,
          siteSlug: 'workflow-site',
          siteName: 'Workflow Site',
          role: 'owner',
          roles: ['owner'],
          capabilities: ['*'],
        }],
      };
    },
    async authorizeSite(userId, siteId) {
      return userId === ACTOR_ID && siteId === SITE_ID;
    },
    async audit(event, options = {}) {
      audits.push({ event, queryable: options.queryable });
    },
  };

  const createTransitionMethod = (method, status) => async input => {
    storeCalls.push({ method, input });
    const result = { id: input.id, site_id: SITE_ID, status, version: 1, lock_version: 2 };
    assert.equal(typeof input.onTransition, 'function', method + ' must receive an audit callback');
    await input.onTransition({ queryable: transactionClient, result, previous: { status: 'fixture' }, action: method });
    return result;
  };

  const contentStore = {
    async getById({ siteId, id }) {
      if (siteId !== SITE_ID || id !== CONTENT_ID) return null;
      return { id: CONTENT_ID, site_id: SITE_ID, created_by: ACTOR_ID, content_type: 'page', status: 'draft', version: 1 };
    },
    submitForReview: createTransitionMethod('submitForReview', 'in_review'),
    approve: createTransitionMethod('approve', 'approved'),
    rejectReview: createTransitionMethod('rejectReview', 'draft'),
    publishContent: createTransitionMethod('publishContent', 'published'),
    scheduleContent: createTransitionMethod('scheduleContent', 'scheduled'),
    archiveContent: createTransitionMethod('archiveContent', 'archived'),
    unpublishContent: createTransitionMethod('unpublishContent', 'draft'),
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
    const base = 'http://127.0.0.1:' + server.address().port;
    const scenarios = [
      ['submit-review', 'submitForReview'],
      ['approve', 'approve'],
      ['reject', 'rejectReview'],
      ['publish', 'publishContent'],
      ['schedule', 'scheduleContent'],
      ['archive', 'archiveContent'],
      ['unpublish', 'unpublishContent'],
    ];

    for (const [routeAction, storeMethod] of scenarios) {
      const body = { expectedVersion: 1, note: 'F1.34 route callback contract' };
      if (routeAction === 'schedule') body.scheduledAt = new Date(Date.now() + 5 * 60_000).toISOString();
      const response = await fetch(base + '/api/v1/pages/' + CONTENT_ID + '/' + routeAction, {
        method: 'POST',
        headers: {
          authorization: 'Bearer workflow-audit-session',
          'x-virgoscorpio-hub-site-id': SITE_ID,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200, routeAction + ' route should retain its success contract');
      const payload = await response.json();
      assert.ok(payload.content);
      assert.equal(payload.requestId, audits.at(-1).event.requestId);
      assert.equal(audits.at(-1).event.action, 'content.' + routeAction);
      assert.equal(audits.at(-1).event.siteId, SITE_ID);
      assert.equal(audits.at(-1).event.actorId, ACTOR_ID);
      assert.equal(audits.at(-1).event.targetType, 'content');
      assert.equal(audits.at(-1).event.targetId, CONTENT_ID);
      assert.equal(audits.at(-1).queryable, transactionClient);
      assert.equal(storeCalls.at(-1).method, storeMethod);
      assert.equal(storeCalls.at(-1).input.correlationId, audits.at(-1).event.requestId);
    }

    assert.equal(storeCalls.length, scenarios.length);
    assert.equal(audits.length, scenarios.length);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});

test('custom content workflow requires a separate reviewer and pins the content type into the transition', async () => {
  const reviewerId = '44444444-4444-4444-8444-444444444444';
  const storeCalls = [];
  const transactionClient = { query: async () => ({ rows: [] }) };
  const identityService = {
    async authenticate(token) {
      const userId = token === 'author-session' ? ACTOR_ID : token === 'reviewer-session' ? reviewerId : null;
      if (!userId) return null;
      return {
        sessionId: token,
        user: { id: userId, email: 'user@example.test', displayName: 'User', status: 'active' },
        memberships: [{
          siteId: SITE_ID,
          siteSlug: 'workflow-site',
          siteName: 'Workflow Site',
          role: 'editor',
          roles: ['editor'],
          capabilities: ['*'],
        }],
      };
    },
    async authorizeSite(userId, siteId, capability) {
      return userId !== null && siteId === SITE_ID && capability !== 'site:manage';
    },
    async audit() {},
  };
  const contentStore = {
    async getById({ siteId, id }) {
      if (siteId !== SITE_ID || id !== CONTENT_ID) return null;
      return {
        id: CONTENT_ID,
        site_id: SITE_ID,
        created_by: ACTOR_ID,
        content_type: 'article',
        status: 'in_review',
        version: 1,
      };
    },
    async approve(input) {
      storeCalls.push(input);
      const result = { id: CONTENT_ID, site_id: SITE_ID, status: 'approved', version: 1, lock_version: 2 };
      await input.onTransition({ queryable: transactionClient, result, previous: { status: 'in_review' }, action: 'approve' });
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
    const url = 'http://127.0.0.1:' + server.address().port + '/api/v1/content/' + CONTENT_ID + '/approve';
    const request = token => fetch(url, {
      method: 'POST',
      headers: {
        authorization: 'Bearer ' + token,
        'x-virgoscorpio-hub-site-id': SITE_ID,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ expectedVersion: 1 }),
    });

    const authorResponse = await request('author-session');
    assert.equal(authorResponse.status, 403, 'the author cannot approve their own review-required content');
    assert.equal(storeCalls.length, 0, 'a denied self-review must not reach the workflow transition');

    const reviewerResponse = await request('reviewer-session');
    assert.equal(reviewerResponse.status, 200, 'a different site-capable reviewer may approve the content');
    assert.equal(storeCalls.length, 1);
    assert.equal(storeCalls[0].expectedContentType, 'article', 'the locked transition must pin the type checked during authorization');
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await server.virgoScorpioHub.close().catch(() => {});
  }
});
