'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService, hashPassword, digest } = require('../../packages/auth/src/service');
const { createApiServer } = require('../../apps/api/src/server');
const { createRealtimeHub } = require('../../packages/realtime/src/event-hub');

const enabled = Boolean(
  process.env.DATABASE_URL &&
  process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true'
);

async function membershipSideEffects(pool, siteId, watchedRecipient) {
  const [memberships, invitations, mail, audit] = await Promise.all([
    pool.query(
      'SELECT site_id,user_id,role_id,created_at FROM site_memberships WHERE site_id=$1 ORDER BY user_id,role_id',
      [siteId]
    ),
    pool.query(
      `SELECT id,site_id,email,role_id,token_hash,invited_by,expires_at,accepted_at,created_at
         FROM site_invitations WHERE site_id=$1 ORDER BY id`,
      [siteId]
    ),
    pool.query(
      `SELECT id,recipient,template,payload,status,attempts,created_at
         FROM mail_outbox WHERE recipient=$1 AND template='site-invitation' ORDER BY id`,
      [watchedRecipient]
    ),
    pool.query(
      'SELECT id,site_id,actor_id,action,target_type,target_id,result,request_id,details,created_at FROM audit_events WHERE site_id=$1 ORDER BY id',
      [siteId]
    ),
  ]);
  return {
    memberships: memberships.rows,
    invitations: invitations.rows,
    mail: mail.rows,
    audit: audit.rows,
  };
}

async function readWithTimeout(reader, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      reader.read(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out waiting for the real-time stream to close.')), timeoutMs);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

test(
  'tenant isolation: site membership and invitation administration cannot cross site boundaries',
  { skip: !enabled },
  async t => {
    const pool = createPostgresPool({
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: '8',
    });
    const siteIds = [];
    const userIds = [];
    const mailRecipients = [];
    let server = null;

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL,
      REQUIRE_VERIFIED_EMAIL: 'false',
      VIRGOSCORPIO_HUB_EXPOSE_DEV_TOKENS: 'false',
      VIRGOSCORPIO_HUB_REALTIME_ENABLED: 'true',
    };
    delete env.VIRGOSCORPIO_HUB_API_TOKEN;

    const authorizationChanges = [];
    let identity = null;
    const realtimeHub = createRealtimeHub({
      authorizeSubscribe: async ({ principal, sessionId, siteId, topic }) => {
        if (topic !== 'presence' || !identity || !sessionId || principal?.isDeveloper) return false;
        if (!(await identity.isSessionActive({ userId: principal.id, sessionId }))) return false;
        return Boolean(await identity.authorizeSite(principal.id, siteId, 'content:read'));
      },
    });
    identity = createIdentityService({
      pool,
      env,
      onAuthorizationChange: async change => {
        authorizationChanges.push(change);
        realtimeHub.invalidateAuthorization(change);
      },
    });
    let streamReader = null;
    let streamController = null;

    t.after(async () => {
      if (streamController) streamController.abort();
      if (streamReader) await streamReader.cancel().catch(() => {});
      if (server) {
        if (server.listening) await new Promise(resolve => server.close(resolve));
        await server.virgoScorpioHub.close().catch(() => {});
      }
      if (siteIds.length) {
        await pool.query('DELETE FROM audit_events WHERE site_id=ANY($1::uuid[])', [siteIds]).catch(() => {});
      }
      if (mailRecipients.length) {
        await pool.query('DELETE FROM mail_outbox WHERE recipient=ANY($1::text[])', [mailRecipients]).catch(() => {});
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

    const siteAResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-members-a-${randomUUID().slice(0, 8)}`, 'Tenant Membership Site A']
    );
    const siteA = siteAResult.rows[0].id;
    siteIds.push(siteA);

    const siteBResult = await pool.query(
      'INSERT INTO sites(slug,name) VALUES($1,$2) RETURNING id',
      [`tenant-members-b-${randomUUID().slice(0, 8)}`, 'Tenant Membership Site B']
    );
    const siteB = siteBResult.rows[0].id;
    siteIds.push(siteB);

    const roles = await pool.query(
      "SELECT id,slug FROM roles WHERE slug IN ('site-owner','editor','author','viewer')"
    );
    const roleIds = new Map(roles.rows.map(row => [row.slug, row.id]));
    for (const required of ['site-owner', 'editor', 'author', 'viewer']) {
      assert.ok(roleIds.has(required), `the ${required} seed role must exist`);
    }

    async function createUser(label, withPassword = false) {
      const email = `tenant-members-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomUUID()}@example.test`;
      const result = await pool.query(
        withPassword
          ? `INSERT INTO users(email,display_name,password_hash,status)
             VALUES($1,$2,$3,'active') RETURNING id,email,display_name`
          : `INSERT INTO users(email,display_name,status)
             VALUES($1,$2,'active') RETURNING id,email,display_name`,
        withPassword
          ? [email, label, await hashPassword('Isolation-Password-2026')]
          : [email, label]
      );
      userIds.push(result.rows[0].id);
      return result.rows[0];
    }

    const actorA = await createUser('Site A Owner', true);
    const coOwnerA = await createUser('Site A Co-Owner', true);
    const actorB = await createUser('Site B Owner', true);
    const targetB = await createUser('Site B Existing Member');
    const targetA = await createUser('Site A Provisioning Target');
    const editorA = await createUser('Site A Editor');
    const authorA = await createUser('Site A Author');
    const streamViewerA = await createUser('Site A Stream Viewer', true);
    const disabledViewerA = await createUser('Site A Disabled Viewer');

    await pool.query(
      `INSERT INTO site_memberships(site_id,user_id,role_id)
       VALUES($1,$2,$3),($1,$4,$3),($5,$6,$3),($5,$7,$8),($1,$9,$8),($1,$10,$11),($1,$12,$13),($1,$14,$13)`,
      [
        siteA, actorA.id, roleIds.get('site-owner'), coOwnerA.id,
        siteB, actorB.id, targetB.id, roleIds.get('editor'),
        editorA.id, authorA.id, roleIds.get('author'),
        streamViewerA.id, roleIds.get('viewer'), disabledViewerA.id,
      ]
    );

    const sessionA = await identity.login({
      email: actorA.email,
      password: 'Isolation-Password-2026',
      ip: '127.0.0.1',
      userAgent: 'tenant-membership-isolation-test',
    });
    assert.equal(sessionA.mfaRequired, false);
    const coOwnerSessionA = await identity.login({
      email: coOwnerA.email,
      password: 'Isolation-Password-2026',
      ip: '127.0.0.1',
      userAgent: 'tenant-membership-isolation-test',
    });
    assert.equal(coOwnerSessionA.mfaRequired, false);
    const streamViewerSessionA = await identity.login({
      email: streamViewerA.email,
      password: 'Isolation-Password-2026',
      ip: '127.0.0.1',
      userAgent: 'tenant-membership-stream-revocation-test',
    });
    assert.equal(streamViewerSessionA.mfaRequired, false);

    server = createApiServer({
      env,
      pool,
      identityService: identity,
      realtimeHub,
      logger: { error() {} },
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });

    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = {
      authorization: `Bearer ${sessionA.token}`,
      'content-type': 'application/json',
    };
    const attemptedInviteEmail = `cross-site-invite-${randomUUID()}@example.test`;
    mailRecipients.push(attemptedInviteEmail);
    const before = await membershipSideEffects(pool, siteB, attemptedInviteEmail);
    const beforeSiteA = await membershipSideEffects(pool, siteA, attemptedInviteEmail);

    await t.test('identity authorization enforces owner, editor, author, viewer, active-user, and site boundaries', async () => {
      const matrix = [
        {
          label: 'site owner',
          userId: actorA.id,
          siteId: siteA,
          expected: { 'site:manage': true, 'content:read': true, 'content:publish': true },
        },
        {
          label: 'editor',
          userId: editorA.id,
          siteId: siteA,
          expected: { 'content:read': true, 'content:edit': true, 'site:manage': false, 'content:publish': false },
        },
        {
          label: 'author',
          userId: authorA.id,
          siteId: siteA,
          expected: { 'content:read:own': true, 'content:edit:own': true, 'content:read': false, 'content:edit': false, 'site:manage': false },
        },
        {
          label: 'viewer',
          userId: streamViewerA.id,
          siteId: siteA,
          expected: { 'content:read': true, 'content:edit': false, 'site:manage': false, 'content:publish': false },
        },
        {
          label: 'Site B editor',
          userId: targetB.id,
          siteId: siteB,
          expected: { 'content:read': true, 'content:edit': true, 'site:manage': false },
        },
      ];

      for (const entry of matrix) {
        for (const [capability, expected] of Object.entries(entry.expected)) {
          assert.equal(
            await identity.authorizeSite(entry.userId, entry.siteId, capability),
            expected,
            `${entry.label} capability ${capability} must resolve to ${expected}`
          );
        }
      }

      assert.equal(await identity.authorizeSite(actorA.id, siteB, 'site:manage'), false);
      assert.equal(await identity.authorizeSite(actorB.id, siteA, 'content:read'), false);
      assert.equal(await identity.authorizeSite(targetB.id, siteA, 'content:edit'), false);

      await pool.query("UPDATE users SET status='disabled' WHERE id=$1", [disabledViewerA.id]);
      assert.equal(await identity.authorizeSite(disabledViewerA.id, siteA, 'content:read'), false);
    });

    async function denyCrossSite(method, url, body) {
      const response = await fetch(base + url, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json();
      assert.equal(response.status, 403, `${method} ${url} must reject an administrator from a different site`);
      assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
      assert.doesNotMatch(JSON.stringify(payload), /Site B Existing Member|cross-site-invite/);
    }

    await t.test('path site selectors reject conflicting header, query, and JSON body context before tenant side effects', async () => {
      const scenarios = [
        {
          method: 'GET',
          url: `/api/v1/sites/${siteA}/members`,
          headers: { 'x-virgoscorpio-hub-site-id': siteB },
        },
        {
          method: 'GET',
          url: `/api/v1/sites/${siteA}/members?siteId=${siteB}`,
        },
        {
          method: 'POST',
          url: `/api/v1/sites/${siteA}/members`,
          body: { siteId: siteB, email: targetA.email, role: 'viewer' },
        },
        {
          method: 'POST',
          url: `/api/v1/sites/${siteA}/invitations`,
          body: { siteId: siteB, email: attemptedInviteEmail, role: 'editor' },
        },
      ];

      for (const scenario of scenarios) {
        const response = await fetch(base + scenario.url, {
          method: scenario.method,
          headers: { ...headers, ...(scenario.headers || {}) },
          ...(scenario.body === undefined ? {} : { body: JSON.stringify(scenario.body) }),
        });
        const payload = await response.json();
        assert.equal(response.status, 400, `${scenario.method} ${scenario.url} must reject conflicting site selectors`);
        assert.equal(payload.code, 'ERR_VIRGOSCORPIO_HUB_SITE_CONTEXT_MISMATCH');
      }

      assert.deepEqual(await membershipSideEffects(pool, siteA, attemptedInviteEmail), beforeSiteA);
      assert.deepEqual(await membershipSideEffects(pool, siteB, attemptedInviteEmail), before);
    });

    await t.test('site A owner can list and add members to site A', async () => {
      assert.equal(await identity.authorizeSite(targetA.id, siteA, 'content:read'), false);

      const listBefore = await fetch(`${base}/api/v1/sites/${siteA}/members`, {
        headers: { authorization: `Bearer ${sessionA.token}` },
      });
      assert.equal(listBefore.status, 200);
      const beforePayload = await listBefore.json();
      assert.ok(beforePayload.members.some(member => member.id === actorA.id));
      assert.equal(beforePayload.members.some(member => member.id === targetA.id), false);

      const add = await fetch(`${base}/api/v1/sites/${siteA}/members`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: targetA.email, role: 'viewer' }),
      });
      assert.equal(add.status, 201);
      const added = await add.json();
      assert.equal(added.member.id, targetA.id);
      assert.equal(await identity.authorizeSite(targetA.id, siteA, 'content:read'), true);

      const membership = await pool.query(
        'SELECT role_id FROM site_memberships WHERE site_id=$1 AND user_id=$2',
        [siteA, targetA.id]
      );
      assert.deepEqual(membership.rows.map(row => row.role_id), [roleIds.get('viewer')]);
    });

    await t.test('removing a site member immediately revokes that member\'s active SSE stream', async () => {
      streamController = new AbortController();
      const streamResponse = await fetch(
        `${base}/api/v1/sites/${siteA}/realtime/events?topic=presence`,
        {
          headers: {
            authorization: `Bearer ${streamViewerSessionA.token}`,
            accept: 'text/event-stream',
          },
          signal: streamController.signal,
        }
      );
      assert.equal(streamResponse.status, 200);
      assert.match(streamResponse.headers.get('content-type') || '', /text\/event-stream/);
      assert.ok(streamResponse.body);
      streamReader = streamResponse.body.getReader();

      const decoder = new TextDecoder();
      let readyFrame = '';
      while (!readyFrame.includes('event: connection.ready')) {
        const chunk = await readWithTimeout(streamReader, 5_000);
        assert.equal(chunk.done, false, 'the authorized stream must announce readiness before revocation');
        readyFrame += decoder.decode(chunk.value, { stream: true });
        assert.ok(readyFrame.length <= 4_096, 'the readiness frame must remain bounded');
      }
      assert.equal(realtimeHub.subscriberCount, 1);

      const removal = await fetch(`${base}/api/v1/sites/${siteA}/members/${streamViewerA.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${sessionA.token}` },
      });
      assert.equal(removal.status, 200);
      assert.equal((await removal.json()).removed, true);
      assert.ok(
        authorizationChanges.some(change => change.siteId === siteA && change.principalId === streamViewerA.id),
        'the committed membership removal must publish a site-and-principal authorization change'
      );

      const closed = await readWithTimeout(streamReader, 5_000);
      assert.equal(closed.done, true, 'membership revocation must terminate the existing SSE response');
      assert.equal(realtimeHub.subscriberCount, 0);
    });

    await t.test('site A owner cannot enumerate site B members', async () => {
      await denyCrossSite('GET', `/api/v1/sites/${siteB}/members`);
    });

    await t.test('site A owner cannot add a member to site B', async () => {
      await denyCrossSite('POST', `/api/v1/sites/${siteB}/members`, {
        email: targetA.email,
        role: 'viewer',
      });
    });

    await t.test('site A owner cannot remove an existing site B member', async () => {
      await denyCrossSite('DELETE', `/api/v1/sites/${siteB}/members/${targetB.id}`);
    });

    await t.test('site A owner cannot create a site B invitation or mail delivery', async () => {
      await denyCrossSite('POST', `/api/v1/sites/${siteB}/invitations`, {
        email: attemptedInviteEmail,
        role: 'editor',
      });
    });

    await t.test('site A member addition produced a scoped audit record only in site A', async () => {
      const addedAudit = await pool.query(
        `SELECT site_id,actor_id,action,target_type,target_id,details
           FROM audit_events WHERE site_id=$1 AND action='site.member_added' AND target_id=$2`,
        [siteA, targetA.id]
      );
      assert.equal(addedAudit.rows.length, 1);
      assert.equal(addedAudit.rows[0].actor_id, actorA.id);
      assert.equal(addedAudit.rows[0].site_id, siteA);
      assert.deepEqual(await membershipSideEffects(pool, siteB, attemptedInviteEmail), before);
    });

    await t.test('site A owner can remove the A member without affecting site B', async () => {
      const response = await fetch(`${base}/api/v1/sites/${siteA}/members/${targetA.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${sessionA.token}` },
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).removed, true);
      const membership = await pool.query(
        'SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2',
        [siteA, targetA.id]
      );
      assert.equal(membership.rowCount, 0);
      assert.equal(await identity.authorizeSite(targetA.id, siteA, 'content:read'), false);
      assert.deepEqual(await membershipSideEffects(pool, siteB, attemptedInviteEmail), before);
    });

    async function createSiteAInvitation(email, role) {
      mailRecipients.push(email);
      const response = await fetch(base + '/api/v1/sites/' + siteA + '/invitations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, role }),
      });
      return { response, payload: await response.json() };
    }

    async function readSiteAInvitation(email) {
      const [invite, mail] = await Promise.all([
        pool.query(
          'SELECT id,site_id,email,role_id,token_hash,expires_at,accepted_at FROM site_invitations WHERE site_id=$1 AND lower(email)=lower($2) ORDER BY created_at DESC LIMIT 1',
          [siteA, email]
        ),
        pool.query(
          "SELECT recipient,template,payload FROM mail_outbox WHERE recipient=$1 AND template='site-invitation' ORDER BY id DESC LIMIT 1",
          [email]
        ),
      ]);
      assert.equal(invite.rows.length, 1);
      assert.equal(mail.rows.length, 1);
      const inviteUrl = new URL(mail.rows[0].payload.inviteUrl);
      const token = inviteUrl.searchParams.get('token');
      assert.equal(Buffer.from(token || '', 'base64url').length, 32);
      assert.equal(invite.rows[0].token_hash, digest(token), 'PostgreSQL stores only the SHA-256 token digest');
      assert.notEqual(invite.rows[0].token_hash, token);
      return { invitation: invite.rows[0], mail: mail.rows[0], token };
    }

    async function redeemInvitation(token) {
      return fetch(base + '/api/v1/auth/invitations/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token,
          password: 'Invited-Account-Password-2026',
          displayName: 'Accepted Tenant Invitee',
        }),
      });
    }

    await t.test('site A owner can create a site A invitation with isolated mail and audit effects', async () => {
      const invitedEmail = `site-a-invitation-${randomUUID()}@example.test`;
      mailRecipients.push(invitedEmail);
      const response = await fetch(`${base}/api/v1/sites/${siteA}/invitations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: invitedEmail, role: 'editor' }),
      });
      assert.equal(response.status, 201);
      const payload = await response.json();
      assert.equal(payload.invitation.email, invitedEmail);
      assert.equal(payload.invitation.role, 'editor');
      assert.equal(Object.hasOwn(payload.invitation, 'token'), false, 'one-time invitation token must not be returned by default');

      const invite = await pool.query(
        'SELECT site_id,email,role_id,length(token_hash)::int AS token_hash_length FROM site_invitations WHERE site_id=$1 AND lower(email)=lower($2) AND accepted_at IS NULL',
        [siteA, invitedEmail]
      );
      assert.equal(invite.rows.length, 1);
      assert.equal(invite.rows[0].site_id, siteA);
      assert.equal(invite.rows[0].role_id, roleIds.get('editor'));
      assert.equal(invite.rows[0].token_hash_length, 64);

      const mail = await pool.query(
        `SELECT recipient,template,payload FROM mail_outbox
          WHERE recipient=$1 AND template='site-invitation'`,
        [invitedEmail]
      );
      assert.equal(mail.rows.length, 1);
      assert.match(mail.rows[0].payload.inviteUrl, /^https?:\/\//);
      assert.ok(!Object.hasOwn(payload.invitation, 'token'));

      const audit = await pool.query(
        `SELECT site_id,actor_id,action,target_type,details FROM audit_events
          WHERE site_id=$1 AND action='site.invitation_created' AND details->>'email'=$2`,
        [siteA, invitedEmail]
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0].actor_id, actorA.id);
      assert.equal(audit.rows[0].target_type, 'invitation');
      assert.deepEqual(await membershipSideEffects(pool, siteB, attemptedInviteEmail), before);

      const { invitation, token } = await readSiteAInvitation(invitedEmail);
      const authorizationChangesBefore = authorizationChanges.length;
      const accepted = await redeemInvitation(token);
      assert.equal(accepted.status, 200);
      const acceptedPayload = await accepted.json();
      assert.equal(acceptedPayload.status, 'accepted');
      assert.equal(acceptedPayload.siteId, siteA);
      assert.equal(acceptedPayload.role, 'editor');
      assert.equal(acceptedPayload.user.email, invitedEmail);
      assert.equal(acceptedPayload.user.status, 'active');
      assert.equal(acceptedPayload.user.emailVerified, true);
      userIds.push(acceptedPayload.user.id);

      const membership = await pool.query(
        'SELECT m.role_id,u.status FROM site_memberships m JOIN users u ON u.id=m.user_id WHERE m.site_id=$1 AND m.user_id=$2',
        [siteA, acceptedPayload.user.id]
      );
      assert.equal(membership.rows.length, 1);
      assert.equal(membership.rows[0].role_id, roleIds.get('editor'));
      assert.equal(membership.rows[0].status, 'active');
      const consumed = await pool.query('SELECT accepted_at FROM site_invitations WHERE id=$1', [invitation.id]);
      assert.ok(consumed.rows[0].accepted_at);

      const acceptedAudit = await pool.query(
        "SELECT site_id,actor_id,action,target_type,target_id,request_id,details FROM audit_events WHERE site_id=$1 AND action='site.invitation_accepted' AND target_id=$2",
        [siteA, invitation.id]
      );
      assert.equal(acceptedAudit.rows.length, 1);
      assert.equal(acceptedAudit.rows[0].actor_id, acceptedPayload.user.id);
      assert.equal(acceptedAudit.rows[0].target_type, 'invitation');
      assert.equal(acceptedAudit.rows[0].request_id, acceptedPayload.requestId);
      assert.equal(acceptedAudit.rows[0].details.role, 'editor');
      assert.equal(JSON.stringify(acceptedAudit.rows[0].details).includes(token), false);
      assert.deepEqual(authorizationChanges.slice(authorizationChangesBefore), [
        { siteId: siteA, principalId: acceptedPayload.user.id },
      ]);

      const replay = await redeemInvitation(token);
      assert.equal(replay.status, 400);
      assert.equal((await replay.json()).code, 'ERR_VIRGOSCORPIO_HUB_INVITATION_INVALID');
      const [users, memberships] = await Promise.all([
        pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [invitedEmail]),
        pool.query('SELECT user_id FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteA, acceptedPayload.user.id]),
      ]);
      assert.equal(users.rowCount, 1);
      assert.equal(memberships.rowCount, 1);
    });

    await t.test('an existing active account accepts only the invited site membership', async () => {
      await pool.query('UPDATE users SET email_verified_at=now(),mfa_enabled=true WHERE id=$1', [targetB.id]);
      const authorizationChangesBefore = authorizationChanges.length;
      const created = await createSiteAInvitation(targetB.email, 'viewer');
      assert.equal(created.response.status, 201);
      const { token, invitation } = await readSiteAInvitation(targetB.email);

      const accepted = await redeemInvitation(token);
      assert.equal(accepted.status, 200);
      const payload = await accepted.json();
      assert.equal(payload.user.id, targetB.id);
      assert.equal(payload.siteId, siteA);
      assert.equal(payload.role, 'viewer');
      assert.equal(payload.user.emailVerified, true);
      assert.equal(payload.user.mfaEnabled, true, 'acceptance must preserve existing MFA configuration');

      const memberships = await pool.query(
        'SELECT m.site_id,r.slug AS role FROM site_memberships m JOIN roles r ON r.id=m.role_id WHERE m.user_id=$1 ORDER BY m.site_id,r.slug',
        [targetB.id]
      );
      assert.equal(memberships.rows.length, 2);
      assert.equal(memberships.rows.find(row => row.site_id === siteA)?.role, 'viewer');
      assert.equal(memberships.rows.find(row => row.site_id === siteB)?.role, 'editor');
      assert.deepEqual(authorizationChanges.slice(authorizationChangesBefore), [
        { siteId: siteA, principalId: targetB.id },
      ]);
      const audit = await pool.query(
        "SELECT actor_id,details FROM audit_events WHERE site_id=$1 AND action='site.invitation_accepted' AND target_id=$2",
        [siteA, invitation.id]
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0].actor_id, targetB.id);
      assert.equal(audit.rows[0].details.role, 'viewer');
    });

    await t.test('a disabled existing account cannot consume an invitation or gain membership', async () => {
      const disabledInvitee = await createUser('Disabled Invitation Target');
      await pool.query("UPDATE users SET status='disabled' WHERE id=$1", [disabledInvitee.id]);
      const authorizationChangesBefore = authorizationChanges.length;
      const created = await createSiteAInvitation(disabledInvitee.email, 'author');
      assert.equal(created.response.status, 201);
      const { token, invitation } = await readSiteAInvitation(disabledInvitee.email);

      const rejected = await redeemInvitation(token);
      assert.equal(rejected.status, 403);
      assert.equal((await rejected.json()).code, 'ERR_VIRGOSCORPIO_HUB_ACCOUNT_DISABLED');
      const [pending, membership] = await Promise.all([
        pool.query('SELECT accepted_at FROM site_invitations WHERE id=$1', [invitation.id]),
        pool.query('SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteA, disabledInvitee.id]),
      ]);
      assert.equal(pending.rows[0].accepted_at, null);
      assert.equal(membership.rowCount, 0);
      assert.equal(authorizationChanges.length, authorizationChangesBefore);
    });

    await t.test('an expired invitation is rejected without creating an account or membership', async () => {
      const expiredEmail = 'expired-site-a-invite-' + randomUUID() + '@example.test';
      const created = await createSiteAInvitation(expiredEmail, 'author');
      assert.equal(created.response.status, 201);
      const { token, invitation } = await readSiteAInvitation(expiredEmail);
      await pool.query(
        "UPDATE site_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",
        [invitation.id]
      );

      const authorizationChangesBefore = authorizationChanges.length;
      const rejected = await redeemInvitation(token);
      assert.equal(rejected.status, 400);
      assert.equal((await rejected.json()).code, 'ERR_VIRGOSCORPIO_HUB_INVITATION_INVALID');
      const [users, membership, pending] = await Promise.all([
        pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [expiredEmail]),
        pool.query(
          'SELECT 1 FROM site_memberships m JOIN users u ON u.id=m.user_id WHERE m.site_id=$1 AND lower(u.email)=lower($2)',
          [siteA, expiredEmail]
        ),
        pool.query('SELECT accepted_at FROM site_invitations WHERE id=$1', [invitation.id]),
      ]);
      assert.equal(users.rowCount, 0);
      assert.equal(membership.rowCount, 0);
      assert.equal(pending.rows[0].accepted_at, null);
      assert.equal(authorizationChanges.length, authorizationChangesBefore);
    });

    await t.test('concurrent redemption of one invitation produces exactly one accepted membership', async () => {
      const invitedEmail = 'concurrent-site-a-invite-' + randomUUID() + '@example.test';
      const created = await createSiteAInvitation(invitedEmail, 'editor');
      assert.equal(created.response.status, 201);
      const { token, invitation } = await readSiteAInvitation(invitedEmail);
      const authorizationChangesBefore = authorizationChanges.length;

      const attempts = await Promise.all([redeemInvitation(token), redeemInvitation(token)]);
      const outcomes = await Promise.all(attempts.map(async response => ({
        status: response.status,
        payload: await response.json(),
      })));
      assert.deepEqual(outcomes.map(result => result.status).sort((a, b) => a - b), [200, 400]);
      const accepted = outcomes.find(result => result.status === 200);
      const rejected = outcomes.find(result => result.status === 400);
      assert.equal(accepted.payload.status, 'accepted');
      assert.equal(rejected.payload.code, 'ERR_VIRGOSCORPIO_HUB_INVITATION_INVALID');
      userIds.push(accepted.payload.user.id);

      const [users, memberships, consumed] = await Promise.all([
        pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [invitedEmail]),
        pool.query('SELECT user_id FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteA, accepted.payload.user.id]),
        pool.query('SELECT accepted_at FROM site_invitations WHERE id=$1', [invitation.id]),
      ]);
      assert.equal(users.rowCount, 1);
      assert.equal(memberships.rowCount, 1);
      assert.ok(consumed.rows[0].accepted_at);
      assert.deepEqual(authorizationChanges.slice(authorizationChangesBefore), [
        { siteId: siteA, principalId: accepted.payload.user.id },
      ]);
      const audits = await pool.query(
        "SELECT id,request_id FROM audit_events WHERE site_id=$1 AND action='site.invitation_accepted' AND target_id=$2",
        [siteA, invitation.id]
      );
      assert.equal(audits.rowCount, 1);
      assert.equal(audits.rows[0].request_id, accepted.payload.requestId);
    });

    await t.test('audit persistence failure rolls back invitation acceptance and allows a safe retry', async () => {
      const invitedEmail = 'audit-failure-site-a-invite-' + randomUUID() + '@example.test';
      const created = await createSiteAInvitation(invitedEmail, 'editor');
      assert.equal(created.response.status, 201);
      const { token, invitation } = await readSiteAInvitation(invitedEmail);

      // Inject a narrowly scoped PostgreSQL failure only for this test site's
      // invitation-acceptance audit row. The trigger is removed before retry.
      const suffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_inv_audit_fail_' + suffix;
      const triggerName = 'test_inv_audit_fail_' + suffix;
      const createFunction = `CREATE FUNCTION public.${functionName}()
        RETURNS trigger LANGUAGE plpgsql AS $body$
        BEGIN
          IF NEW.site_id = '${siteA}'::uuid
             AND NEW.action = 'site.invitation_accepted' THEN
            RAISE EXCEPTION 'injected invitation-acceptance audit failure'
              USING ERRCODE = 'P0001';
          END IF;
          RETURN NEW;
        END;
        $body$`;
      const authorizationChangesBefore = authorizationChanges.length;

      await pool.query(createFunction);

      try {
        await pool.query(
          `CREATE TRIGGER ${triggerName}
             BEFORE INSERT ON audit_events
             FOR EACH ROW EXECUTE FUNCTION public.${functionName}()`
        );

        const failed = await redeemInvitation(token);
        assert.equal(failed.status, 500, 'audit persistence failure must fail the acceptance request');

        const [users, memberships, pending, acceptanceAudits] = await Promise.all([
          pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [invitedEmail]),
          pool.query(
            `SELECT 1 FROM site_memberships m
              JOIN users u ON u.id=m.user_id
             WHERE m.site_id=$1 AND lower(u.email)=lower($2)`,
            [siteA, invitedEmail]
          ),
          pool.query('SELECT accepted_at,token_hash FROM site_invitations WHERE id=$1', [invitation.id]),
          pool.query(
            "SELECT id FROM audit_events WHERE site_id=$1 AND action='site.invitation_accepted' AND target_id=$2",
            [siteA, invitation.id]
          ),
        ]);
        userIds.push(...users.rows.map(user => user.id));
        assert.equal(users.rowCount, 0, 'new-account creation must roll back with the failed acceptance');
        assert.equal(memberships.rowCount, 0, 'membership insertion must roll back with the failed acceptance');
        assert.equal(pending.rows[0].accepted_at, null, 'the invitation must remain redeemable');
        assert.equal(pending.rows[0].token_hash, digest(token), 'the original token digest must remain available for a safe retry');
        assert.equal(acceptanceAudits.rowCount, 0, 'the failed audit insert must not leave a partial event');
        assert.equal(
          authorizationChanges.length,
          authorizationChangesBefore,
          'a rolled-back acceptance must not publish authorization invalidation'
        );
      } finally {
        await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON audit_events`);
        await pool.query(`DROP FUNCTION IF EXISTS public.${functionName}()`);
      }

      const retry = await redeemInvitation(token);
      assert.equal(retry.status, 200, 'the same one-time token must succeed after the audit sink recovers');
      const accepted = await retry.json();
      assert.equal(accepted.status, 'accepted');
      assert.equal(accepted.user.email, invitedEmail);
      userIds.push(accepted.user.id);

      const [users, memberships, consumed, acceptanceAudits] = await Promise.all([
        pool.query('SELECT id FROM users WHERE lower(email)=lower($1)', [invitedEmail]),
        pool.query(
          `SELECT 1 FROM site_memberships m
            JOIN users u ON u.id=m.user_id
           WHERE m.site_id=$1 AND lower(u.email)=lower($2)`,
          [siteA, invitedEmail]
        ),
        pool.query('SELECT accepted_at FROM site_invitations WHERE id=$1', [invitation.id]),
        pool.query(
          "SELECT id,request_id FROM audit_events WHERE site_id=$1 AND action='site.invitation_accepted' AND target_id=$2",
          [siteA, invitation.id]
        ),
      ]);
      assert.equal(users.rowCount, 1);
      assert.equal(memberships.rowCount, 1);
      assert.ok(consumed.rows[0].accepted_at);
      assert.equal(acceptanceAudits.rowCount, 1);
      assert.equal(acceptanceAudits.rows[0].request_id, accepted.requestId);
      assert.deepEqual(authorizationChanges.slice(authorizationChangesBefore), [
        { siteId: siteA, principalId: accepted.user.id },
      ], 'the successful retry must publish exactly one post-commit authorization invalidation');
    });

    await t.test('ordinary member addition and invitation creation cannot grant site-owner', async () => {
      const ownerEscalationEmail = 'owner-escalation-attempt-' + randomUUID() + '@example.test';
      mailRecipients.push(ownerEscalationEmail);
      const beforeEscalation = await membershipSideEffects(pool, siteA, ownerEscalationEmail);

      const add = await fetch(base + '/api/v1/sites/' + siteA + '/members', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: ownerEscalationEmail, role: 'site-owner' }),
      });
      assert.equal(add.status, 400);
      assert.equal((await add.json()).code, 'ERR_VIRGOSCORPIO_HUB_INVALID_ROLE');

      const invite = await fetch(base + '/api/v1/sites/' + siteA + '/invitations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: ownerEscalationEmail, role: 'site-owner' }),
      });
      assert.equal(invite.status, 400);
      assert.equal((await invite.json()).code, 'ERR_VIRGOSCORPIO_HUB_INVALID_ROLE');
      assert.deepEqual(
        await membershipSideEffects(pool, siteA, ownerEscalationEmail),
        beforeEscalation,
        'unsupported owner grants must fail before membership, invitation, mail, or audit side effects'
      );
    });

    await t.test('direct membership audit failures roll back and safe retries remain correlated', async () => {
      const auditTarget = await createUser('Membership Audit Atomicity Target');
      const suffix = randomUUID().replace(/-/g, '');
      const functionName = 'test_member_audit_fail_' + suffix;
      const triggerName = 'test_member_audit_fail_' + suffix;
      const requestBase = 'membership-audit-' + suffix;
      const invalidationsBefore = authorizationChanges.length;

      async function installFailureTrigger() {
        await pool.query(
          "CREATE FUNCTION " + functionName + "() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN " +
          "IF NEW.action IN ('site.member_added','site.member_removed') THEN " +
          "RAISE EXCEPTION 'simulated membership audit persistence failure'; END IF; RETURN NEW; END $$"
        );
        await pool.query("CREATE TRIGGER " + triggerName + " BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION " + functionName + "()");
      }
      async function removeFailureTrigger() {
        await pool.query("DROP TRIGGER IF EXISTS " + triggerName + " ON audit_events");
        await pool.query("DROP FUNCTION IF EXISTS " + functionName + "()");
      }

      try {
        await installFailureTrigger();
        await assert.rejects(identity.addMember({
          siteId: siteA, email: auditTarget.email, roleSlug: 'viewer',
          actorId: actorA.id, requestId: requestBase + '-add-failed',
        }), /simulated membership audit persistence failure/);
        const [membership, audit] = await Promise.all([
          pool.query('SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteA, auditTarget.id]),
          pool.query("SELECT 1 FROM audit_events WHERE site_id=$1 AND action='site.member_added' AND target_id=$2", [siteA, auditTarget.id]),
        ]);
        assert.equal(membership.rowCount, 0, 'failed audit insert must roll back the membership addition');
        assert.equal(audit.rowCount, 0, 'failed addition must not leave an audit row');
        assert.equal(authorizationChanges.length, invalidationsBefore, 'rollback must not publish authorization invalidation');
      } finally {
        await removeFailureTrigger();
      }

      const addedRequestId = requestBase + '-add-retry';
      await identity.addMember({
        siteId: siteA, email: auditTarget.email, roleSlug: 'viewer',
        actorId: actorA.id, requestId: addedRequestId,
      });
      let addedAudit = await pool.query(
        "SELECT site_id,actor_id,action,target_type,target_id,request_id,details FROM audit_events WHERE site_id=$1 AND action='site.member_added' AND target_id=$2",
        [siteA, auditTarget.id],
      );
      assert.equal(addedAudit.rowCount, 1, 'successful retry must write exactly one addition audit row');
      assert.equal(addedAudit.rows[0].site_id, siteA);
      assert.equal(addedAudit.rows[0].actor_id, actorA.id);
      assert.equal(addedAudit.rows[0].action, 'site.member_added');
      assert.equal(addedAudit.rows[0].target_type, 'user');
      assert.equal(addedAudit.rows[0].target_id, auditTarget.id);
      assert.equal(addedAudit.rows[0].request_id, addedRequestId);
      assert.deepEqual(addedAudit.rows[0].details, { role: 'viewer' });
      assert.deepEqual(authorizationChanges.slice(invalidationsBefore), [{ siteId: siteA, principalId: auditTarget.id }]);

      await identity.addMember({
        siteId: siteA, email: auditTarget.email, roleSlug: 'viewer',
        actorId: actorA.id, requestId: requestBase + '-add-noop',
      });
      addedAudit = await pool.query(
        "SELECT 1 FROM audit_events WHERE site_id=$1 AND action='site.member_added' AND target_id=$2",
        [siteA, auditTarget.id],
      );
      assert.equal(addedAudit.rowCount, 1, 'no-op addition must not add another audit row');
      assert.equal(authorizationChanges.length, invalidationsBefore + 1, 'no-op addition must not publish another invalidation');

      const invalidationsBeforeRemoval = authorizationChanges.length;
      try {
        await installFailureTrigger();
        await assert.rejects(identity.removeMember({
          siteId: siteA, userId: auditTarget.id, actorId: actorA.id,
          requestId: requestBase + '-remove-failed',
        }), /simulated membership audit persistence failure/);
        const [membership, audit] = await Promise.all([
          pool.query('SELECT 1 FROM site_memberships WHERE site_id=$1 AND user_id=$2', [siteA, auditTarget.id]),
          pool.query("SELECT 1 FROM audit_events WHERE site_id=$1 AND action='site.member_removed' AND target_id=$2", [siteA, auditTarget.id]),
        ]);
        assert.equal(membership.rowCount, 1, 'failed audit insert must roll back the membership removal');
        assert.equal(audit.rowCount, 0, 'failed removal must not leave an audit row');
        assert.equal(authorizationChanges.length, invalidationsBeforeRemoval, 'rollback must not publish authorization invalidation');
      } finally {
        await removeFailureTrigger();
      }

      const removedRequestId = requestBase + '-remove-retry';
      await identity.removeMember({
        siteId: siteA, userId: auditTarget.id, actorId: actorA.id,
        requestId: removedRequestId,
      });
      const removedAudit = await pool.query(
        "SELECT site_id,actor_id,action,target_type,target_id,request_id,details FROM audit_events WHERE site_id=$1 AND action='site.member_removed' AND target_id=$2",
        [siteA, auditTarget.id],
      );
      assert.equal(removedAudit.rowCount, 1, 'successful retry must write exactly one removal audit row');
      assert.equal(removedAudit.rows[0].site_id, siteA);
      assert.equal(removedAudit.rows[0].actor_id, actorA.id);
      assert.equal(removedAudit.rows[0].action, 'site.member_removed');
      assert.equal(removedAudit.rows[0].target_type, 'user');
      assert.equal(removedAudit.rows[0].target_id, auditTarget.id);
      assert.equal(removedAudit.rows[0].request_id, removedRequestId);
      assert.deepEqual(removedAudit.rows[0].details, {});
      assert.deepEqual(authorizationChanges.slice(invalidationsBeforeRemoval), [{ siteId: siteA, principalId: auditTarget.id }]);

      const invalidationsAfterRemoval = authorizationChanges.length;
      await identity.removeMember({
        siteId: siteA, userId: auditTarget.id, actorId: actorA.id,
        requestId: requestBase + '-remove-noop',
      });
      const finalAudit = await pool.query(
        "SELECT 1 FROM audit_events WHERE site_id=$1 AND action='site.member_removed' AND target_id=$2",
        [siteA, auditTarget.id],
      );
      assert.equal(finalAudit.rowCount, 1, 'no-op removal must not add another audit row');
      assert.equal(authorizationChanges.length, invalidationsAfterRemoval, 'no-op removal must not publish another invalidation');
    });

    await t.test('concurrent owner removals serialize and preserve one active site owner', async () => {
      const lockClient = await pool.connect();
      let removalResultsPromise = Promise.resolve([]);
      let lockWaiterCount = 0;

      try {
        await lockClient.query('BEGIN');
        await lockClient.query('SELECT id FROM sites WHERE id=$1 FOR UPDATE', [siteA]);

        const removals = [
          { actorId: actorA.id, token: sessionA.token, targetId: coOwnerA.id },
          { actorId: coOwnerA.id, token: coOwnerSessionA.token, targetId: actorA.id },
        ];
        removalResultsPromise = Promise.all(removals.map(async removal => {
          const response = await fetch(`${base}/api/v1/sites/${siteA}/members/${removal.targetId}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${removal.token}` },
          });
          return { ...removal, status: response.status, payload: await response.json() };
        }));

        const deadline = Date.now() + 5_000;
        while (Date.now() < deadline) {
          const waiting = await pool.query(
            `SELECT count(*)::integer AS count
               FROM pg_stat_activity
              WHERE datname=current_database()
                AND wait_event_type='Lock'
                AND query LIKE 'SELECT id FROM sites WHERE id%FOR UPDATE%'`
          );
          lockWaiterCount = waiting.rows[0].count;
          if (lockWaiterCount >= 2) break;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
      } finally {
        await lockClient.query('ROLLBACK').catch(() => {});
        lockClient.release();
      }

      const results = await removalResultsPromise;
      assert.equal(lockWaiterCount, 2, 'both requests must serialize on the same site row');
      assert.equal(results.filter(result => result.status === 200).length, 1);
      assert.equal(results.filter(result => result.status === 409).length, 1);
      const successfulRemoval = results.find(result => result.status === 200);
      const rejectedRemoval = results.find(result => result.status === 409);
      assert.equal(rejectedRemoval.payload.code, 'ERR_VIRGOSCORPIO_HUB_LAST_OWNER');

      const owners = await pool.query(
        `SELECT m.user_id
           FROM site_memberships m
           JOIN roles r ON r.id=m.role_id
           JOIN users u ON u.id=m.user_id
          WHERE m.site_id=$1 AND r.slug='site-owner' AND u.status='active'`,
        [siteA]
      );
      assert.deepEqual(owners.rows.map(row => row.user_id), [successfulRemoval.actorId]);

      const removalAudits = await pool.query(
        `SELECT target_id FROM audit_events
          WHERE site_id=$1 AND action='site.member_removed' AND target_id=ANY($2::uuid[])`,
        [siteA, [actorA.id, coOwnerA.id]]
      );
      assert.deepEqual(removalAudits.rows.map(row => row.target_id), [successfulRemoval.targetId]);
    });

    const siteBMembership = await pool.query(
      'SELECT user_id,role_id FROM site_memberships WHERE site_id=$1 ORDER BY user_id',
      [siteB]
    );
    assert.equal(siteBMembership.rows.length, 2);
    assert.ok(siteBMembership.rows.some(row => row.user_id === actorB.id));
    assert.ok(siteBMembership.rows.some(row => row.user_id === targetB.id));
    assert.equal(siteBMembership.rows.some(row => row.user_id === actorA.id), false);
  }
);
