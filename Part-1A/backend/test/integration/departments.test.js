import assert from 'node:assert/strict';
import test from 'node:test';
import { createCsrfToken } from '../../src/middleware/csrf.js';
import { createDepartmentService } from '../../src/modules/departments/service.js';
import {
  cookieFrom,
  createAccountSession,
  createHttpFixture,
  loginPatient,
  registerPatient,
} from '../helpers/http-fixture.js';

function writeHeaders(fixture, session) {
  return {
    Cookie: session.cookie,
    Origin: fixture.config.applicationOrigin,
    'X-CSRF-Token': createCsrfToken(session.token),
  };
}

async function createAuthorizedFixture(t) {
  const fixture = await createHttpFixture(t, {
    departmentManagerAccountIds: [900],
  });
  const staff = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  return { fixture, staff };
}

async function createDoctor(fixture, departmentIds, {
  accountId,
  professionalName = 'Fictional Doctor',
} = {}) {
  const specializationId = fixture.database.prepare(
    'INSERT INTO specializations (name) VALUES (?)',
  ).run(`Specialty ${accountId ?? 1}`).lastInsertRowid;
  const doctorAccountId = fixture.database.prepare(`
    INSERT INTO accounts (id, full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, ?, 'DOCTOR')
  `).run(
    accountId ?? null,
    professionalName,
    `doctor-${accountId ?? 1}@example.test`,
    `$2b$12$${'a'.repeat(53)}`,
  ).lastInsertRowid;
  fixture.database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name)
    VALUES (?, ?)
  `).run(doctorAccountId, professionalName);
  for (const departmentId of departmentIds) {
    fixture.database.prepare(`
      INSERT INTO doctor_departments (doctor_account_id, department_id)
      VALUES (?, ?)
    `).run(doctorAccountId, departmentId);
  }
  fixture.database.prepare(`
    INSERT INTO doctor_specializations (doctor_account_id, specialization_id)
    VALUES (?, ?)
  `).run(doctorAccountId, specializationId);
  return doctorAccountId;
}

test('department service validates fields and reports duplicate names', async (t) => {
  const { fixture, staff } = await createAuthorizedFixture(t);
  const service = createDepartmentService(fixture.database, fixture.config);
  const created = service.create(staff, { name: 'Cardiology', description: 'Heart care' });
  assert.equal(created.name, 'Cardiology');
  assert.equal(created.description, 'Heart care');

  assert.throws(
    () => service.create(staff, { name: '  ' }),
    (error) => error.status === 422 && error.code === 'VALIDATION_FAILED',
  );
  assert.throws(
    () => service.create(staff, { name: 'cardiology' }),
    (error) => error.status === 409 && error.code === 'DUPLICATE_RESOURCE',
  );
});

test('department HTTP supports create, view, update and duplicate conflict', async (t) => {
  const { fixture, staff } = await createAuthorizedFixture(t);
  const headers = writeHeaders(fixture, staff);
  const created = await fixture.request('/api/v1/departments', {
    method: 'POST',
    headers,
    body: { name: 'Neurology', description: 'Brain and nerve care' },
  });
  assert.equal(created.status, 201);
  const department = (await created.json()).data;

  const duplicate = await fixture.request('/api/v1/departments', {
    method: 'POST',
    headers,
    body: { name: 'neurology' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'DUPLICATE_RESOURCE');

  const listed = await fixture.request('/api/v1/departments');
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).data.length, 1);
  const updated = await fixture.request(`/api/v1/departments/${department.id}`, {
    method: 'PATCH',
    headers,
    body: { description: 'Updated fictional description' },
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).data.description, 'Updated fictional description');
  const read = await fixture.request(`/api/v1/departments/${department.id}`);
  assert.equal((await read.json()).data.name, 'Neurology');
});

test('department association replacement is atomic and preserves required relationships', async (t) => {
  const { fixture, staff } = await createAuthorizedFixture(t);
  const headers = writeHeaders(fixture, staff);
  const firstDepartment = await fixture.request('/api/v1/departments', {
    method: 'POST',
    headers,
    body: { name: 'Department One' },
  });
  const secondDepartment = await fixture.request('/api/v1/departments', {
    method: 'POST',
    headers,
    body: { name: 'Department Two' },
  });
  const firstId = (await firstDepartment.json()).data.id;
  const secondId = (await secondDepartment.json()).data.id;
  const duplicateUpdate = await fixture.request(`/api/v1/departments/${secondId}`, {
    method: 'PATCH',
    headers,
    body: { name: 'Department One' },
  });
  assert.equal(duplicateUpdate.status, 409);
  assert.equal((await duplicateUpdate.json()).error.code, 'DUPLICATE_RESOURCE');
  assert.equal(
    fixture.database.prepare('SELECT name FROM departments WHERE id = ?').get(secondId).name,
    'Department Two',
  );
  const doctorId = await createDoctor(fixture, [firstId]);
  const secondDoctorId = await createDoctor(fixture, [firstId], {
    accountId: 8500,
    professionalName: 'Another Fictional Doctor',
  });

  const assigned = await fixture.request(`/api/v1/departments/${secondId}/doctors`, {
    method: 'PUT',
    headers,
    body: { doctorAccountIds: [doctorId] },
  });
  assert.equal(assigned.status, 200);
  const assignedDoctor = (await assigned.json()).data.doctors[0];
  assert.equal(assignedDoctor.accountId, doctorId);
  assert.deepEqual(
    Object.keys(assignedDoctor).sort(),
    ['accountId', 'professionalName', 'professionalSummary'],
  );

  const before = fixture.database.prepare(`
    SELECT department_id FROM doctor_departments
    WHERE doctor_account_id = ? ORDER BY department_id
  `).all(doctorId).map(({ department_id }) => department_id);
  const missingDoctor = await fixture.request(`/api/v1/departments/${secondId}/doctors`, {
    method: 'PUT',
    headers,
    body: { doctorAccountIds: [99999] },
  });
  assert.equal(missingDoctor.status, 404);
  assert.deepEqual(
    fixture.database.prepare(`
      SELECT department_id FROM doctor_departments
      WHERE doctor_account_id = ? ORDER BY department_id
    `).all(doctorId).map(({ department_id }) => department_id),
    before,
  );
  const missingDepartment = await fixture.request('/api/v1/departments/99999/doctors', {
    method: 'PUT',
    headers,
    body: { doctorAccountIds: [doctorId] },
  });
  assert.equal(missingDepartment.status, 404);
  assert.deepEqual(
    fixture.database.prepare(`
      SELECT department_id FROM doctor_departments
      WHERE doctor_account_id = ? ORDER BY department_id
    `).all(doctorId).map(({ department_id }) => department_id),
    before,
  );

  const duplicate = await fixture.request(`/api/v1/departments/${secondId}/doctors`, {
    method: 'PUT',
    headers,
    body: { doctorAccountIds: [doctorId, doctorId] },
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'DUPLICATE_RESOURCE');

  const required = await fixture.request(`/api/v1/departments/${firstId}/doctors`, {
    method: 'PUT',
    headers,
    body: { doctorAccountIds: [] },
  });
  assert.equal(required.status, 409);
  assert.equal((await required.json()).error.code, 'RESOURCE_IN_USE');
  assert.equal(
    fixture.database.prepare(`
      SELECT COUNT(*) AS count FROM doctor_departments WHERE doctor_account_id = ?
    `).get(doctorId).count,
    2,
  );
  assert.equal(
    fixture.database.prepare(`
      SELECT COUNT(*) AS count FROM doctor_departments WHERE doctor_account_id = ?
    `).get(secondDoctorId).count,
    1,
  );
});

test('patient, doctor and unpermitted staff cannot administer departments', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const patient = cookieFrom(await loginPatient(fixture));
  const doctor = createAccountSession(fixture, { role: 'DOCTOR' });
  const staff = createAccountSession(fixture, { role: 'STAFF' });
  const callers = [patient.header, doctor.cookie, staff.cookie];

  for (const cookie of callers) {
    const response = await fixture.request('/api/v1/departments', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: fixture.config.applicationOrigin,
        'X-CSRF-Token': createCsrfToken(cookie.split('=')[1]),
      },
      body: { name: 'Blocked Department' },
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'FORBIDDEN');
  }
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM departments').get().count,
    0,
  );
});

test('department association route requires authentication and validates body fields', async (t) => {
  const { fixture, staff } = await createAuthorizedFixture(t);
  const created = await fixture.request('/api/v1/departments', {
    method: 'POST',
    headers: writeHeaders(fixture, staff),
    body: { name: 'Secure Department' },
  });
  const departmentId = (await created.json()).data.id;

  const unauthenticated = await fixture.request(`/api/v1/departments/${departmentId}/doctors`, {
    method: 'PUT',
    body: { doctorAccountIds: [] },
  });
  assert.equal(unauthenticated.status, 401);

  const invalid = await fixture.request(`/api/v1/departments/${departmentId}/doctors`, {
    method: 'PUT',
    headers: writeHeaders(fixture, staff),
    body: { doctorAccountIds: ['bad'] },
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_FAILED');
});
