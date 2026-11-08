import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/app.js';
import { createConfig } from '../../src/config/index.js';
import { createDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrate.js';

export async function createHttpFixture(t, configOverrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'hms-http-'));
  const database = createDatabase({ filename: join(directory, 'http.sqlite') });
  runMigrations(database);

  let currentTime = new Date('2026-11-08T10:00:00.000Z');
  const logEntries = [];
  const config = createConfig({
    hospitalTimeZone: 'America/New_York',
    applicationOrigin: 'http://hms.test',
    now: () => new Date(currentTime),
    ...configOverrides,
  });
  const logger = {
    error(entry) {
      logEntries.push(entry);
    },
  };
  const server = createServer(createApp({ database, config, logger }));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  return {
    config,
    database,
    baseUrl,
    logEntries,
    logger,
    setTime(value) {
      currentTime = new Date(value);
    },
    request(path, {
      method = 'GET',
      headers = {},
      body,
    } = {}) {
      const requestHeaders = new Headers(headers);
      if (body !== undefined) {
        requestHeaders.set('Content-Type', 'application/json');
      }
      return fetch(`${baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      });
    },
  };
}

export async function registerPatient(fixture, overrides = {}) {
  return fixture.request('/api/v1/auth/register', {
    method: 'POST',
    body: {
      fullName: 'Fictional Patient',
      email: 'patient@example.test',
      password: 'secure-fictional-password',
      ...overrides,
    },
  });
}

export async function loginPatient(fixture, email = 'patient@example.test') {
  return fixture.request('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password: 'secure-fictional-password' },
  });
}

export function cookieFrom(response, name = 'hms_session') {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Expected the response to set the session cookie.');
  }
  const prefix = `${name}=`;
  const cookie = setCookie.split(';')[0];
  if (!cookie.startsWith(prefix)) {
    throw new Error('Response did not contain the expected session cookie.');
  }
  return { header: cookie, token: cookie.slice(prefix.length) };
}

export function createAccountSession(fixture, { accountId, role }) {
  const existing = accountId === undefined
    ? undefined
    : fixture.database.prepare('SELECT role FROM accounts WHERE id = ?').get(accountId);
  if (existing && existing.role !== role) {
    throw new Error('The requested fixture account has a different role.');
  }
  const id = existing ? accountId : fixture.database.prepare(`
    INSERT INTO accounts (id, full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    accountId ?? null,
    `${role} Fixture Account`,
    `${role.toLowerCase()}-${randomBytes(6).toString('hex')}@example.test`,
    `$2b$12$${'a'.repeat(53)}`,
    role,
  ).lastInsertRowid;
  const token = randomBytes(32).toString('base64url');
  const now = fixture.config.now();
  fixture.database.prepare(`
    INSERT INTO sessions (account_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(
    id,
    createHash('sha256').update(token).digest('hex'),
    now.toISOString(),
    new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  );
  return { accountId: id, token, cookie: `hms_session=${token}` };
}
