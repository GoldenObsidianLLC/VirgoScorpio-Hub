'use strict';

const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Pool } = require('pg');
const { loadEnvFile } = require('../../scripts/load-env');
const { createPostgresStore } = require('../../packages/db/src/postgres-store');
const { createRedisApiInstance, initialDocument } = require('../fixtures/collaboration-multinode');
const {
  connectCollaborationClient,
  sendCollaborationCommand,
  waitForCollaborationMessage,
  waitForAnyCollaborationMessage,
  readCollaborativeDocument
} = require('../fixtures/collaboration-client');

loadEnvFile(path.resolve(__dirname, '../../.env'));

function isDedicatedLoopbackDatabaseUrl(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  try {
    const url = new URL(raw);
    const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())
      && /(?:[_-])test$/i.test(databaseName);
  } catch {
    return false;
  }
}

function isCredentialFreeLoopbackRedisUrl(raw) {
  if (typeof raw !== 'string' || !raw) return false;
  try {
    const url = new URL(raw);
    return ['redis:', 'rediss:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase())
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

const databaseUrl = process.env.TEST_DATABASE_URL || '';
const redisUrl = process.env.VIRGOSCORPIO_HUB_TEST_REDIS_URL || '';
const integrationEnabled = process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
  && isDedicatedLoopbackDatabaseUrl(databaseUrl)
  && isCredentialFreeLoopbackRedisUrl(redisUrl);

if (process.env.CI === 'true' && !integrationEnabled) {
  throw new Error(
    'F1.13 CI qualification requires an explicit loopback TEST_DATABASE_URL ending in _test/-test, '
    + 'VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION=true, and a credential-free loopback '
    + 'VIRGOSCORPIO_HUB_TEST_REDIS_URL.'
  );
}

const SITE_MEMBERSHIP_CAPABILITIES = Object.freeze(['content:read', 'content:edit']);

function createDatabaseBackedTestIdentityService({ sessions }) {
  const sessionsByToken = new Map(sessions.map(session => [session.token, session]));
  const sessionsById = new Map(sessions.map(session => [session.sessionId, session]));

  return {
    async authenticate(token) {
      const session = sessionsByToken.get(token);
      if (!session) return null;
      return {
        sessionId: session.sessionId,
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        user: {
          id: session.userId,
          email: session.email,
          displayName: 'F1.13 PostgreSQL Browser Editor',
          status: 'active'
        },
        memberships: session.siteIds.map(siteId => ({
          siteId,
          capabilities: SITE_MEMBERSHIP_CAPABILITIES
        }))
      };
    },
    async isSessionActive({ userId, sessionId }) {
      const session = sessionsById.get(sessionId);
      return Boolean(session && session.userId === userId);
    },
    async authorizeSite(userId, siteId, capability) {
      return sessions.some(session => session.userId === userId
        && session.siteIds.includes(siteId)
        && SITE_MEMBERSHIP_CAPABILITIES.includes(capability));
    }
  };
}

function createTitleOperation({ clientId, title, baseSequence }) {
  return {
    schemaVersion: 1,
    opId: randomUUID(),
    clientId,
    baseSequence,
    type: 'document.set_title',
    payload: { title }
  };
}

async function openPostgresClient(browser, {
  baseUrl,
  siteId,
  contentId,
  sessionNumber,
  clientId,
  document,
  afterSequence = 0
}) {
  const context = await browser.newContext();
  try {
    const token = 'f1-13-session-' + sessionNumber;
    await context.addCookies([{
      name: 'vsh_session',
      value: token,
      url: baseUrl,
      httpOnly: true,
      sameSite: 'Lax'
    }]);
    const page = await context.newPage();
    const joined = await connectCollaborationClient(page, {
      baseUrl,
      siteId,
      contentId,
      clientId,
      initialDocument: document,
      afterSequence
    });
    return { context, page, joined, siteId, contentId, sessionNumber, clientId };
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }
}

async function closeClients(clients) {
  for (const client of clients) {
    await client.page.evaluate(() => window.__virgoscorpio_hubCollaboration?.close()).catch(() => {});
    await client.context.close().catch(() => {});
  }
}

async function createSite(pool, label) {
  const result = await pool.query(
    'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
    ['f1-13-' + label + '-' + randomUUID().slice(0, 12), 'F1.13 ' + label]
  );
  return result.rows[0].id;
}

async function createUser(pool, label) {
  const email = 'f1-13-' + label + '-' + randomUUID() + '@example.test';
  const result = await pool.query(
    'INSERT INTO users(email,display_name) VALUES($1,$2) RETURNING id',
    [email, 'F1.13 ' + label]
  );
  return { id: result.rows[0].id, email };
}

function initialDraftDocument(contentId, title) {
  const document = initialDocument(contentId);
  document.title = title;
  document.children[0].children[0].props.text = title;
  return document;
}

async function createDraft(store, { siteId, authorId, title }) {
  const document = initialDraftDocument(randomUUID(), title);
  return store.saveDraft({
    siteId,
    title: document.title,
    slug: 'f1-13-' + randomUUID().slice(0, 16),
    locale: 'en',
    contentType: 'page',
    document,
    authorId,
    note: 'F1.13 PostgreSQL multi-node browser fixture'
  });
}

test('two browser clients on independent API nodes converge from shared PostgreSQL history', async ({ browser }) => {
  test.skip(!integrationEnabled, 'Requires the explicit dedicated PostgreSQL and loopback Redis integration environment.');
  test.setTimeout(90_000);

  const fixturePool = new Pool({
    connectionString: databaseUrl,
    max: 2,
    connectionTimeoutMillis: 4_000
  });
  const poolA = new Pool({
    connectionString: databaseUrl,
    max: 4,
    connectionTimeoutMillis: 4_000
  });
  const poolB = new Pool({
    connectionString: databaseUrl,
    max: 4,
    connectionTimeoutMillis: 4_000
  });
  const storeA = createPostgresStore({ pool: poolA });
  const storeB = createPostgresStore({ pool: poolB });

  let siteA;
  let siteB;
  const userIds = [];
  let nodeA;
  let nodeB;
  let poolAClosed = false;
  const clients = [];

  try {
    siteA = await createSite(fixturePool, 'site-a');
    siteB = await createSite(fixturePool, 'site-b');
    const authorA = await createUser(fixturePool, 'author-a');
    userIds.push(authorA.id);
    const editorB = await createUser(fixturePool, 'editor-b');
    userIds.push(editorB.id);
    const editorOtherDocument = await createUser(fixturePool, 'editor-other-document');
    userIds.push(editorOtherDocument.id);
    const editorOtherSite = await createUser(fixturePool, 'editor-other-site');
    userIds.push(editorOtherSite.id);

    const primaryDraft = await createDraft(storeA, {
      siteId: siteA,
      authorId: authorA.id,
      title: 'F1.13 shared PostgreSQL draft'
    });
    const otherDocument = await createDraft(storeA, {
      siteId: siteA,
      authorId: authorA.id,
      title: 'F1.13 isolated document'
    });
    const otherSiteDraft = await createDraft(storeA, {
      siteId: siteB,
      authorId: editorOtherSite.id,
      title: 'F1.13 isolated site'
    });
    const primaryDocument = (await storeB.getById({ siteId: siteA, id: primaryDraft.id })).body;
    const otherDocumentBody = (await storeB.getById({ siteId: siteA, id: otherDocument.id })).body;
    const otherSiteDocument = (await storeB.getById({ siteId: siteB, id: otherSiteDraft.id })).body;

    const sessions = [
      { token: 'f1-13-session-1', sessionId: randomUUID(), userId: authorA.id, email: authorA.email, siteIds: [siteA] },
      { token: 'f1-13-session-2', sessionId: randomUUID(), userId: editorB.id, email: editorB.email, siteIds: [siteA] },
      { token: 'f1-13-session-3', sessionId: randomUUID(), userId: editorOtherDocument.id, email: editorOtherDocument.email, siteIds: [siteA] },
      { token: 'f1-13-session-4', sessionId: randomUUID(), userId: editorOtherSite.id, email: editorOtherSite.email, siteIds: [siteB] }
    ];
    const identityService = createDatabaseBackedTestIdentityService({ sessions });
    const channelPrefix = 'virgoscorpio_hub:test:f1-13:' + randomUUID();

    nodeA = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeA,
      identityService,
      heartbeatMs: 5_000
    });
    nodeB = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeB,
      identityService,
      heartbeatMs: 5_000
    });

    expect(nodeA.server.virgoScorpioHub.contentStore).toBe(storeA);
    expect(nodeB.server.virgoScorpioHub.contentStore).toBe(storeB);
    expect(nodeA.server.virgoScorpioHub.contentStore).not.toBe(nodeB.server.virgoScorpioHub.contentStore);

    const clientA = await openPostgresClient(browser, {
      baseUrl: nodeA.baseUrl,
      siteId: siteA,
      contentId: primaryDraft.id,
      sessionNumber: 1,
      clientId: 'postgres-editor-a',
      document: primaryDocument
    });
    clients.push(clientA);
    const clientB = await openPostgresClient(browser, {
      baseUrl: nodeB.baseUrl,
      siteId: siteA,
      contentId: primaryDraft.id,
      sessionNumber: 2,
      clientId: 'postgres-editor-b',
      document: primaryDocument
    });
    clients.push(clientB);
    const isolatedDocumentClient = await openPostgresClient(browser, {
      baseUrl: nodeB.baseUrl,
      siteId: siteA,
      contentId: otherDocument.id,
      sessionNumber: 3,
      clientId: 'postgres-other-document',
      document: otherDocumentBody
    });
    clients.push(isolatedDocumentClient);
    const isolatedSiteClient = await openPostgresClient(browser, {
      baseUrl: nodeB.baseUrl,
      siteId: siteB,
      contentId: otherSiteDraft.id,
      sessionNumber: 4,
      clientId: 'postgres-other-site',
      document: otherSiteDocument
    });
    clients.push(isolatedSiteClient);

    expect(clientA.joined.sequence).toBe(0);
    expect(clientB.joined.sequence).toBe(0);

    const firstOperation = createTitleOperation({
      clientId: clientA.clientId,
      baseSequence: 0,
      title: 'Committed through PostgreSQL node A'
    });
    await sendCollaborationCommand(clientA.page, {
      type: 'document.operation',
      contentId: primaryDraft.id,
      operation: firstOperation
    });
    const firstAck = await waitForCollaborationMessage(clientA.page, 'document.operation.ack');
    expect(firstAck.sequence).toBe(1);
    expect(firstAck.fanoutDegraded).toBe(false);

    const firstDelivery = await waitForAnyCollaborationMessage(clientB.page);
    expect(firstDelivery.sequence).toBe(1);
    expect(firstDelivery.operation.payload.title).toBe('Committed through PostgreSQL node A');

    const durableFirst = await storeB.getCollaborationSync({
      siteId: siteA,
      contentId: primaryDraft.id,
      afterSequence: 0
    });
    expect(durableFirst.reloadRequired).toBe(false);
    expect(durableFirst.sequence).toBe(1);
    expect(durableFirst.operations).toHaveLength(1);
    expect(durableFirst.operations[0].operation.payload.title).toBe('Committed through PostgreSQL node A');

    const databaseFirst = await poolB.query(
      'SELECT sequence FROM content_collaboration_documents WHERE content_id=$1',
      [primaryDraft.id]
    );
    expect(Number(databaseFirst.rows[0]?.sequence)).toBe(1);

    await expect(async () => waitForAnyCollaborationMessage(isolatedDocumentClient.page, 250)).rejects.toThrow(/Timed out/);
    await expect(async () => waitForAnyCollaborationMessage(isolatedSiteClient.page, 250)).rejects.toThrow(/Timed out/);

    nodeA.dropNextDocumentRelay();
    const droppedHintOperation = createTitleOperation({
      clientId: clientA.clientId,
      baseSequence: 1,
      title: 'Recovered from PostgreSQL after dropped Redis hint'
    });
    await sendCollaborationCommand(clientA.page, {
      type: 'document.operation',
      contentId: primaryDraft.id,
      operation: droppedHintOperation
    });
    const degradedAck = await waitForCollaborationMessage(clientA.page, 'document.operation.ack');
    expect(degradedAck.sequence).toBe(2);
    expect(degradedAck.fanoutDegraded).toBe(true);

    await expect(async () => waitForAnyCollaborationMessage(clientB.page, 350)).rejects.toThrow(/Timed out/);
    const repairedDelivery = await waitForCollaborationMessage(
      clientB.page,
      'document.sync.operation',
      12_000
    );
    expect(repairedDelivery.sequence).toBe(2);
    expect(repairedDelivery.operation.payload.title).toBe('Recovered from PostgreSQL after dropped Redis hint');

    const durableAfterRepair = await storeB.getCollaborationSync({
      siteId: siteA,
      contentId: primaryDraft.id,
      afterSequence: 0
    });
    expect(durableAfterRepair.sequence).toBe(2);
    expect(durableAfterRepair.operations.map(item => item.sequence)).toEqual([1, 2]);

    const persistedRows = await poolB.query(
      'SELECT count(*)::int AS count,min(sequence)::int AS min,max(sequence)::int AS max FROM content_collaboration_operations WHERE content_id=$1',
      [primaryDraft.id]
    );
    expect(persistedRows.rows[0]).toEqual({ count: 2, min: 1, max: 2 });

    await nodeA.close();
    nodeA = null;
    await poolA.end();
    poolAClosed = true;

    const reconnected = await openPostgresClient(browser, {
      baseUrl: nodeB.baseUrl,
      siteId: siteA,
      contentId: primaryDraft.id,
      sessionNumber: 1,
      clientId: 'postgres-editor-a-reconnected',
      document: primaryDocument,
      afterSequence: 0
    });
    clients.push(reconnected);
    expect(reconnected.joined.sequence).toBe(2);
    const replayed = [];
    replayed.push(await waitForAnyCollaborationMessage(reconnected.page));
    replayed.push(await waitForAnyCollaborationMessage(reconnected.page));
    expect(replayed.map(message => message.sequence)).toEqual([1, 2]);
    expect((await readCollaborativeDocument(reconnected.page)).title)
      .toBe('Recovered from PostgreSQL after dropped Redis hint');

    const operationAfterFailover = createTitleOperation({
      clientId: reconnected.clientId,
      baseSequence: 2,
      title: 'Write committed after node A loss'
    });
    await sendCollaborationCommand(reconnected.page, {
      type: 'document.operation',
      contentId: primaryDraft.id,
      operation: operationAfterFailover
    });
    const failoverAck = await waitForCollaborationMessage(reconnected.page, 'document.operation.ack');
    expect(failoverAck.sequence).toBe(3);
    const peerDelivery = await waitForAnyCollaborationMessage(clientB.page);
    expect(peerDelivery.sequence).toBe(3);
    expect(peerDelivery.operation.payload.title).toBe('Write committed after node A loss');

    const finalSync = await storeB.getCollaborationSync({
      siteId: siteA,
      contentId: primaryDraft.id,
      afterSequence: 0
    });
    expect(finalSync.sequence).toBe(3);
    expect(finalSync.operations.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect((await storeB.getById({ siteId: siteA, id: primaryDraft.id })).body.title)
      .toBe('Write committed after node A loss');

    const isolatedSiteSync = await storeB.getCollaborationSync({
      siteId: siteB,
      contentId: otherSiteDraft.id,
      afterSequence: 0
    });
    expect(isolatedSiteSync.sequence).toBe(0);
    await expect(async () => waitForAnyCollaborationMessage(isolatedDocumentClient.page, 250)).rejects.toThrow(/Timed out/);
    await expect(async () => waitForAnyCollaborationMessage(isolatedSiteClient.page, 250)).rejects.toThrow(/Timed out/);
  } finally {
    await closeClients(clients);
    await nodeA?.close().catch(() => {});
    await nodeB?.close().catch(() => {});
    await Promise.all([
      poolAClosed ? Promise.resolve() : poolA.end().catch(() => {}),
      poolB.end().catch(() => {})
    ]);
    if (siteA || siteB) {
      await fixturePool.query(
        'DELETE FROM sites WHERE id=ANY($1::uuid[])',
        [[siteA, siteB].filter(Boolean)]
      ).catch(() => {});
    }
    if (userIds.length) {
      await fixturePool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
    }
    await fixturePool.end();
  }
});
