'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { createPostgresPool } = require('../../packages/db/src/postgres-store');
const { createIdentityService } = require('../../packages/auth/src/service');
const { processPasswordResetRequestBatch, processBatch } = require('../../apps/worker/src/mail-worker');

const enabled = Boolean(process.env.DATABASE_URL && process.env.VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION === 'true');
const quietLogger = { emit() {} };
function createPools() { return [0, 1].map(() => createPostgresPool({ ...process.env, DATABASE_POOL_MAX: '6' })); }
async function addUser(pool, email) {
  const result = await pool.query('INSERT INTO users(email,display_name) VALUES($1,$2) RETURNING id', [email, 'Password Reset Integration']);
  return result.rows[0].id;
}
function suffix() { return randomUUID().replaceAll('-', '').slice(0, 16); }

test('PostgreSQL reset requests are durable across replicas and complete token/outbox work atomically', { skip: !enabled }, async t => {
  const [poolA, poolB] = createPools();
  const tag = suffix();
  const emails = ['reset-a-' + tag + '@example.test', 'reset-b-' + tag + '@example.test', 'reset-unknown-' + tag + '@example.test'];
  const userIds = [];
  t.after(async () => {
    await poolA.query('DELETE FROM mail_outbox WHERE recipient=ANY($1::text[])', [emails]).catch(() => {});
    await poolA.query('DELETE FROM password_reset_requests WHERE target_email=ANY($1::text[])', [emails]).catch(() => {});
    if (userIds.length) await poolA.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [userIds]).catch(() => {});
    await Promise.all([poolA.end(), poolB.end()]);
  });

  userIds.push(await addUser(poolA, emails[0]), await addUser(poolA, emails[1]));
  const identityA = createIdentityService({ pool: poolA, env: { ...process.env, NODE_ENV: 'test' } });
  const identityB = createIdentityService({ pool: poolB, env: { ...process.env, NODE_ENV: 'test' } });

  const replicas = await Promise.all([
    identityA.enqueuePasswordResetRequest({ email: emails[0].toUpperCase() }),
    identityB.enqueuePasswordResetRequest({ email: emails[0] })
  ]);
  assert.deepEqual(replicas, [{ accepted: true }, { accepted: true }]);
  await identityA.enqueuePasswordResetRequest({ email: emails[1] });

  const pending = await poolA.query(
    "SELECT count(*)::integer AS n FROM password_reset_requests WHERE status='pending' AND target_email=ANY($1::text[])",
    [emails.slice(0, 2)]
  );
  assert.equal(pending.rows[0].n, 2, 'replicas must coalesce the same normalized target');

  await identityA.enqueuePasswordResetRequest({ email: emails[2] });
  await poolA.query("UPDATE password_reset_requests SET status='failed',processed_at=now() WHERE target_email=$1", [emails[2]]);
  const before = await poolA.query('SELECT count(*)::integer AS n FROM password_reset_requests WHERE target_email=$1', [emails[2]]);
  await identityB.enqueuePasswordResetRequest({ email: emails[2] });
  const after = await poolA.query('SELECT count(*)::integer AS n FROM password_reset_requests WHERE target_email=$1', [emails[2]]);
  assert.equal(after.rows[0].n, before.rows[0].n, 'terminal failures retain target cooldown for 120 seconds');

  const limited = createIdentityService({
    pool: poolA,
    env: { ...process.env, NODE_ENV: 'test', VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_MAX_PENDING: '2' }
  });
  await assert.rejects(
    limited.enqueuePasswordResetRequest({ email: 'reset-capacity-' + tag + '@example.test' }),
    error => error.statusCode === 503 && error.code === 'ERR_VIRGOSCORPIO_HUB_PASSWORD_RESET_QUEUE_FULL'
  );

  const [workerA, workerB] = await Promise.all([
    processPasswordResetRequestBatch(poolA, { identity: identityA, limit: 1, structuredLogger: quietLogger }),
    processPasswordResetRequestBatch(poolB, { identity: identityB, limit: 1, structuredLogger: quietLogger })
  ]);
  assert.equal(workerA.processed + workerB.processed, 2, 'concurrent SKIP LOCKED workers must process both requests once');

  const completed = await poolA.query(
    "SELECT id FROM password_reset_requests WHERE target_email=ANY($1::text[]) AND status='completed'",
    [emails.slice(0, 2)]
  );
  assert.equal(completed.rows.length, 2);

  const outbox = await poolA.query(
    "SELECT recipient,payload FROM mail_outbox WHERE recipient=ANY($1::text[]) AND template='password-reset' ORDER BY recipient",
    [emails.slice(0, 2)]
  );
  assert.equal(outbox.rows.length, 2);
  const tokenDigests = outbox.rows.map(row => {
    assert.equal(typeof row.payload.resetUrl, 'string');
    const token = new URL(row.payload.resetUrl).searchParams.get('token');
    assert.ok(token && token.length >= 32);
    return createHash('sha256').update(token).digest('hex');
  });
  const stored = await poolA.query(
    "SELECT token_hash FROM identity_action_tokens WHERE user_id=ANY($1::uuid[]) AND purpose='password-reset' ORDER BY token_hash",
    [userIds]
  );
  assert.equal(stored.rows.length, 2);
  assert.deepEqual(stored.rows.map(row => row.token_hash).sort(), tokenDigests.sort());

  const mailBatch = await processBatch(poolA, {
    limit: 10,
    structuredLogger: quietLogger,
    env: { ...process.env, NODE_ENV: 'test', VIRGOSCORPIO_HUB_MAIL_PROVIDER: 'disabled' }
  });
  assert.equal(mailBatch.processed, 2);
  const scrubbedMail = await poolA.query(
    "SELECT status,payload FROM mail_outbox WHERE recipient=ANY($1::text[]) AND template='password-reset'",
    [emails.slice(0, 2)]
  );
  assert.ok(scrubbedMail.rows.every(row => row.status === 'failed' && Object.keys(row.payload).length === 0));

  await poolA.query(
    "UPDATE password_reset_requests SET created_at=now()-interval '121 seconds' WHERE target_email=ANY($1::text[]) AND status='completed'",
    [emails.slice(0, 2)]
  );
  await processPasswordResetRequestBatch(poolA, { identity: identityA, structuredLogger: quietLogger });
  const scrubbedQueue = await poolA.query(
    "SELECT target_email FROM password_reset_requests WHERE status='completed' AND id=ANY($1::uuid[])",
    [completed.rows.map(row => row.id)]
  );
  assert.ok(scrubbedQueue.rows.every(row => row.target_email === null));
});

test('PostgreSQL reset queue recovers abandoned claims and terminalizes exhausted requests', { skip: !enabled }, async t => {
  const pool = createPostgresPool({ ...process.env, DATABASE_POOL_MAX: '6' });
  const tag = suffix();
  const requestIds = [];
  const emails = ['stale-retry-' + tag + '@example.test', 'stale-terminal-' + tag + '@example.test'];
  t.after(async () => {
    if (requestIds.length) await pool.query('DELETE FROM password_reset_requests WHERE id=ANY($1::uuid[])', [requestIds]).catch(() => {});
    await pool.end();
  });

  const inserted = await pool.query(
    "INSERT INTO password_reset_requests(target_email,status,attempts,locked_at,created_at) VALUES($1,'processing',2,now()-interval '10 minutes',now()-interval '10 minutes'),($2,'processing',8,now()-interval '10 minutes',now()-interval '10 minutes') RETURNING id",
    emails
  );
  requestIds.push(...inserted.rows.map(row => row.id));
  const identity = { async processPasswordResetRequest() { throw new Error('recovered rows must be delayed or terminalized first'); } };
  const result = await processPasswordResetRequestBatch(pool, { identity, structuredLogger: quietLogger });
  assert.equal(result.recovered, 2);
  assert.equal(result.processed, 0);

  const state = await pool.query(
    'SELECT target_email,status,attempts,processed_at,locked_at,available_at FROM password_reset_requests WHERE id=ANY($1::uuid[]) ORDER BY attempts',
    [inserted.rows.map(row => row.id)]
  );
  assert.equal(state.rows[0].status, 'pending');
  assert.equal(state.rows[0].attempts, 2);
  assert.ok(state.rows[0].available_at > new Date());
  assert.equal(state.rows[1].status, 'failed');
  assert.equal(state.rows[1].attempts, 8);
  assert.ok(state.rows[1].processed_at);
  assert.equal(state.rows[1].locked_at, null);
  assert.equal(state.rows[1].target_email, null);
});
