'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService, digest } = require('../../packages/auth/src/service');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

test(
  'PostgreSQL integration: site invitation, mail outbox and creation audit commit or roll back together',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '6',
    });
    const identity = createIdentityService({
      pool,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        PUBLIC_BASE_URL: 'http://localhost:8787',
        VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS: 'true',
      },
    });
    const siteId = randomUUID();
    const actorId = randomUUID();
    const suffix = randomUUID().replace(/-/g, '');
    const siteSlug = 'invitation-audit-atomicity-' + suffix.slice(0, 12);
    const actorEmail = 'invitation-audit-actor-' + suffix + '@example.test';
    const invitedEmail = 'invitation-audit-target-' + suffix + '@example.test';
    const requestId = 'f1-43-invitation-create-' + suffix.slice(0, 24);
    let activeTrigger = null;

    async function removeAuditFailure() {
      if (!activeTrigger) return;
      await pool.query(
        'DROP TRIGGER IF EXISTS "' + activeTrigger.triggerName + '" ON audit_events'
      );
      await pool.query(
        'DROP FUNCTION IF EXISTS public."' + activeTrigger.functionName + '"()'
      );
      activeTrigger = null;
    }

    async function installAuditFailure() {
      await removeAuditFailure();
      const triggerSuffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_fail_invitation_create_audit_' + triggerSuffix;
      const triggerName = 'test_fail_invitation_create_audit_tr_' + triggerSuffix;
      await pool.query(
        'CREATE FUNCTION public."' + functionName + '"() RETURNS trigger LANGUAGE plpgsql AS $audit$ ' +
        'BEGIN ' +
        "IF NEW.site_id = '" + siteId + "'::uuid AND NEW.action = 'site.invitation_created' THEN " +
        "RAISE EXCEPTION 'simulated invitation creation audit failure' USING ERRCODE = 'P0001'; " +
        'END IF; ' +
        'RETURN NEW; ' +
        'END; ' +
        '$audit$'
      );
      await pool.query(
        'CREATE TRIGGER "' + triggerName + '" BEFORE INSERT ON audit_events ' +
        'FOR EACH ROW EXECUTE FUNCTION public."' + functionName + '"()'
      );
      activeTrigger = { functionName, triggerName };
    }

    async function createInvitation() {
      return identity.createInvitation({
        siteId,
        email: invitedEmail,
        roleSlug: 'editor',
        invitedBy: actorId,
        onInvitationCreated: ({ queryable, result }) => identity.audit({
          siteId,
          actorId,
          action: 'site.invitation_created',
          targetType: 'invitation',
          targetId: result.id,
          requestId,
          details: { email: result.email, role: result.role },
        }, { queryable }),
      });
    }

    t.after(async () => {
      await removeAuditFailure().catch(() => {});
      await pool.query('DELETE FROM audit_events WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query(
        "DELETE FROM mail_outbox WHERE recipient=$1 AND template='site-invitation'",
        [invitedEmail]
      ).catch(() => {});
      await pool.query('DELETE FROM site_invitations WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM site_memberships WHERE site_id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM sites WHERE id=$1', [siteId]).catch(() => {});
      await pool.query('DELETE FROM users WHERE id=$1', [actorId]).catch(() => {});
      await pool.end();
    });

    await pool.query(
      'INSERT INTO sites(id,slug,name) VALUES($1,$2,$3)',
      [siteId, siteSlug, 'Invitation Audit Atomicity Integration Site']
    );
    await pool.query(
      'INSERT INTO users(id,email,display_name) VALUES($1,$2,$3)',
      [actorId, actorEmail, 'Invitation Audit Atomicity Actor']
    );
    const role = await pool.query("SELECT id FROM roles WHERE slug='editor'");
    assert.equal(role.rowCount, 1, 'the editor seed role must exist');
    const ownerRole = await pool.query("SELECT id FROM roles WHERE slug='site-owner'");
    assert.equal(ownerRole.rowCount, 1, 'the site-owner seed role must exist');
    await pool.query(
      'INSERT INTO site_memberships(site_id,user_id,role_id) VALUES($1,$2,$3)',
      [siteId, actorId, ownerRole.rows[0].id]
    );

    await t.test('audit failure rolls back the active invitation upsert and mail outbox row', async () => {
      await installAuditFailure();
      await assert.rejects(
        createInvitation(),
        error => error.code === 'P0001',
        'the original audit persistence error must be preserved'
      );

      const [invitations, mail, audits] = await Promise.all([
        pool.query(
          'SELECT id,site_id,email,role_id,token_hash FROM site_invitations ' +
          'WHERE site_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL',
          [siteId, invitedEmail]
        ),
        pool.query(
          "SELECT id FROM mail_outbox WHERE recipient=$1 AND template='site-invitation'",
          [invitedEmail]
        ),
        pool.query(
          "SELECT id FROM audit_events WHERE site_id=$1 AND action='site.invitation_created' AND request_id=$2",
          [siteId, requestId]
        ),
      ]);

      assert.equal(invitations.rowCount, 0, 'the invitation upsert must roll back');
      assert.equal(mail.rowCount, 0, 'the mail delivery intent must roll back with the invitation');
      assert.equal(audits.rowCount, 0, 'a failed audit insert must leave no event');
    });

    await t.test('safe retry commits exactly one invitation, mail intent and correlated audit', async () => {
      await removeAuditFailure();

      const invitation = await createInvitation();
      assert.equal(invitation.email, invitedEmail);
      assert.equal(invitation.role, 'editor');
      assert.ok(invitation.expiresAt instanceof Date);
      assert.equal(typeof invitation.token, 'string');
      assert.equal(Object.hasOwn(invitation, 'id'), false, 'the public invitation response shape remains unchanged');

      const [invitations, mail, audits] = await Promise.all([
        pool.query(
          'SELECT id,site_id,email,role_id,token_hash,invited_by,expires_at,accepted_at ' +
          'FROM site_invitations WHERE site_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL',
          [siteId, invitedEmail]
        ),
        pool.query(
          "SELECT id,recipient,template,payload FROM mail_outbox WHERE recipient=$1 AND template='site-invitation'",
          [invitedEmail]
        ),
        pool.query(
          'SELECT id,site_id,actor_id,action,target_type,target_id,request_id,details ' +
          'FROM audit_events WHERE site_id=$1 AND action=$2 AND request_id=$3',
          [siteId, 'site.invitation_created', requestId]
        ),
      ]);

      assert.equal(invitations.rowCount, 1, 'retry must leave exactly one active invitation');
      assert.equal(invitations.rows[0].site_id, siteId);
      assert.equal(invitations.rows[0].email, invitedEmail);
      assert.equal(invitations.rows[0].role_id, role.rows[0].id);
      assert.equal(invitations.rows[0].invited_by, actorId);
      assert.equal(invitations.rows[0].token_hash, digest(invitation.token));
      assert.equal(mail.rowCount, 1, 'retry must leave exactly one mail outbox row');
      assert.equal(mail.rows[0].recipient, invitedEmail);
      assert.equal(mail.rows[0].template, 'site-invitation');
      assert.equal(audits.rowCount, 1, 'retry must leave exactly one correlated audit row');
      assert.equal(audits.rows[0].site_id, siteId);
      assert.equal(audits.rows[0].actor_id, actorId);
      assert.equal(audits.rows[0].action, 'site.invitation_created');
      assert.equal(audits.rows[0].target_type, 'invitation');
      assert.equal(audits.rows[0].target_id, invitations.rows[0].id);
      assert.equal(audits.rows[0].request_id, requestId);
      assert.deepEqual(audits.rows[0].details, { email: invitedEmail, role: 'editor' });
      assert.equal(JSON.stringify(audits.rows[0].details).includes(invitation.token), false);
      assert.equal(JSON.stringify(mail.rows[0].payload).includes(invitation.token), true,
        'the one-time token remains in the trusted mail outbox payload, not audit metadata');
    });
  }
);
