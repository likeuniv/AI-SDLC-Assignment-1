import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import express from 'express';
import test from 'node:test';
import { createHttpFixture, registerPatient } from '../helpers/http-fixture.js';
import { createErrorHandler } from '../../src/middleware/error-handler.js';
import { requestContext } from '../../src/middleware/request-context.js';
import { serviceUnavailable } from '../../src/shared/errors.js';
import { sendSuccess } from '../../src/shared/responses.js';

test('maps malformed structure to 400 and validly structured field errors to 422', async (t) => {
  const fixture = await createHttpFixture(t);
  const malformed = await fixture.request('/api/v1/auth/register', {
    method: 'POST',
    body: '{"fullName":',
  });
  const malformedBody = await malformed.json();
  assert.equal(malformed.status, 400);
  assert.equal(malformedBody.error.code, 'INVALID_REQUEST');

  const invalidFields = await fixture.request('/api/v1/auth/register', {
    method: 'POST',
    body: { fullName: '', email: 'not-an-email', password: 'short' },
  });
  const invalidBody = await invalidFields.json();
  assert.equal(invalidFields.status, 422);
  assert.equal(invalidBody.error.code, 'VALIDATION_FAILED');
  assert.ok(invalidBody.error.details.length >= 1);
});

test('returns stable duplicate, unauthorized and privacy-safe not-found errors', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const duplicate = await registerPatient(fixture);
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'DUPLICATE_RESOURCE');

  const unauthorized = await fixture.request('/api/v1/auth/csrf');
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error.code, 'AUTHENTICATION_REQUIRED');

  const missing = await fixture.request('/api/v1/unknown-resource/secret-id');
  const missingBody = await missing.json();
  assert.equal(missing.status, 404);
  assert.equal(missingBody.error.code, 'RESOURCE_NOT_FOUND');
  assert.equal(missingBody.message, 'This information is unavailable.');
  assert.equal(JSON.stringify(missingBody).includes('secret-id'), false);
});

test('204 success has no body and body-bearing success uses the approved envelope', async (t) => {
  const fixture = await createHttpFixture(t);
  const registration = await registerPatient(fixture);
  const registrationBody = await registration.json();
  assert.deepEqual(Object.keys(registrationBody).sort(), ['data', 'message', 'success']);

  const login = await fixture.request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'patient@example.test', password: 'secure-fictional-password' },
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const csrf = await fixture.request('/api/v1/auth/csrf', { headers: { Cookie: cookie } });
  const token = (await csrf.json()).data.csrfToken;
  const logout = await fixture.request('/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': token,
    },
  });
  assert.equal(logout.status, 204);
  assert.equal(await logout.text(), '');
});

test('role denial is 403 and cannot be bypassed with client-supplied role', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const login = await fixture.request('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'patient@example.test', password: 'secure-fictional-password' },
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];

  const app = express();
  app.use(requestContext);
  const { createAuthenticationMiddleware, requireAuthenticated, requireRoles } = await import(
    '../../src/middleware/authentication.js'
  );
  app.use(createAuthenticationMiddleware(fixture.database, fixture.config));
  app.get('/staff-only', requireAuthenticated, requireRoles('STAFF'), (request, response) => {
    sendSuccess(response, 200, 'Allowed.', { role: request.auth.role });
  });
  app.use(createErrorHandler(fixture.logger));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/staff-only?role=STAFF`, {
    headers: { Cookie: cookie, 'X-Role': 'STAFF' },
  });
  const body = await response.json();
  assert.equal(response.status, 403);
  assert.equal(body.error.code, 'FORBIDDEN');
});

test('unexpected errors return generic 500 and logs omit exception details', async (t) => {
  const logEntries = [];
  const app = express();
  app.use(requestContext);
  app.get('/unavailable', (request, response, next) => {
    next(serviceUnavailable());
  });
  app.get('/failure', (request, response, next) => {
    next(new Error('SQLITE failure; password=secret; patient=private'));
  });
  app.use(createErrorHandler({ error: (entry) => logEntries.push(entry) }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  });

  const response = await fetch(`http://127.0.0.1:${server.address().port}/failure`);
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.error.code, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(body).includes('SQLITE'), false);
  assert.equal(JSON.stringify(logEntries).includes('password=secret'), false);
  assert.equal(JSON.stringify(logEntries).includes('patient=private'), false);
  assert.deepEqual(Object.keys(logEntries[0]).sort(), [
    'code',
    'event',
    'method',
    'path',
    'requestId',
    'status',
  ]);

  const unavailable = await fetch(`http://127.0.0.1:${server.address().port}/unavailable`);
  const unavailableBody = await unavailable.json();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailableBody.error.code, 'SERVICE_UNAVAILABLE');
  assert.equal(unavailableBody.success, false);
});

test('central response helper emits the standard 204 response', (t) => {
  const app = express();
  app.get('/empty', (request, response) => sendSuccess(response, 204, '', undefined));
  const server = createServer(app);
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  });
  server.listen(0, '127.0.0.1');

  return new Promise((resolve, reject) => {
    server.once('listening', async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${server.address().port}/empty`);
        assert.equal(response.status, 204);
        assert.equal(await response.text(), '');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
});
