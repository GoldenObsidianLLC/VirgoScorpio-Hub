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
  'PostgreSQL firewall rule create/delete mutations commit atomically with site security events',
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
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;
    const identity = createIdentityService({ pool, env });

    t.after(async () => {
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM site_security_events WHERE site_id=ANY($1::uuid[])', [siteIds]).catch(() => {});
        await pool.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (userIds.length) {
        await pool.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [userIds]).catch(() => {});
        await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
      }
      if (roleId) await pool.query('DELETE FROM roles WHERE id=$1', [roleId]).catch(() => {});
      await pool.end();
    });

    const insertSite = async (prefix, name) => {
      const result = await pool.query(
        'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
        [prefix + randomUUID().slice(0, 8), name]
      );
      siteIds.push(result.rows[0].id);
      return result.rows[0].id;
    };
    const siteA = await insertSite('firewall-a-', 'Firewall Atomicity Site A');
    const siteB = await insertSite('firewall-b-', 'Firewall Atomicity Site B');

    const role = await pool.query(
      'INSERT INTO roles(slug,label,capabilities) VALUES($1,$2,$3::jsonb) RETURNING id',
      ['firewall-' + randomUUID().slice(0, 10), 'Firewall Test Administrator', JSON.stringify(['*'])]
    );
    roleId = role.rows[0].id;

    const password = 'Firewall-Atomicity-2026';
    const user = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['firewall-actor-' + randomUUID() + '@example.test', 'Firewall Test Administrator', await hashPassword(password)]
    );
    userIds.push(user.rows[0].id);
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteA, user.rows[0].id, roleId]
    );
    const foreignUser = await pool.query(
      "INSERT INTO users(email,display_name,password_hash,status) VALUES($1,$2,$3,'active') RETURNING id,email",
      ['firewall-foreign-' + randomUUID() + '@example.test', 'Firewall Site B Administrator', await hashPassword(password)]
    );
    userIds.push(foreignUser.rows[0].id);
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteB, foreignUser.rows[0].id, roleId]
    );
    const session = await identity.login({ email: user.rows[0].email, password, ip: '127.0.0.1' });
    const foreignSession = await identity.login({ email: foreignUser.rows[0].email, password, ip: '127.0.0.1' });
    assert.equal(session.mfaRequired, false);
    assert.equal(foreignSession.mfaRequired, false);

    server = createApiServer({ env, pool, identityService: identity, logger: { error() {} } });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = {
      authorization: 'Bearer ' + session.token,
      'x-virgoscorpio-hub-site-id': siteA,
      'content-type': 'application/json',
    };

    const createRule = (siteId, pattern) => fetch(
      base + '/api/v1/sites/' + siteId + '/security/firewall-rules',
      {
        method: 'POST',
        headers: { ...headers, 'x-virgoscorpio-hub-site-id': siteId },
        body: JSON.stringify({ siteId, action: 'deny', scope: 'ip', pattern, reason: 'F1.36 integration fixture' }),
      }
    );
    const foreignHeaders = {
      authorization: 'Bearer ' + foreignSession.token,
      'x-virgoscorpio-hub-site-id': siteA,
      'content-type': 'application/json',
    };
    const deleteRule = (siteId, ruleId, authHeaders = headers) => fetch(
      base + '/api/v1/sites/' + siteId + '/security/firewall-rules/' + ruleId,
      { method: 'DELETE', headers: { ...authHeaders, 'x-virgoscorpio-hub-site-id': siteId } }
    );
    const ruleRows = async (siteId, pattern) => {
      const result = await pool.query(
        'SELECT id,site_id,pattern FROM firewall_rules WHERE site_id=$1 AND pattern=$2',
        [siteId, pattern]
      );
      return result.rows;
    };
    const eventRows = async (siteId, eventType) => {
      const result = await pool.query(
        'SELECT id,site_id,request_id,event_type,severity,actor_id,details FROM site_security_events WHERE site_id=$1 AND event_type=$2 ORDER BY created_at,id',
        [siteId, eventType]
      );
      return result.rows;
    };
    const withEventFailure = async (siteId, eventType, operation) => {
      const suffix = randomUUID().replace(/-/g, '');
      const functionName = 'firewall_event_failure_' + suffix;
      const triggerName = 'firewall_event_failure_' + suffix;
      await pool.query(
        "CREATE FUNCTION " + functionName + "() RETURNS trigger LANGUAGE plpgsql AS $$ " +
        "BEGIN IF NEW.site_id = TG_ARGV[0]::uuid AND NEW.event_type = TG_ARGV[1] " +
        "THEN RAISE EXCEPTION 'simulated firewall security event failure'; END IF; " +
        "RETURN NEW; END; $$"
      );
      await pool.query(
        "CREATE TRIGGER " + triggerName +
        " BEFORE INSERT ON site_security_events FOR EACH ROW EXECUTE FUNCTION " +
        functionName + "('" + siteId + "','" + eventType + "')"
      );
      try {
        return await operation();
      } finally {
        await pool.query('DROP TRIGGER IF EXISTS ' + triggerName + ' ON site_security_events').catch(() => {});
        await pool.query('DROP FUNCTION IF EXISTS ' + functionName + '()').catch(() => {});
      }
    };

    const createdPattern = '192.0.2.36';
    const failedCreate = await withEventFailure(siteA, 'firewall.rule_created', () => createRule(siteA, createdPattern));
    assert.equal(failedCreate.status, 500, 'event failure must fail the create request');
    assert.equal((await ruleRows(siteA, createdPattern)).length, 0, 'rule insert must roll back with its event');
    assert.equal((await eventRows(siteA, 'firewall.rule_created')).length, 0);

    const createdResponse = await createRule(siteA, createdPattern);
    assert.equal(createdResponse.status, 201);
    const createdPayload = await createdResponse.json();
    const ruleId = createdPayload.rule.id;
    const createdEvents = await eventRows(siteA, 'firewall.rule_created');
    assert.equal((await ruleRows(siteA, createdPattern)).length, 1);
    assert.equal(createdEvents.length, 1, 'successful create retry must write exactly one event');
    assert.equal(createdEvents[0].actor_id, user.rows[0].id);
    assert.equal(createdEvents[0].details.ruleId, ruleId);
    assert.equal(createdEvents[0].details.reason, undefined, 'security event details must not copy the free-form rule reason');

    const failedDelete = await withEventFailure(siteA, 'firewall.rule_deleted', () => deleteRule(siteA, ruleId));
    assert.equal(failedDelete.status, 500, 'event failure must fail the delete request');
    assert.equal((await ruleRows(siteA, createdPattern)).length, 1, 'delete must roll back when its event insert fails');
    assert.equal((await eventRows(siteA, 'firewall.rule_deleted')).length, 0);

    const deletedResponse = await deleteRule(siteA, ruleId);
    assert.equal(deletedResponse.status, 200);
    assert.equal((await ruleRows(siteA, createdPattern)).length, 0);
    const deletedEvents = await eventRows(siteA, 'firewall.rule_deleted');
    assert.equal(deletedEvents.length, 1, 'successful delete retry must write exactly one event');
    assert.equal(deletedEvents[0].actor_id, user.rows[0].id);
    assert.equal(deletedEvents[0].details.ruleId, ruleId);
    assert.equal(deletedEvents[0].details.action, 'deny');
    assert.equal(deletedEvents[0].details.scope, 'ip');

    const foreignPattern = '198.51.100.36';
    const foreignRule = await pool.query(
      "INSERT INTO firewall_rules(site_id,action,scope,pattern,reason,enabled,created_by) " +
      "VALUES($1,'deny','ip',$2,'foreign site fixture',true,$3) RETURNING id",
      [siteA, foreignPattern, user.rows[0].id]
    );
    const foreignDelete = await deleteRule(siteA, foreignRule.rows[0].id, foreignHeaders);
    assert.equal(foreignDelete.status, 403, 'Site B-only member must not reach Site A firewall rules');
    assert.equal((await ruleRows(siteA, foreignPattern)).length, 1);
    assert.equal((await eventRows(siteA, 'firewall.rule_deleted')).length, 1);
  }
);
