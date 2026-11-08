import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import test from 'node:test';
import { createCsrfToken } from '../../src/middleware/csrf.js';
import {
  createAccountSession,
  createHttpFixture,
  registerPatient,
} from '../helpers/http-fixture.js';

function writeHeaders(fixture, session) {
  return {
    Cookie: session.cookie,
    Origin: fixture.config.applicationOrigin,
    'X-CSRF-Token': createCsrfToken(session.token),
  };
}

function seedDepartment(database) {
  const count = database.prepare('SELECT COUNT(*) AS count FROM departments').get().count;
  return database.prepare('INSERT INTO departments (name) VALUES (?)')
    .run(`Fictional Department ${count + 1}`).lastInsertRowid;
}

function seedSpecialization(database) {
  const count = database.prepare('SELECT COUNT(*) AS count FROM specializations').get().count;
  return database.prepare('INSERT INTO specializations (name) VALUES (?)')
    .run(`Fictional Specialty ${count + 1}`).lastInsertRowid;
}

function seedDiscoverableDoctor(fixture, {
  name,
  summary,
  specializations,
  departments,
}) {
  const accountCount = fixture.database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count;
  const accountId = fixture.database.prepare(`
    INSERT INTO accounts (full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, 'DOCTOR')
  `).run(
    name,
    `discovery-doctor-${accountCount + 1}@example.test`,
    `$2b$12$${'b'.repeat(53)}`,
  ).lastInsertRowid;
  fixture.database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name, professional_summary)
    VALUES (?, ?, ?)
  `).run(accountId, name, summary);
  for (const specializationId of specializations) {
    fixture.database.prepare(`
      INSERT INTO doctor_specializations (doctor_account_id, specialization_id)
      VALUES (?, ?)
    `).run(accountId, specializationId);
  }
  for (const departmentId of departments) {
    fixture.database.prepare(`
      INSERT INTO doctor_departments (doctor_account_id, department_id)
      VALUES (?, ?)
    `).run(accountId, departmentId);
  }
  return accountId;
}

async function provision(fixture, staff, overrides = {}) {
  const departmentId = overrides.departmentId ?? seedDepartment(fixture.database);
  const specializationId = overrides.specializationId ?? seedSpecialization(fixture.database);
  return fixture.request('/api/v1/doctors', {
    method: 'POST',
    headers: writeHeaders(fixture, staff),
    body: {
      email: 'doctor@example.test',
      password: 'secure-doctor-password',
      professionalName: 'Fictional Doctor',
      professionalSummary: 'Fictional professional description',
      departmentIds: [departmentId],
      specializationIds: [specializationId],
      ...overrides.body,
    },
  });
}

test('patient doctor discovery supports combined partial filters and stable bounded pagination', async (t) => {
  const fixture = await createHttpFixture(t);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const cardiology = fixture.database.prepare(
    'INSERT INTO specializations (name) VALUES (?)',
  ).run('Cardiology').lastInsertRowid;
  const neurology = fixture.database.prepare(
    'INSERT INTO specializations (name) VALUES (?)',
  ).run('Neurology').lastInsertRowid;
  const heartDepartment = fixture.database.prepare(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
  ).run('Heart Center', 'Fictional cardiac care').lastInsertRowid;
  const brainDepartment = fixture.database.prepare(
    'INSERT INTO departments (name, description) VALUES (?, ?)',
  ).run('Brain Center', 'Fictional neurological care').lastInsertRowid;
  seedDiscoverableDoctor(fixture, {
    name: 'Alice Adams',
    summary: 'Fictional cardiology profile',
    specializations: [cardiology],
    departments: [heartDepartment],
  });
  seedDiscoverableDoctor(fixture, {
    name: 'Alice Adams',
    summary: 'Fictional neurology profile',
    specializations: [neurology],
    departments: [brainDepartment],
  });
  seedDiscoverableDoctor(fixture, {
    name: 'Bob Brown',
    summary: 'Fictional cardiology profile',
    specializations: [cardiology],
    departments: [heartDepartment],
  });

  const headers = { Cookie: patient.cookie };
  const byName = await fixture.request('/api/v1/doctors?name=ALICE', { headers });
  assert.equal(byName.status, 200);
  assert.equal((await byName.json()).data.total, 2);

  const bySpecialization = await fixture.request(
    '/api/v1/doctors?specialization=cardio',
    { headers },
  );
  assert.equal(bySpecialization.status, 200);
  assert.equal((await bySpecialization.json()).data.total, 2);

  const combined = await fixture.request(
    '/api/v1/doctors?name=alice&specialization=cardio',
    { headers },
  );
  const combinedData = (await combined.json()).data;
  assert.equal(combined.status, 200);
  assert.equal(combinedData.total, 1);
  assert.equal(combinedData.items[0].professionalSummary, 'Fictional cardiology profile');

  const firstPage = await fixture.request('/api/v1/doctors?page=1&pageSize=1', { headers });
  const repeatedFirstPage = await fixture.request('/api/v1/doctors?page=1&pageSize=1', { headers });
  const secondPage = await fixture.request('/api/v1/doctors?page=2&pageSize=1', { headers });
  const firstPageData = (await firstPage.json()).data;
  const repeatedData = (await repeatedFirstPage.json()).data;
  const secondPageData = (await secondPage.json()).data;
  assert.deepEqual(firstPageData.items, repeatedData.items);
  assert.equal(firstPageData.total, 3);
  assert.equal(firstPageData.page, 1);
  assert.equal(firstPageData.pageSize, 1);
  assert.notEqual(firstPageData.items[0].id, secondPageData.items[0].id);

  const noMatches = await fixture.request('/api/v1/doctors?name=No%20Such%20Doctor', { headers });
  const noMatchesData = (await noMatches.json()).data;
  assert.equal(noMatches.status, 200);
  assert.deepEqual(noMatchesData.items, []);
  assert.equal(noMatchesData.total, 0);

  const discovered = firstPageData.items[0];
  assert.deepEqual(
    Object.keys(discovered).sort(),
    ['departments', 'id', 'professionalName', 'professionalSummary', 'specializations'],
  );
  assert.deepEqual(
    Object.keys(discovered.departments[0]).sort(),
    ['description', 'id', 'name'],
  );
  assert.deepEqual(
    Object.keys(discovered.specializations[0]).sort(),
    ['id', 'name'],
  );
  for (const privateField of [
    'email',
    'email_normalized',
    'password',
    'passwordHash',
    'password_hash',
    'role',
    'sessionToken',
    'token',
  ]) {
    assert.equal(JSON.stringify(firstPageData).includes(`"${privateField}"`), false);
  }
});

test('doctor discovery validates query shape and pagination bounds', async (t) => {
  const fixture = await createHttpFixture(t);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const headers = { Cookie: patient.cookie };
  for (const query of [
    '?name=Alice&name=Bob',
    '?page=1.5',
    '?unknown=value',
  ]) {
    const response = await fixture.request(`/api/v1/doctors${query}`, { headers });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
  }
  for (const query of ['?page=0', '?pageSize=51', `?name=${'a'.repeat(121)}`]) {
    const response = await fixture.request(`/api/v1/doctors${query}`, { headers });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
  }

  const unauthenticated = await fixture.request('/api/v1/doctors');
  assert.equal(unauthenticated.status, 401);
  const staff = createAccountSession(fixture, { role: 'STAFF' });
  const wrongRole = await fixture.request('/api/v1/doctors', {
    headers: { Cookie: staff.cookie },
  });
  assert.equal(wrongRole.status, 403);
});

test('staff provisions doctor account, profile and assignments without exposing credentials', async (t) => {
  const fixture = await createHttpFixture(t, { doctorManagerAccountIds: [901] });
  const staff = createAccountSession(fixture, { accountId: 901, role: 'STAFF' });
  const response = await provision(fixture, staff);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.data.professionalName, 'Fictional Doctor');
  assert.equal(body.data.specializations[0].name, 'Fictional Specialty 1');
  assert.equal(body.data.departments[0].name, 'Fictional Department 1');
  for (const field of ['email', 'password', 'passwordHash', 'role', 'token']) {
    assert.equal(Object.hasOwn(body.data, field), false);
  }
  const account = fixture.database.prepare(`
    SELECT email_normalized, password_hash, role
    FROM accounts WHERE id = ?
  `).get(body.data.accountId);
  assert.equal(account.email_normalized, 'doctor@example.test');
  assert.equal(account.role, 'DOCTOR');
  assert.equal(
    await bcrypt.compare('secure-doctor-password', account.password_hash),
    true,
  );
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM patient_profiles').get().count,
    0,
  );
});

test('doctor provisioning rejects invalid fields, duplicate email and missing assignments atomically', async (t) => {
  const fixture = await createHttpFixture(t, { doctorManagerAccountIds: [901] });
  const staff = createAccountSession(fixture, { accountId: 901, role: 'STAFF' });
  const invalid = await provision(fixture, staff, {
    body: { professionalName: '' },
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_FAILED');
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1);

  for (const [email, body] of [
    ['bad-email@example.test', { email: 'not-an-email' }],
    ['short-password@example.test', { password: 'short' }],
    ['bad-summary@example.test', { professionalSummary: '' }],
    ['no-departments@example.test', { departmentIds: [] }],
    ['no-specialties@example.test', { specializationIds: [] }],
  ]) {
    const invalidFields = await provision(fixture, staff, {
      body: { email, ...body },
    });
    assert.equal(invalidFields.status, 422);
    assert.equal((await invalidFields.json()).error.code, 'VALIDATION_FAILED');
  }
  const malformed = await fixture.request('/api/v1/doctors', {
    method: 'POST',
    headers: writeHeaders(fixture, staff),
    body: '{"email":',
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_REQUEST');

  const missing = await provision(fixture, staff, {
    departmentId: 99999,
    body: { email: 'missing@example.test' },
  });
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, 'RESOURCE_NOT_FOUND');
  const missingSpecialization = await provision(fixture, staff, {
    body: {
      email: 'missing-specialization@example.test',
      specializationIds: [99999],
    },
  });
  assert.equal(missingSpecialization.status, 404);
  assert.equal((await missingSpecialization.json()).error.code, 'RESOURCE_NOT_FOUND');
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1);
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM doctor_profiles').get().count, 0);

  const created = await provision(fixture, staff, {
    body: { email: 'duplicate@example.test' },
  });
  assert.equal(created.status, 201);
  const duplicate = await provision(fixture, staff, {
    body: { email: 'DUPLICATE@example.test' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).error.code, 'DUPLICATE_RESOURCE');
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM doctor_profiles').get().count, 1);

  const duplicateAssignment = await provision(fixture, staff, {
    body: {
      email: 'duplicate-assignment@example.test',
      departmentIds: [1, 1],
    },
  });
  assert.equal(duplicateAssignment.status, 409);
  assert.equal(
    (await duplicateAssignment.json()).error.code,
    'DUPLICATE_RESOURCE',
  );
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM doctor_profiles').get().count, 1);
});

test('patients, doctors and unpermitted staff cannot provision doctors', async (t) => {
  const fixture = await createHttpFixture(t);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const doctor = createAccountSession(fixture, { role: 'DOCTOR' });
  const staff = createAccountSession(fixture, { role: 'STAFF' });
  const departmentId = seedDepartment(fixture.database);
  const specializationId = seedSpecialization(fixture.database);
  const body = {
    email: 'blocked@example.test',
    password: 'secure-doctor-password',
    professionalName: 'Blocked Doctor',
    departmentIds: [departmentId],
    specializationIds: [specializationId],
  };
  for (const session of [patient, doctor, staff]) {
    const response = await fixture.request('/api/v1/doctors', {
      method: 'POST',
      headers: writeHeaders(fixture, session),
      body,
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'FORBIDDEN');
  }
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM doctor_profiles').get().count, 0);
});

test('doctor can update only own permitted summary; private account fields and assignments stay protected', async (t) => {
  const fixture = await createHttpFixture(t, { doctorManagerAccountIds: [901] });
  const staff = createAccountSession(fixture, { accountId: 901, role: 'STAFF' });
  const provisioned = await provision(fixture, staff);
  const doctorId = (await provisioned.json()).data.accountId;
  const doctor = createAccountSession(fixture, { accountId: doctorId, role: 'DOCTOR' });

  const read = await fixture.request('/api/v1/doctors/me', {
    headers: { Cookie: doctor.cookie },
  });
  const ownProfile = (await read.json()).data;
  assert.equal(read.status, 200);
  assert.equal(ownProfile.accountId, doctorId);
  for (const field of ['email', 'password', 'passwordHash', 'role']) {
    assert.equal(Object.hasOwn(ownProfile, field), false);
  }

  const updated = await fixture.request('/api/v1/doctors/me', {
    method: 'PATCH',
    headers: writeHeaders(fixture, doctor),
    body: { professionalSummary: 'Updated public professional summary' },
  });
  assert.equal(updated.status, 200);
  assert.equal(
    (await updated.json()).data.professionalSummary,
    'Updated public professional summary',
  );
  const cleared = await fixture.request('/api/v1/doctors/me', {
    method: 'PATCH',
    headers: writeHeaders(fixture, doctor),
    body: { professionalSummary: null },
  });
  assert.equal(cleared.status, 200);
  assert.equal((await cleared.json()).data.professionalSummary, null);

  for (const body of [
    { professionalName: 'Changed Name' },
    { email: 'changed@example.test' },
    { departmentIds: [] },
    { specializationIds: [] },
    { role: 'STAFF' },
  ]) {
    const forbidden = await fixture.request('/api/v1/doctors/me', {
      method: 'PATCH',
      headers: writeHeaders(fixture, doctor),
      body,
    });
    assert.equal(forbidden.status, 403);
    assert.equal((await forbidden.json()).error.code, 'FORBIDDEN');
  }
  const invalidSummary = await fixture.request('/api/v1/doctors/me', {
    method: 'PATCH',
    headers: writeHeaders(fixture, doctor),
    body: { professionalSummary: '' },
  });
  assert.equal(invalidSummary.status, 422);
  assert.equal((await invalidSummary.json()).error.code, 'VALIDATION_FAILED');
  assert.equal(
    fixture.database.prepare('SELECT role FROM accounts WHERE id = ?').get(doctorId).role,
    'DOCTOR',
  );
  assert.equal(
    fixture.database.prepare(`
      SELECT professional_name FROM doctor_profiles WHERE account_id = ?
    `).get(doctorId).professional_name,
    'Fictional Doctor',
  );
});

test('authenticated doctor self-profile route does not authorize another role', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const patient = createAccountSession(fixture, { accountId: 1, role: 'PATIENT' });
  const response = await fixture.request('/api/v1/doctors/me', {
    headers: { Cookie: patient.cookie },
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');
});
