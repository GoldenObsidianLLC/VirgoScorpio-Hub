'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PRODUCT_VERSION } = require('../packages/domain/src/version');
const { REQUIRED_EVIDENCE_GATES, REQUIRED_EVIDENCE_GATE_IDS } = require('../scripts/release-readiness-gates');
const CURRENT_MIGRATION_COUNT = fs.readdirSync(path.join(__dirname, '../database/migrations'))
  .filter(file => /^[0-9]+_[a-z0-9_-]+[.]sql$/i.test(file)).length;
const {
  EXPECTED_NPM_VERSION,
  JOBS,
  finalizeReleaseReadiness,
  stageEvidence,
  validateJobEvidence,
  writePostgresMemgraphReleaseEvidence,
} = require('../scripts/ci-evidence');

const expected = {
  repository: 'GoldenObsidianLLC/VirgoScorpio-Hub',
  workflow: 'VirgoScorpio Hub CI',
  eventName: 'pull_request',
  runId: '123456789',
  runAttempt: 2,
  headSha: '1'.repeat(40),
  mergeSha: '2'.repeat(40),
};

function write(root, relativePath, value) {
  const absolute = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}

function createMinimalFixtures(t, { gateIds = REQUIRED_EVIDENCE_GATE_IDS } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'virgoscorpio_hub-gate-security-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const artifactRoot = path.join(root, 'artifacts', 'ci-evidence');
  fs.mkdirSync(artifactRoot, { recursive: true });

  const readinessChecks = [
    'clean-source-tree',
    'syntax-artifact-check',
    'unit-tests',
    'enginex-tests',
    'integration-tests',
  ].map(id => ({ id, status: 'PASS' }));

  const readiness = {
    schemaVersion: 1,
    product: 'VirgoScorpio Hub',
    version: PRODUCT_VERSION,
    sourceRevision: expected.mergeSha,
    sourceTree: { clean: true, changedPaths: [], approvedGeneratedPaths: [], blockingPaths: [] },
    host: { node: 'v22.23.4' },
    readyForProduction: false,
    releaseClassification: 'NOT_PRODUCTION_CERTIFIED',
    checks: readinessChecks,
    evidenceGates: gateIds.map(id => ({
      id,
      title: id,
      status: id === 'postgres-memgraph-live' ? 'BLOCKED' : 'MISSING_EVIDENCE',
      evidencePath: 'artifacts/evidence/' + id + '.json',
      details: 'Evidence remains open.',
    })),
    summary: {
      pass: 5,
      partial: 0,
      blocked: 1,
      missingEvidence: gateIds.length - 1,
      notRun: 0,
    },
    supplementalEvidence: [
      { id: 'fresh-migrations', title: 'Fresh PostgreSQL migrations', status: 'MISSING_EVIDENCE', details: 'Producer not completed.' },
    ],
  };

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: {
      component: {
        'bom-ref': `virgoscorpio-hub@${PRODUCT_VERSION}`,
        purl: `pkg:npm/virgoscorpio-hub@${PRODUCT_VERSION}`,
      },
      tools: [{ vendor: 'npm', name: 'cli', version: EXPECTED_NPM_VERSION }],
    },
    components: [{ name: 'fixture', version: '1.0.0' }],
    dependencies: [],
  };

  for (const file of JOBS[0].requiredFiles) {
    if (file.endsWith('release-readiness.json')) write(root, file, readiness);
    else if (file.endsWith('.cdx.json')) write(root, file, sbom);
    else if (file.endsWith('.md')) write(root, file, '# Candidate readiness\n');
    else if (file.endsWith('package-lock.json')) write(root, file, { name: 'virgoscorpio-hub', version: PRODUCT_VERSION, lockfileVersion: 3 });
    else if (file.endsWith('artifact-check.log')) write(root, file, 'VirgoScorpio Hub artifact check passed (157 required paths).\n');
    else if (file.endsWith('unit-tests.tap.log') || file.endsWith('enginex-tests.tap.log') || file.endsWith('integration-tests.tap.log')) {
      write(root, file, ['TAP version 13', '# tests 8', '# pass 8', '# fail 0', '# cancelled 0', '# skipped 0', '# todo 0'].join('\n'));
    } else write(root, file, 'found 0 vulnerabilities\n');
  }

  const live = {
    status: 'PASS',
    node: 'v22.23.4',
    tests: 22,
    passed: 22,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  };
  const migrations = {
    schemaVersion: 1,
    product: 'VirgoScorpio Hub',
    version: PRODUCT_VERSION,
    sourceRevision: expected.mergeSha,
    gate: 'fresh-migrations',
    status: 'PASS',
    environment: { node: 'v22.23.4' },
    migrationCount: CURRENT_MIGRATION_COUNT,
    firstPass: CURRENT_MIGRATION_COUNT + '/' + CURRENT_MIGRATION_COUNT + ' migrations applied',
    secondPass: CURRENT_MIGRATION_COUNT + '/' + CURRENT_MIGRATION_COUNT + ' migrations skipped as already applied',
    cleanup: 'disposable database dropped',
  };
  for (const file of JOBS[2].requiredFiles) {
    if (file.endsWith('integration-live.json')) write(root, file, live);
    else if (file.endsWith('fresh-migrations.json')) write(root, file, migrations);
    else if (file.endsWith('integration-tests.tap.log')) {
      write(root, file, ['TAP version 13', '# tests 22', '# pass 22', '# fail 0', '# cancelled 0', '# skipped 0', '# todo 0'].join('\n'));
    } else if (file.endsWith('memgraph-outage-live.log')) write(root, file, 'REAL MEMGRAPH OUTAGE RESULT: PASS\n');
    else if (file.endsWith('graph-rebuild-live.log')) write(root, file, 'GRAPH REBUILD LIVE RESULT: PASS\n');
    else write(root, file, 'PASS\n');
  }
  write(root, JOBS[3].requiredFiles[0], 'Running 5 tests\n5 passed (2.1s)\n');

  const jobApi = [];
  const producerOrder = [JOBS[2], JOBS[0], JOBS[1], JOBS[3], JOBS[4]];
  for (const config of producerOrder) {
    const stageDirectory = 'artifacts/ci-stage';
    if (config.key.startsWith('node-')) {
      readiness.host.node = config.runtime;
      write(root, 'artifacts/release-readiness.json', readiness);
    }
    const manifest = stageEvidence({
      root,
      stageDirectory,
      files: config.key === 'browser-and-accessibility'
        ? [...config.requiredFiles] : config.requiredFiles,
      metadata: {
        ...expected,
        jobKey: config.key,
        jobName: config.jobName,
        runtime: config.runtime,
      },
    });
    fs.renameSync(path.join(root, stageDirectory), path.join(artifactRoot, config.artifactName));
    jobApi.push({
      id: 1000 + jobApi.length,
      run_id: Number(expected.runId),
      run_attempt: expected.runAttempt,
      head_sha: expected.headSha,
      workflow_name: expected.workflow,
      name: config.jobName,
      status: 'completed',
      conclusion: 'success',
      completed_at: '2026-11-06T18:00:00.000Z',
    });
  }

  return { root, artifactRoot, jobApi };
}

test('requireReadinessSnapshot rejects reports missing required security gates', t => {
  // Test the exploit scenario: omit critical security gates
  const omittedGates = [
    'postgres-memgraph-live',
    'tenant-isolation-review',
    'observability-production',
  ];

  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: omittedGates });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  // The finalizer should reject the report because it's missing required gates
  assert.throws(() => finalizeReleaseReadiness({
    root,
    artifactRoot,
    expected,
    githubJobs: jobApi,
    postgresEvidence,
    attestationStatus: 'skipped',
    requireAttestation: false,
    finalizedAt: '2026-11-13T01:00:00.000Z',
  }), /omits required evidence gates/i);
});

test('requireReadinessSnapshot rejects reports missing independent-security-review gate', t => {
  // Specifically test omission of the independent security review gate
  const gatesWithoutSecurityReview = REQUIRED_EVIDENCE_GATE_IDS.filter(
    id => id !== 'independent-security-review'
  );

  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: gatesWithoutSecurityReview });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  let error;
  try {
    finalizeReleaseReadiness({
      root,
      artifactRoot,
      expected,
      githubJobs: jobApi,
      postgresEvidence,
      attestationStatus: 'skipped',
      requireAttestation: false,
      finalizedAt: '2026-11-13T01:00:00.000Z',
    });
    assert.fail('Expected finalizeReleaseReadiness to throw');
  } catch (err) {
    error = err;
  }

  assert.match(error.message, /omits required evidence gates/i);
  assert.match(error.message, /independent-security-review/);
});

test('requireReadinessSnapshot rejects reports missing operations-release-approval gate', t => {
  // Test omission of operations approval gate
  const gatesWithoutOpsApproval = REQUIRED_EVIDENCE_GATE_IDS.filter(
    id => id !== 'operations-release-approval'
  );

  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: gatesWithoutOpsApproval });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  let error;
  try {
    finalizeReleaseReadiness({
      root,
      artifactRoot,
      expected,
      githubJobs: jobApi,
      postgresEvidence,
      attestationStatus: 'skipped',
      requireAttestation: false,
      finalizedAt: '2026-11-13T01:00:00.000Z',
    });
    assert.fail('Expected finalizeReleaseReadiness to throw');
  } catch (err) {
    error = err;
  }

  assert.match(error.message, /omits required evidence gates/i);
  assert.match(error.message, /operations-release-approval/);
});

test('requireReadinessSnapshot rejects reports missing multiple critical gates', t => {
  // Test the pentest scenario: omit multiple security-critical gates
  const minimalGates = [
    'postgres-memgraph-live',
    'tenant-isolation-review',
    'observability-production',
  ];

  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: minimalGates });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  let error;
  try {
    finalizeReleaseReadiness({
      root,
      artifactRoot,
      expected,
      githubJobs: jobApi,
      postgresEvidence,
      attestationStatus: 'skipped',
      requireAttestation: false,
      finalizedAt: '2026-11-13T01:00:00.000Z',
    });
    assert.fail('Expected finalizeReleaseReadiness to throw');
  } catch (err) {
    error = err;
  }

  assert.match(error.message, /omits required evidence gates/i);
  // Should list multiple missing gates
  assert.match(error.message, /identity-provider-e2e/);
  assert.match(error.message, /dependency-sbom-codeql/);
  assert.match(error.message, /independent-security-review/);
});

test('requireReadinessSnapshot accepts reports with all required gates present', t => {
  // Positive test: all required gates present should succeed
  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: REQUIRED_EVIDENCE_GATE_IDS });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  // Should not throw when all required gates are present
  const finalized = finalizeReleaseReadiness({
    root,
    artifactRoot,
    expected,
    githubJobs: jobApi,
    postgresEvidence,
    attestationStatus: 'skipped',
    requireAttestation: false,
    finalizedAt: '2026-11-13T01:00:00.000Z',
  });

  assert.ok(finalized);
  assert.ok(finalized.report);
  assert.equal(finalized.report.sourceRevision, expected.mergeSha);

  // Verify all required gates are present in the finalized report
  const finalizedGateIds = finalized.report.evidenceGates.map(gate => gate.id);
  for (const requiredId of REQUIRED_EVIDENCE_GATE_IDS) {
    assert.ok(finalizedGateIds.includes(requiredId), `Missing required gate: ${requiredId}`);
  }
});

test('gate inventory validation enforces exact required set without allowing extras to bypass', t => {
  // Test that having extra gates doesn't bypass the validation
  const gatesWithExtra = [
    ...REQUIRED_EVIDENCE_GATE_IDS.slice(0, 10), // Only first 10 required gates
    'fake-extra-gate-1',
    'fake-extra-gate-2',
  ];

  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: gatesWithExtra });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  // Should still reject because some required gates are missing
  let error;
  try {
    finalizeReleaseReadiness({
      root,
      artifactRoot,
      expected,
      githubJobs: jobApi,
      postgresEvidence,
      attestationStatus: 'skipped',
      requireAttestation: false,
      finalizedAt: '2026-11-13T01:00:00.000Z',
    });
    assert.fail('Expected finalizeReleaseReadiness to throw');
  } catch (err) {
    error = err;
  }

  assert.match(error.message, /omits required evidence gates/i);
});

test('gate inventory validation is enforced for both Node 22 and Node 24 reports', t => {
  // Test that both runtime reports must have all required gates
  const gatesWithoutDependencyGate = REQUIRED_EVIDENCE_GATE_IDS.filter(
    id => id !== 'dependency-sbom-codeql'
  );

  const { root, artifactRoot, jobApi } = createMinimalFixtures(t, { gateIds: gatesWithoutDependencyGate });

  const config = JOBS.find(job => job.key === 'postgres-memgraph-integration');
  const directory = path.join(artifactRoot, config.artifactName);
  const apiJob = jobApi.find(job => job.name === config.jobName);
  const validation = validateJobEvidence(config, directory, expected, apiJob);
  assert.equal(validation.status, 'PASS', JSON.stringify(validation.errors));

  writePostgresMemgraphReleaseEvidence({ root, directory, expected, apiJob, validation });
  const postgresEvidence = JSON.parse(fs.readFileSync(
    path.join(root, 'artifacts/evidence/postgres-memgraph-live.json'), 'utf8'
  ));

  // Both Node 22 and Node 24 reports are missing the gate, so validation should fail
  let error;
  try {
    finalizeReleaseReadiness({
      root,
      artifactRoot,
      expected,
      githubJobs: jobApi,
      postgresEvidence,
      attestationStatus: 'skipped',
      requireAttestation: false,
      finalizedAt: '2026-11-13T01:00:00.000Z',
    });
    assert.fail('Expected finalizeReleaseReadiness to throw');
  } catch (err) {
    error = err;
  }

  assert.match(error.message, /omits required evidence gates/i);
  assert.match(error.message, /dependency-sbom-codeql/);
});

test('REQUIRED_EVIDENCE_GATE_IDS contains all critical security gates', () => {
  // Verify the gate inventory includes all security-critical gates mentioned in the pentest
  const criticalGates = [
    'postgres-memgraph-live',
    'tenant-isolation-review',
    'identity-provider-e2e',
    'cloud-live-providers',
    'dependency-sbom-codeql',
    'load-backup-restore',
    'independent-security-review',
    'operations-release-approval',
  ];

  for (const gate of criticalGates) {
    assert.ok(
      REQUIRED_EVIDENCE_GATE_IDS.includes(gate),
      `Critical gate ${gate} must be in REQUIRED_EVIDENCE_GATE_IDS`
    );
  }

  // Verify the list is frozen (immutable)
  assert.ok(Object.isFrozen(REQUIRED_EVIDENCE_GATE_IDS));
});

test('the release readiness generator and CI share one immutable evidence-gate registry', () => {
  assert.equal(REQUIRED_EVIDENCE_GATES.length, 15);
  assert.ok(Object.isFrozen(REQUIRED_EVIDENCE_GATES));
  assert.ok(REQUIRED_EVIDENCE_GATES.every(gate => Object.isFrozen(gate)));
  assert.deepEqual(REQUIRED_EVIDENCE_GATE_IDS, REQUIRED_EVIDENCE_GATES.map(gate => gate.id));
  assert.equal(new Set(REQUIRED_EVIDENCE_GATE_IDS).size, REQUIRED_EVIDENCE_GATE_IDS.length);
  for (const gate of REQUIRED_EVIDENCE_GATES) {
    assert.match(gate.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(gate.evidenceFile, gate.id + '.json');
    assert.equal(typeof gate.title, 'string');
    assert.ok(gate.title.trim());
  }
});
