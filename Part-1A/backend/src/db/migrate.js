import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_MIGRATIONS_DIRECTORY = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'migrations',
);
const MIGRATION_FILENAME_PATTERN = /^(\d{3,})_([a-z0-9]+(?:[a-z0-9_-]*[a-z0-9])?)\.sql$/;

function discoverMigrations(migrationsDirectory) {
  let entries;
  try {
    entries = readdirSync(migrationsDirectory, { withFileTypes: true });
  } catch (error) {
    throw new Error('Unable to read the database migrations directory.', { cause: error });
  }

  const migrations = [];
  const versions = new Set();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.sql')) {
      continue;
    }

    const match = MIGRATION_FILENAME_PATTERN.exec(entry.name);
    if (!match) {
      throw new Error(
        `Invalid migration filename "${entry.name}"; expected a numbered lowercase SQL filename.`,
      );
    }

    const version = Number(match[1]);
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new Error(`Migration filename "${entry.name}" has an invalid version.`);
    }
    if (versions.has(version)) {
      throw new Error(`Duplicate database migration version ${version}.`);
    }
    versions.add(version);

    let sql;
    try {
      sql = readFileSync(resolve(migrationsDirectory, entry.name), 'utf8');
    } catch (error) {
      throw new Error(`Unable to read database migration "${entry.name}".`, { cause: error });
    }

    migrations.push({ version, filename: entry.name, sql });
  }

  migrations.sort((left, right) => left.version - right.version);
  return migrations;
}

export function runMigrations(database, {
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
} = {}) {
  const migrations = discoverMigrations(migrationsDirectory);

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY CHECK (version > 0),
      applied_at TEXT NOT NULL
    )
  `);

  const appliedVersions = database
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map(({ version }) => version);
  const migrationVersions = new Set(migrations.map(({ version }) => version));
  const missingVersions = appliedVersions.filter((version) => !migrationVersions.has(version));

  if (missingVersions.length > 0) {
    throw new Error(
      `Applied database migration file(s) are missing for version(s): ${missingVersions.join(', ')}.`,
    );
  }

  const alreadyApplied = new Set(appliedVersions);
  const insertHistory = database.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
  );
  const appliedNow = [];

  for (const migration of migrations) {
    if (alreadyApplied.has(migration.version)) {
      continue;
    }

    const applyMigration = database.transaction(() => {
      database.exec(migration.sql);
      insertHistory.run(migration.version, new Date().toISOString());
    });

    try {
      applyMigration.immediate();
      appliedNow.push(migration.version);
    } catch (error) {
      throw new Error(
        `Database migration ${migration.version} ("${migration.filename}") failed; its changes and history record were rolled back.`,
        { cause: error },
      );
    }
  }

  return appliedNow;
}
