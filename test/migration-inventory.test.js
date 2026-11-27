'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  inspectMigrationFileNames,
  inspectMigrationDirectory,
  describeMigrationInventory,
} = require('../scripts/migration-inventory');

test('migration inventory discovers the complete repository sequence, including migration 0022', () => {
  const inventory = inspectMigrationDirectory(path.join(__dirname, '..', 'database', 'migrations'));

  assert.equal(inventory.valid, true);
  assert.ok(inventory.highestVersion >= 22);
  assert.ok(inventory.migrationFiles.includes('0022_password_reset_request_queue.sql'));
  assert.equal(inventory.migrationFiles.length, inventory.highestVersion);
  assert.equal(
    describeMigrationInventory(inventory),
    inventory.migrationFiles.length + ' numbered migration files are present in a contiguous sequence from 0001 through ' +
      String(inventory.highestVersion).padStart(4, '0') +
      '; live fresh/upgrade execution is a separate gate.'
  );
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

test('migration inventory rejects SQL-named directories and other non-regular entries', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'virgoscorpio-migration-inventory-'));

  try {
    fs.writeFileSync(path.join(temporaryDirectory, '0001_initial.sql'), '-- test migration\n');
    fs.mkdirSync(path.join(temporaryDirectory, '0002_directory.sql'));

    const inventory = inspectMigrationDirectory(temporaryDirectory);

    assert.equal(inventory.valid, false);
    assert.deepEqual(inventory.migrationFiles, ['0001_initial.sql']);
    assert.deepEqual(inventory.invalidSqlFiles, ['0002_directory.sql']);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
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
