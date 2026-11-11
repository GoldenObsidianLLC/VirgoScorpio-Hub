'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSbom } = require('../scripts/normalize-sbom');
const { SBOM_ARGS, buildSbomCommand, formatSpawnError, serializeSbom } = require('../scripts/generate-sbom');

test('SBOM command paths use the same lockfile-only dependency inventory', () => {
  const windowsFallback = buildSbomCommand(null, 'C:\\node\\node.exe', 'win32', 'C:\\Windows\\System32\\cmd.exe');
  const windowsCommand = ['npm', ...SBOM_ARGS].join(' ');
  const npmCli = buildSbomCommand('C:\\npm\\node_modules\\npm\\bin\\npm-cli.js', 'C:\\node\\node.exe');
  const fallback = buildSbomCommand(null, 'C:\\node\\node.exe');

  assert.deepEqual(npmCli, {
    command: 'C:\\node\\node.exe',
    args: ['C:\\npm\\node_modules\\npm\\bin\\npm-cli.js', ...SBOM_ARGS],
    shell: false
  });
  assert.deepEqual(fallback, {
    command: process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm',
    args: process.platform === 'win32' ? ['/d', '/s', '/c', windowsCommand] : [...SBOM_ARGS],
    shell: false
  });
  assert.deepEqual(npmCli.args.slice(1), SBOM_ARGS);
  assert.deepEqual(windowsFallback, {
    command: 'C:\\Windows\\System32\\cmd.exe',
    args: ['/d', '/s', '/c', windowsCommand],
    shell: false
  });
  assert.ok(SBOM_ARGS.includes('--package-lock-only'));
  assert.ok(Object.isFrozen(SBOM_ARGS));
});

test('SBOM command launch failures preserve the original spawn diagnostic', () => {
  const invocation = buildSbomCommand(null, 'C:\\node\\node.exe');
  const error = Object.assign(new Error('executable missing'), {
    code: 'ENOENT',
    errno: -4058,
    syscall: 'spawnSync npm'
  });

  assert.equal(
    formatSpawnError(invocation, error, null),
    `Unable to launch npm SBOM command (command=${invocation.command}, npm_execpath=unavailable, code=ENOENT, errno=-4058, syscall=spawnSync npm): executable missing`
  );
});

test('CycloneDX root component identity is independent of checkout directory name', () => {
  const packageInfo = { name: 'virgoscorpio-hub', version: '0.5.1' };
  const sbom = {
    metadata: {
      component: {
        type: 'library',
        name: 'feature-worktree',
        version: '0.5.1',
        'bom-ref': 'virgoscorpio-hub@0.5.1',
        purl: 'pkg:npm/virgoscorpio-hub@0.5.1'
      }
    },
    components: [{ name: 'dependency-a', version: '1.2.3' }],
    dependencies: [{ ref: 'virgoscorpio-hub@0.5.1', dependsOn: ['dependency-a@1.2.3'] }]
  };

  const normalized = normalizeSbom(sbom, packageInfo);
  assert.equal(normalized.metadata.component.name, 'virgoscorpio-hub');
  assert.equal(normalized.metadata.component.version, '0.5.1');
  assert.deepEqual(normalized.components, [{ name: 'dependency-a', version: '1.2.3' }]);
  assert.deepEqual(normalized.dependencies, [{ ref: 'virgoscorpio-hub@0.5.1', dependsOn: ['dependency-a@1.2.3'] }]);
});

test('SBOM serialization normalizes the root identity before its bytes are hashed', () => {
  const packageInfo = { name: 'virgoscorpio-hub', version: '0.6.2' };
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    metadata: {
      component: {
        type: 'library',
        name: 'dependency-supply-chain-review-2026-11-10',
        version: '0.6.2',
        'bom-ref': 'virgoscorpio-hub@0.6.2',
        purl: 'pkg:npm/virgoscorpio-hub@0.6.2'
      }
    },
    components: [{ name: 'dependency-a', version: '1.2.3' }],
    dependencies: [{ ref: 'virgoscorpio-hub@0.6.2', dependsOn: ['dependency-a@1.2.3'] }]
  };

  const serialized = serializeSbom(sbom, packageInfo);
  const normalized = JSON.parse(serialized.toString('utf8'));

  assert.equal(normalized.metadata.component.name, 'virgoscorpio-hub');
  assert.equal(normalized.metadata.component.version, '0.6.2');
  assert.deepEqual(normalized.components, [{ name: 'dependency-a', version: '1.2.3' }]);
  assert.deepEqual(normalized.dependencies, [{ ref: 'virgoscorpio-hub@0.6.2', dependsOn: ['dependency-a@1.2.3'] }]);
});

test('CycloneDX normalization rejects a mismatched root package identity', () => {
  const sbom = {
    metadata: {
      component: {
        type: 'library',
        name: 'wrong',
        version: '0.5.1',
        'bom-ref': 'different@0.5.1',
        purl: 'pkg:npm/different@0.5.1'
      }
    }
  };
  assert.throws(() => normalizeSbom(sbom, { name: 'virgoscorpio-hub', version: '0.5.1' }), /bom-ref does not match/);
});
