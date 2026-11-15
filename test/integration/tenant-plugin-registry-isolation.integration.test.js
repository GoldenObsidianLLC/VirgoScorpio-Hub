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
  'tenant isolation: plugin registry listing, lifecycle actions, and invocation remain site-scoped',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const siteIds = [];
    const userIds = [];
    let roleId = null;
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      VIRGOSCORPIO_HUB_PLUGIN_EXECUTION_ENABLED: 'false',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const identity = createIdentityService({ pool, env });
    t.after(async () => {
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM sites WHERE id = ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      if (roleId) await pool.query('DELETE FROM roles WHERE id = $1', [roleId]).catch(() => {});
      await pool.end();
    });

    const siteAResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['tenant-plugin-a-' + randomUUID().slice(0, 8), 'Tenant Plugin Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      ['tenant-plugin-b-' + randomUUID().slice(0, 8), 'Tenant Plugin Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roleResult = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      ['tenant-plugin-' + randomUUID().slice(0, 10), 'Tenant Plugin Administrator', JSON.stringify(['*'])]
    );
    roleId = roleResult.rows[0].id;

    const password = 'Isolation-Password-2026';
    const passwordHash = await hashPassword(password);
    const actorResult = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['tenant-plugin-actor-' + randomUUID() + '@example.test', 'Site B Plugin Administrator', passwordHash]
    );
    const actor = actorResult.rows[0];
    userIds.push(actor.id);

    const reviewerResult = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['tenant-plugin-reviewer-' + randomUUID() + '@example.test', 'Site B Independent Plugin Reviewer', passwordHash]
    );
    const reviewer = reviewerResult.rows[0];
    userIds.push(reviewer.id);

    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3),($1,$4,$3)',
      [siteB, actor.id, roleId, reviewer.id]
    );

    const pluginName = 'tenant-isolation-plugin';
    const imageDigest = 'registry.example/tenant/isolated-plugin@sha256:' + 'b'.repeat(64);
    const sbomDigest = 'c'.repeat(64);
    const manifest = JSON.stringify({
      name: pluginName,
      version: '1.0.0',
      apiVersion: 1,
      capabilities: ['content:read'],
    });
    const insertPlugin = async siteId => {
      const result = await pool.query(
        "INSERT INTO plugin_installs(site_id,name,version,api_version,status,source_type,image_digest,artifact_digest,sbom_reference,sbom_digest,provenance,signature_verified,manifest,requested_capabilities,approved_capabilities) " +
        "VALUES($1,$2,'1.0.0',1,'pending','oci-image',$3,$4,$5,$6,'{}'::jsonb,true,$7::jsonb,'[\"content:read\"]'::jsonb,'[]'::jsonb) RETURNING id",
        [siteId, pluginName, imageDigest, 'b'.repeat(64), 'artifact://tenant-plugin.sbom.json', sbomDigest, manifest]
      );
      return result.rows[0];
    };
    const pluginA = await insertPlugin(siteA);
    const pluginB = await insertPlugin(siteB);

    const actorSession = await identity.login({ email: actor.email, password, ip: '127.0.0.1' });
    const reviewerSession = await identity.login({ email: reviewer.email, password, ip: '127.0.0.1' });
    assert.equal(actorSession.mfaRequired, false);
    assert.equal(reviewerSession.mfaRequired, false);

    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = 'http://127.0.0.1:' + server.address().port;
    const actorHeaders = {
      authorization: 'Bearer ' + actorSession.token,
      'x-virgoscorpio-hub-site-id': siteB,
    };
    const reviewerHeaders = {
      authorization: 'Bearer ' + reviewerSession.token,
      'x-virgoscorpio-hub-site-id': siteB,
    };
    const snapshot = async () => {
      const result = await pool.query(
        'SELECT id,site_id,status,approved_by,approved_capabilities,security_reviewed_at,security_reviewed_by,updated_at FROM plugin_installs WHERE id=ANY($1::uuid[]) ORDER BY site_id,id',
        [[pluginA.id, pluginB.id]]
      );
      return result.rows;
    };
    const invocationCount = async () => {
      const result = await pool.query(
        'SELECT count(*)::int AS count FROM plugin_invocations WHERE site_id=ANY($1::uuid[])',
        [[siteA, siteB]]
      );
      return result.rows[0].count;
    };
    const actionRequest = (pluginId, action, body, headers) => fetch(
      base + '/api/v1/plugins/' + pluginId + '/' + action,
      {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ siteId: siteB, ...(body || {}) }),
      }
    );

    const auditRows = async (action, targetId) => {
      const result = await pool.query(
        'SELECT id,site_id,actor_id,action,target_type,target_id,request_id,details FROM audit_events WHERE site_id=$1 AND action=$2 AND target_type=$3 AND target_id=$4 ORDER BY id',
        [siteB, action, 'plugin', targetId]
      );
      return result.rows;
    };
    const withAuditFailure = async (action, operation) => {
      const suffix = randomUUID().replace(/-/g, '');
      const functionName = 'plugin_audit_failure_' + suffix;
      const triggerName = 'plugin_audit_failure_' + suffix;
      await pool.query(
        "CREATE FUNCTION " + functionName + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.site_id = TG_ARGV[0]::uuid AND NEW.action = TG_ARGV[1] THEN RAISE EXCEPTION 'simulated plugin audit persistence failure'; END IF; RETURN NEW; END; $$"
      );
      await pool.query(
        "CREATE TRIGGER " + triggerName + " BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION " + functionName + "('" + siteB + "','" + action + "')"
      );
      try {
        return await operation();
      } finally {
        await pool.query("DROP TRIGGER IF EXISTS " + triggerName + " ON audit_events").catch(() => {});
        await pool.query("DROP FUNCTION IF EXISTS " + functionName + "()").catch(() => {});
      }
    };
    const registrationBody = {
      siteId: siteB,
      sourceType: 'npm-archive',
      packageSha256: 'd'.repeat(64),
      manifest: { name: 'plugin-audit-atomicity', version: '1.0.0', apiVersion: 1, title: 'Plugin Audit Atomicity', description: 'Integration fixture for plugin lifecycle transaction guarantees.', capabilities: ['content:read'] },
    };
    const registerRequest = () => fetch(base + '/api/v1/plugins/register', {
      method: 'POST',
      headers: { ...actorHeaders, 'content-type': 'application/json' },
      body: JSON.stringify(registrationBody),
    });
    const waitForPluginLockWaiters = async expectedQueryFragments => {
      const deadline = Date.now() + 10_000;
      let observed = [];
      while (Date.now() < deadline) {
        const waiting = await pool.query(
          "SELECT lower(query) AS query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND datname=current_database() AND wait_event_type='Lock'"
        );
        observed = waiting.rows.map(row => row.query);
        const matched = expectedQueryFragments.every(fragment => observed.some(query => query.includes(fragment)));
        if (matched) return;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      throw new Error(
        'Timed out waiting for plugin lifecycle queries to queue: ' +
        expectedQueryFragments.join(', ') +
        '; observed lock waiters: ' + JSON.stringify(observed)
      );
    };

    const failedRegistration = await withAuditFailure('plugin.registered', registerRequest);
    assert.equal(failedRegistration.status, 500);
    const rolledBackRegistration = await pool.query(
      'SELECT id FROM plugin_installs WHERE site_id=$1 AND name=$2',
      [siteB, registrationBody.manifest.name]
    );
    assert.equal(rolledBackRegistration.rowCount, 0, 'registration must roll back when its audit insert fails');
    const registeredResponse = await registerRequest();
    assert.equal(registeredResponse.status, 201);
    const registeredPlugin = (await registeredResponse.json()).plugin;
    const registrationAudits = await auditRows('plugin.registered', registeredPlugin.id);
    assert.equal(registrationAudits.length, 1, 'successful registration retry must create exactly one audit row');
    assert.equal(registrationAudits[0].actor_id, actor.id);

    const listed = await fetch(base + '/api/v1/plugins', { headers: actorHeaders });
    assert.equal(listed.status, 200);
    const listedPayload = await listed.json();
    assert.ok(listedPayload.plugins.some(plugin => plugin.id === pluginB.id));
    assert.equal(listedPayload.plugins.some(plugin => plugin.id === pluginA.id), false);

    const beforeForeignActions = await snapshot();
    const foreignActions = [
      ['approve', { approvedCapabilities: ['content:read'] }],
      ['security-review', {}],
      ['activate', {}],
      ['disable', {}],
      ['invoke', { action: 'run', input: {} }],
    ];
    for (const [action, body] of foreignActions) {
      const response = await actionRequest(pluginA.id, action, body, actorHeaders);
      const payload = await response.json();
      assert.equal(response.status, 404, 'foreign plugin ' + action + ' must be indistinguishable from a missing Site B plugin');
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_NOT_FOUND');
    }

    const selectorMismatch = await fetch(base + '/api/v1/plugins/register', {
      method: 'POST',
      headers: { ...actorHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        siteId: siteA,
        sourceType: 'npm-archive',
        packageSha256: 'd'.repeat(64),
        manifest: { name: 'cross-site-registration', version: '1.0.0', apiVersion: 1, capabilities: [] },
      }),
    });
    assert.equal(selectorMismatch.status, 400);
    assert.equal((await selectorMismatch.json()).code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
    const unregistered = await pool.query(
      'SELECT id FROM plugin_installs WHERE site_id=ANY($1::uuid[]) AND name=$2',
      [[siteA, siteB], 'cross-site-registration']
    );
    assert.equal(unregistered.rowCount, 0, 'conflicting site selectors must not create a plugin registration');

    const afterForeignActions = await snapshot();
    assert.deepEqual(afterForeignActions, beforeForeignActions, 'foreign plugin actions must not mutate either site');
    assert.equal(await invocationCount(), 0, 'foreign invocation attempts must not create invocation records');

    const failedApproval = await withAuditFailure('plugin.approve', () => actionRequest(
      pluginB.id,
      'approve',
      { approvedCapabilities: ['content:read'] },
      actorHeaders
    ));
    assert.equal(failedApproval.status, 500);
    const approvalRollback = (await snapshot()).find(row => row.id === pluginB.id);
    assert.equal(approvalRollback.status, 'pending');
    assert.equal(approvalRollback.approved_by, null);
    assert.equal((await auditRows('plugin.approve', pluginB.id)).length, 0, 'failed approval must not leave an audit row');

    const approvedResponse = await actionRequest(
      pluginB.id,
      'approve',
      { approvedCapabilities: ['content:read'] },
      actorHeaders
    );
    assert.equal(approvedResponse.status, 200);
    assert.equal((await approvedResponse.json()).plugin.status, 'approved');
    assert.equal((await auditRows('plugin.approve', pluginB.id)).length, 1);

    const failedReview = await withAuditFailure(
      'plugin.security-review',
      () => actionRequest(pluginB.id, 'security-review', {}, reviewerHeaders)
    );
    assert.equal(failedReview.status, 500);
    const reviewRollback = (await snapshot()).find(row => row.id === pluginB.id);
    assert.equal(reviewRollback.status, 'approved');
    assert.equal(reviewRollback.security_reviewed_by, null);
    assert.equal(reviewRollback.security_reviewed_at, null);
    assert.equal((await auditRows('plugin.security-review', pluginB.id)).length, 0, 'failed security review must not leave an audit row');

    const reviewedResponse = await actionRequest(pluginB.id, 'security-review', {}, reviewerHeaders);
    assert.equal(reviewedResponse.status, 200);
    const reviewedState = await snapshot();
    const siteAAfterReview = reviewedState.find(row => row.id === pluginA.id);
    const siteBAfterReview = reviewedState.find(row => row.id === pluginB.id);
    assert.equal(siteAAfterReview.status, 'pending');
    assert.equal(siteAAfterReview.approved_by, null);
    assert.equal(siteBAfterReview.status, 'approved');
    assert.equal(siteBAfterReview.approved_by, actor.id);
    assert.equal(siteBAfterReview.security_reviewed_by, reviewer.id);
    assert.ok(siteBAfterReview.security_reviewed_at);
    assert.equal((await auditRows('plugin.security-review', pluginB.id)).length, 1);

    const activationDisabled = await actionRequest(pluginB.id, 'activate', {}, actorHeaders);
    assert.equal(activationDisabled.status, 503);
    assert.equal((await activationDisabled.json()).code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_EXECUTION_DISABLED');
    const stillApproved = await snapshot();
    assert.equal(stillApproved.find(row => row.id === pluginB.id).status, 'approved');

    env.VIRGOSCORPIO_HUB_PLUGIN_EXECUTION_ENABLED = 'true';
    const failedActivation = await withAuditFailure(
      'plugin.activate',
      () => actionRequest(pluginB.id, 'activate', {}, actorHeaders)
    );
    assert.equal(failedActivation.status, 500);
    assert.equal((await snapshot()).find(row => row.id === pluginB.id).status, 'approved');
    assert.equal((await auditRows('plugin.activate', pluginB.id)).length, 0, 'failed activation must not leave an audit row');

    const activated = await actionRequest(pluginB.id, 'activate', {}, actorHeaders);
    assert.equal(activated.status, 200);
    assert.equal((await activated.json()).plugin.status, 'active');
    assert.equal((await auditRows('plugin.activate', pluginB.id)).length, 1);
    env.VIRGOSCORPIO_HUB_PLUGIN_EXECUTION_ENABLED = 'false';

    const failedDisable = await withAuditFailure(
      'plugin.disable',
      () => actionRequest(pluginB.id, 'disable', {}, actorHeaders)
    );
    assert.equal(failedDisable.status, 500);
    assert.equal((await snapshot()).find(row => row.id === pluginB.id).status, 'active');
    assert.equal((await auditRows('plugin.disable', pluginB.id)).length, 0, 'failed disable must not leave an audit row');

    const disabled = await actionRequest(pluginB.id, 'disable', {}, actorHeaders);
    assert.equal(disabled.status, 200);
    assert.equal((await disabled.json()).plugin.status, 'disabled');
    assert.equal((await auditRows('plugin.disable', pluginB.id)).length, 1);

    const invocation = await actionRequest(pluginB.id, 'invoke', { action: 'run', input: {} }, actorHeaders);
    assert.equal(invocation.status, 503);
    assert.equal((await invocation.json()).code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_EXECUTION_DISABLED');
    assert.equal(await invocationCount(), 0, 'disabled execution must not call a runner or persist invocation records');
    // Hold the replacement registration inside its audit transaction until the reviewer
    // is confirmed waiting on the row lock. This removes scheduler/lock-queue ambiguity.
    await pool.query(
      "UPDATE plugin_installs SET status='approved',approved_by=$3,approved_capabilities=$4::jsonb,source_type='oci-image',image_digest=$5,artifact_digest=$6,sbom_reference=$7,sbom_digest=$8,signature_verified=true,security_reviewed_at=NULL,security_reviewed_by=NULL WHERE site_id=$1 AND id=$2",
      [siteB, pluginB.id, actor.id, JSON.stringify(['content:read']), imageDigest, 'b'.repeat(64), 'artifact://tenant-plugin.sbom.json', sbomDigest]
    );

    const replacementManifest = {
      name: pluginName,
      version: '2.0.0',
      apiVersion: 1,
      title: 'Plugin Audit Atomicity Replacement',
      description: 'Replacement artifact for the re-registration concurrency regression.',
      capabilities: ['content:read'],
    };
    const suffix = randomUUID().replace(/-/g, '');
    const functionName = 'plugin_reregister_gate_' + suffix;
    const triggerName = 'plugin_reregister_gate_' + suffix;
    const advisoryKey = randomUUID().replace(/-/g, '');
    const advisoryKeyA = Number.parseInt(advisoryKey.slice(0, 8), 16) | 0;
    const advisoryKeyB = Number.parseInt(advisoryKey.slice(8, 16), 16) | 0;
    const gateClient = await pool.connect();
    let advisoryLockHeld = false;
    let triggerInstalled = false;
    let reRegistration;
    let concurrentReview;
    try {
      await gateClient.query('SELECT pg_advisory_lock($1, $2)', [advisoryKeyA, advisoryKeyB]);
      advisoryLockHeld = true;
      await pool.query(
        "CREATE FUNCTION " + functionName + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.site_id = TG_ARGV[0]::uuid AND NEW.action = TG_ARGV[3] THEN PERFORM pg_advisory_xact_lock(TG_ARGV[1]::integer, TG_ARGV[2]::integer); END IF; RETURN NEW; END; $$"
      );
      await pool.query(
        "CREATE TRIGGER " + triggerName + " BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION " +
        functionName + "('" + siteB + "','" + advisoryKeyA + "','" + advisoryKeyB + "','plugin.registered')"
      );
      triggerInstalled = true;

      reRegistration = fetch(base + '/api/v1/plugins/register', {
        method: 'POST',
        headers: { ...actorHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({ siteId: siteB, sourceType: 'oci-image', imageDigest, manifest: replacementManifest }),
      });
      // The replacement upsert has acquired the registry row lock and is paused
      // in its audit trigger before COMMIT.
      await waitForPluginLockWaiters(['insert into audit_events']);

      concurrentReview = actionRequest(pluginB.id, 'security-review', {}, reviewerHeaders);
      // The reviewer must now be blocked by the replacement registration's row lock.
      await waitForPluginLockWaiters([
        'insert into audit_events',
        'select * from plugin_installs where site_id=$1 and id=$2 for update',
      ]);

      await gateClient.query('SELECT pg_advisory_unlock($1, $2)', [advisoryKeyA, advisoryKeyB]);
      advisoryLockHeld = false;

      const reRegistrationResponse = await reRegistration;
      assert.equal(reRegistrationResponse.status, 201, 'replacement registration should commit first');
      const concurrentReviewResponse = await concurrentReview;
      assert.equal(concurrentReviewResponse.status, 409, 'review must re-read and reject the replacement pending artifact');
      assert.equal((await concurrentReviewResponse.json()).code, 'ERR_VIRGOSCORPIO_HUB_PLUGIN_NOT_APPROVED');
      const replacementState = (await snapshot()).find(row => row.id === pluginB.id);
      assert.equal(replacementState.status, 'pending');
      assert.equal(replacementState.approved_by, null);
      assert.equal(replacementState.security_reviewed_by, null);
      assert.equal(replacementState.security_reviewed_at, null);
      assert.equal((await auditRows('plugin.registered', pluginB.id)).length, 1);
      assert.equal((await auditRows('plugin.security-review', pluginB.id)).length, 1, 'the stale reviewer must not audit the replacement artifact');
    } finally {
      if (advisoryLockHeld) {
        await gateClient.query('SELECT pg_advisory_unlock($1, $2)', [advisoryKeyA, advisoryKeyB]).catch(() => {});
      }
      if (reRegistration) await reRegistration.catch(() => {});
      if (concurrentReview) await concurrentReview.catch(() => {});
      if (triggerInstalled) await pool.query("DROP TRIGGER IF EXISTS " + triggerName + " ON audit_events").catch(() => {});
      await pool.query("DROP FUNCTION IF EXISTS " + functionName + "()").catch(() => {});
      gateClient.release();
    }

    // Restore the fixture's final disabled state after the deliberate re-registration.
    const disabledAfterConcurrency = await actionRequest(pluginB.id, 'disable', {}, actorHeaders);
    assert.equal(disabledAfterConcurrency.status, 200);
    assert.equal((await disabledAfterConcurrency.json()).plugin.status, 'disabled');
    assert.equal((await auditRows('plugin.disable', pluginB.id)).length, 2);

    const finalState = await snapshot();
    assert.equal(finalState.find(row => row.id === pluginA.id).status, 'pending');
    assert.equal(finalState.find(row => row.id === pluginB.id).status, 'disabled');
  }
);
