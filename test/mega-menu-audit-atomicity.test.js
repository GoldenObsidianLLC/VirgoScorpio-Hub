'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handlePlatformRoute } = require('../apps/api/src/platform-routes');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const MENU_ID = '55555555-5555-4555-8555-555555555555';
const REQUEST_ID = 'f1-45-mega-menu-audit-test';

function menuFixture(overrides = {}) {
  return {
    id: MENU_ID,
    site_id: SITE_ID,
    slug: 'site-navigation',
    name: 'Site navigation',
    version: 1,
    items: [{ id: 'home', label: 'Home', type: 'url', url: '/' }],
    presentation: { megaMenu: true, layout: 'columns' },
    created_at: new Date('2026-11-17T00:00:00.000Z'),
    updated_at: new Date('2026-11-17T00:00:00.000Z'),
    ...overrides,
  };
}

function createHarness({
  menus = [],
  failAuditAction = null,
  identityAvailable = true,
} = {}) {
  const calls = [];
  const auditEvents = [];
  const transactionClients = [];
  let currentMenus = structuredClone(menus);
  let snapshot = null;
  let nextClient = 0;
  let transactionOpen = false;
  let connectCount = 0;

  async function execute(client, sql, values = []) {
    const statement = sql.trim().replace(/\s+/g, ' ');
    calls.push({ client, statement, values });
    if (statement === 'BEGIN') {
      snapshot = {
        menus: structuredClone(currentMenus),
        auditEvents: structuredClone(auditEvents),
      };
      transactionOpen = true;
      return { rows: [] };
    }
    if (statement === 'COMMIT') {
      snapshot = null;
      transactionOpen = false;
      return { rows: [] };
    }
    if (statement === 'ROLLBACK') {
      if (snapshot) {
        currentMenus = structuredClone(snapshot.menus);
        auditEvents.splice(0, auditEvents.length, ...structuredClone(snapshot.auditEvents));
      }
      snapshot = null;
      transactionOpen = false;
      return { rows: [] };
    }
    if (statement.startsWith('SELECT id,slug,name,version,items,presentation,created_at,updated_at FROM navigation_menus')) {
      const [siteId] = values;
      return {
        rows: currentMenus
          .filter(menu => menu.site_id === siteId && menu.presentation?.megaMenu === true)
          .map(menu => structuredClone(menu)),
      };
    }
    if (statement.startsWith('INSERT INTO navigation_menus')) {
      const [siteId, slug, name, items, presentation, updatedBy] = values;
      const row = menuFixture({
        site_id: siteId,
        slug,
        name,
        version: 1,
        items: JSON.parse(items),
        presentation: JSON.parse(presentation),
        updated_by: updatedBy,
      });
      if (currentMenus.some(menu => menu.site_id === siteId && menu.slug === slug)) {
        const error = new Error('duplicate navigation menu');
        error.code = '23505';
        throw error;
      }
      currentMenus.push(row);
      return { rows: [structuredClone(row)], rowCount: 1 };
    }
    if (statement.startsWith('UPDATE navigation_menus')) {
      const [siteId, slug, name, items, presentation, updatedBy, expectedVersion] = values;
      const index = currentMenus.findIndex(menu =>
        menu.site_id === siteId && menu.slug === slug && menu.version === expectedVersion);
      if (index < 0) return { rows: [], rowCount: 0 };
      currentMenus[index] = {
        ...currentMenus[index],
        name,
        items: JSON.parse(items),
        presentation: JSON.parse(presentation),
        updated_by: updatedBy,
        version: currentMenus[index].version + 1,
        updated_at: new Date('2026-11-17T00:01:00.000Z'),
      };
      return { rows: [structuredClone(currentMenus[index])], rowCount: 1 };
    }
    if (statement.startsWith('DELETE FROM navigation_menus')) {
      const [siteId, slug] = values;
      const index = currentMenus.findIndex(menu =>
        menu.site_id === siteId && menu.slug === slug && menu.presentation?.megaMenu === true);
      if (index < 0) return { rows: [], rowCount: 0 };
      const [removed] = currentMenus.splice(index, 1);
      return {
        rows: [{ id: removed.id, slug: removed.slug, version: removed.version }],
        rowCount: 1,
      };
    }
    if (statement.startsWith('INSERT INTO audit_events')) {
      const [siteId, actorId, action, targetType, targetId, result, requestId, details] = values;
      if (action === failAuditAction) {
        throw new Error('simulated audit insert failure');
      }
      auditEvents.push({
        site_id: siteId,
        actor_id: actorId,
        action,
        target_type: targetType,
        target_id: targetId,
        result,
        request_id: requestId,
        details: JSON.parse(details),
        client,
      });
      return { rows: [], rowCount: 1 };
    }
    throw new Error('Unexpected SQL in mega-menu audit harness: ' + statement);
  }

  const pool = {
    query: (sql, values) => execute('pool', sql, values),
    connect: async () => {
      connectCount += 1;
      const client = 'transaction-' + (++nextClient);
      transactionClients.push(client);
      return {
        query: (sql, values) => execute(client, sql, values),
        release: () => calls.push({ client, statement: 'RELEASE', values: [] }),
      };
    },
  };

  const identity = identityAvailable ? {
    audit: async (input, { queryable } = {}) => {
      assert.ok(queryable, 'mega-menu mutation must pass its transaction queryable');
      await queryable.query(
        'INSERT INTO audit_events(site_id,actor_id,action,target_type,target_id,result,request_id,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',
        [
          input.siteId,
          input.actorId,
          input.action,
          input.targetType,
          input.targetId,
          input.result || 'success',
          input.requestId,
          JSON.stringify(input.details || {}),
        ],
      );
    },
  } : null;

  async function call(method, route, body = {}) {
    const response = { status: null, body: null };
    const url = new URL(route, 'http://localhost');
    await handlePlatformRoute({
      req: { method, headers: {} },
      res: response,
      url,
      actor: { user: { id: ACTOR_ID }, isDeveloper: false, memberships: [] },
      siteIdFor: async input => input.routeSiteId,
      requireCapability: async (_actor, siteId, capability) => {
        assert.equal(siteId, SITE_ID);
        assert.equal(capability, method === 'GET' ? 'content:read' : 'site:manage');
      },
      readJson: async () => body,
      sendJson: (_res, status, payload) => {
        response.status = status;
        response.body = payload;
        calls.push({ client: 'response', statement: 'SEND ' + status, values: [] });
        return true;
      },
      fail: (statusCode, code, message, details) =>
        Object.assign(new Error(message), { statusCode, code, details }),
      requestId: body.requestId || REQUEST_ID,
      localPool: pool,
      firewall: null,
      env: { NODE_ENV: 'test' },
      identity,
      maxBody: 256_000,
      maxLibraryBody: 256_000,
      maxOptimizerBytes: 256_000,
      libraryStore: null,
      store: null,
    });
    return response;
  }

  return {
    calls,
    auditEvents,
    transactionClients,
    call,
    get menus() { return structuredClone(currentMenus); },
    get transactionOpen() { return transactionOpen; },
    get connectCount() { return connectCount; },
    set failAuditAction(value) { failAuditAction = value; },
  };
}

function createBody(overrides = {}) {
  return {
    slug: 'site-navigation',
    name: 'Site navigation',
    items: [{ id: 'home', label: 'Home', type: 'url', url: '/' }],
    presentation: { layout: 'columns' },
    ...overrides,
  };
}

test('mega-menu create, update and delete emit metadata-only audit events on their transaction client', async () => {
  const harness = createHarness();

  const created = await harness.call('POST', '/api/v1/sites/' + SITE_ID + '/mega-menus', createBody());
  assert.equal(created.status, 201);
  assert.equal(created.body.menu.version, 1);

  const updated = await harness.call('PUT', '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation', {
    ...createBody({ name: 'Updated navigation', items: [{ id: 'about', label: 'About', type: 'url', url: '/about' }] }),
    expectedVersion: 1,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.menu.version, 2);

  const removed = await harness.call('DELETE', '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation');
  assert.equal(removed.status, 200);
  assert.equal(removed.body.deleted, true);
  assert.equal(harness.menus.length, 0);

  assert.deepEqual(harness.auditEvents.map(event => event.action), [
    'navigation.mega_menu_created',
    'navigation.mega_menu_updated',
    'navigation.mega_menu_deleted',
  ]);
  assert.deepEqual(harness.auditEvents.map(event => event.details), [
    { slug: 'site-navigation', version: 1 },
    { slug: 'site-navigation', version: 2 },
    { slug: 'site-navigation', version: 2 },
  ]);
  for (const event of harness.auditEvents) {
    assert.equal(event.site_id, SITE_ID);
    assert.equal(event.actor_id, ACTOR_ID);
    assert.equal(event.target_type, 'navigation-menu');
    assert.equal(event.target_id, MENU_ID);
    assert.equal(event.request_id, REQUEST_ID);
    assert.equal(event.result, 'success');
    assert.equal(event.client.startsWith('transaction-'), true);
    assert.deepEqual(Object.keys(event.details).sort(), ['slug', 'version']);
  }
  assert.deepEqual(harness.auditEvents.map(event => event.client), harness.transactionClients);
  assert.equal(harness.transactionOpen, false);
});

test('audit failure rolls back each mega-menu mutation and safe retry writes exactly one event', async t => {
  const scenarios = [
    {
      name: 'create',
      action: 'navigation.mega_menu_created',
      initial: [],
      method: 'POST',
      route: '/api/v1/sites/' + SITE_ID + '/mega-menus',
      body: createBody(),
      expectedStatus: 201,
    },
    {
      name: 'update',
      action: 'navigation.mega_menu_updated',
      initial: [menuFixture()],
      method: 'PUT',
      route: '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation',
      body: createBody({ name: 'Updated after retry' }),
      expectedStatus: 200,
      expectedVersion: 1,
    },
    {
      name: 'delete',
      action: 'navigation.mega_menu_deleted',
      initial: [menuFixture()],
      method: 'DELETE',
      route: '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation',
      body: {},
      expectedStatus: 200,
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const harness = createHarness({ menus: scenario.initial, failAuditAction: scenario.action });
      const before = harness.menus;
      const body = {
        ...scenario.body,
        ...(scenario.expectedVersion === undefined ? {} : { expectedVersion: scenario.expectedVersion }),
      };
      await assert.rejects(
        harness.call(scenario.method, scenario.route, body),
        /simulated audit insert failure/,
      );
      assert.deepEqual(harness.menus, before, 'failed audit must roll back the menu mutation');
      assert.equal(harness.auditEvents.length, 0, 'failed audit must not leave an audit row');
      assert.equal(harness.transactionOpen, false);

      harness.failAuditAction = null;
      const retry = await harness.call(scenario.method, scenario.route, body);
      assert.equal(retry.status, scenario.expectedStatus);
      assert.equal(harness.auditEvents.length, 1, 'retry must persist exactly one audit event');
      assert.equal(harness.auditEvents[0].action, scenario.action);
    });
  }
});

test('all mega-menu mutations fail closed before opening a transaction when identity audit is unavailable', async t => {
  const scenarios = [
    {
      name: 'create',
      menus: [],
      method: 'POST',
      route: '/api/v1/sites/' + SITE_ID + '/mega-menus',
      body: createBody(),
    },
    {
      name: 'update',
      menus: [menuFixture()],
      method: 'PUT',
      route: '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation',
      body: { ...createBody({ name: 'Must not persist' }), expectedVersion: 1 },
    },
    {
      name: 'delete',
      menus: [menuFixture()],
      method: 'DELETE',
      route: '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation',
      body: {},
    },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const harness = createHarness({ menus: scenario.menus, identityAvailable: false });
      const before = harness.menus;
      await assert.rejects(
        harness.call(scenario.method, scenario.route, scenario.body),
        error => error.statusCode === 503 && error.code === 'ERR_VIRGOSCORPIO_HUB_AUDIT_UNAVAILABLE',
      );
      assert.equal(harness.connectCount, 0);
      assert.deepEqual(harness.menus, before);
      assert.equal(harness.auditEvents.length, 0);
    });
  }
});

test('stale mega-menu update keeps the version conflict contract and emits no audit event', async () => {
  const harness = createHarness({ menus: [menuFixture()] });
  const before = harness.menus;
  await assert.rejects(
    harness.call('PUT', '/api/v1/sites/' + SITE_ID + '/mega-menus/site-navigation', {
      ...createBody({ name: 'Stale update' }),
      expectedVersion: 99,
    }),
    error => error.statusCode === 409 && error.code === 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT',
  );
  assert.deepEqual(harness.menus, before);
  assert.equal(harness.auditEvents.length, 0);
});

test('missing mega-menu delete preserves the 404 contract and emits no audit event', async () => {
  const harness = createHarness();
  await assert.rejects(
    harness.call('DELETE', '/api/v1/sites/' + SITE_ID + '/mega-menus/missing-menu'),
    error => error.statusCode === 404 && error.code === 'ERR_VIRGOSCORPIO_HUB_MEGA_MENU_NOT_FOUND',
  );
  assert.equal(harness.menus.length, 0);
  assert.equal(harness.auditEvents.length, 0);
  assert.equal(harness.transactionOpen, false);
});
