'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool, createPostgresStore } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');

function dedicatedTestDatabaseUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return false;
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    return ['localhost', '127.0.0.1', '::1', 'postgres'].includes(parsed.hostname.toLowerCase())
      && /(?:[_-])test$/i.test(database);
  } catch {
    return false;
  }
}

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || '';
const enabled = process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
  && dedicatedTestDatabaseUrl(databaseUrl);

test('revision-restore PostgreSQL integration refuses remote or non-test databases', () => {
  assert.equal(dedicatedTestDatabaseUrl('postgresql://tester:secret@127.0.0.1:5432/vsh_restore_test'), true);
  assert.equal(dedicatedTestDatabaseUrl('postgres://tester:secret@postgres:5432/vsh_restore_test'), true);
  assert.equal(dedicatedTestDatabaseUrl('postgresql://tester:secret@db.example.com:5432/vsh_restore_test'), false);
  assert.equal(dedicatedTestDatabaseUrl('postgresql://tester:secret@127.0.0.1:5432/vsh_restore'), false);
  assert.equal(dedicatedTestDatabaseUrl('https://postgres/vsh_restore_test'), false);
  assert.equal(dedicatedTestDatabaseUrl('not-a-url'), false);
});

test(
  'PostgreSQL integration: authenticated revision restore rolls back and retries with its correlated audit',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: databaseUrl,
      DATABASE_POOL_MAX: '8',
    });
    const store = createPostgresStore({ pool });
    const siteIds = [];
    const userIds = [];
    let server = null;
    let triggerName = null;
    let functionName = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl,
      REQUIRE_VERIFIED_EMAIL: 'false',
      RATE_LIMIT_MAX_REQUESTS: '1000',
      AI_PROVIDER: 'mock',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;
    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (triggerName) {
        await pool.query('DROP TRIGGER IF EXISTS "' + triggerName + '" ON audit_events').catch(() => {});
      }
      if (functionName) {
        await pool.query('DROP FUNCTION IF EXISTS "' + functionName + '"()').catch(() => {});
      }
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

    const siteResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['restore-audit-' + randomUUID().slice(0, 12), 'Revision Restore Audit Integration'],
    );
    const siteId = siteResult.rows[0].id;
    siteIds.push(siteId);

    const roleResult = await pool.query("SELECT id FROM roles WHERE slug='site-owner'");
    assert.ok(roleResult.rows[0], 'the seeded site-owner role must exist');

    const password = 'Revision-Restore-Audit-2026';
    const userResult = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['restore-audit-' + randomUUID() + '@example.test', 'Restore Audit Actor', await hashPassword(password)],
    );
    const actor = userResult.rows[0];
    userIds.push(actor.id);
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteId, actor.id, roleResult.rows[0].id],
    );

    const session = await identity.login({
      email: actor.email,
      password,
      ip: '127.0.0.1',
      userAgent: 'content-restore-audit-integration',
    });
    assert.equal(session.mfaRequired, false);

    const originalDocument = {
      schemaVersion: 1,
      documentId: 'restore-original-' + randomUUID(),
      type: 'page',
      title: 'Original Revision',
      children: [{
        id: 'original-heading',
        type: 'widget.heading',
        props: { text: 'Original content' },
        children: [],
      }],
    };
    const slug = 'restore-content-' + randomUUID().slice(0, 12);
    const initial = await store.saveDraft({
      siteId,
      title: 'Original Revision',
      slug,
      locale: 'en',
      contentType: 'page',
      document: originalDocument,
      authorId: actor.id,
      note: 'revision restore integration initial revision',
    });
    assert.equal(initial.version, 1);

    const latestDocument = {
      schemaVersion: 1,
      documentId: 'restore-latest-' + randomUUID(),
      type: 'page',
      title: 'Latest Revision',
      children: [{
        id: 'latest-heading',
        type: 'widget.heading',
        props: { text: 'Latest content' },
        children: [],
      }],
    };
    const latest = await store.saveDraft({
      siteId,
      id: initial.id,
      title: 'Latest Revision',
      slug,
      locale: 'en',
      contentType: 'page',
      document: latestDocument,
      authorId: actor.id,
      expectedVersion: initial.version,
      note: 'revision restore integration second revision',
    });
    assert.equal(latest.version, 2);
    assert.notDeepEqual(latest.document, originalDocument);

    const revision = await store.getRevision({ siteId, contentId: initial.id, version: 1 });
    assert.ok(revision, 'the original revision must be available for restore');
    assert.equal(revision.version, 1);

    server = createApiServer({
      env,
      pool,
      contentStore: store,
      identityService: identity,
      logger: { error() {} },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = {
      authorization: 'Bearer ' + session.token,
      'x-virgoscorpio-hub-site-id': siteId,
      'content-type': 'application/json',
    };
    const restore = expectedVersion => fetch(
      base + '/api/v1/pages/' + initial.id + '/restore/1',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ expectedVersion }),
      },
    );
    const contentState = async () => {
      const query = [
        'SELECT ci.status,ci.version,ci.lock_version,ci.title,ci.body,',
        '(SELECT count(*)::int FROM content_revisions r WHERE r.content_id=ci.id) AS revision_count,',
        '(SELECT count(*)::int FROM workflow_events w WHERE w.site_id=ci.site_id AND w.content_id=ci.id) AS workflow_count,',
        '(SELECT count(*)::int FROM outbox_events o WHERE o.site_id=ci.site_id AND o.aggregate_id=ci.id) AS outbox_count,',
        "(SELECT count(*)::int FROM audit_events a WHERE a.site_id=ci.site_id AND a.target_type='content' AND a.target_id=ci.id) AS audit_count",
        'FROM content_items ci',
        'WHERE ci.site_id=$1 AND ci.id=$2 AND ci.deleted_at IS NULL',
      ].join('\n');
      const result = await pool.query(query, [siteId, initial.id]);
      return result.rows[0] || null;
    };

    const beforeRestore = await contentState();
    assert.ok(beforeRestore);
    assert.equal(beforeRestore.version, 2);
    assert.equal(beforeRestore.revision_count, 2);
    assert.equal(beforeRestore.audit_count, 0);

    const suffix = randomUUID().replace(/-/g, '');
    functionName = 'restore_audit_failure_' + suffix;
    triggerName = 'restore_audit_failure_' + suffix;
    const createFunctionSql = [
      'CREATE FUNCTION "' + functionName + '"() RETURNS trigger LANGUAGE plpgsql AS $audit$',
      'BEGIN',
      "  IF NEW.site_id = '" + siteId + "'::uuid AND NEW.action = 'content.draft_saved' THEN",
      "    RAISE EXCEPTION 'simulated revision restore audit failure' USING ERRCODE = '23505';",
      '  END IF;',
      '  RETURN NEW;',
      'END;',
      '$audit$',
    ].join('\n');
    await pool.query(createFunctionSql);
    await pool.query(
      'CREATE TRIGGER "' + triggerName + '" BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION "' + functionName + '"()',
    );

    try {
      const failedResponse = await restore(2);
      const failedPayload = await failedResponse.json();
      assert.equal(failedResponse.status, 500, JSON.stringify(failedPayload));
      assert.notEqual(failedPayload.code, 'ERR_VIRGOSCORPIO_HUB_ROUTE_CONFLICT');
      assert.deepEqual(
        await contentState(),
        beforeRestore,
        'audit failure must roll back the content version/document, revision history, workflow, outbox and audit writes',
      );
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS "' + triggerName + '" ON audit_events');
      await pool.query('DROP FUNCTION IF EXISTS "' + functionName + '"()');
      triggerName = null;
      functionName = null;
    }

    const retryResponse = await restore(2);
    const retryPayload = await retryResponse.json();
    assert.equal(retryResponse.status, 200, JSON.stringify(retryPayload));
    assert.equal(retryPayload.status, 'draft');
    assert.equal(retryPayload.restoredFromVersion, 1);
    assert.equal(retryPayload.content.id, initial.id);
    assert.equal(retryPayload.content.version, 3);
    assert.equal(retryPayload.content.title, 'Original Revision');
    assert.deepEqual(retryPayload.content.body, originalDocument);

    const afterRetry = await contentState();
    assert.equal(afterRetry.version, 3);
    assert.equal(afterRetry.revision_count, beforeRestore.revision_count + 1);
    assert.equal(afterRetry.workflow_count, beforeRestore.workflow_count + 1);
    assert.equal(afterRetry.outbox_count, beforeRestore.outbox_count + 1);
    assert.equal(afterRetry.audit_count, 1);

    const auditQuery = [
      'SELECT actor_id,action,target_type,target_id,request_id,details',
      'FROM audit_events',
      "WHERE site_id=$1 AND action='content.draft_saved' AND target_type='content' AND target_id=$2",
    ].join('\n');
    const auditResult = await pool.query(auditQuery, [siteId, initial.id]);
    assert.equal(auditResult.rows.length, 1);
    assert.deepEqual(auditResult.rows[0], {
      actor_id: actor.id,
      action: 'content.draft_saved',
      target_type: 'content',
      target_id: initial.id,
      request_id: retryPayload.requestId,
      details: { version: 3 },
    });
  },
);
