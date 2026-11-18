'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

test(
  'tenant isolation: regular navigation-menu CRUD keeps same-slug records isolated across sites',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const siteIds = [];
    const userIds = [];
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS: 'false',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;
    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      await pool.end();
    });

    const siteAResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['tenant-menu-a-' + randomUUID(), 'Tenant Navigation Menu Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['tenant-menu-b-' + randomUUID(), 'Tenant Navigation Menu Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roleResult = await pool.query("SELECT id FROM roles WHERE slug='site-owner' LIMIT 1");
    assert.ok(roleResult.rows[0], 'the seeded site-owner role must exist');
    const ownerRoleId = roleResult.rows[0].id;

    async function createOwner(label) {
      const email = 'tenant-menu-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + randomUUID() + '@example.test';
      const result = await pool.query(
        "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
        [email, label, await hashPassword('Isolation-Password-2026')]
      );
      userIds.push(result.rows[0].id);
      return result.rows[0];
    }

    const ownerA = await createOwner('Site A Owner');
    const ownerB = await createOwner('Site B Owner');
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($4,$5,$3)',
      [siteA, ownerA.id, ownerRoleId, siteB, ownerB.id]
    );

    const sharedSlug = 'shared-navigation-' + randomUUID().replace(/-/g, '').slice(0, 12);
    const initialItems = [{ id: 'home', label: 'Home', type: 'url', url: '/' }];
    const initialPresentation = { layout: 'columns' };
    await pool.query(
      'INSERT INTO navigation_menus(site_id,slug,name,items,presentation,updated_by) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6),($7,$2,$8,$4::jsonb,$5::jsonb,$9)',
      [
        siteA, sharedSlug, 'Site A private navigation', JSON.stringify(initialItems),
        JSON.stringify(initialPresentation), ownerA.id,
        siteB, 'Site B private navigation', ownerB.id,
      ]
    );

    const sessionA = await identity.login({
      email: ownerA.email,
      password: 'Isolation-Password-2026',
      ip: '127.0.0.1',
      userAgent: 'tenant-navigation-menu-isolation-test',
    });
    assert.equal(sessionA.mfaRequired, false);

    server = createApiServer({
      env,
      pool,
      identityService: identity,
      logger: { error() {} },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = 'http://127.0.0.1:' + server.address().port;
    const authHeaders = {
      authorization: 'Bearer ' + sessionA.token,
      'content-type': 'application/json',
    };
    const readHeaders = { authorization: 'Bearer ' + sessionA.token };
    const path = siteId => '/api/v1/sites/' + siteId + '/menus';

    async function menuSnapshot() {
      const result = await pool.query(
        'SELECT id,site_id,slug,name,version,items,presentation,updated_by,created_at,updated_at FROM navigation_menus WHERE site_id=ANY($1::uuid[]) ORDER BY site_id,slug',
        [[siteA, siteB]]
      );
      return result.rows;
    }

    async function navigationAuditSnapshot() {
      const result = await pool.query(
        "SELECT site_id,actor_id,action,target_type,target_id,request_id,details FROM audit_events WHERE site_id=ANY($1::uuid[]) AND action IN ('navigation.menu_created','navigation.menu_updated','navigation.menu_deleted') ORDER BY site_id,action,target_id,request_id",
        [[siteA, siteB]]
      );
      return result.rows;
    }

    async function outboxSnapshot() {
      const result = await pool.query(
        'SELECT id,site_id,actor_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,status,attempts,correlation_id,classification FROM outbox_events WHERE site_id=ANY($1::uuid[]) ORDER BY created_at,id',
        [[siteA, siteB]]
      );
      return result.rows;
    }

    const before = await menuSnapshot();
    assert.equal(before.length, 2, 'the fixture must contain one same-slug menu in each site');
    assert.deepEqual(before.map(row => row.slug), [sharedSlug, sharedSlug]);

    const ownList = await fetch(base + path(siteA), { headers: readHeaders });
    assert.equal(ownList.status, 200);
    const ownListPayload = await ownList.json();
    assert.deepEqual(ownListPayload.menus.map(menu => menu.slug), [sharedSlug]);
    assert.equal(ownListPayload.menus[0].name, 'Site A private navigation');
    assert.doesNotMatch(JSON.stringify(ownListPayload), /Site B private navigation/);

    const menusBeforeDeniedRequests = await menuSnapshot();
    const auditsBeforeDeniedRequests = await navigationAuditSnapshot();
    const outboxBeforeDeniedRequests = await outboxSnapshot();
    const deniedScenarios = [
      { method: 'GET', url: path(siteB) },
      {
        method: 'PUT',
        url: path(siteB) + '/' + sharedSlug,
        body: {
          slug: sharedSlug,
          expectedVersion: 1,
          name: 'Cross-site overwrite attempt',
          items: [{ id: 'stolen', label: 'Stolen', type: 'url', url: '/stolen' }],
          presentation: { layout: 'tabs' },
        },
      },
      { method: 'DELETE', url: path(siteB) + '/' + sharedSlug },
    ];

    for (const scenario of deniedScenarios) {
      const response = await fetch(base + scenario.url, {
        method: scenario.method,
        headers: scenario.body === undefined ? readHeaders : authHeaders,
        ...(scenario.body === undefined ? {} : { body: JSON.stringify(scenario.body) }),
      });
      const payload = await response.json();
      assert.equal(response.status, 403, scenario.method + ' ' + scenario.url + ' must reject Site A owner access to Site B');
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.doesNotMatch(JSON.stringify(payload), /Site B private navigation/);
    }

    assert.deepEqual(await menuSnapshot(), menusBeforeDeniedRequests, 'denied cross-site CRUD must not change either site menu');
    assert.deepEqual(
      await navigationAuditSnapshot(),
      auditsBeforeDeniedRequests,
      'denied cross-site CRUD must not emit navigation mutation audit events'
    );
    assert.deepEqual(
      await outboxSnapshot(),
      outboxBeforeDeniedRequests,
      'denied cross-site CRUD must not enqueue site events or background work'
    );

    const ownSharedUpdate = await fetch(base + path(siteA) + '/' + sharedSlug, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        slug: sharedSlug,
        expectedVersion: 1,
        name: 'Site A updated navigation',
        items: [{ id: 'about', label: 'About', type: 'url', url: '/about' }],
        presentation: { layout: 'tabs' },
      }),
    });
    assert.equal(ownSharedUpdate.status, 200);
    const ownSharedUpdatePayload = await ownSharedUpdate.json();
    assert.equal(ownSharedUpdatePayload.menu.version, 2);
    assert.equal(ownSharedUpdatePayload.menu.name, 'Site A updated navigation');

    const createdSlug = 'site-a-new-navigation-' + randomUUID().replace(/-/g, '').slice(0, 12);
    const created = await fetch(base + path(siteA), {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        slug: createdSlug,
        name: 'Site A created navigation',
        items: [{ id: 'contact', label: 'Contact', type: 'url', url: '/contact' }],
        presentation: { layout: 'columns' },
      }),
    });
    assert.equal(created.status, 201);
    const createdPayload = await created.json();
    assert.equal(createdPayload.menu.version, 1);
    assert.equal(createdPayload.menu.slug, createdSlug);

    const createdUpdate = await fetch(base + path(siteA) + '/' + createdSlug, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        slug: createdSlug,
        expectedVersion: 1,
        name: 'Site A updated created navigation',
        items: [{ id: 'contact', label: 'Contact us', type: 'url', url: '/contact-us' }],
        presentation: { layout: 'columns' },
      }),
    });
    assert.equal(createdUpdate.status, 200);
    assert.equal((await createdUpdate.json()).menu.version, 2);

    const createdDelete = await fetch(base + path(siteA) + '/' + createdSlug, {
      method: 'DELETE',
      headers: readHeaders,
    });
    assert.equal(createdDelete.status, 200);
    assert.equal((await createdDelete.json()).deleted, true);

    const ownSharedDelete = await fetch(base + path(siteA) + '/' + sharedSlug, {
      method: 'DELETE',
      headers: readHeaders,
    });
    assert.equal(ownSharedDelete.status, 200);
    assert.equal((await ownSharedDelete.json()).deleted, true);

    const after = await menuSnapshot();
    assert.equal(after.length, 1, 'only Site B menu should remain after Site A deletes its own record');
    assert.equal(after[0].site_id, siteB);
    assert.equal(after[0].slug, sharedSlug);
    assert.equal(after[0].name, 'Site B private navigation');
    assert.equal(after[0].version, 1);
    assert.deepEqual(after[0].items, initialItems);
    assert.deepEqual(after[0].presentation, initialPresentation);

    const finalAuditEvents = await navigationAuditSnapshot();
    assert.equal(finalAuditEvents.length, 5, 'Site A positive CRUD operations should emit their correlated menu audit events');
    assert.equal((await outboxSnapshot()).length, 0, 'regular navigation-menu CRUD should not enqueue unrelated background work');
    assert.ok(finalAuditEvents.every(event => event.site_id === siteA && event.actor_id === ownerA.id));
    assert.deepEqual(
      finalAuditEvents.map(event => event.action).sort(),
      [
        'navigation.menu_created',
        'navigation.menu_deleted',
        'navigation.menu_deleted',
        'navigation.menu_updated',
        'navigation.menu_updated',
      ]
    );
    assert.ok(finalAuditEvents.every(event => event.target_type === 'navigation-menu'));
  }
);
