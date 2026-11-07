'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validatePublicAssetDeliveryManifest } = require('../packages/media/src/public-asset-delivery-contract');

const repositoryRoot = path.resolve(__dirname, '..');
const defaultManifest = path.join(repositoryRoot, 'artifacts', 'evidence', 'public-asset-delivery.json');
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;

function usage() {
  console.log('Usage: node scripts/validate-public-asset-delivery.js [manifest.json]');
  console.log('Validates public-asset delivery evidence declarations; it does not configure or probe providers.');
}

function isInsideDirectory(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return Boolean(relative) && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function resolveManifestPath(inputPath, root = repositoryRoot) {
  const rootRealPath = fs.realpathSync(root);
  const candidate = path.resolve(rootRealPath, inputPath);
  if (!isInsideDirectory(rootRealPath, candidate)) {
    throw new Error('Manifest path must be inside the repository.');
  }

  const relative = path.relative(rootRealPath, candidate);
  const segments = relative.split(path.sep);
  let current = rootRealPath;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const metadata = fs.lstatSync(current);
    if (metadata.isSymbolicLink()) throw new Error('Manifest paths must not contain symbolic links.');
    if (index < segments.length - 1 && !metadata.isDirectory()) {
      throw new Error('Manifest parent paths must be real directories.');
    }
    if (index === segments.length - 1 && !metadata.isFile()) {
      throw new Error('Manifest must be a regular file.');
    }
  }

  const realPath = fs.realpathSync(candidate);
  if (!isInsideDirectory(rootRealPath, realPath)) {
    throw new Error('Manifest path resolves outside the repository.');
  }
  return realPath;
}

/**
 * Read only a regular non-symlink file beneath the repository root. Open first,
 * verify the opened inode still matches its directory entry, and consume the
 * same descriptor so a path swap cannot redirect the read after validation.
 */
function readRegularManifest(rootRealPath, filePath) {
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
  const descriptor = fs.openSync(filePath, flags);
  try {
    const openedStats = fs.fstatSync(descriptor);
    const entryStats = fs.lstatSync(filePath);
    if (!openedStats.isFile() || !entryStats.isFile() || entryStats.isSymbolicLink() ||
        openedStats.dev !== entryStats.dev || openedStats.ino !== entryStats.ino) {
      throw new Error('Manifest must remain a regular non-symbolic-link file while being read.');
    }

    const canonicalPath = fs.realpathSync(filePath);
    if (!isInsideDirectory(rootRealPath, canonicalPath)) {
      throw new Error('Manifest path resolves outside the repository.');
    }
    if (openedStats.size > MAX_MANIFEST_BYTES) throw new Error('Manifest exceeds the 2 MiB size limit.');

    const chunks = [];
    const chunk = Buffer.alloc(64 * 1024);
    let total = 0;
    while (true) {
      const bytesRead = fs.readSync(descriptor, chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > MAX_MANIFEST_BYTES) throw new Error('Manifest exceeds the 2 MiB size limit.');
      chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    fs.closeSync(descriptor);
  }
}

function main(args = process.argv.slice(2), { env = process.env, root = repositoryRoot } = {}) {
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }
  if (args.length > 1) {
    usage();
    console.error('Provide at most one manifest path.');
    return 2;
  }

  const inputPath = args[0] || path.relative(root, defaultManifest);
  const rootRealPath = fs.realpathSync(root);
  let manifest;
  try {
    const resolved = resolveManifestPath(inputPath, rootRealPath);
    manifest = JSON.parse(readRegularManifest(rootRealPath, resolved));
  } catch (error) {
    console.error('PUBLIC ASSET DELIVERY: BLOCKED');
    console.error(error.code === 'ENOENT'
      ? 'Production evidence manifest is missing. Copy the documented template and replace every placeholder with deployment-approved evidence.'
      : 'Could not safely read or parse the production evidence manifest.');
    return 2;
  }

  const expectedRevision = env.VIRGOSCORPIO_HUB_EXPECTED_SOURCE_REVISION;
  const result = validatePublicAssetDeliveryManifest(manifest, {
    expectedRevision: expectedRevision || undefined
  });
  if (!result.ready) {
    console.error('PUBLIC ASSET DELIVERY: BLOCKED (' + result.errors.length + ' issue(s))');
    for (const error of result.errors) console.error('- ' + error.path + ': ' + error.code);
    return 1;
  }

  console.log('PUBLIC ASSET DELIVERY: STRUCTURAL EVIDENCE VALIDATION PASSED');
  console.log('Origin privacy, edge cache policy, revocation probes, legacy URL disposition, and ownership declarations are complete.');
  console.log('Provider evidence was not fetched or authenticated; human/provider-specific verification and independent release approval remain required.');
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { main, resolveManifestPath, readRegularManifest };
