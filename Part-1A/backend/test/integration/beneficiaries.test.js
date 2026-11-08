import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cookieFrom,
  createAccountSession,
  createHttpFixture,
  loginPatient,
  registerPatient,
} from '../helpers/http-fixture.js';
import { createCsrfToken } from '../../src/middleware/csrf.js';
import { createBeneficiaryService } from '../../src/modules/beneficiaries/service.js';

const MINOR = {
  fullName: 'Fictional Minor',
  dateOfBirth: '2012-02-14',
  relationship: 'child',
};
const ADULT = {
  fullName: 'Fictional Adult',
  dateOfBirth: '1990-02-14',
  relationship: 'sibling',
};

async function patientSession(fixture) {
  await registerPatient(fixture);
  const login = await loginPatient(fixture);
  const { header, token } = cookieFrom(login);
  const csrfResponse = await fixture.request('/api/v1/auth/csrf', {
    headers: { Cookie: header },
  });
  const csrfToken = (await csrfResponse.json()).data.csrfToken;
  return {
    cookie: header,
    writeHeaders: {
      Cookie: header,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': csrfToken,
    },
    token,
  };
}

async function createBeneficiary(fixture, headers, body) {
  return fixture.request('/api/v1/beneficiaries', {
    method: 'POST',
    headers,
    body,
  });
}

async function review(fixture, session, id, outcome, verificationMethod = 'PHONE') {
  return fixture.request(`/api/v1/admin/beneficiaries/${id}/authorization-decision`, {
    method: 'POST',
    headers: {
      Cookie: session.cookie,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': createCsrfToken(session.token),
    },
    body: { outcome, verificationMethod, directConfirmation: true },
  });
}

test('beneficiary service creates minor and pending adult records and validates input', async (t) => {
  const fixture = await createHttpFixture(t);
  await registerPatient(fixture);
  const service = createBeneficiaryService(fixture.database, fixture.config);

  const minor = service.create(1, MINOR);
  assert.equal(minor.fullName, MINOR.fullName);
  assert.equal(minor.authorizationStatus, null);

  const adult = service.create(1, ADULT);
  assert.deepEqual(Object.keys(adult).sort(), ['authorizationStatus', 'beneficiaryId']);
  assert.equal(adult.authorizationStatus, 'PENDING_AUTHORIZATION');

  assert.throws(
    () => service.create(1, undefined),
    (error) => error.status === 400 && error.code === 'INVALID_REQUEST',
  );
  assert.throws(
    () => service.create(1, { ...MINOR, relationship: 'cousin' }),
    (error) => error.status === 422 && error.code === 'VALIDATION_FAILED',
  );
});

test('beneficiary HTTP endpoints create, list, read and update owner records', async (t) => {
  const fixture = await createHttpFixture(t);
  const session = await patientSession(fixture);
  const created = await createBeneficiary(fixture, session.writeHeaders, {
    ...MINOR,
    relationship: 'other',
    relationshipDescription: 'Fictional family relation',
    gender: 'Self-described',
    contactEmail: 'relative@example.test',
    contactPhone: '+1 555 010 0200',
  });
  assert.equal(created.status, 201);
  const profile = (await created.json()).data;
  assert.equal(profile.relationshipDescription, 'Fictional family relation');
  assert.equal(profile.gender, 'Self-described');
  assert.equal(profile.contactEmail, 'relative@example.test');
  assert.equal(profile.authorizationStatus, null);

  const listed = await fixture.request('/api/v1/beneficiaries', {
    headers: { Cookie: session.cookie },
  });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).data.length, 1);

  const updated = await fixture.request(`/api/v1/beneficiaries/${profile.id}`, {
    method: 'PATCH',
    headers: session.writeHeaders,
    body: { contactPhone: '+1 555 010 0300', relationship: 'parent' },
  });
  assert.equal(updated.status, 200);
  const updatedProfile = (await updated.json()).data;
  assert.equal(updatedProfile.contactPhone, '+1 555 010 0300');
  assert.equal(updatedProfile.relationship, 'parent');

  const read = await fixture.request(`/api/v1/beneficiaries/${profile.id}`, {
    headers: { Cookie: session.cookie },
  });
  assert.equal(read.status, 200);
  assert.equal((await read.json()).data.id, profile.id);
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count,
    1,
  );
});

test('adult creation discloses only pending status and invalid input makes no changes', async (t) => {
  const fixture = await createHttpFixture(t);
  const session = await patientSession(fixture);
  const adult = await createBeneficiary(fixture, session.writeHeaders, ADULT);
  const adultBody = await adult.json();
  assert.equal(adult.status, 201);
  assert.deepEqual(adultBody.data, {
    beneficiaryId: 1,
    authorizationStatus: 'PENDING_AUTHORIZATION',
  });
  const stored = fixture.database.prepare(
    'SELECT authorization_status FROM beneficiaries WHERE id = ?',
  ).get(1);
  assert.equal(stored.authorization_status, 'PENDING_AUTHORIZATION');

  const malformed = await createBeneficiary(fixture, session.writeHeaders, '{"fullName":');
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_REQUEST');

  const invalid = await createBeneficiary(fixture, session.writeHeaders, {
    ...MINOR,
    relationship: 'other',
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error.code, 'VALIDATION_FAILED');
  const futureBirth = await createBeneficiary(fixture, session.writeHeaders, {
    ...MINOR,
    dateOfBirth: '2027-01-01',
  });
  assert.equal(futureBirth.status, 422);
  assert.equal((await futureBirth.json()).error.code, 'VALIDATION_FAILED');
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM beneficiaries').get().count,
    1,
  );

  const protectedChange = await fixture.request('/api/v1/beneficiaries/1', {
    method: 'PATCH',
    headers: session.writeHeaders,
    body: { authorizationStatus: 'AUTHORIZED' },
  });
  assert.equal(protectedChange.status, 403);
  assert.equal((await protectedChange.json()).error.code, 'FORBIDDEN');
});

test('authorization decisions record both outcomes and reject terminal-state retries', async (t) => {
  const fixture = await createHttpFixture(t, {
    beneficiaryAuthorizationReviewerAccountIds: [900],
  });
  const owner = await patientSession(fixture);
  const reviewer = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const first = await createBeneficiary(fixture, owner.writeHeaders, ADULT);
  const second = await createBeneficiary(fixture, owner.writeHeaders, {
    ...ADULT,
    fullName: 'Another Fictional Adult',
  });
  const firstId = (await first.json()).data.beneficiaryId;
  const secondId = (await second.json()).data.beneficiaryId;

  const authorized = await review(fixture, reviewer, firstId, 'AUTHORIZED', 'IN_PERSON');
  assert.equal(authorized.status, 200);
  assert.equal((await authorized.json()).data.authorizationStatus, 'AUTHORIZED');
  const rejected = await review(fixture, reviewer, secondId, 'REJECTED', 'PHONE');
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).data.authorizationStatus, 'REJECTED');

  for (const [id, outcome] of [[firstId, 'REJECTED'], [secondId, 'AUTHORIZED']]) {
    const conflict = await review(fixture, reviewer, id, outcome);
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, 'BENEFICIARY_STATE_CONFLICT');
  }
  const audit = fixture.database.prepare(`
    SELECT beneficiary_id, reviewer_account_id, verification_method, outcome, reviewed_at
    FROM beneficiary_authorization_audit ORDER BY beneficiary_id
  `).all();
  assert.equal(audit.length, 2);
  assert.deepEqual(audit.map(({ outcome }) => outcome), ['AUTHORIZED', 'REJECTED']);
  assert.deepEqual(audit.map(({ verification_method }) => verification_method), ['IN_PERSON', 'PHONE']);
  assert.ok(audit.every(({ reviewer_account_id }) => reviewer_account_id === 900));
  assert.ok(audit.every(({ reviewed_at }) => /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(reviewed_at)));

  const missingConfirmation = await fixture.request(
    `/api/v1/admin/beneficiaries/${firstId}/authorization-decision`,
    {
      method: 'POST',
      headers: {
        Cookie: reviewer.cookie,
        Origin: fixture.config.applicationOrigin,
        'X-CSRF-Token': createCsrfToken(reviewer.token),
      },
      body: { outcome: 'AUTHORIZED', verificationMethod: 'PHONE' },
    },
  );
  assert.equal(missingConfirmation.status, 422);
  assert.equal((await missingConfirmation.json()).error.code, 'VALIDATION_FAILED');
});

test('authorization state and audit history roll back together on audit insertion failure', async (t) => {
  const fixture = await createHttpFixture(t, {
    beneficiaryAuthorizationReviewerAccountIds: [900],
  });
  const owner = await patientSession(fixture);
  const reviewer = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const created = await createBeneficiary(fixture, owner.writeHeaders, ADULT);
  const beneficiaryId = (await created.json()).data.beneficiaryId;

  fixture.database.exec(`
    CREATE TRIGGER test_reject_authorization_audit
    BEFORE INSERT ON beneficiary_authorization_audit
    BEGIN
      SELECT RAISE(ABORT, 'test audit insert failure');
    END;
  `);
  const failedDecision = await review(
    fixture,
    reviewer,
    beneficiaryId,
    'AUTHORIZED',
  );
  assert.equal(failedDecision.status, 500);
  assert.equal(
    fixture.database.prepare(
      'SELECT authorization_status FROM beneficiaries WHERE id = ?',
    ).get(beneficiaryId).authorization_status,
    'PENDING_AUTHORIZATION',
  );
  assert.equal(
    fixture.database.prepare(`
      SELECT COUNT(*) AS count
      FROM beneficiary_authorization_audit
      WHERE beneficiary_id = ?
    `).get(beneficiaryId).count,
    0,
  );
});
