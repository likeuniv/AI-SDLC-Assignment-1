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
import { createTimeService } from '../../src/shared/time.js';

const ADULT = {
  fullName: 'Fictional Adult',
  dateOfBirth: '1990-02-14',
  relationship: 'sibling',
};
const MINOR = {
  fullName: 'Fictional Minor',
  dateOfBirth: '2012-02-14',
  relationship: 'child',
};

async function createOwnerSession(fixture, email = 'patient@example.test') {
  await registerPatient(fixture, { email });
  const login = await loginPatient(fixture, email);
  const { header, token } = cookieFrom(login);
  const csrf = await fixture.request('/api/v1/auth/csrf', { headers: { Cookie: header } });
  return {
    cookie: header,
    token,
    writeHeaders: {
      Cookie: header,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': (await csrf.json()).data.csrfToken,
    },
  };
}

async function createBeneficiary(fixture, session, profile = ADULT) {
  const response = await fixture.request('/api/v1/beneficiaries', {
    method: 'POST',
    headers: session.writeHeaders,
    body: profile,
  });
  assert.equal(response.status, 201);
  return (await response.json()).data;
}

async function decide(fixture, staff, beneficiaryId, outcome) {
  return fixture.request(`/api/v1/admin/beneficiaries/${beneficiaryId}/authorization-decision`, {
    method: 'POST',
    headers: {
      Cookie: staff.cookie,
      Origin: fixture.config.applicationOrigin,
      'X-CSRF-Token': createCsrfToken(staff.token),
    },
    body: {
      outcome,
      verificationMethod: 'PHONE',
      directConfirmation: true,
    },
  });
}

test('pending and rejected adult profiles return 422 while status remains available', async (t) => {
  const fixture = await createHttpFixture(t, {
    beneficiaryAuthorizationReviewerAccountIds: [900],
  });
  const owner = await createOwnerSession(fixture);
  const reviewer = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const pending = await createBeneficiary(fixture, owner);

  const pendingRead = await fixture.request(`/api/v1/beneficiaries/${pending.beneficiaryId}`, {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(pendingRead.status, 422);
  assert.equal((await pendingRead.json()).error.code, 'BENEFICIARY_NOT_AUTHORIZED');
  const pendingUpdate = await fixture.request(
    `/api/v1/beneficiaries/${pending.beneficiaryId}`,
    {
      method: 'PATCH',
      headers: owner.writeHeaders,
      body: { contactPhone: '+1 555 010 0400' },
    },
  );
  assert.equal(pendingUpdate.status, 422);
  assert.equal((await pendingUpdate.json()).error.code, 'BENEFICIARY_NOT_AUTHORIZED');

  const pendingStatus = await fixture.request(
    `/api/v1/beneficiaries/${pending.beneficiaryId}/authorization-status`,
    { headers: { Cookie: owner.cookie } },
  );
  const statusBody = (await pendingStatus.json()).data;
  assert.equal(pendingStatus.status, 200);
  assert.deepEqual(Object.keys(statusBody).sort(), ['authorizationStatus', 'beneficiaryId']);
  assert.equal(statusBody.authorizationStatus, 'PENDING_AUTHORIZATION');

  const rejected = await decide(fixture, reviewer, pending.beneficiaryId, 'REJECTED');
  assert.equal(rejected.status, 200);
  const rejectedRead = await fixture.request(`/api/v1/beneficiaries/${pending.beneficiaryId}`, {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(rejectedRead.status, 422);
  assert.equal((await rejectedRead.json()).error.code, 'BENEFICIARY_NOT_AUTHORIZED');

  const list = await fixture.request('/api/v1/beneficiaries', {
    headers: { Cookie: owner.cookie },
  });
  const [listed] = (await list.json()).data;
  assert.deepEqual(Object.keys(listed).sort(), ['authorizationStatus', 'beneficiaryId']);
  assert.equal(listed.authorizationStatus, 'REJECTED');
});

test('authorized owner and minor can access profiles; beneficiary has no login account', async (t) => {
  const fixture = await createHttpFixture(t, {
    beneficiaryAuthorizationReviewerAccountIds: [900],
  });
  const owner = await createOwnerSession(fixture);
  const reviewer = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const adult = await createBeneficiary(fixture, owner);
  const minor = await createBeneficiary(fixture, owner, MINOR);

  assert.equal((await decide(fixture, reviewer, adult.beneficiaryId, 'AUTHORIZED')).status, 200);
  const adultRead = await fixture.request(`/api/v1/beneficiaries/${adult.beneficiaryId}`, {
    headers: { Cookie: owner.cookie },
  });
  const adultProfile = (await adultRead.json()).data;
  assert.equal(adultRead.status, 200);
  assert.equal(adultProfile.fullName, ADULT.fullName);
  assert.equal(adultProfile.authorizationStatus, 'AUTHORIZED');

  const minorRead = await fixture.request(`/api/v1/beneficiaries/${minor.id}`, {
    headers: { Cookie: owner.cookie },
  });
  assert.equal(minorRead.status, 200);
  assert.equal((await minorRead.json()).data.fullName, MINOR.fullName);
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count,
    2,
  );
});

test('beneficiary access is isolated to the managing patient account', async (t) => {
  const fixture = await createHttpFixture(t);
  const firstOwner = await createOwnerSession(fixture);
  const secondOwner = await createOwnerSession(fixture, 'second@example.test');
  const minor = await createBeneficiary(fixture, firstOwner, MINOR);

  for (const response of [
    await fixture.request(`/api/v1/beneficiaries/${minor.id}`, {
      headers: { Cookie: secondOwner.cookie },
    }),
    await fixture.request(`/api/v1/beneficiaries/${minor.id}`, {
      method: 'PATCH',
      headers: secondOwner.writeHeaders,
      body: { fullName: 'Unauthorized Update' },
    }),
    await fixture.request(`/api/v1/beneficiaries/${minor.id}/authorization-status`, {
      headers: { Cookie: secondOwner.cookie },
    }),
  ]) {
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'RESOURCE_NOT_FOUND');
  }
});

test('staff without beneficiary review permission receives 403', async (t) => {
  const fixture = await createHttpFixture(t);
  const owner = await createOwnerSession(fixture);
  const beneficiary = await createBeneficiary(fixture, owner);
  const staff = createAccountSession(fixture, { accountId: 901, role: 'STAFF' });

  const response = await decide(fixture, staff, beneficiary.beneficiaryId, 'AUTHORIZED');
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'FORBIDDEN');
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM beneficiary_authorization_audit').get().count,
    0,
  );
});

test('adult eligibility changes on the hospital-local birthday boundary', () => {
  let instant = new Date('2026-11-08T04:59:00.000Z');
  const time = createTimeService({
    timeZone: 'America/New_York',
    now: () => instant,
  });
  assert.equal(time.hospitalLocalDate(), '2026-11-07');
  assert.equal(time.ageOnDate('2008-11-08'), 17);

  instant = new Date('2026-11-08T05:00:00.000Z');
  assert.equal(time.hospitalLocalDate(), '2026-11-08');
  assert.equal(time.ageOnDate('2008-11-08'), 18);
});

test('authorization audit history is retained after terminal-state retries', async (t) => {
  const fixture = await createHttpFixture(t, {
    beneficiaryAuthorizationReviewerAccountIds: [900],
  });
  const owner = await createOwnerSession(fixture);
  const reviewer = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const beneficiary = await createBeneficiary(fixture, owner);

  assert.equal((await decide(fixture, reviewer, beneficiary.beneficiaryId, 'AUTHORIZED')).status, 200);
  const before = fixture.database.prepare(`
    SELECT beneficiary_id, reviewer_account_id, verification_method, outcome, reviewed_at
    FROM beneficiary_authorization_audit WHERE beneficiary_id = ?
  `).get(beneficiary.beneficiaryId);
  const retry = await decide(fixture, reviewer, beneficiary.beneficiaryId, 'REJECTED');
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).error.code, 'BENEFICIARY_STATE_CONFLICT');
  assert.deepEqual(
    fixture.database.prepare(`
      SELECT beneficiary_id, reviewer_account_id, verification_method, outcome, reviewed_at
      FROM beneficiary_authorization_audit WHERE beneficiary_id = ?
    `).get(beneficiary.beneficiaryId),
    before,
  );
});
