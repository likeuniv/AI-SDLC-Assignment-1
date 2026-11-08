import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cookieFrom,
  createHttpFixture,
  loginPatient,
  registerPatient,
} from '../helpers/http-fixture.js';

async function patientSession(fixture) {
  await registerPatient(fixture);
  const { header, token } = cookieFrom(await loginPatient(fixture));
  const csrfResponse = await fixture.request('/api/v1/auth/csrf', {
    headers: { Cookie: header },
  });
  return {
    cookie: header,
    writeHeaders: {
      Cookie: header,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': (await csrfResponse.json()).data.csrfToken,
    },
    token,
  };
}

async function requestProfile(fixture, accountId, session, options = {}) {
  return fixture.request(`/api/v1/patients/${accountId}`, {
    ...options,
    headers: {
      ...(options.method === 'PATCH' ? session.writeHeaders : { Cookie: session.cookie }),
      ...options.headers,
    },
  });
}

test('patient can read and update only permitted fields on their profile', async (t) => {
  const fixture = await createHttpFixture(t);
  const session = await patientSession(fixture);
  const initial = await requestProfile(fixture, 1, session);
  assert.equal(initial.status, 200);
  const initialProfile = (await initial.json()).data;
  assert.equal(initialProfile.accountId, 1);
  assert.equal(initialProfile.fullName, 'Fictional Patient');
  assert.equal(initialProfile.email, 'patient@example.test');
  assert.equal(initialProfile.dateOfBirth, null);

  const updated = await requestProfile(fixture, 1, session, {
    method: 'PATCH',
    body: {
      dateOfBirth: '1990-04-15',
      gender: 'Self-described',
      contactEmail: 'PATIENT-CONTACT@example.test',
      contactPhone: '+1 (555) 010-0200',
    },
  });
  const updatedBody = await updated.json();
  assert.equal(updated.status, 200);
  assert.equal(updatedBody.data.dateOfBirth, '1990-04-15');
  assert.equal(updatedBody.data.gender, 'Self-described');
  assert.equal(updatedBody.data.contactEmail, 'patient-contact@example.test');
  assert.equal(updatedBody.data.contactPhone, '+1 (555) 010-0200');
  assert.equal(updatedBody.data.fullName, 'Fictional Patient');

  for (const body of [
    { role: 'STAFF' },
    { fullName: 'Changed Identity' },
    { accountId: 99 },
  ]) {
    const protectedChange = await requestProfile(fixture, 1, session, {
      method: 'PATCH',
      body,
    });
    assert.equal(protectedChange.status, 403);
    assert.equal((await protectedChange.json()).error.code, 'FORBIDDEN');
  }
  assert.equal(
    fixture.database.prepare('SELECT role FROM accounts WHERE id = 1').get().role,
    'PATIENT',
  );
});

test('profile read and update conceal cross-account access and validate fields', async (t) => {
  const fixture = await createHttpFixture(t);
  const session = await patientSession(fixture);
  await registerPatient(fixture, { email: 'another-patient@example.test' });

  for (const response of [
    await requestProfile(fixture, 2, session),
    await requestProfile(fixture, 2, session, {
      method: 'PATCH',
      body: { gender: 'Changed' },
    }),
  ]) {
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'RESOURCE_NOT_FOUND');
  }

  const invalidDate = await requestProfile(fixture, 1, session, {
    method: 'PATCH',
    body: { dateOfBirth: '2026-11-09' },
  });
  assert.equal(invalidDate.status, 422);
  assert.equal((await invalidDate.json()).error.code, 'VALIDATION_FAILED');

  const invalidStructure = await requestProfile(fixture, 1, session, {
    method: 'PATCH',
    body: '{"gender":',
  });
  assert.equal(invalidStructure.status, 400);
  assert.equal((await invalidStructure.json()).error.code, 'INVALID_REQUEST');
});
