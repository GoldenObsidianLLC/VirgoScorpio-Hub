'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSbom } = require('../scripts/normalize-sbom');
const { SBOM_ARGS, buildSbomCommand, formatSpawnError, serializeSbom } = require('../scripts/generate-sbom');

test('SBOM command paths use fixed commands and the shared lockfile-only inventory', () => {
  const windowsCommand = buildSbomCommand('win32');
  const posixCommand = buildSbomCommand('linux');

  assert.deepEqual(windowsCommand, {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', ['npm', ...SBOM_ARGS].join(' ')],
    shell: false
  });
  assert.deepEqual(posixCommand, {
    command: 'npm',
    args: [...SBOM_ARGS],
    shell: false
  });
  assert.ok(SBOM_ARGS.includes('--package-lock-only'));
  assert.ok(Object.isFrozen(SBOM_ARGS));
});

test('untrusted npm and command-processor environment values cannot override SBOM commands', () => {
  const previousNpmExecPath = process.env.npm_execpath;
  const previousComSpec = process.env.ComSpec;

  try {
    process.env.npm_execpath = 'C:\\attacker\\controlled\\npm-cli.js';
    process.env.ComSpec = 'C:\\attacker\\controlled\\cmd.exe';

    assert.deepEqual(buildSbomCommand('win32'), {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', ['npm', ...SBOM_ARGS].join(' ')],
      shell: false
    });
    assert.deepEqual(buildSbomCommand('linux'), {
      command: 'npm',
      args: [...SBOM_ARGS],
      shell: false
    });
  } finally {
    if (previousNpmExecPath === undefined) delete process.env.npm_execpath;
    else process.env.npm_execpath = previousNpmExecPath;
    if (previousComSpec === undefined) delete process.env.ComSpec;
    else process.env.ComSpec = previousComSpec;
  }
});

test('SBOM command launch failures preserve the original spawn diagnostic', () => {
  const invocation = buildSbomCommand('win32');
  const error = Object.assign(new Error('executable missing'), {
    code: 'ENOENT',
    errno: -4058,
    syscall: 'spawnSync cmd.exe'
  });

  assert.equal(
    formatSpawnError(invocation, error),
    'Unable to launch npm SBOM command (command=' + invocation.command + ', code=ENOENT, errno=-4058, syscall=spawnSync cmd.exe): executable missing'
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
