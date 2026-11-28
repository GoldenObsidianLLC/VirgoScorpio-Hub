'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadEnvFile } = require('./load-env');
const { parseNodeTestSummary } = require('./parse-node-test-summary');

const root = path.resolve(__dirname, '..');
const evidenceDir = path.join(root, 'artifacts', 'evidence');
const evidence = {
  schemaVersion: 1,
  product: 'VirgoScorpio Hub',
  gate: 'local-live-integration-subset',
  generatedAt: new Date().toISOString(),
  status: 'BLOCKED',
  node: process.version,
  databaseName: null,
  graphEndpoint: null,
  tests: null,
  passed: null,
  failed: null,
  cancelled: null,
  skipped: null,
  todo: null,
  error: null
};
function persistEvidence() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  evidence.generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(evidenceDir, 'integration-live.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
function run(label, args, env, evidenceFile, { allowTestFailures = false } = {}) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env,
    encoding: 'utf8',
    // Keep a finite per-process bound. The serialized integration collection
    // is executed one file at a time below, so a long earlier file cannot
    // consume the timeout budget for later security regressions.
    timeout: 900_000,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (evidenceFile) {
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, evidenceFile), output);
  }
  if (result.error) throw new Error(`${label} failed to start: ${result.error.message}`);
  if (result.status !== 0 && !allowTestFailures) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
  return { output, status: result.status };
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function retryUntil(label, operation, timeoutMs = 60_000) {
  const end = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < end) {
    try { return await operation(); }
    catch (error) { lastError = error; await delay(1500); }
  }
  throw new Error(`${label} did not become ready within ${Math.round(timeoutMs / 1000)} seconds (${lastError?.code || lastError?.name || 'unknown error'}).`);
}

async function ensureLocalTestDatabase(pg, appDbUrl, testDbUrl) {
  if (!appDbUrl) return;
  let app; let target;
  try { app = new URL(appDbUrl); target = new URL(testDbUrl); } catch { return; }
  const localHosts = new Set(['127.0.0.1', 'localhost', 'postgres']);
  const appDb = decodeURIComponent(app.pathname.replace(/^\//, ''));
  const testDb = decodeURIComponent(target.pathname.replace(/^\//, ''));
  const localSameServer = localHosts.has(target.hostname)
    && target.hostname === app.hostname
    && (target.port || '5432') === (app.port || '5432')
    && decodeURIComponent(target.username) === decodeURIComponent(app.username)
    && testDb !== appDb
    && /^[A-Za-z0-9_-]+$/.test(testDb)
    && /^[A-Za-z0-9_]+$/.test(decodeURIComponent(target.username));
  if (!localSameServer) return; // Never create databases on an arbitrary remote server.

  const adminPool = new pg.Pool({ connectionString: appDbUrl, connectionTimeoutMillis: 4000, max: 1 });
  try {
    const present = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
    if (present.rowCount) return;
    const owner = decodeURIComponent(target.username);
    console.log(`Dedicated local test database "${testDb}" is missing; creating it on the local development PostgreSQL instance.`);
    await adminPool.query(`CREATE DATABASE "${testDb}" OWNER "${owner}"`);
  } finally { await adminPool.end(); }
}

async function main() {
  loadEnvFile(path.join(root, '.env'));
  const testDbUrl = process.env.TEST_DATABASE_URL;
  const graphUrl = process.env.MEMGRAPH_TEST_URL || process.env.MEMGRAPH_URL;
  if (!testDbUrl) throw new Error('TEST_DATABASE_URL is required. Refusing to run database tests against DATABASE_URL implicitly.');
  if (!graphUrl) throw new Error('MEMGRAPH_TEST_URL or MEMGRAPH_URL is required.');
  let dbName;
  try { dbName = new URL(testDbUrl).pathname.replace(/^\//, ''); } catch { throw new Error('TEST_DATABASE_URL is invalid.'); }
  if (!/(^|[_-])test$/i.test(dbName)) throw new Error(`Safety stop: TEST_DATABASE_URL database name must end in "test" (got "${dbName}").`);
  evidence.databaseName = dbName;
  try { const parsedGraph = new URL(graphUrl); evidence.graphEndpoint = `${parsedGraph.hostname}:${parsedGraph.port || '7687'}`; } catch { evidence.graphEndpoint = 'invalid'; }

  const pg = require('pg');
  await ensureLocalTestDatabase(pg, process.env.DATABASE_URL, testDbUrl);
  const pool = new pg.Pool({ connectionString: testDbUrl, connectionTimeoutMillis: 4000, max: 2 });
  try {
    await retryUntil('PostgreSQL test database', () => pool.query('SELECT 1 AS ready'));
    console.log(`PostgreSQL reachable; integration database is "${dbName}" (credentials omitted).`);
  } catch (error) {
    throw new Error(`PostgreSQL test database is not reachable (${error.code || error.name}). Start Compose and confirm TEST_DATABASE_URL.`);
  } finally { await pool.end(); }

  const { createMemgraphDriver } = require('../packages/graph/src/memgraph-store');
  const driver = createMemgraphDriver({ url: graphUrl, username: process.env.MEMGRAPH_USERNAME || '', password: process.env.MEMGRAPH_PASSWORD || '' });
  try {
    await retryUntil('Memgraph Bolt endpoint', () => driver.verifyConnectivity());
    console.log('Memgraph Bolt endpoint is reachable.');
  } catch (error) {
    throw new Error(`Memgraph is not reachable (${error.code || error.name}). Start Compose and confirm MEMGRAPH_TEST_URL.`);
  } finally { await driver.close(); }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: testDbUrl,
    MEMGRAPH_URL: graphUrl,
    VIRGOSCORPIO_HUB_RUN_POSTGRES_INTEGRATION: 'true',
    VIRGOSCORPIO_HUB_RUN_MEMGRAPH_INTEGRATION: 'true'
  };
  run('Apply versioned migrations to the isolated test database', ['scripts/migrate.js'], env, 'integration-migrations.log');

  const redisUrl = process.env.VIRGOSCORPIO_HUB_PRESENCE_REDIS_URL;
  if (redisUrl) {
    let parsedRedis;
    try { parsedRedis = new URL(redisUrl); }
    catch { throw new Error('VIRGOSCORPIO_HUB_PRESENCE_REDIS_URL is invalid.'); }
    const allowedRedisHosts = new Set(['127.0.0.1', 'localhost', '::1', 'redis']);
    if (!['redis:', 'rediss:'].includes(parsedRedis.protocol) || !allowedRedisHosts.has(parsedRedis.hostname.toLowerCase())) {
      throw new Error('Safety stop: Redis integration is restricted to a local Redis/Memurai test service.');
    }
    // Reuse the one explicitly approved loopback Redis endpoint for both
    // presence and document Pub/Sub integration suites. Those suites require
    // VIRGOSCORPIO_HUB_TEST_REDIS_URL and must never guess a Redis target.
    env.VIRGOSCORPIO_HUB_RUN_REDIS_INTEGRATION = 'true';
    env.VIRGOSCORPIO_HUB_TEST_REDIS_URL = redisUrl;
  } else {
    delete env.VIRGOSCORPIO_HUB_RUN_REDIS_INTEGRATION;
  }

  const integrationDir = path.join(root, 'test', 'integration');
  const runDisposableRedisOutageTest = process.env.CI === 'true' &&
    process.env.VIRGOSCORPIO_HUB_RUN_REDIS_OUTAGE_INTEGRATION === 'true';
  const files = fs.readdirSync(integrationDir)
    .filter(file => file.endsWith('.test.js'))
    .filter(file => file !== 'redis-outage-recovery.integration.test.js' || runDisposableRedisOutageTest)
    .sort()
    .map(file => path.join('test', 'integration', file));
  if (!files.length) throw new Error('No integration test files were found.');
  // The test files share one dedicated PostgreSQL database, Redis service and
  // graph endpoint, but Node's multi-file test runner previously imposed one
  // 900-second timeout across the entire collection. A timeout in an earlier
  // file prevented later security regressions (including cloud-connection
  // capability revocation) from executing. Run each file serially in its own
  // bounded child process: this preserves fixture ordering while isolating the
  // timeout budget and retaining per-file logs for actionable diagnostics.
  const combinedLogPath = path.join(evidenceDir, 'integration-tests.tap.log');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(combinedLogPath, '');
  const totals = { tests: 0, passed: 0, failed: 0, cancelled: 0, skipped: 0, todo: 0 };
  for (const file of files) {
    const label = `Run live integration file ${path.basename(file)}`;
    const evidenceFile = `integration-${path.basename(file, '.test.js')}.tap.log`;
    const result = run(label, ['--test', '--test-concurrency=1', file], env, evidenceFile, { allowTestFailures: true });
    fs.appendFileSync(combinedLogPath, `\n\n===== ${file} =====\n${result.output}`);
    const summary = parseNodeTestSummary(result.output);
    if (!summary) {
      throw new Error(`${label} produced no complete Node.js test summary; inspect artifacts/evidence/${evidenceFile}.`);
    }
    for (const key of Object.keys(totals)) totals[key] += summary[key];
    Object.assign(evidence, totals);
    persistEvidence();
    if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
    if (summary.failed > 0) throw new Error(`${label} reported ${summary.failed} failed test(s).`);
    if (summary.cancelled > 0) throw new Error(`${label} reported ${summary.cancelled} cancelled test(s).`);
    if (summary.skipped > 0) throw new Error(`${label} reported ${summary.skipped} skipped test(s); live integration requires zero skips.`);
    if (summary.todo > 0) throw new Error(`${label} reported ${summary.todo} TODO test(s); live integration requires zero TODO tests.`);
  }

  Object.assign(evidence, totals);
  if (totals.tests < 1) throw new Error('Integration test runner reported zero tests.');
  evidence.status = 'PASS';
  persistEvidence();

  console.log('\nLIVE INTEGRATION RESULT: PASS');
  console.log(`Executed ${totals.tests} tests across ${files.length} serialized files with zero skips against the dedicated test database.`);
  console.log('This is local integration evidence only; it does not certify production, third-party identity, Stripe, storage, or security review gates.');
}

main().then(() => {
  persistEvidence();
}).catch(error => {
  evidence.status = 'BLOCKED';
  evidence.error = error.message;
  persistEvidence();
  console.error(`\nLIVE INTEGRATION BLOCKED: ${error.message}`);
  process.exitCode = 1;
});
