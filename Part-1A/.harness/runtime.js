import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../backend/src/app.js';
import { createConfig } from '../backend/src/config/index.js';
import { createDatabase } from '../backend/src/db/connection.js';
import { runMigrations } from '../backend/src/db/migrate.js';
import {
  FIXTURE_PATIENT_ACCOUNT_ID,
  FIXTURE_STAFF_ACCOUNT_ID,
} from './fixtures/generator.js';
import { seedFixture } from './fixtures/seed.js';
import { createFixedClock } from './fixtures/time.js';

const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
const bcrypt = requireBackend('bcrypt');
export const HARNESS_ORIGIN = 'http://hms.test';

export function createRuntimeCredentials(fixture) {
  return {
    patient: {
      email: fixture.patients[0].email,
      password: randomBytes(32).toString('base64url'),
    },
    staff: {
      email: fixture.staff.email,
      password: randomBytes(32).toString('base64url'),
    },
  };
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return `http://127.0.0.1:${port}`;
}

export async function createIsolatedApplication({
  fixture,
  credentials = createRuntimeCredentials(fixture),
  directoryPrefix = 'hms-phase9-',
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), directoryPrefix));
  const databasePath = join(directory, 'hms.sqlite');
  let database;
  let server;
  let stopped = false;
  try {
    database = createDatabase({ filename: databasePath });
    runMigrations(database);
    const [patientPasswordHash, staffPasswordHash] = await Promise.all([
      bcrypt.hash(credentials.patient.password, 4),
      bcrypt.hash(credentials.staff.password, 4),
    ]);
    seedFixture(database, fixture, { patientPasswordHash, staffPasswordHash });
    const staffAccountIds = [FIXTURE_STAFF_ACCOUNT_ID];
    const config = createConfig({
      hospitalTimeZone: fixture.manifest.hospitalTimeZone,
      applicationOrigin: HARNESS_ORIGIN,
      secureCookies: false,
      now: createFixedClock(fixture.manifest.benchmarkClockAnchor),
      beneficiaryAuthorizationReviewerAccountIds: staffAccountIds,
      departmentManagerAccountIds: staffAccountIds,
      doctorManagerAccountIds: staffAccountIds,
      availabilityManagerAccountIds: staffAccountIds,
      availabilityViewerAccountIds: staffAccountIds,
      appointmentBookerAccountIds: staffAccountIds,
      appointmentCancellerAccountIds: staffAccountIds,
      appointmentViewerAccountIds: staffAccountIds,
      patientDirectoryViewerAccountIds: staffAccountIds,
      adminDashboardAccountIds: staffAccountIds,
    });
    const logEntries = [];
    server = createServer(createApp({
      database,
      config,
      logger: {
        error(entry) {
          logEntries.push(entry);
        },
      },
    }));
    const baseUrl = await listen(server);

    async function shutdown() {
      if (stopped) {
        return;
      }
      stopped = true;
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
      database.close();
    }

    return {
      baseUrl,
      databasePath,
      directory,
      database,
      config,
      credentials,
      logEntries,
      async shutdown() {
        await shutdown();
      },
      async dispose() {
        await shutdown();
        rmSync(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (server?.listening) {
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
    }
    if (database?.open) {
      database.close();
    }
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

export function fixtureActorIds() {
  return {
    patientAccountId: FIXTURE_PATIENT_ACCOUNT_ID,
    staffAccountId: FIXTURE_STAFF_ACCOUNT_ID,
  };
}
