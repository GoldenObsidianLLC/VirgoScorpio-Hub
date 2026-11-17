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
  'PostgreSQL integration: mega-menu create/update/delete and identity audit commit or roll back together',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });
    const siteId = randomUUID();
    const actorId = randomUUID();
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const siteSlug = 'f1-45-mega-menu-' + suffix;
    const email = 'f1-45-mega-menu-' + suffix + '@example.test';
    const password = 'Mega-Menu-Audit-Atomicity-2026';
    const passwordHash = await hashPassword(password);
    const requestIds = new Set();
    let server = null;
    let activeTrigger = null;

    async function removeAuditFailure() {
      if (!activeTrigger) return;
      await pool.query('DROP TRIGGER IF EXISTS "' + activeTrigger.triggerName + '" ON audit_events');
      await pool.query('DROP FUNCTION IF EXISTS "' + activeTrigger.functionName + '"()');
      activeTrigger = null;
    }

    async function installAuditFailure(action) {
      await removeAuditFailure();
      const triggerSuffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_fail_mega_menu_audit_' + triggerSuffix;
      const triggerName = 'test_fail_mega_menu_audit_tr_' + triggerSuffix;
      await pool.query(
        'CREATE FUNCTION "' + functionName + '"() RETURNS trigger LANGUAGE plpgsql AS $audit$ ' +
        'BEGIN ' +
        "IF NEW.site_id = '" + siteId + "'::uuid AND NEW.action = '" + action + "' THEN " +
        "RAISE EXCEPTION 'simulated mega-menu audit failure' USING ERRCODE = '23505'; " +
        'END IF; RETURN NEW; END; $audit$'
      );
      await pool.query(
        'CREATE TRIGGER "' + triggerName + '" BEFORE INSERT ON audit_events ' +
        'FOR EACH ROW EXECUTE FUNCTION "' + functionName + '"()'
      );
      activeTrigger = { triggerName, functionName };
    }

    function nextRequestId(label) {
      const value = 'f1-45-' + label + '-' + randomUUID();
      requestIds.add(value);
      return value;
    }

    async function request(session, method, route, body, requestId) {
      const headers = {
        authorization: 'Bearer ' + session.token,
        'content-type': 'application/json',
        'x-virgoscorpio-hub-site-id': siteId,
        'x-request-id': requestId,
      };
      return fetch('http://127.0.0.1:' + server.address().port + route, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }

    async function menuSnapshot(slug) {
      const result = await pool.query(
        'SELECT id,site_id,slug,name,version,items,presentation,updated_by ' +
        'FROM navigation_menus WHERE site_id=$1 AND slug=$2',
        [siteId, slug],
      );
      return result.rows[0] || null;
    }

    async function auditFor(action, requestId) {
      return pool.query(
        'SELECT site_id,actor_id,action,target_type,target_id,result,request_id,details ' +
        'FROM audit_events WHERE site_id=$1 AND action=$2 AND request_id=$3',
        [siteId, action, requestId],
      );
    }

    t.after(async () => {
      await removeAuditFailure().catch(() => {});
      if (server?.listening) await new Promise(resolve => server.close(resolve));
      if (server?.virgoScorpioHub) await server.virgoScorpioHub.close().catch(() => {});
      await pool.query('DELETE FROM audit_events WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM navigation_menus WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [actorId]).catch(() => {});
      await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => {});
      await pool.end();
    });

    await pool.query('INSERT INTO sites(id,slug,name) VALUES($1,$2,$3)', [
      siteId, siteSlug, 'F1.45 Mega Menu Audit Site',
    ]);
    const ownerRole = await pool.query("SELECT id FROM roles WHERE slug='site-owner' LIMIT 1");
    assert.ok(ownerRole.rows[0], 'seeded site-owner role must exist');
    await pool.query(
      "INSERT INTO users(id,email,display_name,password_hash,status) VALUES($1,$2,'F1.45 Mega Menu Actor',$3,'active')",
      [actorId, email, passwordHash],
    );
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteId, actorId, ownerRole.rows[0].id],
    );

    const session = await identity.login({
      email,
      password,
      ip: '127.0.0.1',
      userAgent: 'f1-45-mega-menu-audit-atomicity-test',
    });
    assert.equal(session.mfaRequired, false);

    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const collection = '/api/v1/sites/' + siteId + '/mega-menus';
    const item = collection + '/site-navigation';
    const createBody = {
      slug: 'site-navigation',
      name: 'Site navigation',
      items: [{ id: 'home', label: 'Home', type: 'url', url: '/' }],
      presentation: { layout: 'columns' },
    };

    await t.test('create audit failure rolls back and retry commits exactly one event', async () => {
      const requestId = nextRequestId('create');
      await installAuditFailure('navigation.mega_menu_created');
      const failed = await request(session, 'POST', collection, createBody, requestId);
      assert.ok(failed.status >= 400, 'audit failure must fail the API request');
      assert.equal(await menuSnapshot('site-navigation'), null);
      assert.equal((await auditFor('navigation.mega_menu_created', requestId)).rowCount, 0);

      await removeAuditFailure();
      const retry = await request(session, 'POST', collection, createBody, requestId);
      assert.equal(retry.status, 201);
      const payload = await retry.json();
      assert.equal(payload.menu.version, 1);
      const audit = await auditFor('navigation.mega_menu_created', requestId);
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].site_id, siteId);
      assert.equal(audit.rows[0].actor_id, actorId);
      assert.equal(audit.rows[0].target_type, 'navigation-menu');
      assert.equal(audit.rows[0].target_id, payload.menu.id);
      assert.deepEqual(audit.rows[0].details, { slug: 'site-navigation', version: 1 });
      assert.deepEqual(Object.keys(audit.rows[0].details).sort(), ['slug', 'version']);
    });

    await t.test('update audit failure rolls back version/content and retry commits exactly one event', async () => {
      const before = await menuSnapshot('site-navigation');
      assert.ok(before);
      const requestId = nextRequestId('update');
      const updateBody = {
        expectedVersion: before.version,
        name: 'Updated site navigation',
        items: [{ id: 'about', label: 'About', type: 'url', url: '/about' }],
        presentation: { layout: 'tabs' },
      };

      await installAuditFailure('navigation.mega_menu_updated');
      const failed = await request(session, 'PUT', item, updateBody, requestId);
      assert.ok(failed.status >= 400, 'audit failure must fail the API request');
      assert.deepEqual(await menuSnapshot('site-navigation'), before);
      assert.equal((await auditFor('navigation.mega_menu_updated', requestId)).rowCount, 0);

      await removeAuditFailure();
      const retry = await request(session, 'PUT', item, updateBody, requestId);
      assert.equal(retry.status, 200);
      const payload = await retry.json();
      assert.equal(payload.menu.version, before.version + 1);
      const audit = await auditFor('navigation.mega_menu_updated', requestId);
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].target_id, before.id);
      assert.deepEqual(audit.rows[0].details, { slug: 'site-navigation', version: before.version + 1 });
    });

    await t.test('delete audit failure restores the menu and retry commits exactly one event', async () => {
      const before = await menuSnapshot('site-navigation');
      assert.ok(before);
      const requestId = nextRequestId('delete');

      await installAuditFailure('navigation.mega_menu_deleted');
      const failed = await request(session, 'DELETE', item, undefined, requestId);
      assert.ok(failed.status >= 400, 'audit failure must fail the API request');
      assert.deepEqual(await menuSnapshot('site-navigation'), before);
      assert.equal((await auditFor('navigation.mega_menu_deleted', requestId)).rowCount, 0);

      await removeAuditFailure();
      const retry = await request(session, 'DELETE', item, undefined, requestId);
      assert.equal(retry.status, 200);
      assert.equal(await menuSnapshot('site-navigation'), null);
      const audit = await auditFor('navigation.mega_menu_deleted', requestId);
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].target_id, before.id);
      assert.deepEqual(audit.rows[0].details, { slug: 'site-navigation', version: before.version });
    });

    assert.equal(requestIds.size, 3);
  },
);
