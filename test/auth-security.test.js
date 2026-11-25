'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdentityService, normalizeEmail, validatePassword, hashPassword, verifyPassword, digest, safeEqualText } = require('../packages/auth/src/service');

test('identity helpers normalize email consistently and reject invalid addresses', () => {
  assert.equal(normalizeEmail('  Admin@Example.COM '), 'admin@example.com');
  assert.equal(normalizeEmail('not-an-email'), '');
  assert.equal(normalizeEmail('x'.repeat(260)), '');
});

test('password policy and scrypt hashes are enforced', async () => {
  assert.throws(() => validatePassword('short'), { code: 'ERR_VIRGOSCORPIO_HUB_PASSWORD_POLICY' });
  assert.throws(() => validatePassword('alllowercase123'), { code: 'ERR_VIRGOSCORPIO_HUB_PASSWORD_POLICY' });
  const encoded = await hashPassword('CorrectHorse9Battery');
  assert.match(encoded, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await verifyPassword('CorrectHorse9Battery', encoded), true);
  assert.equal(await verifyPassword('WrongHorse9Battery', encoded), false);
  assert.equal(await verifyPassword('anything', 'unknown$scheme'), false);
});

test('password verification performs fixed-cost dummy scrypt for missing and malformed hashes', async () => {
  const derivedKey = Buffer.alloc(64, 0x3c);
  const salt = Buffer.alloc(16, 0x2d);
  const validHash = 'scrypt$32768$8$1$' + salt.toString('base64url') + '$' + derivedKey.toString('base64url');
  const calls = [];
  const deriveKey = async (password, suppliedSalt, keyLength, options) => {
    calls.push({ password, salt: Buffer.from(suppliedSalt), keyLength, options: { ...options } });
    return Buffer.from(derivedKey);
  };

  assert.equal(await verifyPassword('CorrectHorse9Battery', validHash, deriveKey), true);
  assert.equal(await verifyPassword('CorrectHorse9Battery', null, deriveKey), false);
  assert.equal(await verifyPassword('CorrectHorse9Battery', 'not-a-scrypt-hash', deriveKey), false);
  assert.equal(await verifyPassword('x'.repeat(129), undefined, deriveKey), false);
  assert.equal(await verifyPassword('x'.repeat(129), validHash, deriveKey), false,
    'oversized input must not authenticate even if the bounded empty candidate matches a legacy hash');
  assert.equal(await verifyPassword(Buffer.from('CorrectHorse9Battery'), validHash, deriveKey), false,
    'non-string input must remain ineligible for authentication');

  assert.equal(calls.length, 6, 'all credential shapes must perform one derivation');
  for (const call of calls) {
    assert.equal(call.keyLength, 64);
    assert.equal(call.salt.length, 16);
    assert.deepEqual(call.options, { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  }
  assert.equal(calls[0].salt.equals(salt), true, 'valid hashes use their stored salt');
  assert.equal(calls[1].salt.equals(salt), false, 'unknown users use the fixed dummy salt');
  assert.equal(calls[2].salt.equals(calls[1].salt), true, 'malformed hashes use the same dummy salt');
  assert.equal(calls[3].password, '', 'oversized passwords are bounded before scrypt');
  assert.equal(calls[4].password, '', 'valid stored hashes still use bounded input for oversized passwords');
  assert.equal(calls[5].password, '', 'non-string passwords are normalized before scrypt');
});
test('ordinary membership and invitation APIs cannot grant the site-owner role', async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      throw new Error('Owner-role rejection must happen before database access.');
    },
    async connect() {
      throw new Error('Owner-role rejection must happen before opening a transaction.');
    },
  };
  const identity = createIdentityService({ pool, env: {} });

  await assert.rejects(
    identity.addMember({
      siteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      email: 'owner-escalation@example.test',
      roleSlug: 'site-owner',
    }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_INVALID_ROLE'
  );
  await assert.rejects(
    identity.createInvitation({
      siteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      email: 'owner-escalation@example.test',
      roleSlug: 'site-owner',
      invitedBy: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    }),
    error => error.statusCode === 400 && error.code === 'ERR_VIRGOSCORPIO_HUB_INVALID_ROLE'
  );

  assert.deepEqual(queries, [], 'unsupported owner grants must fail before PostgreSQL side effects');
});

test('production membership operations fail closed when the actor ID is omitted', async () => {
  const siteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const transactionQueries = [];
  const client = {
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      transactionQueries.push(normalized);
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalized)) return { rowCount: 0, rows: [] };
      if (normalized === 'SELECT id FROM sites WHERE id=$1 FOR KEY SHARE' || normalized === 'SELECT id FROM sites WHERE id=$1 FOR UPDATE') return { rowCount: 1, rows: [{ id: siteId }] };
      if (normalized.includes('SELECT r.capabilities') || normalized.includes('INSERT INTO')) throw new Error('A missing production actor must be rejected before membership reads or writes.');
      throw new Error('Unexpected membership transaction query: ' + normalized);
    },
    release() {},
  };
  const pool = {
    async connect() { return client; },
    async query(sql) {
      if (sql.includes('SELECT id FROM roles WHERE slug=$1')) return { rowCount: 1, rows: [{ id: 'role-id' }] };
      if (sql.includes('SELECT slug,name FROM sites WHERE id=$1')) return { rowCount: 1, rows: [{ slug: 'site', name: 'Site' }] };
      throw new Error('Unexpected pool query: ' + sql);
    },
  };
  const identity = createIdentityService({ pool, env: { NODE_ENV: 'production' } });
  const forbidden = error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN';
  await assert.rejects(identity.listMembers({ siteId }), forbidden);
  await assert.rejects(identity.addMember({ siteId, email: 'member@example.test', roleSlug: 'editor' }), forbidden);
  await assert.rejects(identity.removeMember({ siteId, userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }), forbidden);
  await assert.rejects(identity.createInvitation({ siteId, email: 'invite@example.test', roleSlug: 'viewer' }), forbidden);
  assert.equal(transactionQueries.filter(sql => sql.includes('SELECT r.capabilities')).length, 0);
  assert.equal(transactionQueries.filter(sql => sql.includes('INSERT INTO')).length, 0);
});
test('site creation writes its owner membership and correlated audit in one transaction', async t => {
  const actorId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const siteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const ownerRoleId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const requestId = 'request-site-create-123';
  const site = { id: siteId, slug: 'atomic-site', name: 'Atomic Site', default_locale: 'en' };

  async function runScenario({ allowed = true, failAudit = false, auditUniqueViolation = false, duplicateSlug = false } = {}) {
    const events = [];
    const pool = {
      async query(sql) {
        throw new Error('Site creation must use its dedicated transaction client: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM site_memberships m JOIN roles r') && sql.includes("r.capabilities @>")) {
              events.push('CHECK_SITE_MANAGE');
              return { rowCount: allowed ? 1 : 0, rows: allowed ? [{}] : [] };
            }
            if (sql.includes('INSERT INTO sites(slug,name)')) {
              events.push('INSERT_SITE');
              if (duplicateSlug) throw Object.assign(new Error('duplicate site slug'), { code: '23505' });
              assert.deepEqual(values, ['atomic-site', 'Atomic Site']);
              return { rowCount: 1, rows: [site] };
            }
            if (sql.includes("SELECT id FROM roles WHERE slug='site-owner'")) {
              events.push('SELECT_SITE_OWNER_ROLE');
              return { rowCount: 1, rows: [{ id: ownerRoleId }] };
            }
            if (sql.includes('INSERT INTO site_memberships(site_id,user_id,role_id)')) {
              events.push('INSERT_OWNER_MEMBERSHIP');
              assert.deepEqual(values, [siteId, actorId, ownerRoleId]);
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO audit_events')) {
              events.push('INSERT_SITE_AUDIT');
              if (failAudit) {
                const error = new Error('simulated site creation audit failure');
                if (auditUniqueViolation) error.code = '23505';
                throw error;
              }
              assert.deepEqual(values, [
                siteId,
                actorId,
                'site.created',
                'site',
                siteId,
                'success',
                requestId,
                '{}',
              ]);
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected site-creation transaction query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env: {} });
    return {
      events,
      create: () => identity.createSite({ actorId, slug: 'atomic-site', name: ' Atomic Site ', requestId }),
    };
  }

  await t.test('commits the site, owner membership and audit together', async () => {
    const scenario = await runScenario();
    assert.deepEqual(await scenario.create(), site);
    assert.deepEqual(scenario.events, [
      'BEGIN',
      'CHECK_SITE_MANAGE',
      'INSERT_SITE',
      'SELECT_SITE_OWNER_ROLE',
      'INSERT_OWNER_MEMBERSHIP',
      'INSERT_SITE_AUDIT',
      'COMMIT',
      'RELEASE',
    ]);
  });

  await t.test('rolls the new site and owner membership back when audit persistence fails', async () => {
    const scenario = await runScenario({ failAudit: true });
    await assert.rejects(scenario.create(), /simulated site creation audit failure/);
    assert.deepEqual(scenario.events, [
      'BEGIN',
      'CHECK_SITE_MANAGE',
      'INSERT_SITE',
      'SELECT_SITE_OWNER_ROLE',
      'INSERT_OWNER_MEMBERSHIP',
      'INSERT_SITE_AUDIT',
      'ROLLBACK',
      'RELEASE',
    ]);
    assert.equal(scenario.events.includes('COMMIT'), false);
  });

  await t.test('denies an actor without site management before inserting a site or audit', async () => {
    const scenario = await runScenario({ allowed: false });
    await assert.rejects(
      scenario.create(),
      error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN',
    );
    assert.deepEqual(scenario.events, ['BEGIN', 'CHECK_SITE_MANAGE', 'ROLLBACK', 'RELEASE']);
  });

  await t.test('preserves audit unique-violation codes instead of misclassifying them as site slug conflicts', async () => {
    const scenario = await runScenario({ failAudit: true, auditUniqueViolation: true });
    await assert.rejects(
      scenario.create(),
      error => error.code === '23505' && error.statusCode === undefined,
    );
    assert.equal(scenario.events.includes('ROLLBACK'), true);
    assert.equal(scenario.events.includes('COMMIT'), false);
  });

  await t.test('preserves duplicate-slug conflict mapping through rollback', async () => {
    const scenario = await runScenario({ duplicateSlug: true });
    await assert.rejects(
      scenario.create(),
      error => error.statusCode === 409 && error.code === 'ERR_VIRGOSCORPIO_HUB_SITE_SLUG_EXISTS',
    );
    assert.deepEqual(scenario.events, ['BEGIN', 'CHECK_SITE_MANAGE', 'INSERT_SITE', 'ROLLBACK', 'RELEASE']);
  });
});

test('invitation acceptance audits transactionally with request correlation and post-commit invalidation', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const siteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const invitationId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const token = Buffer.alloc(32, 7).toString('base64url');
  const requestId = 'request-invitation-acceptance-123';
  const user = {
    id: userId,
    email: 'invitee@example.test',
    display_name: 'Invited Member',
    status: 'active',
    email_verified_at: new Date('2026-11-11T12:00:00.000Z'),
    mfa_enabled: false,
  };

  async function runScenario({ failAudit = false } = {}) {
    const events = [];
    const auditValues = [];
    const invalidations = [];
    const pool = {
      async query() {
        throw new Error('Unexpected pool-level query during invitation acceptance.');
      },
      async connect() {
        return {
          async query(sql, values = []) {
            events.push(sql);
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM site_invitations') && sql.includes('FOR UPDATE')) {
              return {
                rowCount: 1,
                rows: [{
                  id: invitationId,
                  site_id: siteId,
                  email: user.email,
                  role_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
                  role_slug: 'editor',
                }],
              };
            }
            if (sql.includes('FROM users WHERE lower(email)')) {
              return { rowCount: 1, rows: [user] };
            }
            if (sql.includes('INSERT INTO site_memberships')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('UPDATE site_invitations SET accepted_at')) {
              return { rowCount: 1, rows: [] };
            }
            if (sql.includes('INSERT INTO audit_events')) {
              auditValues.push(values);
              if (failAudit) throw new Error('simulated audit storage failure');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected invitation-acceptance query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({
      pool,
      env: {},
      onAuthorizationChange: async change => {
        events.push('INVALIDATE');
        invalidations.push(change);
      },
    });
    return {
      events,
      auditValues,
      invalidations,
      accept: () => identity.acceptInvitation({ token, password: 'unused-existing-account-password', requestId }),
    };
  }

  await t.test('commits membership, invitation consumption and correlated audit before invalidation', async () => {
    const scenario = await runScenario();
    const accepted = await scenario.accept();
    const auditInsert = scenario.events.findIndex(sql => typeof sql === 'string' && sql.includes('INSERT INTO audit_events'));
    const commit = scenario.events.indexOf('COMMIT');
    const invalidation = scenario.events.indexOf('INVALIDATE');

    assert.equal(accepted.siteId, siteId);
    assert.equal(accepted.role, 'editor');
    assert.equal(accepted.user.id, userId);
    assert.equal(accepted.user.emailVerified, true);
    assert.ok(auditInsert > scenario.events.indexOf('UPDATE site_invitations SET accepted_at'));
    assert.ok(commit > auditInsert);
    assert.ok(invalidation > commit, 'authorization invalidation is emitted only after the transaction commits');
    assert.deepEqual(scenario.auditValues[0], [
      siteId,
      userId,
      'site.invitation_accepted',
      'invitation',
      invitationId,
      'success',
      requestId,
      JSON.stringify({ role: 'editor' }),
    ]);
    assert.deepEqual(scenario.invalidations, [{ siteId, principalId: userId }]);
  });

  await t.test('rolls back membership and invitation acceptance when the audit insert fails', async () => {
    const scenario = await runScenario({ failAudit: true });
    await assert.rejects(
      scenario.accept(),
      /simulated audit storage failure/
    );
    assert.ok(scenario.events.includes('ROLLBACK'));
    assert.equal(scenario.events.includes('COMMIT'), false);
    assert.equal(scenario.events.includes('INVALIDATE'), false);
    assert.deepEqual(scenario.invalidations, []);
  });
});

test('identity service emits scoped authorization invalidations after membership and session changes', async () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const siteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const changes = [];
  const lockedSites = [];
  const membershipAuditValues = [];
  const transactionEvents = [];
  const pool = {
    async query(sql) {
      if (sql.includes('UPDATE auth_sessions')) return { rowCount: 1, rows: [{ id: sessionId, user_id: userId }] };
      if (sql.includes('SELECT 1 FROM auth_sessions')) return { rowCount: 1, rows: [{}] };
      if (sql.includes('SELECT id,email,display_name,status FROM users')) return { rowCount: 1, rows: [{ id: userId, email: 'member@example.test', display_name: 'Member', status: 'active' }] };
      if (sql.includes('SELECT id FROM roles')) return { rowCount: 1, rows: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }] };
      if (sql.includes('INSERT INTO site_memberships')) return { rowCount: 1, rows: [{ user_id: userId }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            transactionEvents.push(sql);
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('SELECT id,email,display_name,status FROM users')) return { rowCount: 1, rows: [{ id: userId, email: 'member@example.test', display_name: 'Member', status: 'active' }] };
          if (sql.includes('SELECT id FROM roles')) return { rowCount: 1, rows: [{ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' }] };
          if (sql.includes('INSERT INTO site_memberships')) return { rowCount: 1, rows: [{ user_id: userId }] };
          if (sql.includes('INSERT INTO audit_events')) { membershipAuditValues.push(values); return { rowCount: 1, rows: [] }; }
          if (sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) return { rowCount: 1, rows: [{ id: siteId }] };
          if (sql.includes('FOR SHARE OF m, r, u')) return { rowCount: 1, rows: [{ capabilities: ['site:manage'] }] };
          if (sql.includes('SELECT id FROM sites WHERE id=$1 FOR UPDATE')) {
            lockedSites.push(siteId);
            return { rowCount: 1, rows: [{ id: siteId }] };
          }
          if (sql.includes("r.slug='site-owner'")) return { rowCount: 0, rows: [] };
          if (sql.includes('DELETE FROM site_memberships')) return { rowCount: 1, rows: [{ user_id: userId }] };
          throw new Error(`Unexpected transaction query: ${sql}`);
        },
        release() {}
      };
    }
  };
  const identity = createIdentityService({
    pool,
    env: {},
    onAuthorizationChange: async change => {
      transactionEvents.push('INVALIDATE');
      changes.push(change);
    },
  });

  assert.deepEqual(await identity.revokeSession({ userId, sessionId }), { revoked: true });
  assert.deepEqual(await identity.logout('opaque-session-token'), { revoked: true });
  const transactionEventsBeforeMembership = transactionEvents.length;
  const membershipRequestId = 'request-membership-admin-123';
  await identity.addMember({ siteId, email: 'member@example.test', roleSlug: 'editor', actorId: userId, requestId: membershipRequestId });
  await identity.removeMember({ siteId, userId, actorId: userId, requestId: membershipRequestId });
  assert.deepEqual(membershipAuditValues, [
    [siteId, userId, 'site.member_added', 'user', userId, 'success', membershipRequestId, JSON.stringify({ role: 'editor' })],
    [siteId, userId, 'site.member_removed', 'user', userId, 'success', membershipRequestId, '{}'],
  ]);
  assert.deepEqual(
    transactionEvents.slice(transactionEventsBeforeMembership),
    ['BEGIN', 'COMMIT', 'INVALIDATE', 'BEGIN', 'COMMIT', 'INVALIDATE'],
    'each membership invalidation must be published only after the matching transaction commits',
  );
  assert.deepEqual(lockedSites, [siteId], 'membership removal serializes against changes for the same site');
  assert.deepEqual(changes, [
    { principalId: userId, sessionId },
    { principalId: userId, sessionId },
    { siteId, principalId: userId },
    { siteId, principalId: userId }
  ]);
  assert.equal(await identity.isSessionActive({ userId, sessionId }), true);
  assert.equal(await identity.isSessionActive({ userId: '', sessionId }), false);
});

test('browser session and CSRF bearer values are random opaque tokens while only their SHA-256 digests are persisted', async () => {
  const passwordHash = await hashPassword('CorrectHorse9Battery');
  const userId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  let sessionInsert;

  const pool = {
    async query(sql, values) {
      if (sql.includes('FROM users WHERE lower(email)')) {
        return { rowCount: 1, rows: [{
          id: userId, email: 'owner@example.test', display_name: 'Owner',
          status: 'active', password_hash: passwordHash, mfa_enabled: false,
          email_verified_at: new Date()
        }] };
      }
      if (sql.includes('INSERT INTO auth_sessions')) {
        sessionInsert = { sql, values };
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const identity = createIdentityService({ pool, env: {} });
  const session = await identity.login({
    email: 'owner@example.test', password: 'CorrectHorse9Battery',
    ip: '192.0.2.10', userAgent: 'VirgoScorpio Hub security test'
  });

  assert.equal(Buffer.from(session.token, 'base64url').length, 32, 'session token contains 256 bits of random material');
  assert.equal(Buffer.from(session.csrf, 'base64url').length, 32, 'CSRF token contains 256 bits of random material');
  assert.equal(sessionInsert.values[0], userId);
  assert.equal(sessionInsert.values[1], digest(session.token), 'only the session token digest is sent to PostgreSQL');
  assert.equal(sessionInsert.values[2], digest(session.csrf), 'only the CSRF token digest is sent to PostgreSQL');
  assert.notEqual(sessionInsert.values[1], session.token);
  assert.notEqual(sessionInsert.values[2], session.csrf);
  assert.equal(sessionInsert.values[4], digest('VirgoScorpio Hub security test'));
  assert.equal(sessionInsert.values[5], digest('192.0.2.10'));
  assert.equal(session.user.id, userId);
});

test('MFA browser challenge is random, short-lived, and only its digest is persisted', async () => {
  const passwordHash = await hashPassword('CorrectHorse9Battery');
  const userId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  let challengeInsert;

  const pool = {
    async query(sql, values) {
      if (sql.includes('FROM users WHERE lower(email)')) {
        return { rowCount: 1, rows: [{
          id: userId, email: 'mfa@example.test', display_name: 'MFA User',
          status: 'active', password_hash: passwordHash, mfa_enabled: true,
          email_verified_at: new Date()
        }] };
      }
      if (sql.includes('INSERT INTO auth_mfa_challenges')) {
        challengeInsert = { sql, values };
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const identity = createIdentityService({ pool, env: {} });
  const login = await identity.login({
    email: 'mfa@example.test', password: 'CorrectHorse9Battery',
    ip: '192.0.2.11', userAgent: 'VirgoScorpio Hub MFA security test'
  });

  assert.equal(login.mfaRequired, true);
  assert.equal(Buffer.from(login.challengeToken, 'base64url').length, 32);
  assert.equal(challengeInsert.values[0], userId);
  assert.equal(challengeInsert.values[1], digest(login.challengeToken), 'only the MFA challenge digest is sent to PostgreSQL');
  assert.notEqual(challengeInsert.values[1], login.challengeToken);
  assert.ok(challengeInsert.values[2] instanceof Date);
  assert.ok(challengeInsert.values[2].getTime() > Date.now());
  assert.ok(challengeInsert.values[2].getTime() <= Date.now() + 5 * 60_000 + 1000);
});

test('token digests and equality checks avoid direct token storage assumptions', () => {
  assert.equal(digest('secret').length, 64);
  assert.equal(safeEqualText('abc', 'abc'), true);
  assert.equal(safeEqualText('abc', 'abd'), false);
  assert.equal(safeEqualText('abc', 'abcd'), false);
});

test('MFA enrollment requires password step-up authentication', async t => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const correctPasswordHash = await hashPassword('CorrectHorse9Battery');
  const { randomBytes } = require('node:crypto');
  const mfaKey = randomBytes(32).toString('base64url');
  const user = {
    id: userId,
    email: 'user@example.test',
    display_name: 'Test User',
    status: 'active',
    password_hash: correctPasswordHash,
    mfa_enabled: false,
  };

  await t.test('rejects enrollment with empty password', async () => {
    const events = [];
    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env: { VIRGOSCORPIO_HUB_MFA_ENCRYPTION_KEY: mfaKey } });
    await assert.rejects(
      identity.beginMfaEnrollment({ userId, password: '', code: '' }),
      error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_REAUTH_FAILED'
    );
    assert.deepEqual(events, ['BEGIN', 'SELECT_USER', 'ROLLBACK', 'RELEASE']);
  });

  await t.test('rejects enrollment with wrong password', async () => {
    const events = [];
    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env: { VIRGOSCORPIO_HUB_MFA_ENCRYPTION_KEY: mfaKey } });
    await assert.rejects(
      identity.beginMfaEnrollment({ userId, password: 'WrongPassword123', code: '' }),
      error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_REAUTH_FAILED'
    );
    assert.deepEqual(events, ['BEGIN', 'SELECT_USER', 'ROLLBACK', 'RELEASE']);
  });

  await t.test('allows enrollment with correct password when MFA is not enabled', async () => {
    const events = [];
    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            if (sql.includes('INSERT INTO user_mfa_credentials')) {
              events.push('INSERT_CREDENTIAL');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env: { VIRGOSCORPIO_HUB_MFA_ENCRYPTION_KEY: mfaKey } });
    const enrollment = await identity.beginMfaEnrollment({ userId, password: 'CorrectHorse9Battery', code: '' });
    assert.ok(enrollment.secret);
    assert.ok(enrollment.otpauthUrl);
    assert.equal(enrollment.issuer, 'VirgoScorpio Hub');
    assert.deepEqual(events, ['BEGIN', 'SELECT_USER', 'INSERT_CREDENTIAL', 'COMMIT', 'RELEASE']);
  });
});

test('MFA re-enrollment requires current factor verification when MFA is already enabled', async t => {
  const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const correctPasswordHash = await hashPassword('CorrectHorse9Battery');
  const { randomBytes } = require('node:crypto');
  const mfaKey = randomBytes(32).toString('base64url');
  const { generateTotpSecret, verifyTotp, encryptSecret } = require('../packages/auth/src/totp');
  const env = { VIRGOSCORPIO_HUB_MFA_ENCRYPTION_KEY: mfaKey };
  const existingSecret = generateTotpSecret();
  const encryptedSecret = encryptSecret(existingSecret, env);
  
  const user = {
    id: userId,
    email: 'mfa-user@example.test',
    display_name: 'MFA User',
    status: 'active',
    password_hash: correctPasswordHash,
    mfa_enabled: true,
  };

  const credential = {
    secret_ciphertext: encryptedSecret,
    last_used_step: -1,
    pending_secret: false,
  };

  await t.test('rejects re-enrollment with password but no MFA code', async () => {
    const events = [];
    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return { rowCount: 1, rows: [credential] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env, clock: () => Date.now() });
    await assert.rejects(
      identity.beginMfaEnrollment({ userId, password: 'CorrectHorse9Battery', code: '' }),
      error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_REAUTH_FAILED'
    );
    assert.deepEqual(events, ['BEGIN', 'SELECT_USER', 'SELECT_CREDENTIAL', 'ROLLBACK', 'RELEASE']);
  });

  await t.test('rejects re-enrollment with password and invalid MFA code', async () => {
    const events = [];
    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return { rowCount: 1, rows: [credential] };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes SET consumed_at=now()')) {
              events.push('CHECK_RECOVERY');
              return { rowCount: 0, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env, clock: () => Date.now() });
    await assert.rejects(
      identity.beginMfaEnrollment({ userId, password: 'CorrectHorse9Battery', code: '000000' }),
      error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_REAUTH_FAILED'
    );
    assert.ok(events.includes('SELECT_USER'));
    assert.ok(events.includes('SELECT_CREDENTIAL'));
    assert.ok(events.includes('ROLLBACK'));
  });

  await t.test('allows re-enrollment with password and valid TOTP code', async () => {
    const events = [];
    const now = Date.now();
    const { totpAt } = require('../packages/auth/src/totp');
    const currentStep = Math.floor(now / 30_000);
    const validCode = totpAt(existingSecret, currentStep);

    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return { rowCount: 1, rows: [credential] };
            }
            if (sql.includes('INSERT INTO user_mfa_credentials')) {
              events.push('INSERT_NEW_CREDENTIAL');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env, clock: () => now });
    const enrollment = await identity.beginMfaEnrollment({ userId, password: 'CorrectHorse9Battery', code: validCode });
    assert.ok(enrollment.secret);
    assert.ok(enrollment.otpauthUrl);
    assert.deepEqual(events, ['BEGIN', 'SELECT_USER', 'SELECT_CREDENTIAL', 'INSERT_NEW_CREDENTIAL', 'COMMIT', 'RELEASE']);
  });

  await t.test('allows re-enrollment with password and valid recovery code', async () => {
    const events = [];
    const recoveryCode = 'VALID-RECOVERY-CODE-123';

    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('SELECT id,email,status,password_hash,mfa_enabled FROM users')) {
              events.push('SELECT_USER');
              return { rowCount: 1, rows: [user] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return { rowCount: 1, rows: [credential] };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes SET consumed_at=now()')) {
              events.push('CONSUME_RECOVERY');
              return { rowCount: 1, rows: [{ id: 'recovery-id' }] };
            }
            if (sql.includes('INSERT INTO user_mfa_credentials')) {
              events.push('INSERT_NEW_CREDENTIAL');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env, clock: () => Date.now() });
    const enrollment = await identity.beginMfaEnrollment({ userId, password: 'CorrectHorse9Battery', code: recoveryCode });
    assert.ok(enrollment.secret);
    assert.ok(enrollment.otpauthUrl);
    assert.deepEqual(events, ['BEGIN', 'SELECT_USER', 'SELECT_CREDENTIAL', 'CONSUME_RECOVERY', 'INSERT_NEW_CREDENTIAL', 'COMMIT', 'RELEASE']);
  });
});

test('MFA login rejects pending credentials but accepts recovery codes during abandoned enrollment', async t => {
  const userId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const challengeToken = Buffer.alloc(32, 5).toString('base64url');
  const { randomBytes } = require('node:crypto');
  const mfaKey = randomBytes(32).toString('base64url');
  const { generateTotpSecret, encryptSecret, totpAt } = require('../packages/auth/src/totp');
  const env = { VIRGOSCORPIO_HUB_MFA_ENCRYPTION_KEY: mfaKey };
  const pendingSecret = generateTotpSecret();
  const encryptedPendingSecret = encryptSecret(pendingSecret, env);
  const now = Date.now();
  const currentStep = Math.floor(now / 30_000);
  const validCodeForPendingSecret = totpAt(pendingSecret, currentStep);

  const challenge = {
    challenge_id: 'challenge-id',
    user_id: userId,
    attempts: 0,
    id: userId,
    email: 'mfa-user@example.test',
    display_name: 'MFA User',
    status: 'active',
    mfa_enabled: true,
  };

  const pendingCredential = {
    secret_ciphertext: encryptedPendingSecret,
    last_used_step: -1,
    pending_secret: true,
  };

  await t.test('rejects TOTP code from pending (unconfirmed) secret during login', async () => {
    const events = [];
    const pool = {
      async query() { throw new Error('Must not use pool-level query.'); },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u')) {
              events.push('SELECT_CHALLENGE');
              return { rowCount: 1, rows: [challenge] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return { rowCount: 1, rows: [pendingCredential] };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes SET consumed_at=now()')) {
              events.push('CHECK_RECOVERY');
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET attempts=attempts+1')) {
              events.push('INCREMENT_ATTEMPTS');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env, clock: () => now });
    await assert.rejects(
      identity.completeMfaLogin({ challengeToken, code: validCodeForPendingSecret, ip: '192.0.2.1', userAgent: 'test' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_MFA_INVALID'
    );
    assert.ok(events.includes('SELECT_CHALLENGE'));
    assert.ok(events.includes('SELECT_CREDENTIAL'));
    assert.ok(events.includes('INCREMENT_ATTEMPTS'), 'failed login attempt must be recorded');
    assert.ok(events.includes('COMMIT'), 'attempt increment must be committed');
  });

  await t.test('accepts valid recovery code during abandoned enrollment', async () => {
    const events = [];
    const recoveryCode = 'VALID-RECOVERY-CODE-456';
    const sessionId = 'session-id';

    const pool = {
      async query(sql, values = []) {
        if (sql.includes('INSERT INTO auth_sessions')) {
          events.push('CREATE_SESSION');
          return { rowCount: 1, rows: [{ id: sessionId }] };
        }
        throw new Error('Unexpected pool query: ' + sql);
      },
      async connect() {
        return {
          async query(sql, values = []) {
            if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              events.push(sql);
              return { rowCount: 0, rows: [] };
            }
            if (sql.includes('FROM auth_mfa_challenges c JOIN users u')) {
              events.push('SELECT_CHALLENGE');
              return { rowCount: 1, rows: [challenge] };
            }
            if (sql.includes('SELECT secret_ciphertext,last_used_step,pending_secret FROM user_mfa_credentials')) {
              events.push('SELECT_CREDENTIAL');
              return { rowCount: 1, rows: [pendingCredential] };
            }
            if (sql.includes('UPDATE user_mfa_recovery_codes SET consumed_at=now()')) {
              events.push('CONSUME_RECOVERY');
              return { rowCount: 1, rows: [{ id: 'recovery-id' }] };
            }
            if (sql.includes('UPDATE auth_mfa_challenges SET consumed_at')) {
              events.push('CONSUME_CHALLENGE');
              return { rowCount: 1, rows: [] };
            }
            throw new Error('Unexpected query: ' + sql);
          },
          release() { events.push('RELEASE'); },
        };
      },
    };
    const identity = createIdentityService({ pool, env, clock: () => now });
    const session = await identity.completeMfaLogin({ challengeToken, code: recoveryCode, ip: '192.0.2.1', userAgent: 'test' });
    assert.equal(session.mfaRequired, false);
    assert.ok(session.token);
    assert.ok(events.includes('SELECT_CHALLENGE'));
    assert.ok(events.includes('SELECT_CREDENTIAL'));
    assert.ok(events.includes('CONSUME_RECOVERY'), 'recovery code must be accepted during pending state');
    assert.ok(events.includes('CONSUME_CHALLENGE'));
    assert.ok(events.includes('COMMIT'));
  });
});
