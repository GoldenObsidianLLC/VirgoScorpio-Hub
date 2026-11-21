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
  const encoded = await hashPassword('****tery');
  assert.match(encoded, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await verifyPassword('****tery', encoded), true);
  assert.equal(await verifyPassword('WrongHorse9Battery', encoded), false);
  assert.equal(await verifyPassword('anything', 'unknown$scheme'), false);
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
      accept: () => identity.acceptInvitation({ token, password: '****word', requestId }),
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
  const passwordHash = await hashPassword('****tery');
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
    email: 'owner@example.test', password: '****tery',
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
  const passwordHash = await hashPassword('****tery');
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
    email: 'mfa@example.test', password: '****tery',
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

test('login performs equivalent scrypt work for missing and existing users to prevent timing oracle', async t => {
  const validPasswordHash = await hashPassword('****tery');
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  await t.test('missing user triggers dummy hash verification instead of early return', async () => {
    const verifications = [];
    const pool = {
      async query(sql, values) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          verifications.push({ type: 'query', email: values[0] });
          return { rowCount: 0, rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: 'nonexistent@example.test', password: '****tery', ip: '192.0.2.1' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.equal(verifications.length, 1);
    assert.equal(verifications[0].email, 'nonexistent@example.test');
    assert.ok(duration > 50, 'missing user login must perform expensive scrypt work, not return immediately');
  });

  await t.test('existing user with valid hash performs scrypt verification', async () => {
    const pool = {
      async query(sql, values) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return {
            rowCount: 1,
            rows: [{
              id: userId,
              email: 'existing@example.test',
              display_name: 'Existing User',
              status: 'active',
              password_hash: validPasswordHash,
              mfa_enabled: false,
              email_verified_at: new Date()
            }]
          };
        }
        if (sql.includes('INSERT INTO auth_sessions')) {
          return { rowCount: 1, rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    const session = await identity.login({
      email: 'existing@example.test',
      password: '****tery',
      ip: '192.0.2.2'
    });
    const duration = Date.now() - startTime;

    assert.equal(session.user.id, userId);
    assert.ok(duration > 50, 'existing user login must perform expensive scrypt work');
  });

  await t.test('existing user with wrong password performs scrypt verification and fails', async () => {
    const pool = {
      async query(sql, values) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return {
            rowCount: 1,
            rows: [{
              id: userId,
              email: 'existing@example.test',
              display_name: 'Existing User',
              status: 'active',
              password_hash: validPasswordHash,
              mfa_enabled: false,
              email_verified_at: new Date()
            }]
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: 'existing@example.test', password: 'WrongPassword9', ip: '192.0.2.3' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.ok(duration > 50, 'wrong password must still perform expensive scrypt work');
  });

  await t.test('user with malformed password hash triggers dummy hash verification', async () => {
    const pool = {
      async query(sql, values) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return {
            rowCount: 1,
            rows: [{
              id: userId,
              email: 'malformed@example.test',
              display_name: 'Malformed Hash User',
              status: 'active',
              password_hash: 'invalid$hash$format',
              mfa_enabled: false,
              email_verified_at: new Date()
            }]
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: 'malformed@example.test', password: 'AnyPassword9', ip: '192.0.2.4' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.ok(duration > 50, 'malformed hash must trigger dummy hash verification, not early return');
  });

  await t.test('user with null password hash triggers dummy hash verification', async () => {
    const pool = {
      async query(sql, values) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return {
            rowCount: 1,
            rows: [{
              id: userId,
              email: 'nullhash@example.test',
              display_name: 'Null Hash User',
              status: 'active',
              password_hash: null,
              mfa_enabled: false,
              email_verified_at: new Date()
            }]
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: 'nullhash@example.test', password: 'AnyPassword9', ip: '192.0.2.5' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.ok(duration > 50, 'null hash must trigger dummy hash verification, not early return');
  });

  await t.test('timing difference between missing and existing users is minimized', async () => {
    const missingUserPool = {
      async query(sql) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return { rowCount: 0, rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const existingUserPool = {
      async query(sql) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return {
            rowCount: 1,
            rows: [{
              id: userId,
              email: 'existing@example.test',
              display_name: 'Existing User',
              status: 'active',
              password_hash: validPasswordHash,
              mfa_enabled: false,
              email_verified_at: new Date()
            }]
          };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const missingIdentity = createIdentityService({ pool: missingUserPool, env: {} });
    const existingIdentity = createIdentityService({ pool: existingUserPool, env: {} });

    const missingStart = Date.now();
    await assert.rejects(
      missingIdentity.login({ email: 'missing@example.test', password: 'TestPassword9', ip: '192.0.2.6' }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const missingDuration = Date.now() - missingStart;

    const existingStart = Date.now();
    await assert.rejects(
      existingIdentity.login({ email: 'existing@example.test', password: 'WrongPassword9', ip: '192.0.2.7' }),
      error => error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const existingDuration = Date.now() - existingStart;

    const timingRatio = Math.max(missingDuration, existingDuration) / Math.min(missingDuration, existingDuration);
    assert.ok(
      timingRatio < 3,
      `timing ratio between missing (${missingDuration}ms) and existing (${existingDuration}ms) user paths should be similar (ratio: ${timingRatio.toFixed(2)})`
    );
    assert.ok(missingDuration > 50, 'missing user path must perform expensive work');
    assert.ok(existingDuration > 50, 'existing user path must perform expensive work');
  });

  await t.test('invalid email format triggers dummy hash verification', async () => {
    const pool = {
      async query() {
        throw new Error('Invalid email should not reach database query');
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: 'not-an-email', password: 'TestPassword9', ip: '192.0.2.8' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.ok(duration > 50, 'invalid email must still trigger dummy hash verification');
  });

  await t.test('empty email triggers dummy hash verification', async () => {
    const pool = {
      async query() {
        throw new Error('Empty email should not reach database query');
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: '', password: 'TestPassword9', ip: '192.0.2.9' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.ok(duration > 50, 'empty email must still trigger dummy hash verification');
  });

  await t.test('non-string password is safely handled with dummy hash', async () => {
    const pool = {
      async query(sql) {
        if (sql.includes('FROM users WHERE lower(email)')) {
          return { rowCount: 0, rows: [] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      }
    };

    const identity = createIdentityService({ pool, env: {} });
    const startTime = Date.now();
    await assert.rejects(
      identity.login({ email: 'test@example.test', password: null, ip: '192.0.2.10' }),
      error => error.statusCode === 401 && error.code === 'ERR_VIRGOSCORPIO_HUB_LOGIN_FAILED'
    );
    const duration = Date.now() - startTime;

    assert.ok(duration > 50, 'non-string password must still trigger dummy hash verification');
  });
});

test('dummy password hash is structurally valid and performs equivalent scrypt work', async () => {
  const { DUMMY_PASSWORD_HASH, isUsableScryptHash } = require('../packages/auth/src/service');

  assert.ok(DUMMY_PASSWORD_HASH, 'DUMMY_PASSWORD_HASH constant must be exported');
  assert.ok(typeof DUMMY_PASSWORD_HASH === 'string', 'DUMMY_PASSWORD_HASH must be a string');
  assert.match(DUMMY_PASSWORD_HASH, /^scrypt\$32768\$8\$1\$/, 'DUMMY_PASSWORD_HASH must use standard scrypt parameters');

  const parts = DUMMY_PASSWORD_HASH.split('$');
  assert.equal(parts.length, 6, 'DUMMY_PASSWORD_HASH must have 6 parts');
  assert.equal(parts[0], 'scrypt');
  assert.equal(parts[1], '32768', 'N parameter must match production hashes');
  assert.equal(parts[2], '8', 'r parameter must match production hashes');
  assert.equal(parts[3], '1', 'p parameter must match production hashes');

  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  assert.equal(salt.length, 16, 'dummy salt must be 16 bytes');
  assert.equal(hash.length, 64, 'dummy hash must be 64 bytes');

  assert.equal(isUsableScryptHash(DUMMY_PASSWORD_HASH), true, 'DUMMY_PASSWORD_HASH must pass usability check');

  const startTime = Date.now();
  const result = await verifyPassword('any-password', DUMMY_PASSWORD_HASH);
  const duration = Date.now() - startTime;

  assert.equal(result, false, 'dummy hash must never match any password');
  assert.ok(duration > 50, 'dummy hash verification must perform expensive scrypt work');
});

test('isUsableScryptHash correctly validates hash structure', () => {
  const { isUsableScryptHash } = require('../packages/auth/src/service');

  const validHash = `scrypt$32768$8$1$${Buffer.alloc(16, 0x5a).toString('base64url')}$${Buffer.alloc(64, 0xa5).toString('base64url')}`;
  assert.equal(isUsableScryptHash(validHash), true, 'valid hash structure must pass');

  assert.equal(isUsableScryptHash(null), false, 'null must fail');
  assert.equal(isUsableScryptHash(undefined), false, 'undefined must fail');
  assert.equal(isUsableScryptHash(123), false, 'number must fail');
  assert.equal(isUsableScryptHash(''), false, 'empty string must fail');
  assert.equal(isUsableScryptHash('not-a-hash'), false, 'invalid format must fail');
  assert.equal(isUsableScryptHash('bcrypt$10$salt$hash'), false, 'wrong algorithm must fail');
  assert.equal(isUsableScryptHash('scrypt$16384$8$1$salt$hash'), false, 'wrong N parameter must fail');
  assert.equal(isUsableScryptHash('scrypt$32768$16$1$salt$hash'), false, 'wrong r parameter must fail');
  assert.equal(isUsableScryptHash('scrypt$32768$8$2$salt$hash'), false, 'wrong p parameter must fail');
  assert.equal(isUsableScryptHash(`scrypt$32768$8$1$${Buffer.alloc(8).toString('base64url')}$${Buffer.alloc(64).toString('base64url')}`), false, 'wrong salt length must fail');
  assert.equal(isUsableScryptHash(`scrypt$32768$8$1$${Buffer.alloc(16).toString('base64url')}$${Buffer.alloc(32).toString('base64url')}`), false, 'wrong hash length must fail');
  assert.equal(isUsableScryptHash('scrypt$32768$8$1$!!!invalid!!!$hash'), false, 'invalid base64url must fail');
});
