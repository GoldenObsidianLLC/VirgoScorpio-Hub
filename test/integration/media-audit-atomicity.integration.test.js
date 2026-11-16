'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService } = require('../../packages/auth/src/service');
const { createLocalMediaStore } = require('../../packages/media/src/local-store');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test(
  'PostgreSQL integration: media upload audit failure rolls back the asset and compensates bytes before a safe retry',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '6',
    });
    const identity = createIdentityService({ pool, env: { NODE_ENV: 'test' } });
    const siteId = randomUUID();
    const actorId = randomUUID();
    const suffix = randomUUID().slice(0, 12);
    const siteSlug = 'media-audit-atomicity-' + suffix;
    const mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio_hub-media-audit-'));
    let activeTrigger = null;
    let attemptedObjectKey = null;

    const store = createLocalMediaStore({ pool, root: mediaRoot });

    t.after(async () => {
      await removeAuditFailure().catch(() => {});
      await pool.query('DELETE FROM audit_events WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM media_assets WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => {});
      await fs.rm(mediaRoot, { recursive: true, force: true }).catch(() => {});
      await pool.end();
    });

    await pool.query('INSERT INTO sites(id,slug,name) VALUES($1,$2,$3)', [
      siteId, siteSlug, 'Media Audit Atomicity Integration Site',
    ]);
    await pool.query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [
      actorId, 'media-audit-' + actorId + '@example.test', 'Media Audit Actor',
    ]);

    async function installAuditFailure() {
      const triggerSuffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_fail_media_audit_' + triggerSuffix;
      const triggerName = functionName;
      await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.site_id = '${siteId}'::uuid AND NEW.action = 'media.uploaded' THEN
            RAISE EXCEPTION 'simulated media audit failure' USING ERRCODE = '23505';
          END IF;
          RETURN NEW;
        END;
      $$`);
      await pool.query(
        'CREATE TRIGGER ' + triggerName + ' BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION ' + functionName + '()'
      );
      activeTrigger = { triggerName, functionName };
    }

    async function removeAuditFailure() {
      if (!activeTrigger) return;
      await pool.query('DROP TRIGGER IF EXISTS ' + activeTrigger.triggerName + ' ON audit_events');
      await pool.query('DROP FUNCTION IF EXISTS ' + activeTrigger.functionName + '()');
      activeTrigger = null;
    }

    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const requestId = 'media-upload-' + randomUUID();

    async function upload() {
      return store.upload({
        siteId,
        actorId,
        dataBase64: image.toString('base64'),
        mimeType: 'image/png',
        altText: 'atomicity integration fixture',
        isPublic: false,
        onAssetUploaded: async ({ queryable, result }) => {
          attemptedObjectKey = result.storage_key;
          await identity.audit({
            siteId,
            actorId,
            action: 'media.uploaded',
            targetType: 'media',
            targetId: result.id,
            requestId,
            details: {
              mimeType: result.mime_type,
              byteSize: result.byte_size,
            },
          }, { queryable });
        },
      });
    }

    await installAuditFailure();
    await assert.rejects(upload(), error => error.code === '23505');
    const failedObjectKey = attemptedObjectKey;
    assert.ok(failedObjectKey, 'the callback must receive the inserted media asset');
    assert.equal(await fileExists(path.join(mediaRoot, ...failedObjectKey.split('/'))), false);

    const rolledBack = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM media_assets WHERE site_id=$1) AS asset_count,
        (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND action='media.uploaded') AS audit_count
    `, [siteId]);
    assert.deepEqual(rolledBack.rows[0], { asset_count: 0, audit_count: 0 });

    await removeAuditFailure();
    attemptedObjectKey = null;
    const asset = await upload();
    assert.equal(asset.site_id, siteId);
    assert.equal(asset.publicly_accessible, false);
    assert.ok(attemptedObjectKey, 'the retry callback must receive a new media asset');
    assert.equal(asset.storage_key, attemptedObjectKey);
    assert.notEqual(asset.storage_key, failedObjectKey);
    assert.equal(await fileExists(path.join(mediaRoot, ...failedObjectKey.split('/'))), false);
    assert.equal(await fileExists(path.join(mediaRoot, ...asset.storage_key.split('/'))), true);

    const committed = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM media_assets WHERE site_id=$1 AND id=$2) AS asset_count,
        (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='media.uploaded') AS audit_count
    `, [siteId, asset.id]);
    assert.deepEqual(committed.rows[0], { asset_count: 1, audit_count: 1 });

    const audit = await pool.query(
      'SELECT action,target_type,target_id,request_id,details FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action=$3',
      [siteId, asset.id, 'media.uploaded']
    );
    assert.equal(audit.rows[0].action, 'media.uploaded');
    assert.equal(audit.rows[0].target_type, 'media');
    assert.equal(audit.rows[0].target_id, asset.id);
    assert.equal(audit.rows[0].request_id, requestId);
    assert.deepEqual(audit.rows[0].details, { mimeType: 'image/png', byteSize: image.length });
  }
);
