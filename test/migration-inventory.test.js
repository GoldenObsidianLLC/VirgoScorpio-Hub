'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  inspectMigrationFileNames,
  inspectMigrationDirectory,
  describeMigrationInventory,
} = require('../scripts/migration-inventory');

test('migration inventory discovers the complete repository sequence, including migration 0022', () => {
  const inventory = inspectMigrationDirectory(path.join(__dirname, '..', 'database', 'migrations'));

  assert.equal(inventory.valid, true);
  assert.ok(inventory.migrationFiles.length >= 22);
  assert.ok(inventory.migrationFiles.includes('0022_password_reset_request_queue.sql'));
  assert.equal(inventory.highestVersion, 22);
  assert.match(describeMigrationInventory(inventory), /22 numbered migration files.*0001 through 0022/);
});

test('migration inventory detects missing versions instead of passing a count-only check', () => {
  const inventory = inspectMigrationFileNames([
    '0001_initial.sql',
    '0003_add_feature.sql',
  ]);

  assert.equal(inventory.valid, false);
  assert.deepEqual(inventory.missingVersions, [2]);
  assert.match(describeMigrationInventory(inventory), /Missing migration versions: 0002/);
});

test('migration inventory rejects duplicate versions and unrecognized SQL filenames', () => {
  const inventory = inspectMigrationFileNames([
    '0001_initial.sql',
    '0001_duplicate.sql',
    '0002_add_feature.sql',
    'not-a-versioned-migration.sql',
  ]);

  assert.equal(inventory.valid, false);
  assert.deepEqual(inventory.duplicateVersions, [1]);
  assert.deepEqual(inventory.invalidSqlFiles, ['not-a-versioned-migration.sql']);
});

test('migration inventory ignores non-SQL entries', () => {
  const inventory = inspectMigrationFileNames([
    '0001_initial.sql',
    'README.md',
    'notes.txt',
  ]);

  assert.equal(inventory.valid, true);
  assert.deepEqual(inventory.migrationFiles, ['0001_initial.sql']);
  assert.deepEqual(inventory.invalidSqlFiles, []);
});
