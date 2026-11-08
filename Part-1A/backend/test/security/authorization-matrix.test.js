import assert from 'node:assert/strict';
import test from 'node:test';
import { createCsrfToken } from '../../src/middleware/csrf.js';
import {
  createAccountSession,
  createHttpFixture,
} from '../helpers/http-fixture.js';

const protectedEndpoints = [
  ['GET', '/api/v1/auth/session'],
  ['GET', '/api/v1/auth/csrf'],
  ['POST', '/api/v1/auth/logout'],
  ['GET', '/api/v1/patients/1'],
  ['PATCH', '/api/v1/patients/1'],
  ['GET', '/api/v1/beneficiaries'],
  ['POST', '/api/v1/beneficiaries'],
  ['GET', '/api/v1/beneficiaries/1/authorization-status'],
  ['GET', '/api/v1/beneficiaries/1'],
  ['PATCH', '/api/v1/beneficiaries/1'],
  ['POST', '/api/v1/admin/beneficiaries/1/authorization-decision'],
  ['GET', '/api/v1/doctors'],
  ['POST', '/api/v1/doctors'],
  ['GET', '/api/v1/doctors/me'],
  ['PATCH', '/api/v1/doctors/me'],
  ['POST', '/api/v1/departments'],
  ['PATCH', '/api/v1/departments/1'],
  ['PUT', '/api/v1/departments/1/doctors'],
  ['GET', '/api/v1/doctors/1/availability'],
  ['POST', '/api/v1/doctors/1/availability'],
  ['PATCH', '/api/v1/doctors/1/availability/1'],
  ['DELETE', '/api/v1/doctors/1/availability/1'],
  ['POST', '/api/v1/appointments'],
  ['GET', '/api/v1/appointments'],
  ['GET', '/api/v1/appointments/1'],
  ['POST', '/api/v1/appointments/1/cancellation'],
  ['POST', '/api/v1/appointments/1/completion'],
  ['GET', '/api/v1/admin/dashboard'],
  ['GET', '/api/v1/admin/patients'],
  ['GET', '/api/v1/admin/appointments'],
];

const wrongRoleEndpoints = [
  ['DOCTOR', 'GET', '/api/v1/patients/1'],
  ['DOCTOR', 'PATCH', '/api/v1/patients/1'],
  ['DOCTOR', 'GET', '/api/v1/beneficiaries'],
  ['DOCTOR', 'POST', '/api/v1/beneficiaries'],
  ['DOCTOR', 'GET', '/api/v1/beneficiaries/1/authorization-status'],
  ['DOCTOR', 'GET', '/api/v1/beneficiaries/1'],
  ['DOCTOR', 'PATCH', '/api/v1/beneficiaries/1'],
  ['PATIENT', 'POST', '/api/v1/admin/beneficiaries/1/authorization-decision'],
  ['DOCTOR', 'GET', '/api/v1/doctors'],
  ['PATIENT', 'POST', '/api/v1/doctors'],
  ['PATIENT', 'GET', '/api/v1/doctors/me'],
  ['PATIENT', 'PATCH', '/api/v1/doctors/me'],
  ['PATIENT', 'POST', '/api/v1/departments'],
  ['PATIENT', 'PATCH', '/api/v1/departments/1'],
  ['PATIENT', 'PUT', '/api/v1/departments/1/doctors'],
  ['DOCTOR', 'POST', '/api/v1/appointments'],
  ['DOCTOR', 'POST', '/api/v1/appointments/1/cancellation'],
  ['PATIENT', 'POST', '/api/v1/appointments/1/completion'],
  ['DOCTOR', 'GET', '/api/v1/admin/dashboard'],
  ['DOCTOR', 'GET', '/api/v1/admin/patients'],
  ['DOCTOR', 'GET', '/api/v1/admin/appointments'],
];

function headersFor(fixture, session) {
  return {
    Cookie: session.cookie,
    Origin: fixture.config.applicationOrigin,
    'X-CSRF-Token': createCsrfToken(session.token),
  };
}

test('authorization matrix requires authentication on every protected API endpoint', async (t) => {
  const fixture = await createHttpFixture(t);

  for (const [method, path] of protectedEndpoints) {
    await t.test(`${method} ${path} returns 401 without a session`, async () => {
      const response = await fixture.request(path, {
        method,
        body: method === 'POST' || method === 'PATCH' || method === 'PUT' ? {} : undefined,
      });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, 'AUTHENTICATION_REQUIRED');
    });
  }
});

test('authorization matrix rejects roles not permitted for each role-protected API endpoint', async (t) => {
  const fixture = await createHttpFixture(t);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const doctor = createAccountSession(fixture, { role: 'DOCTOR' });
  const sessions = { PATIENT: patient, DOCTOR: doctor };

  for (const [role, method, path] of wrongRoleEndpoints) {
    await t.test(`${method} ${path} returns 403 for ${role}`, async () => {
      const session = sessions[role];
      const response = await fixture.request(path, {
        method,
        headers: headersFor(fixture, session),
        body: method === 'POST' || method === 'PATCH' || method === 'PUT' ? {} : undefined,
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'FORBIDDEN');
    });
  }

  const unpermittedStaff = createAccountSession(fixture, { role: 'STAFF' });
  for (const [method, path] of [
    ['GET', '/api/v1/appointments'],
    ['GET', '/api/v1/admin/appointments'],
  ]) {
    await t.test(`${method} ${path} returns 403 for staff without view permission`, async () => {
      const response = await fixture.request(path, {
        headers: { Cookie: unpermittedStaff.cookie },
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'FORBIDDEN');
    });
  }
});
