'use strict';

const { test, expect } = require('@playwright/test');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Pool } = require('pg');
const { loadEnvFile } = require('../../scripts/load-env');
const { createPostgresStore } = require('../../packages/db/src/postgres-store');
const { hashPassword } = require('../../packages/auth/src/service');
const { createRedisApiInstance, initialDocument } = require('../fixtures/collaboration-multinode');
const {
  validateRedisOutageTarget,
  inspectRedisOutageTarget,
  stopRedisOutageTarget,
  startRedisOutageTarget
} = require('../fixtures/redis-outage-container');
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
const outageAuthorizationEnabled = process.env.CI === 'true' &&
  process.env.VIRGOSCORPIO_HUB_RUN_REDIS_OUTAGE_AUTHORIZATION === 'true';
const outageTarget = outageAuthorizationEnabled
  ? validateRedisOutageTarget({
    redisUrl,
    containerId: process.env.VIRGOSCORPIO_HUB_TEST_REDIS_CONTAINER_ID
  })
  : null;

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
  afterSequence = 0,
  sessionToken = 'f1-13-session-' + sessionNumber
}) {
  const context = await browser.newContext();
  try {
    const token = sessionToken;
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

async function loginForSession(baseUrl, { email, password }) {
  const response = await fetch(baseUrl + '/api/v1/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  expect(response.status).toBe(200);
  const setCookieValues = response.headers.getSetCookie?.()
    || [response.headers.get('set-cookie') || ''];
  const sessionCookie = setCookieValues.find(value => value.startsWith('vsh_session='))
    || setCookieValues.find(value => value.includes('vsh_session='));
  expect(sessionCookie).toBeTruthy();
  const sessionCookieOffset = sessionCookie.indexOf('vsh_session=');
  return decodeURIComponent(
    sessionCookie.slice(sessionCookieOffset + 'vsh_session='.length).split(';', 1)[0].split(',', 1)[0]
  );
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

test('independent API nodes converge PostgreSQL collaboration and propagate real identity membership revocation', async ({ browser }) => {
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
  const authPool = new Pool({
    connectionString: databaseUrl,
    max: 3,
    connectionTimeoutMillis: 4_000
  });
  const storeA = createPostgresStore({ pool: poolA });
  const storeB = createPostgresStore({ pool: poolB });

  let siteA;
  let siteB;
  const userIds = [];
  let nodeA;
  let nodeB;
  let identityNode;
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
    const identityOwner = await createUser(fixturePool, 'f1-16-identity-owner');
    userIds.push(identityOwner.id);

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
    // Model separate API-node authorization snapshots. Node B deliberately stays stale
    // until Redis invalidation reaches its event hub, isolating the fan-out behavior.
    const sessionsForNodeA = sessions.map(session => ({ ...session, siteIds: [...session.siteIds] }));
    const sessionsForNodeB = sessions.map(session => ({ ...session, siteIds: [...session.siteIds] }));
    const identityServiceA = createDatabaseBackedTestIdentityService({ sessions: sessionsForNodeA });
    const identityServiceB = createDatabaseBackedTestIdentityService({ sessions: sessionsForNodeB });
    const channelPrefix = 'virgoscorpio_hub:test:f1-13:' + randomUUID();

    nodeA = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeA,
      identityService: identityServiceA,
      heartbeatMs: 5_000
    });
    nodeB = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeB,
      identityService: identityServiceB,
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

    // Drive the real identity-service membership-removal path on a separate API
    // node. The node B collaboration identity deliberately remains stale, so the
    // remote socket can close only when createApiServer's identity callback
    // publishes the committed membership change through its Redis bridge.
    const revocationProbe = isolatedDocumentClient;
    const identityRoles = await authPool.query(
      "SELECT id,slug FROM roles WHERE slug IN ('site-owner','editor')"
    );
    const roleIds = new Map(identityRoles.rows.map(row => [row.slug, row.id]));
    expect(roleIds.has('site-owner')).toBe(true);
    expect(roleIds.has('editor')).toBe(true);
    const ownerPassword = 'F1-16-Identity-Owner-Password-2026';
    await authPool.query(
      'UPDATE users SET password_hash=$1 WHERE id=$2',
      [await hashPassword(ownerPassword), identityOwner.id]
    );
    await authPool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($1,$4,$5)',
      [siteA, identityOwner.id, roleIds.get('site-owner'), editorOtherDocument.id, roleIds.get('editor')]
    );

    identityNode = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeA,
      pool: authPool,
      heartbeatMs: 5_000
    });
    const loginResponse = await fetch(identityNode.baseUrl + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: identityOwner.email, password: ownerPassword })
    });
    expect(loginResponse.status).toBe(200);
    const setCookieValues = loginResponse.headers.getSetCookie?.()
      || [loginResponse.headers.get('set-cookie') || ''];
    const sessionCookie = setCookieValues.find(value => value.startsWith('vsh_session='))
      || setCookieValues.find(value => value.includes('vsh_session='));
    expect(sessionCookie).toBeTruthy();
    const sessionCookieOffset = sessionCookie.indexOf('vsh_session=');
    const ownerSessionToken = decodeURIComponent(
      sessionCookie.slice(sessionCookieOffset + 'vsh_session='.length).split(';', 1)[0].split(',', 1)[0]
    );

    const membershipRemoval = await fetch(
      identityNode.baseUrl + '/api/v1/sites/' + siteA + '/members/' + editorOtherDocument.id,
      {
        method: 'DELETE',
        headers: { authorization: 'Bearer ' + ownerSessionToken }
      }
    );
    expect(membershipRemoval.status).toBe(200);
    expect((await membershipRemoval.json()).removed).toBe(true);
    expect(sessionsForNodeB.find(session => session.userId === editorOtherDocument.id).siteIds)
      .toContain(siteA);
    const removedMembership = await authPool.query(
      'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2',
      [siteA, editorOtherDocument.id]
    );
    expect(removedMembership.rowCount).toBe(0);
    await revocationProbe.page.waitForFunction(() => {
      const socket = window.__virgoscorpio_hubCollaboration?.socket;
      return socket?.readyState === WebSocket.CLOSED;
    }, null, { timeout: 7_500 });

    expect(await revocationProbe.page.evaluate(
      () => window.__virgoscorpio_hubCollaboration.socket.readyState
    )).toBe(3);
    expect(await clientB.page.evaluate(
      () => window.__virgoscorpio_hubCollaboration.socket.readyState
    )).toBe(1);
    expect(await isolatedSiteClient.page.evaluate(
      () => window.__virgoscorpio_hubCollaboration.socket.readyState
    )).toBe(1);

    await sendCollaborationCommand(isolatedSiteClient.page, { type: 'ping' });
    const unaffectedSitePong = await waitForCollaborationMessage(
      isolatedSiteClient.page,
      'pong',
      3_000
    );
    expect(unaffectedSitePong.type).toBe('pong');

    const primaryAfterRevocation = await storeB.getCollaborationSync({
      siteId: siteA,
      contentId: primaryDraft.id,
      afterSequence: 0
    });
    expect(primaryAfterRevocation.sequence).toBe(2);
    expect(primaryAfterRevocation.operations.map(item => item.sequence)).toEqual([1, 2]);

    const revokedDocumentSync = await storeB.getCollaborationSync({
      siteId: siteA,
      contentId: otherDocument.id,
      afterSequence: 0
    });
    expect(revokedDocumentSync.sequence).toBe(0);
    expect(revokedDocumentSync.operations).toEqual([]);

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
    await identityNode?.close().catch(() => {});
    await Promise.all([
      poolAClosed ? Promise.resolve() : poolA.end().catch(() => {}),
      poolB.end().catch(() => {}),
      authPool.end().catch(() => {})
    ]);
    if (siteA || siteB) {
      await fixturePool.query(
        'DELETE FROM sites WHERE id=ANY($1::uuid[])',
        [[siteA, siteB].filter(Boolean)]
      ).catch(() => {});
    }
    if (userIds.length) {
      await fixturePool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [userIds]).catch(() => {});
      await fixturePool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
    }
    await fixturePool.end();
  }
});

for (const scenario of [
  { name: 'before accepting a command', heartbeatMs: 30_000, triggerCommand: true },
  { name: 'for an idle socket on the heartbeat during a real Redis outage', heartbeatMs: 5_000, triggerCommand: false, actualRedisOutage: true }
]) {
test(`WebSocket reauthorizes against PostgreSQL ${scenario.name} when Redis authorization invalidation is lost`, async ({ browser }) => {
  test.skip(!integrationEnabled, 'Requires the explicit dedicated PostgreSQL and loopback Redis integration environment.');
  test.skip(scenario.actualRedisOutage && !outageAuthorizationEnabled, 'Real Redis outage authorization fallback runs only in the dedicated disposable-service CI job.');
  test.setTimeout(scenario.actualRedisOutage ? 120_000 : 90_000);

  const fixturePool = new Pool({
    connectionString: databaseUrl,
    max: 3,
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
  let redisOutageStopped = false;
  const clients = [];

  try {
    siteA = await createSite(fixturePool, 'f1-20-outage-site-a');
    siteB = await createSite(fixturePool, 'f1-20-outage-site-b');
    const owner = await createUser(fixturePool, 'f1-20-outage-owner');
    userIds.push(owner.id);
    const revokedEditor = await createUser(fixturePool, 'f1-20-outage-revoked-editor');
    userIds.push(revokedEditor.id);
    const unaffectedEditor = await createUser(fixturePool, 'f1-20-outage-unaffected-editor');
    userIds.push(unaffectedEditor.id);

    const roleResult = await fixturePool.query(
      "SELECT id,slug FROM roles WHERE slug IN ('site-owner','editor')"
    );
    const roleIds = new Map(roleResult.rows.map(row => [row.slug, row.id]));
    expect(roleIds.has('site-owner')).toBe(true);
    expect(roleIds.has('editor')).toBe(true);

    const ownerPassword = 'F1-17-Owner-Password-2026';
    const revokedEditorPassword = 'F1-17-Revoked-Editor-Password-2026';
    const unaffectedEditorPassword = 'F1-17-Unaffected-Editor-Password-2026';
    await fixturePool.query(
      'UPDATE users SET password_hash=CASE id WHEN $1 THEN $2 WHEN $3 THEN $4 WHEN $5 THEN $6 END WHERE id=ANY($7::uuid[])',
      [
        owner.id, await hashPassword(ownerPassword),
        revokedEditor.id, await hashPassword(revokedEditorPassword),
        unaffectedEditor.id, await hashPassword(unaffectedEditorPassword),
        [owner.id, revokedEditor.id, unaffectedEditor.id]
      ]
    );
    await fixturePool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($1,$4,$5),($6,$7,$5)',
      [
        siteA, owner.id, roleIds.get('site-owner'),
        revokedEditor.id, roleIds.get('editor'),
        siteB, unaffectedEditor.id
      ]
    );

    const siteADraft = await createDraft(storeA, {
      siteId: siteA,
      authorId: owner.id,
      title: 'F1.18 authorization-loss Site A draft'
    });
    const siteBDraft = await createDraft(storeA, {
      siteId: siteB,
      authorId: unaffectedEditor.id,
      title: 'F1.18 unaffected Site B draft'
    });
    const siteADocument = (await storeB.getById({ siteId: siteA, id: siteADraft.id })).body;
    const siteBDocument = (await storeB.getById({ siteId: siteB, id: siteBDraft.id })).body;
    const channelPrefix = 'virgoscorpio_hub:test:f1-18:' + randomUUID();

    // Both API nodes use their normal database-backed identity services. Node B
    // therefore rechecks authoritative membership state even if its Pub/Sub
    // authorization notification is intentionally lost by the test subscriber.
    nodeA = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeA,
      pool: poolA,
      heartbeatMs: scenario.heartbeatMs
    });
    nodeB = await createRedisApiInstance({
      redisUrl,
      channelPrefix,
      siteIds: [siteA, siteB],
      store: storeB,
      pool: poolB,
      heartbeatMs: scenario.heartbeatMs
    });

    const ownerToken = await loginForSession(nodeA.baseUrl, {
      email: owner.email,
      password: ownerPassword
    });
    const revokedEditorToken = await loginForSession(nodeB.baseUrl, {
      email: revokedEditor.email,
      password: revokedEditorPassword
    });
    const unaffectedEditorToken = await loginForSession(nodeB.baseUrl, {
      email: unaffectedEditor.email,
      password: unaffectedEditorPassword
    });

    const revokedClient = await openPostgresClient(browser, {
      baseUrl: nodeB.baseUrl,
      siteId: siteA,
      contentId: siteADraft.id,
      sessionNumber: 18,
      clientId: 'f1-18-revoked-editor',
      document: siteADocument,
      sessionToken: revokedEditorToken
    });
    clients.push(revokedClient);
    const unaffectedClient = await openPostgresClient(browser, {
      baseUrl: nodeB.baseUrl,
      siteId: siteB,
      contentId: siteBDraft.id,
      sessionNumber: 19,
      clientId: 'f1-18-unaffected-editor',
      document: siteBDocument,
      sessionToken: unaffectedEditorToken
    });
    clients.push(unaffectedClient);

    expect(revokedClient.joined.sequence).toBe(0);
    expect(unaffectedClient.joined.sequence).toBe(0);

    // Capture close notifications before any membership state is changed so
    // the idle-socket case cannot miss a heartbeat close racing the DB checks.
    await revokedClient.page.evaluate(() => {
      const socket = window.__virgoscorpio_hubCollaboration?.socket;
      if (!socket) throw new Error('Collaboration WebSocket is unavailable.');
      window.__f118AuthorizationClose = null;
      socket.addEventListener('close', event => {
        window.__f118AuthorizationClose = { code: event.code, reason: event.reason };
      }, { once: true });
    });

    if (scenario.actualRedisOutage) {
      // Stop only the exact full-ID Redis 7.4 service container approved by CI.
      // The database-backed membership change and heartbeat fallback continue
      // while cross-instance Pub/Sub is physically unavailable.
      expect(inspectRedisOutageTarget(outageTarget).running).toBe(true);
      redisOutageStopped = true;
      stopRedisOutageTarget(outageTarget);
      expect(inspectRedisOutageTarget(outageTarget).running).toBe(false);
    } else {
      // The companion scenario deterministically drops one authorization hint.
      nodeB.dropNextAuthorizationInvalidation();
    }

    const membershipRemoval = await fetch(
      nodeA.baseUrl + '/api/v1/sites/' + siteA + '/members/' + revokedEditor.id,
      {
        method: 'DELETE',
        headers: { authorization: 'Bearer ' + ownerToken }
      }
    );
    expect(membershipRemoval.status).toBe(200);
    expect((await membershipRemoval.json()).removed).toBe(true);
    if (scenario.actualRedisOutage) {
      expect(inspectRedisOutageTarget(outageTarget).running).toBe(false);
    } else {
      await expect.poll(() => nodeB.droppedAuthorizationInvalidations, { timeout: 5_000 }).toBe(1);
    }

    const removedMembership = await fixturePool.query(
      'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2',
      [siteA, revokedEditor.id]
    );
    expect(removedMembership.rowCount).toBe(0);

    if (scenario.triggerCommand) {
      await sendCollaborationCommand(revokedClient.page, {
        type: 'document.operation',
        contentId: siteADraft.id,
        operation: createTitleOperation({
          clientId: revokedClient.clientId,
          baseSequence: 0,
          title: 'This unauthorized operation must never persist'
        })
      });
    }

    // The idle case sends no application command after membership removal.
    // It must close solely because the next server heartbeat reauthorizes
    // the existing subscription against authoritative PostgreSQL membership.
    await expect.poll(
      () => revokedClient.page.evaluate(
        () => window.__virgoscorpio_hubCollaboration.socket.readyState
      ),
      { timeout: scenario.heartbeatMs * 2 + 2_000, intervals: [100, 250, 500] }
    ).toBe(3);
    const closeEvent = await revokedClient.page.evaluate(() => window.__f118AuthorizationClose);
    expect(closeEvent.code).toBe(1008);

    expect(await unaffectedClient.page.evaluate(
      () => window.__virgoscorpio_hubCollaboration.socket.readyState
    )).toBe(1);
    await sendCollaborationCommand(unaffectedClient.page, { type: 'ping' });
    const unaffectedPong = await waitForCollaborationMessage(
      unaffectedClient.page,
      'pong',
      3_000
    );
    expect(unaffectedPong.type).toBe('pong');

    const revokedDocumentSync = await storeB.getCollaborationSync({
      siteId: siteA,
      contentId: siteADraft.id,
      afterSequence: 0
    });
    expect(revokedDocumentSync.sequence).toBe(0);
    expect(revokedDocumentSync.operations).toEqual([]);

    const unaffectedDocumentSync = await storeB.getCollaborationSync({
      siteId: siteB,
      contentId: siteBDraft.id,
      afterSequence: 0
    });
    expect(unaffectedDocumentSync.sequence).toBe(0);
    expect(unaffectedDocumentSync.operations).toEqual([]);
  } finally {
    let redisRestoreError;
    if (redisOutageStopped) {
      try {
        startRedisOutageTarget(outageTarget);
        redisOutageStopped = false;
      } catch (error) {
        redisRestoreError = error;
      }
    }
    await closeClients(clients);
    await nodeA?.close().catch(() => {});
    await nodeB?.close().catch(() => {});
    await Promise.all([poolA.end().catch(() => {}), poolB.end().catch(() => {})]);
    if (siteA || siteB) {
      await fixturePool.query(
        'DELETE FROM sites WHERE id=ANY($1::uuid[])',
        [[siteA, siteB].filter(Boolean)]
      ).catch(() => {});
    }
    if (userIds.length) {
      await fixturePool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [userIds]).catch(() => {});
      await fixturePool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
    }
    await fixturePool.end();
    if (redisRestoreError) throw redisRestoreError;
  }
});
}
