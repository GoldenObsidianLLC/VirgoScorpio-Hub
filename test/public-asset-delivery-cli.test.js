'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { main, resolveManifestPath } = require('../scripts/validate-public-asset-delivery');
const { validManifest, REVISION } = require('./fixtures/public-asset-delivery-manifest');

const repositoryRoot = path.resolve(__dirname, '..');
const fixtureDirectory = path.join(repositoryRoot, 'var');

function writeFixture(t, fileName, value) {
  fs.mkdirSync(fixtureDirectory, { recursive: true });
  const filePath = path.join(fixtureDirectory, fileName + '-' + process.pid + '.json');
  fs.writeFileSync(filePath, typeof value === 'string' ? value : JSON.stringify(value));
  t.after(() => fs.rmSync(filePath, { force: true }));
  return path.relative(repositoryRoot, filePath);
}

function capture(callback) {
  const originalLog = console.log;
  const originalError = console.error;
  const output = [];
  console.log = (...args) => output.push(args.join(' '));
  console.error = (...args) => output.push(args.join(' '));
  try {
    return { result: callback(), output: output.join('\n') };
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test('CLI help is available without a production evidence manifest', () => {
  const result = capture(() => main(['--help']));
  assert.equal(result.result, 0);
  assert.match(result.output, /Usage: node scripts\/validate-public-asset-delivery\.js/);
});

test('CLI rejects manifest paths outside the repository', () => {
  assert.throws(
    () => resolveManifestPath(path.resolve(repositoryRoot, '..', '..', 'outside.json')),
    /inside the repository/
  );
});

test('CLI rejects symlink manifest paths', t => {
  const target = path.join(fixtureDirectory, 'target-' + process.pid + '.json');
  const link = path.join(fixtureDirectory, 'link-' + process.pid + '.json');
  fs.mkdirSync(fixtureDirectory, { recursive: true });
  fs.writeFileSync(target, '{}');
  t.after(() => {
    fs.rmSync(target, { force: true });
    fs.rmSync(link, { force: true });
  });
  try {
    fs.symlinkSync(target, link, 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return t.skip('Symlink creation is unavailable on this platform.');
    throw error;
  }
  assert.throws(() => resolveManifestPath(path.relative(repositoryRoot, link)), /symbolic links/);
});

test('CLI reports a missing production manifest as blocked without failing the unit suite', () => {
  const result = capture(() => main(['var/missing-public-asset-delivery-' + process.pid + '.json']));
  assert.equal(result.result, 2);
  assert.match(result.output, /PUBLIC ASSET DELIVERY: BLOCKED/);
  assert.match(result.output, /manifest is missing/i);
});

test('CLI sanitizes malformed JSON and does not echo manifest content', t => {
  const relativePath = writeFixture(t, 'malformed', '{"secret":"NEVER_ECHO_THIS_SECRET"');
  const result = capture(() => main([relativePath]));
  assert.equal(result.result, 2);
  assert.match(result.output, /Could not safely read or parse/);
  assert.doesNotMatch(result.output, /NEVER_ECHO_THIS_SECRET/);
});

test('CLI accepts structurally complete evidence and clearly limits what that pass means', t => {
  const relativePath = writeFixture(t, 'valid', validManifest());
  const result = capture(() => main([relativePath], {
    env: { VIRGOSCORPIO_HUB_EXPECTED_SOURCE_REVISION: REVISION }
  }));
  assert.equal(result.result, 0);
  assert.match(result.output, /STRUCTURAL EVIDENCE VALIDATION PASSED/);
  assert.match(result.output, /not fetched or authenticated/);
});

test('CLI blocks a source-revision mismatch and never prints secret values', t => {
  const manifest = validManifest();
  manifest.providers.edge.apiToken = 'DO_NOT_PRINT_CLI_SECRET';
  const relativePath = writeFixture(t, 'invalid', manifest);
  const result = capture(() => main([relativePath], {
    env: { VIRGOSCORPIO_HUB_EXPECTED_SOURCE_REVISION: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
  }));
  assert.equal(result.result, 1);
  assert.match(result.output, /PUBLIC ASSET DELIVERY: BLOCKED/);
  assert.match(result.output, /unexpected_field/);
  assert.match(result.output, /revision_mismatch/);
  assert.doesNotMatch(result.output, /DO_NOT_PRINT_CLI_SECRET/);
});

test('CLI rejects directories and unexpected argument counts', t => {
  fs.mkdirSync(fixtureDirectory, { recursive: true });
  const directory = path.join(fixtureDirectory, 'directory-' + process.pid);
  fs.mkdirSync(directory, { recursive: true });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const directoryResult = capture(() => main([path.relative(repositoryRoot, directory)]));
  const argumentsResult = capture(() => main(['one.json', 'two.json']));
  assert.equal(directoryResult.result, 2);
  assert.equal(argumentsResult.result, 2);
});
