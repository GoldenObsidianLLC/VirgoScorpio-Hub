'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleCommunityWorkflowRoute, cleanRequiredText, constants } = require('../packages/community/src/workflows');

const siteId = 'cb289662-2ea5-4b43-92a9-cd2dce8f9310';
const actorId = '82c36ec0-4fd4-4c85-bb7d-dde7e6a61098';
const recipientId = '385ef0ad-d7d6-4ec1-a1f4-1f9230551ea7';

function createContext({ method = 'GET', path = `/api/v1/sites/${siteId}/community/conversations`, body = {}, query = '', pool } = {}) {
  const ctx = {
    req: { method },
    res: {},
    url: new URL(`http://virgoscorpio-hub.local${path}${query}`),
    actor: { user: { id: actorId, email: 'actor@example.test' } },
    localPool: pool || { async query() { return { rows: [] }; }, async connect() { throw new Error('connect should not be called'); } },
    maxBody: 64_000,
    requestId: 'test-request',
    async siteIdFor() { return siteId; },
    async requireCapability() { return true; },
    async readJson() { return body; },
    sendJson(res, status, payload) { res.statusCode = status; res.payload = payload; return true; },
    fail(statusCode, code, message, details) { return Object.assign(new Error(message), { statusCode, code, details }); }
  };
  return ctx;
}

function transactionalConversationListPool({ activeMembership = true } = {}) {
  const state = { statements: [], commits: 0, rollbacks: 0, releases: 0 };
  const conversationId = 'a8bf4f30-9827-4bf0-9a77-2b96b173bfb1';
  const client = {
    async query(sql) {
      const statement = String(sql).trim();
      state.statements.push(statement);
      if (statement === 'BEGIN') return { rows: [] };
      if (statement === 'COMMIT') { state.commits += 1; return { rows: [] }; }
      if (statement === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
      if (statement.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) {
        return { rows: [{ id: siteId }] };
      }
      if (statement.includes('SELECT r.capabilities FROM users u')) {
        return { rows: activeMembership ? [{ capabilities: ['content:read'] }] : [] };
      }
      if (statement.startsWith('SELECT c.id,c.conversation_type,c.group_id')) {
        return {
          rows: [{
            id: conversationId,
            conversation_type: 'direct',
            group_id: null,
            participants: [{ userId: actorId, displayName: 'Actor' }],
            last_message_body: 'Latest message preview',
            last_message_sender_id: recipientId,
            last_message_at: new Date('2026-11-27T00:00:00.000Z'),
            unread_count: 1,
          }],
        };
      }
      throw new Error('Unexpected conversation-list transaction query: ' + statement);
    },
    release() { state.releases += 1; },
  };
  return {
    state,
    async query() { throw new Error('pool.query must not be used for the transactional conversation list'); },
    async connect() { return client; },
  };
}

function transactionalMessagePool({ activeMembership = true } = {}) {
  const state = { statements: [], commits: 0, rollbacks: 0, releases: 0 };
  const conversationId = 'e8e1c8c8-3523-4acd-a3f6-c4dfd3cdbb9b';
  const client = {
    async query(sql) {
      const statement = sql.replace(/\s+/g, ' ').trim();
      state.statements.push(statement);
      if (statement === 'BEGIN') return { rows: [] };
      if (statement === 'COMMIT') { state.commits += 1; return { rows: [] }; }
      if (statement === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
      if (statement.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) return { rows: [{ id: siteId }] };
      if (statement.includes('SELECT r.capabilities FROM users u')) {
        return { rows: activeMembership ? [{ capabilities: ['content:create'] }] : [] };
      }
      if (statement.startsWith('SELECT c.id,c.conversation_type,c.group_id')) {
        return { rows: [{ id: conversationId, conversation_type: 'direct', group_id: null }] };
      }
      if (statement.startsWith('SELECT user_id FROM social_conversation_members')) return { rows: [{ user_id: recipientId }] };
      if (statement.includes('FROM social_blocks')) return { rows: [] };
      if (statement.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (statement.includes('SELECT count(*)::int AS count FROM social_messages')) return { rows: [{ count: 0 }] };
      if (statement.startsWith('INSERT INTO social_messages')) {
        return { rows: [{ id: 'c2f744b0-5c66-4f26-91d3-22f42d11a509', conversation_id: conversationId, sender_id: actorId, body: 'Hello', status: 'sent' }] };
      }
      if (statement.startsWith('UPDATE social_conversations')) return { rows: [] };
      if (statement.startsWith('INSERT INTO social_notifications')) return { rows: [] };
      throw new Error('Unexpected message transaction query: ' + statement);
    },
    release() { state.releases += 1; }
  };
  return {
    state,
    async query() { throw new Error('pool.query should not be called by message mutation'); },
    async connect() { return client; }
  };
}

test('message creation revalidates active site membership under the site-first transaction lock', async () => {
  const pool = transactionalMessagePool();
  const conversationId = 'e8e1c8c8-3523-4acd-a3f6-c4dfd3cdbb9b';
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/conversations/' + conversationId + '/messages',
    body: { body: 'Hello' },
    pool
  });

  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 201);
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.rollbacks, 0);
  assert.equal(pool.state.releases, 1);
  const siteLock = pool.state.statements.findIndex(sql => sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE'));
  const membershipCheck = pool.state.statements.findIndex(sql => sql.includes('SELECT r.capabilities FROM users u'));
  const conversationCheck = pool.state.statements.findIndex(sql => sql.startsWith('SELECT c.id,c.conversation_type,c.group_id'));
  const messageInsert = pool.state.statements.findIndex(sql => sql.startsWith('INSERT INTO social_messages'));
  assert.ok(siteLock >= 0 && siteLock < membershipCheck);
  assert.ok(membershipCheck < conversationCheck && conversationCheck < messageInsert);
});

test('message creation rolls back when the sender lost active site membership', async () => {
  const pool = transactionalMessagePool({ activeMembership: false });
  const conversationId = 'e8e1c8c8-3523-4acd-a3f6-c4dfd3cdbb9b';
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/conversations/' + conversationId + '/messages',
    body: { body: 'Must not be persisted' },
    pool
  });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN' && error.statusCode === 403
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(sql => sql.startsWith('INSERT INTO social_messages')), false);
});

test('conversation listing revalidates active site membership before returning previews in one transaction', async () => {
  const pool = transactionalConversationListPool();
  const ctx = createContext({ pool });

  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.payload.conversations.length, 1);
  assert.equal(ctx.res.payload.conversations[0].last_message_body, 'Latest message preview');
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.rollbacks, 0);
  assert.equal(pool.state.releases, 1);

  const siteLock = pool.state.statements.findIndex(sql => sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE'));
  const membershipCheck = pool.state.statements.findIndex(sql => sql.includes('SELECT r.capabilities FROM users u'));
  const conversationList = pool.state.statements.findIndex(sql => sql.startsWith('SELECT c.id,c.conversation_type,c.group_id'));
  assert.ok(siteLock >= 0 && siteLock < membershipCheck);
  assert.ok(membershipCheck < conversationList, 'site membership must be revalidated before the conversation preview query');
});

test('conversation listing rolls back and discloses no previews after site membership revocation', async () => {
  const pool = transactionalConversationListPool({ activeMembership: false });
  const ctx = createContext({ pool });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN' && error.statusCode === 403,
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(
    pool.state.statements.some(sql => sql.startsWith('SELECT c.id,c.conversation_type,c.group_id')),
    false,
    'denied requests must not execute the conversation preview query',
  );
});

test('developer message creation preserves its existing membership-check bypass', async () => {
  const pool = transactionalMessagePool({ activeMembership: false });
  const conversationId = 'e8e1c8c8-3523-4acd-a3f6-c4dfd3cdbb9b';
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/conversations/' + conversationId + '/messages',
    body: { body: 'Developer message' },
    pool
  });
  ctx.actor.isDeveloper = true;

  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 201);
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(sql => sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')), false);
  assert.equal(pool.state.statements.some(sql => sql.includes('SELECT r.capabilities FROM users u')), false);
});

test('community workflow helpers sanitize control characters and cap input length', () => {
  assert.equal(cleanRequiredText('  hello\r\nworld\u0000  ', 100), 'hello\nworld');
  assert.equal(cleanRequiredText('x'.repeat(20), 5), 'xxxxx');
  assert.equal(constants.MAX_MESSAGE_LENGTH, 10_000);
  assert.equal(constants.MESSAGES_PER_MINUTE, 30);
});

test('unrelated API paths are not consumed by community workflow routing', async () => {
  const ctx = createContext({ path: '/api/v1/sites/' + siteId + '/community/feed' });
  assert.equal(await handleCommunityWorkflowRoute(ctx), false);
});

test('direct conversation creation rejects malformed or self-recipient before database access', async () => {
  for (const recipient of ['', actorId, 'not-a-uuid']) {
    const ctx = createContext({ method: 'POST', body: { recipientId: recipient }, pool: {
      async query() { throw new Error('query should not be called'); },
      async connect() { throw new Error('connect should not be called'); }
    } });
    await assert.rejects(handleCommunityWorkflowRoute(ctx), error => error.code === 'ERR_VIRGOSCORPIO_HUB_CONVERSATION_RECIPIENT' && error.statusCode === 400);
  }
});

test('message creation rejects empty content before opening a transaction', async () => {
  const conversationId = 'e8e1c8c8-3523-4acd-a3f6-c4dfd3cdbb9b';
  const ctx = createContext({ method: 'POST', path: `/api/v1/sites/${siteId}/community/conversations/${conversationId}/messages`, body: { body: ' \n ' }, pool: {
    async query() { throw new Error('query should not be called for an invalid message'); },
    async connect() { throw new Error('connect should not be called for an invalid message'); }
  } });
  await assert.rejects(handleCommunityWorkflowRoute(ctx), error => error.code === 'ERR_VIRGOSCORPIO_HUB_MESSAGE_INVALID' && error.statusCode === 400);
});

test('report listing revalidates community moderation transactionally before reading details', async () => {
  const report = {
    id: 'f65a5487-f9fc-4a98-a71b-1f23c9f08490',
    reporter_id: recipientId,
    reporter_name: 'Reporter',
    target_type: 'user',
    target_id: recipientId,
    category: 'harassment',
    detail: 'Private report detail',
    status: 'open',
  };
  function createPool({ hasCapability }) {
    const state = { statements: [], commits: 0, rollbacks: 0, releases: 0, poolQueries: 0 };
    const client = {
      async query(sql, params) {
        const statement = String(sql).replace(/\s+/g, ' ').trim();
        state.statements.push({ statement, params });
        if (statement === 'BEGIN') return { rows: [] };
        if (statement === 'COMMIT') { state.commits += 1; return { rows: [] }; }
        if (statement === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
        if (statement.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) return { rows: [{ id: siteId }] };
        if (statement.includes('SELECT r.capabilities FROM users u')) {
          return { rows: hasCapability ? [{ capabilities: ['community:moderate'] }] : [] };
        }
        if (statement.includes('FROM social_reports r JOIN users u')) return { rows: [report] };
        throw new Error('Unexpected report-list transaction query: ' + statement);
      },
      release() { state.releases += 1; },
    };
    return {
      state,
      pool: {
        async query() { state.poolQueries += 1; throw new Error('pool.query must not be used for the transactional report list'); },
        async connect() { return client; },
      },
    };
  }

  const active = createPool({ hasCapability: true });
  const activeCtx = createContext({ method: 'GET', path: '/api/v1/sites/' + siteId + '/community/reports', query: '?status=open&limit=25', pool: active.pool });
  assert.equal(await handleCommunityWorkflowRoute(activeCtx), true);
  assert.equal(activeCtx.res.statusCode, 200);
  assert.deepEqual(activeCtx.res.payload.reports, [report]);
  assert.equal(activeCtx.res.payload.requestId, 'test-request');
  assert.equal(active.state.poolQueries, 0);
  assert.equal(active.state.commits, 1);
  assert.equal(active.state.rollbacks, 0);
  assert.equal(active.state.releases, 1);
  const capabilityIndex = active.state.statements.findIndex(({ statement }) => statement.includes('SELECT r.capabilities FROM users u'));
  const reportIndex = active.state.statements.findIndex(({ statement }) => statement.includes('FROM social_reports r JOIN users u'));
  assert.ok(capabilityIndex >= 0 && capabilityIndex < reportIndex, 'the current moderation capability must be locked before report details are selected');
  assert.deepEqual(active.state.statements[reportIndex].params, [siteId, 'open', 25]);

  const revoked = createPool({ hasCapability: false });
  const revokedCtx = createContext({ method: 'GET', path: '/api/v1/sites/' + siteId + '/community/reports', pool: revoked.pool });
  await assert.rejects(handleCommunityWorkflowRoute(revokedCtx), error => error.statusCode === 403 && error.code === 'ERR_VIRGOSCORPIO_HUB_FORBIDDEN');
  assert.equal(revoked.state.statements.some(({ statement }) => statement.includes('FROM social_reports r JOIN users u')), false, 'revoked moderators must not reach the report-detail query');
  assert.equal(revoked.state.commits, 0);
  assert.equal(revoked.state.rollbacks, 1);
  assert.equal(revoked.state.releases, 1);
});

test('report submission rejects unsupported target and category values', async () => {
  const ctx = createContext({ method: 'POST', path: `/api/v1/sites/${siteId}/community/reports`, body: { targetType: 'table', targetId: recipientId, category: 'spam' }, pool: {
    async query() { throw new Error('query should not be called for invalid report'); },
    async connect() { throw new Error('connect should not be called for invalid report'); }
  } });
  await assert.rejects(handleCommunityWorkflowRoute(ctx), error => error.code === 'ERR_VIRGOSCORPIO_HUB_REPORT_TARGET' && error.statusCode === 400);

  const ctx2 = createContext({ method: 'POST', path: `/api/v1/sites/${siteId}/community/reports`, body: { targetType: 'user', targetId: recipientId, category: 'wrong' }, pool: {
    async query() { throw new Error('query should not be called for invalid report'); },
    async connect() { throw new Error('connect should not be called for invalid report'); }
  } });
  await assert.rejects(handleCommunityWorkflowRoute(ctx2), error => error.code === 'ERR_VIRGOSCORPIO_HUB_REPORT_CATEGORY' && error.statusCode === 400);
});

test('notification read-all revalidates site membership transactionally and scopes updates by user and site', async () => {
  const state = { statements: [], commits: 0, rollbacks: 0, releases: 0, values: null };
  const client = {
    async query(sql, args) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      state.statements.push(statement);
      if (statement === 'BEGIN') return { rows: [] };
      if (statement === 'COMMIT') { state.commits += 1; return { rows: [] }; }
      if (statement === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
      if (statement.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) return { rows: [{ id: siteId }] };
      if (statement.includes('SELECT r.capabilities FROM users u')) return { rows: [{ capabilities: [] }] };
      if (statement.startsWith('UPDATE social_notifications SET read_at=now()')) {
        state.values = args;
        return { rows: [{ id: 'n1' }, { id: 'n2' }] };
      }
      throw new Error('Unexpected notification read-all transaction query: ' + statement);
    },
    release() { state.releases += 1; },
  };
  const pool = {
    async query() { throw new Error('pool query should not be used for transactional read-all'); },
    async connect() { return client; },
  };
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/notifications/read-all',
    pool,
  });
  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.payload.markedRead, 2);
  assert.deepEqual(state.values, [siteId, actorId]);
  assert.equal(state.commits, 1);
  assert.equal(state.rollbacks, 0);
  assert.equal(state.releases, 1);
  const authorizationIndex = state.statements.findIndex(sql => sql.includes('SELECT r.capabilities FROM users u'));
  const updateIndex = state.statements.findIndex(sql => sql.startsWith('UPDATE social_notifications SET read_at=now()'));
  assert.ok(authorizationIndex >= 0);
  assert.ok(updateIndex > authorizationIndex, 'active membership must be locked before the read-marker update');
});

function transactionalDirectConversationPool({
  blocked = false,
  inactiveParticipantId = null,
  missingMembershipId = null,
} = {}) {
  const state = { statements: [], commits: 0, rollbacks: 0, releases: 0 };
  const conversation = {
    id: 'd47bf4ed-2029-401c-8f31-4e0ec17199ef',
    site_id: siteId,
    conversation_type: 'direct',
    group_id: null
  };
  const client = {
    async query(sql) {
      state.statements.push(sql);
      if (sql === 'BEGIN') return { rows: [] };
      if (sql === 'COMMIT') { state.commits += 1; return { rows: [] }; }
      if (sql === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) {
        return { rows: [{ id: siteId }] };
      }
      if (sql.includes('SELECT id,status FROM users')) {
        return {
          rows: [actorId, recipientId].map(id => ({
            id,
            status: id === inactiveParticipantId ? 'disabled' : 'active'
          }))
        };
      }
      if (sql.includes('FROM site_memberships')) {
        return {
          rows: [actorId, recipientId]
            .filter(id => id !== missingMembershipId)
            .map(user_id => ({ user_id }))
        };
      }
      if (sql.includes('SELECT 1 FROM social_blocks')) return { rows: blocked ? [{ present: 1 }] : [] };
      if (sql.includes('SELECT c.id FROM social_conversations')) return { rows: [] };
      if (sql.includes('INSERT INTO social_conversations')) return { rows: [{ id: conversation.id }] };
      if (sql.includes('SELECT c.id,c.site_id')) return { rows: [conversation] };
      if (sql.includes('INSERT INTO social_conversation_members') || sql.includes('INSERT INTO social_notifications')) {
        return { rows: [] };
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
    release() { state.releases += 1; }
  };
  return {
    state,
    async query(sql) {
      assert.ok(sql.includes('SELECT u.id FROM users'));
      return { rows: [{ id: recipientId }] };
    },
    async connect() { return client; }
  };
}

test('direct conversation creation rejects an inactive participant at the transaction boundary', async () => {
  const pool = transactionalDirectConversationPool({ inactiveParticipantId: recipientId });
  const ctx = createContext({ method: 'POST', body: { recipientId }, pool });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND' && error.statusCode === 404
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(sql => /INSERT INTO social_conversations/.test(sql)), false);
});

test('direct conversation creation rejects a participant without current site membership', async () => {
  const pool = transactionalDirectConversationPool({ missingMembershipId: actorId });
  const ctx = createContext({ method: 'POST', body: { recipientId }, pool });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND' && error.statusCode === 404
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(sql => /INSERT INTO social_conversations/.test(sql)), false);
});

test('direct conversation creation commits before returning and releases its transaction client', async () => {
  const pool = transactionalDirectConversationPool();
  const ctx = createContext({ method: 'POST', body: { recipientId }, pool });

  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 201);
  assert.equal(ctx.res.payload.created, true);
  assert.equal(ctx.res.payload.conversation.id, 'd47bf4ed-2029-401c-8f31-4e0ec17199ef');
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.rollbacks, 0);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements[0], 'BEGIN');
  assert.equal(pool.state.statements.at(-1), 'COMMIT');
});

test('direct conversation policy denial rolls back and releases its transaction client', async () => {
  const pool = transactionalDirectConversationPool({ blocked: true });
  const ctx = createContext({ method: 'POST', body: { recipientId }, pool });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_BLOCKED' && error.statusCode === 403
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
});


function transactionalBlockPool({
  actorMember = true,
  targetMember = true,
  preflightTargetMember = true,
  actorStatus = 'active',
  targetStatus = 'active',
  blockExists = true,
} = {}) {
  const state = { poolQueries: [], statements: [], commits: 0, rollbacks: 0, releases: 0 };
  const block = {
    site_id: siteId,
    blocker_id: actorId,
    blocked_id: recipientId,
    reason: 'test block',
    created_at: new Date(0).toISOString(),
  };
  const client = {
    async query(sql, params) {
      const statement = sql.replace(/\\s+/g, ' ').trim();
      state.statements.push({ statement, params });
      if (statement === 'BEGIN') return { rows: [] };
      if (statement === 'COMMIT') { state.commits += 1; return { rows: [] }; }
      if (statement === 'ROLLBACK') { state.rollbacks += 1; return { rows: [] }; }
      if (statement.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE')) return { rows: [{ id: siteId }] };
      if (statement.startsWith('SELECT r.capabilities FROM users u')) {
        return { rows: actorMember && actorStatus === 'active' ? [{ capabilities: ['community:moderate'] }] : [] };
      }
      if (statement.startsWith('SELECT id,status FROM users')) {
        return {
          rows: [
            { id: actorId, status: actorStatus },
            { id: recipientId, status: targetStatus },
          ],
        };
      }
      if (statement.startsWith('SELECT user_id FROM site_memberships')) {
        return {
          rows: [
            ...(actorMember ? [{ user_id: actorId }] : []),
            ...(targetMember ? [{ user_id: recipientId }] : []),
          ],
        };
      }
      if (statement.startsWith('INSERT INTO social_blocks')) return { rows: [block] };
      if (statement.startsWith('DELETE FROM social_blocks')) return { rows: blockExists ? [{ blocked_id: recipientId }] : [] };
      throw new Error('Unexpected block transaction query: ' + statement);
    },
    release() { state.releases += 1; },
  };
  return {
    state,
    async query(sql, params) {
      state.poolQueries.push({ sql: sql.replace(/\\s+/g, ' ').trim(), params });
      if (sql.includes('FROM site_memberships sm JOIN users u ON u.id=sm.user_id')) {
        return { rows: preflightTargetMember ? [{ present: 1 }] : [] };
      }
      throw new Error('Unexpected block pool query: ' + sql);
    },
    async connect() { return client; },
  };
}

test('block creation revalidates both participants inside a deterministic transaction before upsert', async () => {
  const pool = transactionalBlockPool();
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/blocks',
    body: { userId: recipientId, reason: 'test block' },
    pool,
  });

  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 201);
  assert.equal(ctx.res.payload.block.blocker_id, actorId);
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.rollbacks, 0);
  assert.equal(pool.state.releases, 1);
  const siteLock = pool.state.statements.findIndex(x => x.statement.includes('SELECT id FROM sites WHERE id=$1 FOR KEY SHARE'));
  const usersLock = pool.state.statements.findIndex(x => x.statement.startsWith('SELECT id,status FROM users'));
  const membershipsLock = pool.state.statements.findIndex(x => x.statement.startsWith('SELECT user_id FROM site_memberships'));
  const blockInsert = pool.state.statements.findIndex(x => x.statement.startsWith('INSERT INTO social_blocks'));
  assert.ok(siteLock >= 0 && siteLock < usersLock && usersLock < membershipsLock && membershipsLock < blockInsert);
  assert.equal(pool.state.statements[usersLock].statement.includes('ORDER BY id FOR SHARE'), true);
  assert.equal(pool.state.statements[membershipsLock].statement.includes('ORDER BY user_id,role_id FOR SHARE'), true);
});

test('block creation rolls back if actor membership was revoked after request preflight', async () => {
  const pool = transactionalBlockPool({ actorMember: false });
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/blocks',
    body: { userId: recipientId, reason: 'must not persist' },
    pool,
  });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN' && error.statusCode === 403,
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(x => x.statement.startsWith('INSERT INTO social_blocks')), false);
});

test('block creation preserves generic target-not-found when target membership disappears before transaction', async () => {
  const pool = transactionalBlockPool({ targetMember: false, preflightTargetMember: true });
  const ctx = createContext({
    method: 'POST',
    path: '/api/v1/sites/' + siteId + '/community/blocks',
    body: { userId: recipientId, reason: 'must not persist' },
    pool,
  });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_COMMUNITY_USER_NOT_FOUND' && error.statusCode === 404,
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(x => x.statement.startsWith('INSERT INTO social_blocks')), false);
});

test('unblock revalidates actor membership inside its transaction before delete', async () => {
  const pool = transactionalBlockPool({ actorMember: false, blockExists: true });
  const ctx = createContext({
    method: 'DELETE',
    path: '/api/v1/sites/' + siteId + '/community/blocks/' + recipientId,
    pool,
  });

  await assert.rejects(
    handleCommunityWorkflowRoute(ctx),
    error => error.code === 'ERR_VIRGOSCORPIO_HUB_TENANT_FORBIDDEN' && error.statusCode === 403,
  );
  assert.equal(pool.state.commits, 0);
  assert.equal(pool.state.rollbacks, 1);
  assert.equal(pool.state.releases, 1);
  assert.equal(pool.state.statements.some(x => x.statement.startsWith('DELETE FROM social_blocks')), false);
});

test('unblock commits its site-scoped delete only after actor authorization succeeds', async () => {
  const pool = transactionalBlockPool({ actorMember: true, blockExists: true });
  const ctx = createContext({
    method: 'DELETE',
    path: '/api/v1/sites/' + siteId + '/community/blocks/' + recipientId,
    pool,
  });

  assert.equal(await handleCommunityWorkflowRoute(ctx), true);
  assert.equal(ctx.res.statusCode, 200);
  assert.equal(ctx.res.payload.unblocked, true);
  assert.equal(ctx.res.payload.userId, recipientId);
  assert.equal(pool.state.commits, 1);
  assert.equal(pool.state.rollbacks, 0);
  assert.equal(pool.state.releases, 1);
  const membershipCheck = pool.state.statements.findIndex(x => x.statement.includes('SELECT r.capabilities FROM users u'));
  const blockDelete = pool.state.statements.findIndex(x => x.statement.startsWith('DELETE FROM social_blocks'));
  assert.ok(membershipCheck >= 0 && membershipCheck < blockDelete);
});
