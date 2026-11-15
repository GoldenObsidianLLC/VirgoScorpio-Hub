'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool, createPostgresStore } = require('../../packages/db/src/postgres-store');
const { createIdentityService } = require('../../packages/auth/src/service');

const enabled = Boolean(process.env.DATABASE_URL && process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true');

test('PostgreSQL integration: page draft and content.draft_saved audit roll back and retry atomically', { skip: !enabled }, async t => {
  const pool = createPostgresPool({ DATABASE_URL: process.env.DATABASE_URL, DATABASE_POOL_MAX: '4' });
  const store = createPostgresStore({ pool });
  const identity = createIdentityService({ pool, env: { NODE_ENV: 'test' } });
  const siteId = randomUUID();
  const actorId = randomUUID();
  const slug = 'draft-audit-' + randomUUID().slice(0, 12);
  const triggerSuffix = randomUUID().replace(/-/g, '');
  const functionName = 'test_fail_draft_audit_' + triggerSuffix;
  const triggerName = 'test_fail_draft_audit_' + triggerSuffix;
  let triggerInstalled = false;
  await pool.query('INSERT INTO sites(id,slug,name) VALUES($1,$2,$3)', [siteId, slug, 'Draft Audit Integration Site']);
  await pool.query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [actorId, 'draft-audit-' + actorId + '@example.test', 'Draft Audit Actor']);
  t.after(async () => {
    await pool.query('DROP TRIGGER IF EXISTS ' + triggerName + ' ON audit_events').catch(() => {});
    await pool.query('DROP FUNCTION IF EXISTS ' + functionName + '()').catch(() => {});
    await pool.query('DELETE FROM audit_events WHERE site_id=$1', [siteId]).catch(() => {});
    await pool.query('DELETE FROM outbox_events WHERE site_id=$1', [siteId]).catch(() => {});
    await pool.query('DELETE FROM workflow_events WHERE site_id=$1', [siteId]).catch(() => {});
    await pool.query('DELETE FROM content_items WHERE site_id=$1', [siteId]).catch(() => {});
    await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => {});
    await pool.end();
  });

  const document = { schemaVersion: 1, documentId: 'audit-atomicity-' + randomUUID(), type: 'page', title: 'Atomic Draft', children: [] };
  const requestId = 'draft-audit-integration-' + randomUUID();
  const save = () => store.saveDraft({
    siteId, title: 'Atomic Draft', slug, locale: 'en', contentType: 'page', document, authorId: actorId, correlationId: requestId,
    onDraftSaved: async ({ queryable, result }) => identity.audit({
      siteId, actorId, action: 'content.draft_saved', targetType: 'content', targetId: result.id, requestId, details: { version: result.version },
    }, { queryable }),
  });

  await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.site_id = '${siteId}'::uuid AND NEW.action = 'content.draft_saved' THEN
        RAISE EXCEPTION 'simulated content draft audit failure' USING ERRCODE = '23505';
      END IF;
      RETURN NEW;
    END;
  $$`);
  await pool.query('CREATE TRIGGER ' + triggerName + ' BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ' + functionName + '()');
  triggerInstalled = true;

  await assert.rejects(save(), error => error.code === '23505' && error.code !== 'ERR_VIRGOSCORPIO_HUB_ROUTE_CONFLICT');
  const rolledBack = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM content_items WHERE site_id=$1 AND slug=$2) AS content_count,
      (SELECT count(*)::int FROM content_revisions r JOIN content_items c ON c.id=r.content_id WHERE c.site_id=$1 AND c.slug=$2) AS revision_count,
      (SELECT count(*)::int FROM workflow_events WHERE site_id=$1 AND action='draft_saved') AS workflow_count,
      (SELECT count(*)::int FROM outbox_events WHERE site_id=$1 AND event_type='content.upsert') AS outbox_count,
      (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND action='content.draft_saved') AS audit_count,
      (SELECT count(*)::int FROM content_collaboration_documents d JOIN content_items c ON c.id=d.content_id WHERE c.site_id=$1 AND c.slug=$2) AS collaboration_count
  `, [siteId, slug]);
  assert.deepEqual(rolledBack.rows[0], { content_count: 0, revision_count: 0, workflow_count: 0, outbox_count: 0, audit_count: 0, collaboration_count: 0 });

  await pool.query('DROP TRIGGER ' + triggerName + ' ON audit_events');
  await pool.query('DROP FUNCTION ' + functionName + '()');
  triggerInstalled = false;

  const saved = await save();
  assert.equal(saved.status, 'draft');
  assert.equal(saved.version, 1);
  const committed = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM content_items WHERE site_id=$1 AND id=$2) AS content_count,
      (SELECT count(*)::int FROM content_revisions WHERE content_id=$2) AS revision_count,
      (SELECT count(*)::int FROM workflow_events WHERE site_id=$1 AND content_id=$2 AND action='draft_saved') AS workflow_count,
      (SELECT count(*)::int FROM outbox_events WHERE site_id=$1 AND aggregate_id=$2 AND event_type='content.upsert') AS outbox_count,
      (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='content.draft_saved' AND request_id=$3) AS audit_count,
      (SELECT count(*)::int FROM content_collaboration_documents WHERE content_id=$2) AS collaboration_count
  `, [siteId, saved.id, requestId]);
  assert.deepEqual(committed.rows[0], { content_count: 1, revision_count: 1, workflow_count: 1, outbox_count: 1, audit_count: 1, collaboration_count: 1 });
});
