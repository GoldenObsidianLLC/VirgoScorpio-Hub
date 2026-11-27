'use strict';

const fs = require('node:fs');

const MIGRATION_FILE_PATTERN = /^(\d{4})_[a-z0-9_-]+\.sql$/i;

/**
 * Inspect migration directory entry names as a contiguous numbered sequence.
 * This avoids a manually maintained allow-list becoming stale as migrations
 * are added while still detecting gaps and ambiguous version identifiers.
 *
 * @param {string[]} fileNames Directory entry names.
 */
function inspectMigrationFileNames(fileNames) {
  if (!Array.isArray(fileNames) || fileNames.some((name) => typeof name !== 'string')) {
    throw new TypeError('Migration file names must be an array of strings.');
  }

  const sqlFileNames = fileNames.filter((name) => /\.sql$/i.test(name));
  const migrationFiles = [];
  const invalidSqlFiles = [];
  const versions = new Map();

  for (const fileName of sqlFileNames) {
    const match = MIGRATION_FILE_PATTERN.exec(fileName);
    const version = match ? Number(match[1]) : 0;
    if (!match || version < 1) {
      invalidSqlFiles.push(fileName);
      continue;
    }

    migrationFiles.push(fileName);
    const names = versions.get(version) || [];
    names.push(fileName);
    versions.set(version, names);
  }

  migrationFiles.sort();
  invalidSqlFiles.sort();

  const highestVersion = versions.size ? Math.max(...versions.keys()) : 0;
  const duplicateVersions = [...versions.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([version]) => version)
    .sort((a, b) => a - b);
  const missingVersions = [];
  for (let version = 1; version <= highestVersion; version += 1) {
    if (!versions.has(version)) missingVersions.push(version);
  }

  return {
    valid: migrationFiles.length > 0
      && invalidSqlFiles.length === 0
      && duplicateVersions.length === 0
      && missingVersions.length === 0,
    migrationFiles,
    invalidSqlFiles,
    duplicateVersions,
    missingVersions,
    highestVersion,
  };
}

/**
 * Read and validate the migration directory. SQL-named directories and other
 * non-regular entries fail closed instead of being silently omitted.
 *
 * @param {string} migrationDirectory Absolute or relative migration directory.
 */
function inspectMigrationDirectory(migrationDirectory) {
  const entries = fs.readdirSync(migrationDirectory, { withFileTypes: true });
  const sqlEntries = entries.filter((entry) => /\.sql$/i.test(entry.name));
  const regularFileNames = sqlEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const nonRegularSqlEntries = sqlEntries
    .filter((entry) => !entry.isFile())
    .map((entry) => entry.name)
    .sort();

  const inventory = inspectMigrationFileNames(regularFileNames);
  const invalidSqlFiles = [...inventory.invalidSqlFiles, ...nonRegularSqlEntries].sort();
  return {
    ...inventory,
    valid: inventory.valid && invalidSqlFiles.length === 0,
    invalidSqlFiles,
  };
}

function describeMigrationInventory(inventory) {
  const issues = [];
  if (inventory.migrationFiles.length === 0) {
    issues.push('No numbered SQL migration files were found');
  }
  if (inventory.invalidSqlFiles.length) {
    issues.push('Invalid SQL migration entries: ' + inventory.invalidSqlFiles.join(', '));
  }
  if (inventory.duplicateVersions.length) {
    issues.push('Duplicate migration versions: ' + inventory.duplicateVersions.map((version) => String(version).padStart(4, '0')).join(', '));
  }
  if (inventory.missingVersions.length) {
    issues.push('Missing migration versions: ' + inventory.missingVersions.map((version) => String(version).padStart(4, '0')).join(', '));
  }

  if (issues.length) return issues.join('; ') + '.';
  return inventory.migrationFiles.length + ' numbered migration files are present in a contiguous sequence from 0001 through ' +
    String(inventory.highestVersion).padStart(4, '0') +
    '; live fresh/upgrade execution is a separate gate.';
}

module.exports = {
  inspectMigrationFileNames,
  inspectMigrationDirectory,
  describeMigrationInventory,
};
