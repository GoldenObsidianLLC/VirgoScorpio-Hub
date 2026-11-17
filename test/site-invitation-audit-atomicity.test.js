'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService } = require('../packages/auth/src/service');

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const ROLE_ID = '22222222-2222-4222-8222-222222222222';
const INVITATION_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR_ID = '44444444-4444-4444-8444-444444444444';

function createInvitationFixture({ failAudit = false } = {}) {
  const poolCalls = [];
  const transactionCalls = [];
  let released = false;

  const client = {
    async query(sql, values = []) {
      const normalized = String(sql).trim().replace(/\\s+/g, ' ');
      transactionCalls.push({ sql: normalized, values });
      if (failAudit && normalized.startsWith('INSERT INTO audit_events')) {
        throw Object.assign(new Error('injected audit failure'), { code: 'P0001' });
      }
      if (normalized.startsWith('INSERT INTO site_invitations')) {
        return { rowCount: 1, rows: [{ id: INVITATION_ID }] };
      }
      return { rowCount: 1, rows: [] };
    },
    release() {
      released = true;
    },
  };

  const pool = {
    async query(sql, values = []) {
      const normalized = String(sql).trim().replace(/\\s+/g, ' ');
      poolCalls.push({ sql: normalized, values });
      if (normalized.startsWith('SELECT id FROM roles')) {
        return { rowCount: 1, rows: [{ id: ROLE_ID }] };
      }
      if (normalized.startsWith('SELECT slug,name FROM sites')) {
        return { rowCount: 1, rows: [{ slug: 'site-one', name: 'Site One' }] };
      }
      throw new Error(`Unexpected pool query: ${normalized}`);
    },
    async connect() {
      return client;
    },
  };

  return {
    pool,
    client,
    poolCalls,
    transactionCalls,
    isReleased: () => released,
  };
}

function createAudit(identity, eventCalls) {
  return async ({ queryable, result }) => {
    eventCalls.push({ queryable, result });
    await identity.audit({
      siteId: SITE_ID,
      actorId: ACTOR_ID,
      action: 'site.invitation_created',
      targetType: 'invitation',
      targetId: result.id,
      requestId: 'request-invitation-create',
      details: { email: result.email, role: result.role },
    }, { queryable });
  };
}

test('invitation creation writes its audit on the same transaction client before COMMIT', async () => {
  const fixture = createInvitationFixture();
  const identity = createIdentityService({
    pool: fixture.pool,
    env: {
      NODE_ENV: 'development',
      VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS: 'true',
    },
  });
  const callbackCalls = [];

  const invitation = await identity.createInvitation({
    siteId: SITE_ID,
    email: ' Invitee@Example.Test ',
    roleSlug: 'viewer',
    invitedBy: ACTOR_ID,
    onInvitationCreated: createAudit(identity, callbackCalls),
  });

  assert.equal(callbackCalls.length, 1);
  assert.equal(callbackCalls[0].queryable, fixture.client);
  assert.equal(callbackCalls[0].result.id, INVITATION_ID);
  assert.equal(callbackCalls[0].result.email, 'invitee@example.test');
  assert.equal(callbackCalls[0].result.role, 'viewer');
  assert.ok(callbackCalls[0].result.expiresAt instanceof Date);
  assert.equal(Object.hasOwn(callbackCalls[0].result, 'token'), false);
  assert.equal(invitation.email, 'invitee@example.test');
  assert.equal(invitation.role, 'viewer');
  assert.equal(typeof invitation.token, 'string');
  assert.equal(Object.hasOwn(invitation, 'id'), false, 'the public service return shape remains compatible');

  const statements = fixture.transactionCalls.map(call => call.sql);
  const invitationInsert = statements.findIndex(sql => sql.startsWith('INSERT INTO site_invitations'));
  assert.match(statements[invitationInsert], /ON CONFLICT/);
  assert.match(statements[invitationInsert], /RETURNING id$/);
  const outboxInsert = statements.findIndex(sql => sql.startsWith('INSERT INTO mail_outbox'));
  const auditInsert = statements.findIndex(sql => sql.startsWith('INSERT INTO audit_events'));
  const commit = statements.indexOf('COMMIT');
  assert.ok(statements.indexOf('BEGIN') < invitationInsert);
  assert.ok(invitationInsert < outboxInsert);
  assert.ok(outboxInsert < auditInsert);
  assert.ok(auditInsert < commit);
  assert.equal(fixture.poolCalls.some(call => call.sql.startsWith('INSERT INTO audit_events')), false);

  const auditCall = fixture.transactionCalls[auditInsert];
  assert.equal(auditCall.values[0], SITE_ID);
  assert.equal(auditCall.values[1], ACTOR_ID);
  assert.equal(auditCall.values[2], 'site.invitation_created');
  assert.equal(auditCall.values[3], 'invitation');
  assert.equal(auditCall.values[4], INVITATION_ID);
  assert.equal(auditCall.values[6], 'request-invitation-create');
  assert.deepEqual(JSON.parse(auditCall.values[7]), {
    email: 'invitee@example.test',
    role: 'viewer',
  });
  assert.equal(JSON.stringify(auditCall.values).includes(invitation.token), false);
  assert.equal(fixture.isReleased(), true);
});

test('invitation creation rolls back invitation and outbox work when its audit callback fails', async () => {
  const fixture = createInvitationFixture({ failAudit: true });
  const identity = createIdentityService({ pool: fixture.pool, env: { NODE_ENV: 'test' } });

  await assert.rejects(
    identity.createInvitation({
      siteId: SITE_ID,
      email: 'rollback@example.test',
      roleSlug: 'author',
      invitedBy: ACTOR_ID,
      onInvitationCreated: async ({ queryable, result }) => {
        assert.equal(queryable, fixture.client);
        assert.equal(result.id, INVITATION_ID);
        await identity.audit({
          siteId: SITE_ID,
          actorId: ACTOR_ID,
          action: 'site.invitation_created',
          targetType: 'invitation',
          targetId: result.id,
          details: { email: result.email, role: result.role },
        }, { queryable });
      },
    }),
    error => error.code === 'P0001',
  );

  const statements = fixture.transactionCalls.map(call => call.sql);
  assert.ok(statements.some(sql => sql.startsWith('INSERT INTO site_invitations')));
  assert.ok(statements.some(sql => sql.startsWith('INSERT INTO mail_outbox')));
  assert.ok(statements.some(sql => sql.startsWith('INSERT INTO audit_events')));
  assert.ok(statements.includes('ROLLBACK'));
  assert.equal(statements.includes('COMMIT'), false);
  assert.equal(fixture.isReleased(), true);
});
