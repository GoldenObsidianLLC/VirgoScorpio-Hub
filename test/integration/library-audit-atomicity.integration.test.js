'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService } = require('../../packages/auth/src/service');
const { createLibraryStore } = require('../../packages/library/src/file-store');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

async function filesBelow(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(root, fullPath));
    else if (entry.isFile()) files.push(path.relative(root, fullPath));
  }
  return files.sort();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

test(
  'PostgreSQL integration: library upload and version audit failures roll back rows and compensate new objects',
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
    const siteSlug = 'library-audit-atomicity-' + suffix;
    const libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'virgoscorpio_hub-library-audit-'));
    let activeTrigger = null;

    const store = createLibraryStore({
      pool,
      root: libraryRoot,
      requireMalwareScan: true,
      malwareScanner: {
        engine: 'library-audit-integration',
        async scan() {
          return { clean: true, status: 'clean', engine: 'library-audit-integration' };
        },
      },
    });

    await pool.query('INSERT INTO sites(id,slug,name) VALUES($1,$2,$3)', [
      siteId, siteSlug, 'Library Audit Atomicity Integration Site',
    ]);
    await pool.query('INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)', [
      actorId, 'library-audit-' + actorId + '@example.test', 'Library Audit Actor',
    ]);

    async function installAuditFailure(action) {
      assert.ok(['library.asset_uploaded', 'library.asset_version_replaced'].includes(action));
      const triggerSuffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_fail_library_audit_' + triggerSuffix;
      const triggerName = functionName;
      await pool.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.site_id = '${siteId}'::uuid AND NEW.action = '${action}' THEN
            RAISE EXCEPTION 'simulated library audit failure' USING ERRCODE = '23505';
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

    t.after(async () => {
      await removeAuditFailure().catch(() => {});
      await pool.query('DELETE FROM audit_events WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM library_assets WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => {});
      await fs.rm(libraryRoot, { recursive: true, force: true }).catch(() => {});
      await pool.end();
    });

    await t.test('upload audit failure rolls back the asset and first version, removes bytes, and permits one safe retry', async () => {
      const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      const displayName = 'audit-upload-' + randomUUID();
      const requestId = 'library-upload-' + randomUUID();
      let failedAssetId = null;
      let failedObjectKey = null;
      let attemptedObjectKey = null;

      const upload = () => store.upload({
        siteId,
        actorId,
        category: 'image',
        dataBase64: image.toString('base64'),
        mimeType: 'image/png',
        fileName: 'uploaded.png',
        displayName,
        isPublic: false,
        onAssetUploaded: async ({ queryable, result }) => {
          attemptedObjectKey = siteId + '/' + result.id + '/v1.png';
          await identity.audit({
            siteId,
            actorId,
            action: 'library.asset_uploaded',
            targetType: 'library-asset',
            targetId: result.id,
            requestId,
            details: {
              kind: result.asset_kind,
              mimeType: result.mime_type,
              byteSize: result.byte_size,
              sha256: result.sha256,
            },
          }, { queryable });
        },
      });

      await installAuditFailure('library.asset_uploaded');
      await assert.rejects(upload(), error => error.code === '23505');
      failedAssetId = attemptedObjectKey ? attemptedObjectKey.split('/')[1] : null;
      failedObjectKey = attemptedObjectKey;
      assert.ok(failedAssetId, 'the store callback must run with the inserted asset');
      const rolledBack = await pool.query(`
        SELECT
          (SELECT count(*)::int FROM library_assets WHERE site_id=$1 AND id=$2) AS asset_count,
          (SELECT count(*)::int FROM library_asset_versions WHERE asset_id=$2) AS version_count,
          (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='library.asset_uploaded') AS audit_count
      `, [siteId, failedAssetId]);
      assert.deepEqual(rolledBack.rows[0], { asset_count: 0, version_count: 0, audit_count: 0 });
      assert.equal(await fileExists(path.join(libraryRoot, ...failedObjectKey.split('/'))), false);
      assert.deepEqual(await filesBelow(libraryRoot), []);

      await removeAuditFailure();
      attemptedObjectKey = null;
      const saved = await upload();
      const savedObjectKey = siteId + '/' + saved.id + '/v1.png';
      assert.equal(saved.version, 1);
      assert.equal(saved.status, 'active');
      assert.equal(await fileExists(path.join(libraryRoot, ...savedObjectKey.split('/'))), true);
      const committed = await pool.query(`
        SELECT
          (SELECT count(*)::int FROM library_assets WHERE site_id=$1 AND id=$2) AS asset_count,
          (SELECT count(*)::int FROM library_asset_versions WHERE asset_id=$2) AS version_count,
          (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='library.asset_uploaded' AND request_id=$3) AS audit_count,
          (SELECT details FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='library.asset_uploaded' AND request_id=$3 LIMIT 1) AS details
      `, [siteId, saved.id, requestId]);
      assert.equal(committed.rows[0].asset_count, 1);
      assert.equal(committed.rows[0].version_count, 1);
      assert.equal(committed.rows[0].audit_count, 1);
      assert.deepEqual(Object.keys(committed.rows[0].details).sort(), ['byteSize', 'kind', 'mimeType', 'sha256']);
      assert.equal(committed.rows[0].details.sha256, createHash('sha256').update(image).digest('hex'));
    });

    await t.test('version-replacement audit failure rolls back the version and preserves old bytes before a safe retry', async () => {
      const original = Buffer.from('original library asset version');
      const replacement = Buffer.from('replacement library asset version');
      const initial = await store.upload({
        siteId,
        actorId,
        category: 'document',
        dataBase64: original.toString('base64'),
        mimeType: 'text/plain',
        fileName: 'original.txt',
        displayName: 'audit-version-' + randomUUID(),
      });
      const initialRow = await pool.query(
        'SELECT id,version,status,storage_key,sha256,byte_size FROM library_assets WHERE site_id=$1 AND id=$2',
        [siteId, initial.id]
      );
      const oldRow = initialRow.rows[0];
      const oldPath = path.join(libraryRoot, ...oldRow.storage_key.split('/'));
      const filesBefore = await filesBelow(libraryRoot);
      const requestId = 'library-version-' + randomUUID();

      const replace = () => store.replaceVersion({
        siteId,
        id: initial.id,
        actorId,
        expectedVersion: 1,
        dataBase64: replacement.toString('base64'),
        mimeType: 'text/plain',
        fileName: 'replacement.txt',
        onVersionReplaced: async ({ queryable, result }) => identity.audit({
          siteId,
          actorId,
          action: 'library.asset_version_replaced',
          targetType: 'library-asset',
          targetId: initial.id,
          requestId,
          details: {
            version: result.version,
            mimeType: result.mime_type,
            sha256: result.sha256,
          },
        }, { queryable }),
      });

      await installAuditFailure('library.asset_version_replaced');
      await assert.rejects(replace(), error => error.code === '23505');
      const rolledBack = await pool.query(`
        SELECT
          (SELECT version FROM library_assets WHERE site_id=$1 AND id=$2) AS current_version,
          (SELECT count(*)::int FROM library_asset_versions WHERE asset_id=$2) AS version_count,
          (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='library.asset_version_replaced') AS audit_count
      `, [siteId, initial.id]);
      assert.deepEqual(rolledBack.rows[0], { current_version: 1, version_count: 1, audit_count: 0 });
      assert.equal(await fileExists(oldPath), true, 'the previous version object must remain');
      assert.deepEqual(await filesBelow(libraryRoot), filesBefore);

      await removeAuditFailure();
      const replaced = await replace();
      assert.equal(replaced.version, 2);
      assert.equal(replaced.status, 'active');
      assert.equal(await fileExists(oldPath), true);
      const committedAsset = await pool.query(
        'SELECT storage_key FROM library_assets WHERE site_id=$1 AND id=$2',
        [siteId, initial.id],
      );
      assert.equal(committedAsset.rows[0].storage_key.startsWith(siteId + '/' + initial.id + '/v2-'), true,
        'replacement writes use immutable randomized version keys');
      const committedPath = path.join(libraryRoot, ...committedAsset.rows[0].storage_key.split('/'));
      assert.equal(await fileExists(committedPath), true, 'the committed version object must exist at its persisted key');
      const committed = await pool.query(`
        SELECT
          (SELECT version FROM library_assets WHERE site_id=$1 AND id=$2) AS current_version,
          (SELECT count(*)::int FROM library_asset_versions WHERE asset_id=$2) AS version_count,
          (SELECT count(*)::int FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='library.asset_version_replaced' AND request_id=$3) AS audit_count,
          (SELECT details FROM audit_events WHERE site_id=$1 AND target_id=$2 AND action='library.asset_version_replaced' AND request_id=$3 LIMIT 1) AS details
      `, [siteId, initial.id, requestId]);
      assert.deepEqual(committed.rows[0], {
        current_version: 2,
        version_count: 2,
        audit_count: 1,
        details: { version: 2, mimeType: 'text/plain', sha256: createHash('sha256').update(replacement).digest('hex') },
      });
    });
  }
);
