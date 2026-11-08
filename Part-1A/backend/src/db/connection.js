import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const DATABASE_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_DATABASE_PATH = 'data/hms.sqlite';
const BUSY_TIMEOUT_MS = 5000;

function resolveDatabasePath(filename) {
  if (filename === ':memory:') {
    return filename;
  }

  if (typeof filename !== 'string' || filename.trim() === '') {
    throw new TypeError('Database path must be a non-empty string.');
  }

  return isAbsolute(filename) ? filename : resolve(DATABASE_DIRECTORY, filename);
}

export function createDatabase({
  filename = process.env.HMS_DATABASE_PATH ?? DEFAULT_DATABASE_PATH,
} = {}) {
  const databasePath = resolveDatabasePath(filename);
  let database;

  try {
    if (databasePath !== ':memory:') {
      mkdirSync(dirname(databasePath), { recursive: true });
    }

    database = new Database(databasePath, { timeout: BUSY_TIMEOUT_MS });

    database.pragma('foreign_keys = ON');
    if (database.pragma('foreign_keys', { simple: true }) !== 1) {
      throw new Error('Foreign-key enforcement could not be enabled.');
    }

    if (databasePath !== ':memory:') {
      const journalMode = database.pragma('journal_mode = WAL', { simple: true });
      if (journalMode !== 'wal') {
        throw new Error('WAL journal mode could not be enabled.');
      }
    }

    database.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    if (database.pragma('busy_timeout', { simple: true }) !== BUSY_TIMEOUT_MS) {
      throw new Error('The SQLite busy timeout could not be configured.');
    }

    return database;
  } catch (initializationError) {
    let closeError;
    if (database?.open) {
      try {
        database.close();
      } catch (error) {
        closeError = error;
      }
    }

    if (closeError) {
      throw new AggregateError(
        [closeError],
        'Failed to initialize the SQLite database connection and close it safely.',
        { cause: initializationError },
      );
    }

    throw new Error('Failed to initialize the SQLite database connection.', {
      cause: initializationError,
    });
  }
}
