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

function pageDocument(title, documentId) {
  return {
    schemaVersion: 1,
    documentId,
    type: 'page',
    title,
    children: [{
      id: 'component-section',
      type: 'section',
      props: { className: 'vsh-component' },
      children: [
        { id: 'component-heading', type: 'widget.heading', props: { text: title, level: 1 }, children: [] }
      ]
    }]
  };
}

test(
  'PostgreSQL integration: reusable-component mutations, audit and tenant boundaries commit or roll back together',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8'
    });
    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
      AI_ALLOWED_PROVIDERS: 'mock'
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });
    const siteA = randomUUID();
    const siteB = randomUUID();
    const siteSuffix = randomUUID().replace(/-/g, '').slice(0, 12);
    const siteSlugA = 'reusable-component-a-' + siteSuffix;
    const siteSlugB = 'reusable-component-b-' + siteSuffix;
    const roleSlug = 'reusable-component-editor-' + siteSuffix;
    const password = 'Reusable-Component-Atomicity-2026';
    const passwordHash = await hashPassword(password);
    const actorAId = randomUUID();
    const actorBId = randomUUID();
    const actorAEmail = 'reusable-component-a-' + siteSuffix + '@example.test';
    const actorBEmail = 'reusable-component-b-' + siteSuffix + '@example.test';
    const requestIds = new Set();
    let roleId = null;
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
      const suffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_fail_component_audit_' + suffix;
      const triggerName = 'test_fail_component_audit_tr_' + suffix;
      await pool.query(
        'CREATE FUNCTION "' + functionName + '"() RETURNS trigger LANGUAGE plpgsql AS $audit$ ' +
        'BEGIN ' +
        "IF NEW.site_id = '" + siteB + "'::uuid AND NEW.action = '" + action + "' THEN " +
        "RAISE EXCEPTION 'simulated reusable component audit failure' USING ERRCODE = '23505'; " +
        'END IF; RETURN NEW; END; $audit$'
      );
      await pool.query(
        'CREATE TRIGGER "' + triggerName + '" BEFORE INSERT ON audit_events ' +
        'FOR EACH ROW EXECUTE FUNCTION "' + functionName + '"()'
      );
      activeTrigger = { triggerName, functionName };
    }

    const headersFor = session => ({
      authorization: 'Bearer ' + session.token,
      'content-type': 'application/json'
    });

    function nextRequestId(label) {
      const requestId = 'f1-40-' + label + '-' + randomUUID();
      requestIds.add(requestId);
      return requestId;
    }

    async function request(session, siteId, method, componentId, body, requestId) {
      const path = '/api/v1/sites/' + siteId + '/reusable-components' +
        (componentId ? '/' + componentId : '');
      const headers = {
        ...headersFor(session),
        'x-virgoscorpio-hub-site-id': siteId,
        'x-request-id': requestId
      };
      return fetch('http://127.0.0.1:' + server.address().port + path, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    }

    async function componentSnapshot(siteId, id) {
      const result = await pool.query(
        'SELECT id,site_id,slug,name,version,document,created_by,updated_by,created_at,updated_at ' +
        'FROM reusable_components WHERE site_id=$1 AND id=$2',
        [siteId, id]
      );
      return result.rows[0] || null;
    }

    async function auditFor(siteId, action, requestId) {
      return pool.query(
        'SELECT site_id,actor_id,action,target_type,target_id,result,request_id,details ' +
        'FROM audit_events WHERE site_id=$1 AND action=$2 AND request_id=$3',
        [siteId, action, requestId]
      );
    }

    t.after(async () => {
      await removeAuditFailure().catch(() => {});
      if (server?.listening) await new Promise(resolve => server.close(resolve));
      if (server?.virgoScorpioHub) await server.virgoScorpioHub.close().catch(() => {});
      await pool.query('DELETE FROM audit_events WHERE site_id=ANY($1::uuid[])', [[siteA, siteB]]).catch(() => {});
      await pool.query('DELETE FROM reusable_components WHERE site_id=ANY($1::uuid[])', [[siteA, siteB]]).catch(() => {});
      await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [[actorAId, actorBId]]).catch(() => {});
      await pool.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [[siteA, siteB]]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[actorAId, actorBId]]).catch(() => {});
      if (roleId) await pool.query('DELETE FROM roles WHERE id=$1', [roleId]).catch(() => {});
      await pool.end();
    });

    await pool.query('INSERT INTO sites(id,slug,name) VALUES($1,$2,$3),($4,$5,$6)', [
      siteA, siteSlugA, 'Reusable Component Site A',
      siteB, siteSlugB, 'Reusable Component Site B'
    ]);
    const role = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [roleSlug, 'Reusable Component Test Editor', JSON.stringify(['content:read', 'content:edit'])]
    );
    roleId = role.rows[0].id;

    await pool.query(
      'INSERT INTO users(id,email,display_name,password_hash,status) ' +
      "VALUES($1,$2,'Reusable Component Actor A',$3,'active'),($4,$5,'Reusable Component Actor B',$3,'active')",
      [actorAId, actorAEmail, passwordHash, actorBId, actorBEmail]
    );
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($4,$5,$3)',
      [siteA, actorAId, roleId, siteB, actorBId]
    );

    const sessionA = await identity.login({ email: actorAEmail, password, ip: '127.0.0.1', userAgent: 'f1-40-site-a' });
    const sessionB = await identity.login({ email: actorBEmail, password, ip: '127.0.0.1', userAgent: 'f1-40-site-b' });
    assert.equal(sessionA.mfaRequired, false);
    assert.equal(sessionB.mfaRequired, false);

    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const siteARequestId = nextRequestId('site-a-create');
    const siteBRequestId = nextRequestId('site-b-create');
    const siteAResponse = await request(sessionA, siteA, 'POST', null, {
      slug: 'site-a-component-' + siteSuffix,
      name: 'Site A component control',
      document: pageDocument('Site A control', 'site-a-' + siteSuffix)
    }, siteARequestId);
    assert.equal(siteAResponse.status, 201);
    const siteAComponent = (await siteAResponse.json()).component;

    const siteBResponse = await request(sessionB, siteB, 'POST', null, {
      slug: 'site-b-component-' + siteSuffix,
      name: 'Site B protected component',
      document: pageDocument('Site B protected', 'site-b-' + siteSuffix)
    }, siteBRequestId);
    assert.equal(siteBResponse.status, 201);
    const siteBComponent = (await siteBResponse.json()).component;
    const siteAControl = await componentSnapshot(siteA, siteAComponent.id);
    const siteBBaseline = await componentSnapshot(siteB, siteBComponent.id);
    assert.ok(siteAControl);
    assert.ok(siteBBaseline);

    await t.test('two-site listings and ID-addressed mutations do not cross the site boundary', async () => {
      const listingRequestId = nextRequestId('site-a-list');
      const listing = await request(sessionA, siteA, 'GET', null, undefined, listingRequestId);
      assert.equal(listing.status, 200);
      const listedComponents = (await listing.json()).components;
      assert.deepEqual(listedComponents.map(component => component.id), [siteAComponent.id]);
      assert.equal(JSON.stringify(listedComponents).includes(siteBComponent.id), false);
      assert.equal(JSON.stringify(listedComponents).includes('Site B protected component'), false);

      const foreignUpdateRequestId = nextRequestId('foreign-update');
      const foreignUpdate = await request(sessionA, siteA, 'PUT', siteBComponent.id, {
        slug: 'foreign-overwrite',
        name: 'Foreign overwrite attempt',
        expectedVersion: siteBBaseline.version,
        document: pageDocument('Foreign overwrite attempt', 'foreign-update-' + siteSuffix)
      }, foreignUpdateRequestId);
      assert.equal(foreignUpdate.status, 409);
      assert.equal((await foreignUpdate.json()).code, 'ERR_VIRGOSCORPIO_HUB_VERSION_CONFLICT');

      const foreignDeleteRequestId = nextRequestId('foreign-delete');
      const foreignDelete = await request(sessionA, siteA, 'DELETE', siteBComponent.id, undefined, foreignDeleteRequestId);
      assert.equal(foreignDelete.status, 404);
      assert.equal((await foreignDelete.json()).code, 'ERR_VIRGOSCORPIO_HUB_COMPONENT_NOT_FOUND');

      const foreignRouteRequestId = nextRequestId('foreign-route');
      const foreignRoute = await request(sessionA, siteB, 'GET', null, undefined, foreignRouteRequestId);
      assert.equal(foreignRoute.status, 403);

      assert.deepEqual(await componentSnapshot(siteB, siteBComponent.id), siteBBaseline);
      assert.deepEqual(await componentSnapshot(siteA, siteAComponent.id), siteAControl);
      for (const requestId of [foreignUpdateRequestId, foreignDeleteRequestId, foreignRouteRequestId]) {
        const rows = await pool.query('SELECT id FROM audit_events WHERE request_id=$1', [requestId]);
        assert.equal(rows.rowCount, 0, 'denied cross-site requests must not create audit events');
      }
    });

    await t.test('create audit failure rolls back the component insert and allows one safe retry', async () => {
      const failureRequestId = nextRequestId('create-failure');
      const retryRequestId = nextRequestId('create-retry');
      const slug = 'site-b-failure-create-' + siteSuffix;
      const body = {
        slug,
        name: 'Site B create rollback fixture',
        document: pageDocument('Create rollback fixture', 'create-rollback-' + siteSuffix)
      };
      await installAuditFailure('reusable_component.created');
      try {
        const failed = await request(sessionB, siteB, 'POST', null, body, failureRequestId);
        assert.equal(failed.status, 500);
        await failed.json();
        const rolledBack = await pool.query('SELECT id FROM reusable_components WHERE site_id=$1 AND slug=$2', [siteB, slug]);
        assert.equal(rolledBack.rowCount, 0);
        assert.equal((await auditFor(siteB, 'reusable_component.created', failureRequestId)).rowCount, 0);
      } finally {
        await removeAuditFailure();
      }

      const retried = await request(sessionB, siteB, 'POST', null, body, retryRequestId);
      assert.equal(retried.status, 201);
      const component = (await retried.json()).component;
      const audit = await auditFor(siteB, 'reusable_component.created', retryRequestId);
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].actor_id, actorBId);
      assert.equal(audit.rows[0].target_type, 'reusable-component');
      assert.equal(audit.rows[0].target_id, component.id);
      assert.deepEqual(audit.rows[0].details, { slug, version: 1 });
      assert.equal(JSON.stringify(audit.rows[0].details).includes('document'), false);
    });

    await t.test('update audit failure rolls back the version and document before a safe retry', async () => {
      const failureRequestId = nextRequestId('update-failure');
      const retryRequestId = nextRequestId('update-retry');
      const body = {
        slug: 'site-b-component-updated-' + siteSuffix,
        name: 'Site B protected component updated',
        expectedVersion: siteBBaseline.version,
        document: pageDocument('Site B update retry', 'update-retry-' + siteSuffix)
      };
      await installAuditFailure('reusable_component.updated');
      try {
        const failed = await request(sessionB, siteB, 'PUT', siteBComponent.id, body, failureRequestId);
        assert.equal(failed.status, 500);
        await failed.json();
        assert.deepEqual(await componentSnapshot(siteB, siteBComponent.id), siteBBaseline);
        assert.equal((await auditFor(siteB, 'reusable_component.updated', failureRequestId)).rowCount, 0);
      } finally {
        await removeAuditFailure();
      }

      const retried = await request(sessionB, siteB, 'PUT', siteBComponent.id, body, retryRequestId);
      assert.equal(retried.status, 200);
      const updated = (await retried.json()).component;
      assert.equal(updated.version, siteBBaseline.version + 1);
      const audit = await auditFor(siteB, 'reusable_component.updated', retryRequestId);
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].actor_id, actorBId);
      assert.equal(audit.rows[0].target_id, siteBComponent.id);
      assert.deepEqual(audit.rows[0].details, { slug: body.slug, version: updated.version });
      assert.deepEqual(await componentSnapshot(siteA, siteAComponent.id), siteAControl);
    });

    await t.test('delete audit failure preserves the component before retry and records one correlated delete', async () => {
      const failureRequestId = nextRequestId('delete-failure');
      const retryRequestId = nextRequestId('delete-retry');
      const updatedSnapshot = await componentSnapshot(siteB, siteBComponent.id);
      assert.equal(updatedSnapshot.version, siteBBaseline.version + 1);

      await installAuditFailure('reusable_component.deleted');
      try {
        const failed = await request(sessionB, siteB, 'DELETE', siteBComponent.id, undefined, failureRequestId);
        assert.equal(failed.status, 500);
        await failed.json();
        assert.deepEqual(await componentSnapshot(siteB, siteBComponent.id), updatedSnapshot);
        assert.equal((await auditFor(siteB, 'reusable_component.deleted', failureRequestId)).rowCount, 0);
      } finally {
        await removeAuditFailure();
      }

      const retried = await request(sessionB, siteB, 'DELETE', siteBComponent.id, undefined, retryRequestId);
      assert.equal(retried.status, 200);
      assert.deepEqual(await retried.json(), { deleted: true, requestId: retryRequestId });
      assert.equal(await componentSnapshot(siteB, siteBComponent.id), null);
      const audit = await auditFor(siteB, 'reusable_component.deleted', retryRequestId);
      assert.equal(audit.rowCount, 1);
      assert.equal(audit.rows[0].actor_id, actorBId);
      assert.equal(audit.rows[0].target_id, siteBComponent.id);
      assert.deepEqual(audit.rows[0].details, { slug: updatedSnapshot.slug, version: updatedSnapshot.version });
      assert.deepEqual(await componentSnapshot(siteA, siteAComponent.id), siteAControl);
    });

    assert.ok(requestIds.size >= 11, 'all positive, rejected, failure and retry requests should be uniquely correlated');
    assert.equal((await auditFor(siteB, 'reusable_component.created', siteBRequestId)).rowCount, 1);
  }
);
