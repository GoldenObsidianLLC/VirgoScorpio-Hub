'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool, createPostgresStore } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

async function contentSideEffects(pool, siteId, contentId) {
  const result = await pool.query(
    `SELECT ci.status, ci.version, ci.lock_version,
       (SELECT count(*)::int FROM content_revisions r WHERE r.content_id=ci.id) AS revision_count,
       (SELECT count(*)::int FROM workflow_events w WHERE w.site_id=ci.site_id AND w.content_id=ci.id) AS workflow_count,
       (SELECT count(*)::int FROM outbox_events o WHERE o.site_id=ci.site_id AND o.aggregate_id=ci.id) AS outbox_count,
       (SELECT count(*)::int FROM content_collaboration_documents d WHERE d.content_id=ci.id) AS collaboration_document_count,
       (SELECT count(*)::int FROM content_collaboration_operations op WHERE op.content_id=ci.id) AS collaboration_operation_count
       FROM content_items ci
       WHERE ci.site_id=$1 AND ci.id=$2 AND ci.deleted_at IS NULL`,
    [siteId, contentId]
  );
  return result.rows[0] || null;
}

test(
  'tenant isolation: a site B member cannot read, restore, publish, or collaborate on a site A content ID',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const store = createPostgresStore({ pool });
    const siteIds = [];
    const userIds = [];
    let roleId = null;
    let editorRoleId = null;
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      AI_PROVIDER: 'mock',
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
      if (roleId) await pool.query('DELETE FROM roles WHERE id=$1', [roleId]).catch(() => {});
      if (editorRoleId) await pool.query('DELETE FROM roles WHERE id=$1', [editorRoleId]).catch(() => {});
      await pool.end();
    });

    const siteAResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-object-a-${randomUUID().slice(0, 8)}`, 'Tenant Object Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-object-b-${randomUUID().slice(0, 8)}`, 'Tenant Object Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [`tenant-object-${randomUUID().slice(0, 10)}`, 'Tenant Object Test Administrator', JSON.stringify(['*'])]
    );
    roleId = roleResult.rows[0].id;

    const password = 'Isolation-Password-2026';
    const actorResult = await pool.query(
      `INSERT INTO users(email,display_name,password_hash,status)
       VALUES($1,$2,$3,'active') RETURNING id,email`,
      [`tenant-object-actor-${randomUUID()}@example.test`, 'Site B Actor', await hashPassword(password)]
    );
    const actor = actorResult.rows[0];
    userIds.push(actor.id);

    const authorResult = await pool.query(
      `INSERT INTO users(email,display_name,status)
       VALUES($1,$2,'active') RETURNING id`,
      [`tenant-object-author-${randomUUID()}@example.test`, 'Site A Author']
    );
    const authorId = authorResult.rows[0].id;
    userIds.push(authorId);

    // The actor belongs only to B; the foreign content and its author belong to A.
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteB, actor.id, roleId]
    );

    const editorRoleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      [
        `tenant-object-editor-${randomUUID().slice(0, 10)}`,
        'Tenant Object Site B Editor',
        JSON.stringify(['content:read', 'content:create', 'content:edit']),
      ]
    );
    editorRoleId = editorRoleResult.rows[0].id;
    const editorPassword = 'Editor-Password-2026';
    const editorResult = await pool.query(
      `INSERT INTO users(email,display_name,password_hash,status)
       VALUES($1,$2,$3,'active') RETURNING id,email`,
      [
        `tenant-object-editor-${randomUUID()}@example.test`,
        'Site B Editor Without Site Management',
        await hashPassword(editorPassword),
      ]
    );
    const editor = editorResult.rows[0];
    userIds.push(editor.id);
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteB, editor.id, editorRoleId]
    );

    const document = {
      schemaVersion: 1,
      documentId: randomUUID(),
      type: 'page',
      title: 'Private Site A Draft',
      children: [{
        id: 'heading-private',
        type: 'widget.heading',
        props: { text: 'Site A only' },
        children: [],
      }],
    };
    const foreignContent = await store.saveDraft({
      siteId: siteA,
      title: 'Private Site A Draft',
      slug: `private-site-a-${randomUUID().slice(0, 8)}`,
      locale: 'en',
      contentType: 'page',
      document,
      authorId,
      note: 'tenant object isolation fixture',
    });

    const ownDocument = {
      schemaVersion: 1,
      documentId: randomUUID(),
      type: 'page',
      title: 'Site B Control Draft',
      children: [],
    };
    const ownContent = await store.saveDraft({
      siteId: siteB,
      title: 'Site B Control Draft',
      slug: `site-b-control-${randomUUID().slice(0, 8)}`,
      locale: 'en',
      contentType: 'page',
      document: ownDocument,
      authorId: actor.id,
      note: 'positive control',
    });

    const ownContentTarget = await store.saveDraft({
      siteId: siteB,
      title: 'Site B Relationship Target',
      slug: 'site-b-relationship-target-' + randomUUID().slice(0, 8),
      locale: 'en',
      contentType: 'page',
      document: {
        schemaVersion: 1,
        documentId: randomUUID(),
        type: 'page',
        title: 'Site B Relationship Target',
        children: [],
      },
      authorId: actor.id,
      note: 'relationship positive control',
    });
    const session = await identity.login({
      email: actor.email,
      password,
      ip: '127.0.0.1',
      userAgent: 'tenant-object-isolation-test',
    });
    assert.equal(session.mfaRequired, false);
    const editorSession = await identity.login({
      email: editor.email,
      password: editorPassword,
      ip: '127.0.0.1',
      userAgent: 'tenant-object-editor-role-test',
    });
    assert.equal(editorSession.mfaRequired, false);
    assert.equal(await identity.authorizeSite(editor.id, siteB, 'content:read'), true);
    assert.equal(await identity.authorizeSite(editor.id, siteB, 'site:manage'), false);

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

    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { authorization: `Bearer ${session.token}`, 'x-virgoscorpio-hub-site-id': siteB };
    const editorHeaders = { authorization: `Bearer ${editorSession.token}`, 'x-virgoscorpio-hub-site-id': siteB };
    const before = await contentSideEffects(pool, siteA, foreignContent.id);
    assert.ok(before, 'site A fixture must exist before adversarial requests');
    await t.test('relationship endpoints must belong to the selected site and valid same-site relationships still work', async () => {
      const foreignEndpoints = [
        { sourceId: ownContent.id, targetId: foreignContent.id },
        { sourceId: foreignContent.id, targetId: ownContent.id },
      ];

      for (const endpoints of foreignEndpoints) {
        const response = await fetch(base + '/api/v1/sites/' + siteB + '/relationships', {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ ...endpoints, kind: 'RELATED_TO' }),
        });
        const payload = await response.json();
        assert.equal(response.status, 404);
        assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_RELATIONSHIP_ENDPOINT_NOT_FOUND');
        assert.doesNotMatch(JSON.stringify(payload), /Private Site A Draft|Site A only/);

        const persisted = await pool.query(
          'SELECT id FROM content_relationships WHERE site_id=$1 AND source_id=$2 AND target_id=$3 AND kind=$4 AND deleted_at IS NULL',
          [siteB, endpoints.sourceId, endpoints.targetId, 'RELATED_TO']
        );
        assert.equal(persisted.rowCount, 0, 'foreign relationship attempts must not persist');
      }

      try {
        const validResponse = await fetch(base + '/api/v1/sites/' + siteB + '/relationships', {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            siteId: siteB,
            sourceId: ownContent.id,
            targetId: ownContentTarget.id,
            kind: 'RELATED_TO',
          }),
        });
        const validPayload = await validResponse.json();
        assert.equal(validResponse.status, 201, 'same-site relationship creation remains available');
        assert.equal(validPayload.relationship.site_id, siteB);
        assert.equal(validPayload.relationship.source_id, ownContent.id);
        assert.equal(validPayload.relationship.target_id, ownContentTarget.id);
        const upsertEvent = await pool.query(
          "SELECT site_id,classification,payload->>'siteId' AS payload_site_id FROM outbox_events WHERE aggregate_type=$1 AND aggregate_id=$2 AND event_type=$3",
          ['relationship', validPayload.relationship.id, 'relationship.upsert']
        );
        assert.equal(upsertEvent.rowCount, 1);
        assert.equal(upsertEvent.rows[0].site_id, siteB);
        assert.equal(upsertEvent.rows[0].classification, 'site-private');
        assert.equal(upsertEvent.rows[0].payload_site_id, siteB);

        const deleteResponse = await fetch(base + '/api/v1/sites/' + siteB + '/relationships/' + validPayload.relationship.id, {
          method: 'DELETE',
          headers,
        });
        assert.equal(deleteResponse.status, 200, 'same-site relationship deletion remains available');
        const deleteEvent = await pool.query(
          "SELECT site_id,classification,payload->>'siteId' AS payload_site_id FROM outbox_events WHERE aggregate_type=$1 AND aggregate_id=$2 AND event_type=$3",
          ['relationship', validPayload.relationship.id, 'relationship.delete']
        );
        assert.equal(deleteEvent.rowCount, 1);
        assert.equal(deleteEvent.rows[0].site_id, siteB);
        assert.equal(deleteEvent.rows[0].classification, 'site-private');
        assert.equal(deleteEvent.rows[0].payload_site_id, siteB);
      } finally {
        // The route emits a durable outbox event. Remove only this fixture's
        // relationship and matching event so later outage/replay tests retain
        // their empty-queue precondition.
        const created = await pool.query(
          'SELECT id FROM content_relationships WHERE site_id=$1 AND source_id=$2 AND target_id=$3 AND kind=$4',
          [siteB, ownContent.id, ownContentTarget.id, 'RELATED_TO']
        );
        const relationshipIds = created.rows.map(row => row.id);
        if (relationshipIds.length) {
          await pool.query(
            'DELETE FROM outbox_events WHERE aggregate_type=$1 AND aggregate_id=ANY($2::uuid[]) AND event_type=ANY($3::text[])',
            ['relationship', relationshipIds, ['relationship.upsert', 'relationship.delete']]
          );
          await pool.query(
            'DELETE FROM content_relationships WHERE site_id=$1 AND id=ANY($2::uuid[])',
            [siteB, relationshipIds]
          );
        }
      }
    });

    await t.test('taxonomy CRUD rejects conflicting site context and emits site-private outbox envelopes', async () => {
      const slug = 'site-b-taxonomy-' + randomUUID().slice(0, 8);
      const conflictingGet = await fetch(base + '/api/v1/sites/' + siteB + '/terms', {
        headers: { ...headers, 'x-virgoscorpio-hub-site-id': siteA },
      });
      assert.equal(conflictingGet.status, 400);
      assert.equal((await conflictingGet.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');

      const conflictingCreate = await fetch(base + '/api/v1/sites/' + siteB + '/terms', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ siteId: siteA, taxonomy: 'category', slug, label: 'Should Not Persist' }),
      });
      assert.equal(conflictingCreate.status, 400);
      assert.equal((await conflictingCreate.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
      const absent = await pool.query('SELECT id FROM taxonomy_terms WHERE site_id=$1 AND slug=$2', [siteB, slug]);
      assert.equal(absent.rowCount, 0, 'conflicting create must not persist a term');

      const createdResponse = await fetch(base + '/api/v1/sites/' + siteB + '/terms', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ taxonomy: 'category', slug, label: 'Site B Taxonomy', metadata: { source: 'tenant integration' } }),
      });
      assert.equal(createdResponse.status, 201);
      const created = (await createdResponse.json()).term;
      assert.ok(created?.id);

      const mismatchedUpdate = await fetch(base + '/api/v1/sites/' + siteB + '/terms/' + created.id, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ siteId: siteA, expectedVersion: created.version, label: 'Must Not Update' }),
      });
      assert.equal(mismatchedUpdate.status, 400);
      assert.equal((await mismatchedUpdate.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
      const unchanged = await pool.query('SELECT label,version FROM taxonomy_terms WHERE site_id=$1 AND id=$2', [siteB, created.id]);
      assert.equal(unchanged.rows[0].label, 'Site B Taxonomy');
      assert.equal(unchanged.rows[0].version, created.version);

      const updatedResponse = await fetch(base + '/api/v1/sites/' + siteB + '/terms/' + created.id, {
        method: 'PUT',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ expectedVersion: created.version, label: 'Site B Taxonomy Updated' }),
      });
      assert.equal(updatedResponse.status, 200);
      const updated = (await updatedResponse.json()).term;
      assert.equal(updated.version, created.version + 1);

      const conflictingDelete = await fetch(base + '/api/v1/sites/' + siteB + '/terms/' + created.id, {
        method: 'DELETE',
        headers: { ...headers, 'x-virgoscorpio-hub-site-id': siteA },
      });
      assert.equal(conflictingDelete.status, 400);
      assert.equal((await conflictingDelete.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
      const stillActive = await pool.query('SELECT deleted_at FROM taxonomy_terms WHERE site_id=$1 AND id=$2', [siteB, created.id]);
      assert.equal(stillActive.rows[0].deleted_at, null);

      const deletedResponse = await fetch(base + '/api/v1/sites/' + siteB + '/terms/' + created.id, {
        method: 'DELETE',
        headers,
      });
      assert.equal(deletedResponse.status, 200);

      const events = await pool.query(
        "SELECT event_type,aggregate_version,site_id,actor_id,correlation_id,classification,payload->>'siteId' AS payload_site_id,payload->>'status' AS payload_status FROM outbox_events WHERE aggregate_type='taxonomy-term' AND aggregate_id=$1 ORDER BY aggregate_version,event_type",
        [created.id]
      );
      assert.deepEqual(events.rows.map(row => ({
        event_type: row.event_type,
        aggregate_version: row.aggregate_version,
        site_id: row.site_id,
        actor_id: row.actor_id,
        classification: row.classification,
        payload_site_id: row.payload_site_id,
        payload_status: row.payload_status,
        hasCorrelation: Boolean(row.correlation_id),
      })), [
        { event_type: 'taxonomy.upsert', aggregate_version: created.version, site_id: siteB, actor_id: actor.id, classification: 'site-private', payload_site_id: siteB, payload_status: 'active', hasCorrelation: true },
        { event_type: 'taxonomy.upsert', aggregate_version: updated.version, site_id: siteB, actor_id: actor.id, classification: 'site-private', payload_site_id: siteB, payload_status: 'active', hasCorrelation: true },
        { event_type: 'taxonomy.delete', aggregate_version: updated.version + 1, site_id: siteB, actor_id: actor.id, classification: 'site-private', payload_site_id: siteB, payload_status: 'deleted', hasCorrelation: true },
      ]);
    });
    await t.test('custom content type registry and records remain isolated between sites with the same slug', async () => {
      const slug = 'tenant-portfolio-' + randomUUID().slice(0, 8);
      const siteALabel = 'Site A Private Portfolio Definition';
      const siteBLabel = 'Site B Portfolio Definition';
      const definition = label => ({
        apiVersion: 1,
        name: slug,
        label,
        version: 1,
        source: 'admin',
        fields: [{ name: 'title', type: 'string', required: true, maxLength: 180 }],
        capabilities: ['read', 'create', 'edit'],
        publicationPolicy: 'review-required',
      });

      // Site A owns an admin definition with the same slug used by Site B.
      // The Site B actor must never learn its label or schema through Site B routes.
      const siteADefinition = definition(siteALabel);
      await pool.query(
        `INSERT INTO content_type_definitions(site_id,slug,label,version,source,active,definition)
         VALUES($1,$2,$3,1,'admin',true,$4::jsonb)`,
        [siteA, slug, siteALabel, JSON.stringify(siteADefinition)]
      );

      const createdDefinition = await fetch(base + '/api/v1/content-types', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ definition: definition(siteBLabel) }),
      });
      assert.equal(createdDefinition.status, 201, 'the Site B administrator can create its own same-slug definition');
      const createdDefinitionBody = await createdDefinition.json();
      assert.equal(createdDefinitionBody.definition.name, slug);
      assert.equal(createdDefinitionBody.definition.label, siteBLabel);

      const registryResponse = await fetch(base + '/api/v1/content-types', { headers });
      assert.equal(registryResponse.status, 200);
      const registry = await registryResponse.json();
      const visibleDefinition = registry.definitions.find(item => item.name === slug);
      assert.equal(visibleDefinition?.label, siteBLabel);
      assert.equal(JSON.stringify(registry).includes(siteALabel), false, 'registry reads must not disclose another site definition');
      assert.equal(registry.conflicts.includes(slug), false, 'a same-slug definition in another site is not a conflict');

      const foreignTitle = 'Site A Private Custom Record ' + randomUUID();
      const foreignRecord = await store.saveDraft({
        siteId: siteA,
        title: foreignTitle,
        slug: 'site-a-portfolio-' + randomUUID().slice(0, 8),
        locale: 'en',
        contentType: slug,
        document: {
          schemaVersion: 1,
          documentType: 'custom:' + slug,
          fields: { title: foreignTitle },
        },
        authorId,
        note: 'tenant custom content type isolation fixture',
      });

      const ownTitle = 'Site B Portfolio Record ' + randomUUID();
      const createdRecordResponse = await fetch(base + '/api/v1/content-types/' + slug + '/records', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ title: ownTitle, values: { title: ownTitle } }),
      });
      assert.equal(createdRecordResponse.status, 201);
      const createdRecord = (await createdRecordResponse.json()).record;
      assert.ok(createdRecord?.id);
      assert.equal(createdRecord.site_id, siteB);

      const listResponse = await fetch(base + '/api/v1/content-types/' + slug + '/records?limit=100', { headers });
      assert.equal(listResponse.status, 200);
      const listed = (await listResponse.json()).items;
      assert.ok(listed.some(item => item.id === createdRecord.id), 'Site B record must remain visible to its owner');
      assert.equal(listed.some(item => item.id === foreignRecord.id), false, 'Site B list must exclude Site A records even when the type slug matches');
      assert.equal(JSON.stringify(listed).includes(foreignTitle), false, 'list responses must not disclose Site A record content');

      const foreignRead = await fetch(base + '/api/v1/content-types/' + slug + '/records/' + foreignRecord.id, { headers });
      assert.equal(foreignRead.status, 404, 'foreign record IDs must be indistinguishable from absent records in Site B');
      const foreignPayload = await foreignRead.json();
      assert.equal(JSON.stringify(foreignPayload).includes(foreignTitle), false);
      assert.equal(JSON.stringify(foreignPayload).includes(siteALabel), false);

      const ownRead = await fetch(base + '/api/v1/content-types/' + slug + '/records/' + createdRecord.id, { headers });
      assert.equal(ownRead.status, 200, 'Site B record detail remains available');
      const ownPayload = await ownRead.json();
      assert.equal(ownPayload.record.id, createdRecord.id);
      assert.equal(ownPayload.record.site_id, siteB);
      assert.equal(ownPayload.definition.label, siteBLabel);

      const conflictingRegistryRead = await fetch(base + '/api/v1/content-types?siteId=' + siteA, { headers });
      assert.equal(conflictingRegistryRead.status, 400, 'registry reads must reject a conflicting site selector');
      assert.equal((await conflictingRegistryRead.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');

      const rejectedTitle = 'Must Not Persist ' + randomUUID();
      const conflictingRecordWrite = await fetch(base + '/api/v1/content-types/' + slug + '/records', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ siteId: siteA, title: rejectedTitle, values: { title: rejectedTitle } }),
      });
      assert.equal(conflictingRecordWrite.status, 400, 'record writes must reject a conflicting body site selector');
      assert.equal((await conflictingRecordWrite.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
      const rejectedWrite = await pool.query(
        'SELECT id FROM content_items WHERE site_id=$1 AND content_type=$2 AND title=$3 AND deleted_at IS NULL',
        [siteB, slug, rejectedTitle]
      );
      assert.equal(rejectedWrite.rowCount, 0, 'rejected cross-site writes must not persist content');

      const concurrentLabels = [
        'Site B Concurrent Registry Revision A',
        'Site B Concurrent Registry Revision B',
      ];
      const concurrentResponses = await Promise.all(concurrentLabels.map(label => fetch(base + '/api/v1/content-types', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ definition: definition(label) }),
      })));
      assert.deepEqual(
        concurrentResponses.map(response => response.status),
        [201, 201],
        'both concurrent updates for the same site/slug must serialize successfully'
      );
      const concurrentPayloads = await Promise.all(concurrentResponses.map(response => response.json()));
      assert.deepEqual(
        concurrentPayloads.map(payload => payload.definition.version).sort((a, b) => a - b),
        [2, 3],
        'the advisory lock must assign distinct consecutive versions'
      );

      const siteBVersions = await pool.query(
        'SELECT version,active,label FROM content_type_definitions WHERE site_id=$1 AND slug=$2 ORDER BY version',
        [siteB, slug]
      );
      assert.deepEqual(
        siteBVersions.rows.map(row => ({ version: row.version, active: row.active })),
        [
          { version: 1, active: false },
          { version: 2, active: false },
          { version: 3, active: true },
        ],
        'only the newest Site B definition version may remain active'
      );
      const winningSiteBLabel = concurrentPayloads.find(payload => payload.definition.version === 3).definition.label;
      assert.equal(siteBVersions.rows[2].label, winningSiteBLabel);

      const currentRegistryResponse = await fetch(base + '/api/v1/content-types', { headers });
      assert.equal(currentRegistryResponse.status, 200);
      const currentRegistry = await currentRegistryResponse.json();
      const currentDefinition = currentRegistry.definitions.find(item => item.name === slug);
      assert.equal(currentDefinition?.version, 3);
      assert.equal(currentDefinition?.label, winningSiteBLabel);
      assert.equal(
        currentRegistry.definitions.filter(item => item.name === slug).length,
        1,
        'registry reads must expose exactly one active Site B definition for this slug'
      );

      const siteAVersions = await pool.query(
        'SELECT version,active,label FROM content_type_definitions WHERE site_id=$1 AND slug=$2 ORDER BY version',
        [siteA, slug]
      );
      assert.deepEqual(siteAVersions.rows, [
        { version: 1, active: true, label: siteALabel },
      ], 'Site B registry updates must not alter the same-slug Site A definition');
    });

    await t.test('content type definition writes require site management before persistence', async () => {
      const deniedSlug = 'unauthorized-registry-' + randomUUID().slice(0, 8);
      const deniedLabel = 'Must Not Persist Site B Editor Definition';
      const before = await pool.query(
        'SELECT count(*)::int AS count FROM content_type_definitions WHERE site_id=$1',
        [siteB]
      );

      const registryRead = await fetch(base + '/api/v1/content-types', { headers: editorHeaders });
      assert.equal(registryRead.status, 200, 'an editor with content:read may read the site-scoped registry');
      assert.equal(JSON.stringify(await registryRead.json()).includes(deniedLabel), false);

      const denied = await fetch(base + '/api/v1/content-types', {
        method: 'POST',
        headers: { ...editorHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          definition: {
            apiVersion: 1,
            name: deniedSlug,
            label: deniedLabel,
            version: 1,
            source: 'admin',
            fields: [{ name: 'title', type: 'string', required: true, maxLength: 180 }],
            capabilities: ['read', 'create', 'edit'],
            publicationPolicy: 'review-required',
          },
        }),
      });
      assert.equal(denied.status, 403);
      const deniedPayload = await denied.json();
      assert.equal(deniedPayload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.equal(JSON.stringify(deniedPayload).includes(deniedLabel), false);

      const [rows, after] = await Promise.all([
        pool.query(
          'SELECT id FROM content_type_definitions WHERE site_id=$1 AND slug=$2',
          [siteB, deniedSlug]
        ),
        pool.query(
          'SELECT count(*)::int AS count FROM content_type_definitions WHERE site_id=$1',
          [siteB]
        ),
      ]);
      assert.equal(rows.rowCount, 0, 'a member without site:manage must not persist a registry definition');
      assert.equal(after.rows[0].count, before.rows[0].count, 'denied registry writes must have no definition-row side effects');
    });

    const cases = [
      {
        name: 'page read',
        method: 'GET',
        path: `/api/v1/pages/${foreignContent.id}`,
        status: 404,
        body: null,
      },
      {
        name: 'revision history read',
        method: 'GET',
        path: `/api/v1/pages/${foreignContent.id}/revisions`,
        status: 404,
        body: null,
      },
      {
        name: 'collaboration sync read',
        method: 'GET',
        path: `/api/v1/pages/${foreignContent.id}/collaboration/sync?afterSequence=0`,
        status: 404,
        body: null,
      },
      {
        name: 'collaboration operation write',
        method: 'POST',
        path: `/api/v1/pages/${foreignContent.id}/collaboration/operations`,
        status: 404,
        body: { operation: {} },
      },
      {
        name: 'revision restore write',
        method: 'POST',
        path: `/api/v1/pages/${foreignContent.id}/restore/1`,
        status: 404,
        body: { expectedVersion: 1 },
      },
      {
        name: 'publish workflow write',
        method: 'POST',
        path: `/api/v1/pages/${foreignContent.id}/publish`,
        status: 404,
        body: { expectedVersion: 1 },
      },
    ];

    for (const scenario of cases) {
      await t.test(scenario.name, async () => {
        const response = await fetch(base + scenario.path, {
          method: scenario.method,
          headers: scenario.body
            ? { ...headers, 'content-type': 'application/json' }
            : headers,
          ...(scenario.body ? { body: JSON.stringify(scenario.body) } : {}),
        });
        const payload = await response.json();
        assert.equal(response.status, scenario.status, 'foreign object IDs must be scoped to the selected site');
        assert.ok(
          payload.code === 'ERR_VIRGOSCORPIO_HUB_CONTENT_NOT_FOUND' ||
          payload.code === 'ERR_VIRGOSCORPIO_HUB_REVISION_NOT_FOUND',
          'a foreign object must be indistinguishable from an absent object in the selected site'
        );
        assert.doesNotMatch(JSON.stringify(payload), /Private Site A Draft|Site A only/);
        assert.deepEqual(
          await contentSideEffects(pool, siteA, foreignContent.id),
          before,
          'denied foreign-object requests must not mutate content, revisions, workflow, outbox, or collaboration state'
        );
      });
    }

    const ownRead = await fetch(base + `/api/v1/pages/${ownContent.id}`, { headers });
    assert.equal(ownRead.status, 200, 'the actor must still be able to read content in site B');
    const ownPayload = await ownRead.json();
    assert.equal(ownPayload.content.id, ownContent.id);
    assert.equal(ownPayload.content.site_id, siteB);

    assert.equal(await store.getById({ siteId: siteA, id: foreignContent.id }) !== null, true);
    assert.equal(await store.getById({ siteId: siteB, id: foreignContent.id }), null);
  }
);
