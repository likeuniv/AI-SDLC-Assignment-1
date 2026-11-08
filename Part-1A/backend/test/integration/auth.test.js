import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import test from 'node:test';
import {
  cookieFrom,
  createHttpFixture,
  loginPatient,
  registerPatient,
} from '../helpers/http-fixture.js';

async function getCsrf(fixture, cookie) {
  const response = await fixture.request('/api/v1/auth/csrf', {
    headers: { Cookie: cookie },
  });
  const body = await response.json();
  return { response, token: body.data?.csrfToken };
}

test('registers a patient, creates the profile, and persists only a bcrypt hash', async (t) => {
  const fixture = await createHttpFixture(t);
  const response = await registerPatient(fixture, {
    fullName: '  Fictional Patient  ',
    email: 'Patient@Example.Test',
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.fullName, 'Fictional Patient');
  assert.equal(body.data.email, 'patient@example.test');
  assert.equal(body.data.role, 'PATIENT');
  assert.equal('passwordHash' in body.data, false);
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM patient_profiles').get().count,
    1,
  );
  const account = fixture.database.prepare(`
    SELECT password_hash, role FROM accounts WHERE id = ?
  `).get(body.data.accountId);
  assert.equal(account.role, 'PATIENT');
  assert.notEqual(account.password_hash, 'secure-fictional-password');
  assert.equal(await bcrypt.compare('secure-fictional-password', account.password_hash), true);
});

test('registration rejects duplicates and invalid fields with safe responses', async (t) => {
  const fixture = await createHttpFixture(t);
  assert.equal((await registerPatient(fixture)).status, 201);

  const duplicate = await registerPatient(fixture);
  const duplicateBody = await duplicate.json();
  assert.equal(duplicate.status, 409);
  assert.equal(duplicateBody.error.code, 'DUPLICATE_RESOURCE');

  const invalidPassword = 'p'.repeat(73);
  const invalid = await registerPatient(fixture, { password: invalidPassword });
  const invalidBody = await invalid.json();
  assert.equal(invalid.status, 422);
  assert.equal(invalidBody.error.code, 'VALIDATION_FAILED');
  assert.ok(invalidBody.error.details.some(({ field }) => field === 'password'));
  assert.equal(JSON.stringify(invalidBody).includes(invalidPassword), false);
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1);
});

test('unknown email and incorrect password return equivalent login errors', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);

  const unknown = await loginPatient(fixture, 'unknown@example.test');
  const unknownBody = await unknown.json();
  const incorrect = await fixture.request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'patient@example.test', password: 'incorrect-fictional-password' },
  });
  const incorrectBody = await incorrect.json();

  assert.equal(unknown.status, 401);
  assert.equal(incorrect.status, 401);
  assert.equal(unknownBody.error.code, 'INVALID_CREDENTIALS');
  assert.deepEqual(unknownBody, incorrectBody);
});

test('issues high-entropy HttpOnly SameSite session cookies and stores only token hashes', async (t) => {
  const fixture = await createHttpFixture(t, { secureCookies: true });
  await registerPatient(fixture);

  const response = await loginPatient(fixture);
  const body = await response.json();
  const { header, token } = cookieFrom(response);
  const session = fixture.database.prepare(`
    SELECT token_hash FROM sessions WHERE account_id = ?
  `).get(body.data.accountId);

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.role, 'PATIENT');
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.match(response.headers.get('set-cookie'), /Secure/i);
  assert.equal(session.token_hash, (await import('node:crypto')).createHash('sha256').update(token).digest('hex'));
  assert.equal(session.token_hash.includes(token), false);
  assert.equal(header.startsWith('hms_session='), true);
});

test('restores authenticated identity from the cookie and ignores client role spoofing', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const login = await loginPatient(fixture);
  const { header } = cookieFrom(login);

  const response = await fixture.request('/api/v1/auth/session?role=STAFF', {
    headers: { Cookie: header, 'X-Role': 'STAFF' },
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.role, 'PATIENT');
});

test('binds CSRF tokens to sessions and rotates/invalidate sessions on re-login', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const firstLogin = await loginPatient(fixture);
  const firstCookie = cookieFrom(firstLogin);
  const firstCsrf = await getCsrf(fixture, firstCookie.header);
  assert.equal(firstCsrf.response.status, 200);

  const secondLogin = await fixture.request('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      Cookie: firstCookie.header,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': firstCsrf.token,
    },
    body: { email: 'patient@example.test', password: 'secure-fictional-password' },
  });
  const secondCookie = cookieFrom(secondLogin);
  const secondCsrf = await getCsrf(fixture, secondCookie.header);
  assert.equal(secondCsrf.response.status, 200);
  assert.notEqual(firstCookie.token, secondCookie.token);
  assert.notEqual(firstCsrf.token, secondCsrf.token);

  const oldSession = fixture.database.prepare(`
    SELECT invalidated_at FROM sessions WHERE token_hash = ?
  `).get((await import('node:crypto')).createHash('sha256').update(firstCookie.token).digest('hex'));
  assert.ok(oldSession.invalidated_at);
  assert.equal((await getCsrf(fixture, firstCookie.header)).response.status, 401);
});

test('enforces CSRF Origin and token checks on cookie-authenticated writes', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const login = await loginPatient(fixture);
  const { header } = cookieFrom(login);
  const { token } = await getCsrf(fixture, header);

  const read = await fixture.request('/api/v1/auth/session', { headers: { Cookie: header } });
  assert.equal(read.status, 200);

  for (const headers of [
    {},
    { Origin: 'http://attacker.test', 'X-CSRF-Token': token },
    { Origin: 'not-an-origin', 'X-CSRF-Token': token },
    { Origin: 'null', 'X-CSRF-Token': token },
    { Origin: fixture.config.applicationOrigin },
    { Origin: fixture.config.applicationOrigin, 'X-CSRF-Token': 'invalid' },
  ]) {
    const response = await fixture.request('/api/v1/auth/logout', {
      method: 'POST',
      headers: { Cookie: header, ...headers },
    });
    const body = await response.json();
    assert.equal(response.status, 403);
    assert.equal(body.error.code, 'FORBIDDEN');
  }
});

test('login rate limiting returns the approved 429 error envelope', async (t) => {
  const fixture = await createHttpFixture(t, {
    loginRateLimit: { maxRequests: 2, windowMs: 60_000 },
  });
  await registerPatient(fixture);

  assert.equal((await loginPatient(fixture)).status, 200);
  assert.equal((await loginPatient(fixture)).status, 200);
  const limited = await loginPatient(fixture);
  const body = await limited.json();
  assert.equal(limited.status, 429);
  assert.equal(body.error.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
});

test('logout invalidates the session and expires its cookie', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const login = await loginPatient(fixture);
  const { header, token } = cookieFrom(login);
  const { token: csrfToken } = await getCsrf(fixture, header);

  const logout = await fixture.request('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: header,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': csrfToken,
    },
  });
  assert.equal(logout.status, 204);
  assert.equal(await logout.text(), '');
  assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);

  const tokenHash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
  assert.ok(fixture.database.prepare('SELECT invalidated_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash).invalidated_at);
  const protectedRead = await fixture.request('/api/v1/auth/session', {
    headers: { Cookie: header },
  });
  assert.equal(protectedRead.status, 401);
  assert.equal((await protectedRead.json()).error.code, 'AUTHENTICATION_REQUIRED');
});

test('expired sessions cannot restore a session or obtain a CSRF token', async (t) => {
  const fixture = await createHttpFixture(t, { sessionTtlSeconds: 2 });
  await registerPatient(fixture);
  const login = await loginPatient(fixture);
  const { header } = cookieFrom(login);

  fixture.setTime('2026-11-08T10:00:03.000Z');
  const session = await fixture.request('/api/v1/auth/session', { headers: { Cookie: header } });
  const csrf = await fixture.request('/api/v1/auth/csrf', { headers: { Cookie: header } });
  assert.equal(session.status, 401);
  assert.equal(csrf.status, 401);
});
