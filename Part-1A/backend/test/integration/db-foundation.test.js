import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrate.js';

function createTemporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), 'hms-db-foundation-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function writeMigration(directory, filename, sql) {
  writeFileSync(join(directory, filename), sql);
}

test('configures foreign keys, WAL, and a 5000 ms busy timeout on each file connection', (t) => {
  const directory = createTemporaryDirectory(t);
  const filename = join(directory, 'connection.sqlite');
  const first = createDatabase({ filename });
  const second = createDatabase({ filename });

  t.after(() => {
    first.close();
    second.close();
  });

  for (const database of [first, second]) {
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(database.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(database.pragma('busy_timeout', { simple: true }), 5000);
    assert.equal(typeof database.transaction(() => {}).immediate, 'function');

    database.exec(`
      CREATE TEMP TABLE foreign_key_parent (id INTEGER PRIMARY KEY);
      CREATE TEMP TABLE foreign_key_child (
        parent_id INTEGER REFERENCES foreign_key_parent (id)
      );
    `);
    const insertOrphan = database.prepare(
      'INSERT INTO foreign_key_child (parent_id) VALUES (?)',
    );
    assert.throws(() => insertOrphan.run(999), /FOREIGN KEY constraint failed/);
  }
});

test('uses the configured environment path for the database file', (t) => {
  const directory = createTemporaryDirectory(t);
  const filename = join(directory, 'configured.sqlite');
  const originalPath = process.env.HMS_DATABASE_PATH;
  process.env.HMS_DATABASE_PATH = filename;

  try {
    const database = createDatabase();
    assert.equal(database.name, filename);
    database.close();
  } finally {
    if (originalPath === undefined) {
      delete process.env.HMS_DATABASE_PATH;
    } else {
      process.env.HMS_DATABASE_PATH = originalPath;
    }
  }
});

test('supports parameterized statements and committed transactions', (t) => {
  const database = createDatabase({ filename: ':memory:' });
  t.after(() => database.close());
  database.exec('CREATE TABLE values_for_test (value TEXT NOT NULL)');

  const value = "not SQL'; DROP TABLE values_for_test; --";
  database.prepare('INSERT INTO values_for_test (value) VALUES (?)').run(value);
  const commit = database.transaction((entry) => {
    database.prepare('INSERT INTO values_for_test (value) VALUES (?)').run(entry);
  });
  commit('committed');

  assert.deepEqual(
    database.prepare('SELECT value FROM values_for_test ORDER BY rowid').all(),
    [{ value }, { value: 'committed' }],
  );
});

test('rolls back a failed transaction', (t) => {
  const database = createDatabase({ filename: ':memory:' });
  t.after(() => database.close());
  database.exec('CREATE TABLE rollback_test (value TEXT NOT NULL)');

  const failAfterInsert = database.transaction(() => {
    database.prepare('INSERT INTO rollback_test (value) VALUES (?)').run('temporary');
    throw new Error('intentional test failure');
  });

  assert.throws(failAfterInsert, /intentional test failure/);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM rollback_test').get().count, 0);
});

test('applies migrations in ascending order and does not reapply them', (t) => {
  const directory = createTemporaryDirectory(t);
  const migrationsDirectory = join(directory, 'migrations');
  mkdirSync(migrationsDirectory);
  writeMigration(
    migrationsDirectory,
    '010_add_second.sql',
    "INSERT INTO migration_order (position) VALUES (10);",
  );
  writeMigration(
    migrationsDirectory,
    '002_create_order.sql',
    'CREATE TABLE migration_order (position INTEGER NOT NULL); INSERT INTO migration_order (position) VALUES (2);',
  );
  const database = createDatabase({ filename: join(directory, 'migrations.sqlite') });
  t.after(() => database.close());

  assert.deepEqual(runMigrations(database, { migrationsDirectory }), [2, 10]);
  assert.deepEqual(runMigrations(database, { migrationsDirectory }), []);
  assert.deepEqual(
    database.prepare('SELECT position FROM migration_order ORDER BY rowid').all(),
    [{ position: 2 }, { position: 10 }],
  );

  const history = database
    .prepare('SELECT version, applied_at FROM schema_migrations ORDER BY version')
    .all();
  assert.deepEqual(history.map(({ version }) => version), [2, 10]);
  assert.ok(history.every(({ applied_at: appliedAt }) => !Number.isNaN(Date.parse(appliedAt))));
});

test('rolls back a failed migration without recording its version', (t) => {
  const directory = createTemporaryDirectory(t);
  const migrationsDirectory = join(directory, 'migrations');
  mkdirSync(migrationsDirectory);
  writeMigration(migrationsDirectory, '001_valid.sql', 'CREATE TABLE valid_migration (id INTEGER);');
  writeMigration(
    migrationsDirectory,
    '002_failure.sql',
    'CREATE TABLE rolled_back_migration (id INTEGER); INSERT INTO missing_table (id) VALUES (1);',
  );
  const database = createDatabase({ filename: join(directory, 'migrations.sqlite') });
  t.after(() => database.close());

  assert.throws(
    () => runMigrations(database, { migrationsDirectory }),
    /migration 2 .*failed; its changes and history record were rolled back/,
  );
  assert.equal(
    database
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('rolled_back_migration').count,
    0,
  );
  assert.deepEqual(
    database.prepare('SELECT version FROM schema_migrations ORDER BY version').all(),
    [{ version: 1 }],
  );
});

test('detects an applied migration whose file is missing', (t) => {
  const directory = createTemporaryDirectory(t);
  const migrationsDirectory = join(directory, 'migrations');
  mkdirSync(migrationsDirectory);
  const migrationPath = join(migrationsDirectory, '001_initial.sql');
  writeFileSync(migrationPath, 'CREATE TABLE initial_migration (id INTEGER);');
  const database = createDatabase({ filename: join(directory, 'migrations.sqlite') });
  t.after(() => database.close());

  runMigrations(database, { migrationsDirectory });
  rmSync(migrationPath);

  assert.throws(
    () => runMigrations(database, { migrationsDirectory }),
    /Applied database migration file\(s\) are missing for version\(s\): 1/,
  );
});

test('rejects invalid and duplicate migration filenames', (t) => {
  const directory = createTemporaryDirectory(t);
  const invalidDirectory = join(directory, 'invalid');
  mkdirSync(invalidDirectory);
  writeMigration(invalidDirectory, 'initial.sql', 'CREATE TABLE invalid_name (id INTEGER);');
  const database = createDatabase({ filename: join(directory, 'migrations.sqlite') });
  t.after(() => database.close());

  assert.throws(
    () => runMigrations(database, { migrationsDirectory: invalidDirectory }),
    /Invalid migration filename/,
  );

  const duplicateDirectory = join(directory, 'duplicate');
  mkdirSync(duplicateDirectory);
  writeMigration(duplicateDirectory, '001_first.sql', 'CREATE TABLE first_migration (id INTEGER);');
  writeMigration(duplicateDirectory, '001_second.sql', 'CREATE TABLE second_migration (id INTEGER);');

  assert.throws(
    () => runMigrations(database, { migrationsDirectory: duplicateDirectory }),
    /Duplicate database migration version 1/,
  );
});

test('closes database connections cleanly', (t) => {
  const database = createDatabase({ filename: ':memory:' });
  assert.equal(database.open, true);

  database.close();

  assert.equal(database.open, false);
  t.after(() => {
    if (database.open) {
      database.close();
    }
  });
});
