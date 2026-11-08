import assert from 'node:assert/strict';
import test from 'node:test';
import { createCsrfToken } from '../../src/middleware/csrf.js';
import { createHttpFixture, createAccountSession } from '../helpers/http-fixture.js';

const SELF_RECIPIENT = 'patientRecipientAccountId';

function writeHeaders(fixture, session) {
  return {
    Cookie: session.cookie,
    Origin: fixture.config.applicationOrigin,
    'X-CSRF-Token': createCsrfToken(session.token),
  };
}

function seedPatient(fixture, accountId) {
  fixture.database.prepare(`
    INSERT INTO patient_profiles (account_id, date_of_birth, contact_email, contact_phone)
    VALUES (?, ?, ?, ?)
  `).run(accountId, '1990-01-02', `private-${accountId}@example.test`, '555-0199');
}

function seedDoctor(fixture, accountId, name = 'Fictional Appointment Doctor') {
  fixture.database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name)
    VALUES (?, ?)
  `).run(accountId, name);
}

function seedSlot(fixture, doctorId, {
  startAt = '2026-11-09T15:00:00.000Z',
  endAt = '2026-11-09T16:00:00.000Z',
} = {}) {
  return fixture.database.prepare(`
    INSERT INTO availability_slots (doctor_account_id, start_at, end_at)
    VALUES (?, ?, ?)
  `).run(doctorId, startAt, endAt).lastInsertRowid;
}

function seedBeneficiary(fixture, ownerAccountId, {
  dateOfBirth = '2015-03-04',
  authorizationStatus = null,
  name = 'Fictional Beneficiary',
} = {}) {
  return fixture.database.prepare(`
    INSERT INTO beneficiaries (
      owner_account_id, full_name, date_of_birth, relationship,
      authorization_status
    ) VALUES (?, ?, ?, 'child', ?)
  `).run(ownerAccountId, name, dateOfBirth, authorizationStatus).lastInsertRowid;
}

async function book(fixture, patient, doctorId, slotId, recipient = {}) {
  return fixture.request('/api/v1/appointments', {
    method: 'POST',
    headers: writeHeaders(fixture, patient),
    body: {
      doctorAccountId: doctorId,
      availabilitySlotId: slotId,
      ...recipient,
    },
  });
}

function bookBody(doctorId, slotId, patientId) {
  return {
    doctorAccountId: doctorId,
    availabilitySlotId: slotId,
    [SELF_RECIPIENT]: patientId,
  };
}

function insertBookedAppointment(fixture, {
  doctorId,
  slotId,
  patientId,
  beneficiaryId = null,
  actorId = patientId,
  actorRole = 'PATIENT',
  status = 'BOOKED',
} = {}) {
  return fixture.database.prepare(`
    INSERT INTO appointments (
      availability_slot_id, doctor_account_id, patient_recipient_account_id,
      beneficiary_recipient_id, responsible_account_id,
      initiated_by_account_id, initiated_by_role, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    slotId,
    doctorId,
    beneficiaryId === null ? patientId : null,
    beneficiaryId,
    patientId,
    actorId,
    actorRole,
    status,
  ).lastInsertRowid;
}

async function createBase(t, overrides = {}) {
  const fixture = await createHttpFixture(t, overrides);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, patient.accountId);
  const doctor = createAccountSession(fixture, { role: 'DOCTOR' });
  seedDoctor(fixture, doctor.accountId);
  const slotId = seedSlot(fixture, doctor.accountId);
  return { fixture, patient, doctor, slotId };
}

test('patient books for self, minor beneficiary and authorized adult with server-attributed identity', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const self = await book(fixture, patient, doctor.accountId, slotId, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  assert.equal(self.status, 201);
  const selfAppointment = (await self.json()).data;
  assert.equal(selfAppointment.status, 'BOOKED');
  assert.equal(selfAppointment.recipientType, 'PATIENT');
  assert.equal(selfAppointment.doctorAccountId, doctor.accountId);

  const secondSlot = seedSlot(fixture, doctor.accountId, {
    startAt: '2026-11-09T16:00:00.000Z',
    endAt: '2026-11-09T17:00:00.000Z',
  });
  const minorId = seedBeneficiary(fixture, patient.accountId);
  const minor = await book(fixture, patient, doctor.accountId, secondSlot, {
    beneficiaryId: minorId,
  });
  assert.equal(minor.status, 201);
  assert.equal((await minor.json()).data.recipientType, 'BENEFICIARY');

  const thirdSlot = seedSlot(fixture, doctor.accountId, {
    startAt: '2026-11-09T17:00:00.000Z',
    endAt: '2026-11-09T18:00:00.000Z',
  });
  const adultId = seedBeneficiary(fixture, patient.accountId, {
    dateOfBirth: '1990-01-02',
    authorizationStatus: 'AUTHORIZED',
    name: 'Fictional Authorized Adult',
  });
  const adult = await book(fixture, patient, doctor.accountId, thirdSlot, {
    beneficiaryId: adultId,
  });
  assert.equal(adult.status, 201);

  const stored = fixture.database.prepare(`
    SELECT patient_recipient_account_id, beneficiary_recipient_id,
      responsible_account_id, initiated_by_account_id, initiated_by_role
    FROM appointments ORDER BY id
  `).all();
  assert.equal(stored[0].patient_recipient_account_id, patient.accountId);
  assert.equal(stored[0].responsible_account_id, patient.accountId);
  assert.equal(stored[0].initiated_by_account_id, patient.accountId);
  assert.equal(stored[0].initiated_by_role, 'PATIENT');
  assert.equal(stored[1].beneficiary_recipient_id, minorId);
  assert.equal(stored[2].beneficiary_recipient_id, adultId);
});

test('staff booking checks patient ownership and attributes the responsible account and actor separately', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t, {
    appointmentBookerAccountIds: [900],
  });
  const staff = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const beneficiaryId = seedBeneficiary(fixture, patient.accountId);
  const response = await fixture.request('/api/v1/appointments', {
    method: 'POST',
    headers: writeHeaders(fixture, staff),
    body: {
      doctorAccountId: doctor.accountId,
      availabilitySlotId: slotId,
      responsibleAccountId: patient.accountId,
      beneficiaryId,
    },
  });
  assert.equal(response.status, 201);
  const appointment = (await response.json()).data;
  assert.equal(appointment.recipientType, 'BENEFICIARY');
  assert.equal(appointment.responsibleAccountId, patient.accountId);
  assert.equal(appointment.initiatedByAccountId, staff.accountId);
  assert.equal(appointment.initiatedByRole, 'STAFF');

  const stored = fixture.database.prepare(`
    SELECT responsible_account_id, initiated_by_account_id, initiated_by_role
    FROM appointments WHERE id = ?
  `).get(appointment.appointmentId);
  assert.deepEqual(stored, {
    responsible_account_id: patient.accountId,
    initiated_by_account_id: staff.accountId,
    initiated_by_role: 'STAFF',
  });
});

test('booking conceals cross-account recipients and rejects pending or rejected adult authorization', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const otherPatient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, otherPatient.accountId);
  const otherBeneficiary = seedBeneficiary(fixture, otherPatient.accountId);
  const concealed = await book(fixture, patient, doctor.accountId, slotId, {
    beneficiaryId: otherBeneficiary,
  });
  assert.equal(concealed.status, 404);
  assert.equal((await concealed.json()).error.code, 'RESOURCE_NOT_FOUND');
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM appointments').get().count, 0);

  for (const status of ['PENDING_AUTHORIZATION', 'REJECTED']) {
    const beneficiaryId = seedBeneficiary(fixture, patient.accountId, {
      dateOfBirth: '1990-01-02',
      authorizationStatus: status,
      name: `Fictional ${status} Adult`,
    });
    const response = await book(fixture, patient, doctor.accountId, slotId, { beneficiaryId });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, 'BENEFICIARY_NOT_AUTHORIZED');
  }
  const missingStatusAdult = seedBeneficiary(fixture, patient.accountId, {
    dateOfBirth: '1990-01-02',
    name: 'Fictional Adult Awaiting Refresh',
  });
  const missingStatusResponse = await book(
    fixture,
    patient,
    doctor.accountId,
    slotId,
    { beneficiaryId: missingStatusAdult },
  );
  assert.equal(missingStatusResponse.status, 422);
  assert.equal(
    fixture.database.prepare('SELECT authorization_status FROM beneficiaries WHERE id = ?')
      .get(missingStatusAdult).authorization_status,
    'PENDING_AUTHORIZATION',
  );
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM appointments').get().count, 0);
});

test('booking validates recipient shape, role, authentication, and slot availability', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const noRecipient = await book(fixture, patient, doctor.accountId, slotId);
  assert.equal(noRecipient.status, 422);
  assert.equal((await noRecipient.json()).error.code, 'INVALID_APPOINTMENT_RECIPIENT');
  const twoRecipients = await book(fixture, patient, doctor.accountId, slotId, {
    [SELF_RECIPIENT]: patient.accountId,
    beneficiaryId: seedBeneficiary(fixture, patient.accountId),
  });
  assert.equal(twoRecipients.status, 422);
  assert.equal((await twoRecipients.json()).error.code, 'INVALID_APPOINTMENT_RECIPIENT');

  const malformed = await fixture.request('/api/v1/appointments', {
    method: 'POST',
    headers: writeHeaders(fixture, patient),
    body: { ...bookBody(doctor.accountId, slotId, patient.accountId), role: 'STAFF' },
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_REQUEST');

  const unavailable = await book(fixture, patient, doctor.accountId, 99999, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  assert.equal(unavailable.status, 409);
  assert.equal((await unavailable.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');

  const doctorDenied = await fixture.request('/api/v1/appointments', {
    method: 'POST',
    headers: writeHeaders(fixture, doctor),
    body: bookBody(doctor.accountId, slotId, patient.accountId),
  });
  assert.equal(doctorDenied.status, 403);
  const unauthorizedStaff = createAccountSession(fixture, { role: 'STAFF' });
  const staffDenied = await fixture.request('/api/v1/appointments', {
    method: 'POST',
    headers: writeHeaders(fixture, unauthorizedStaff),
    body: {
      doctorAccountId: doctor.accountId,
      availabilitySlotId: slotId,
      responsibleAccountId: patient.accountId,
      [SELF_RECIPIENT]: patient.accountId,
    },
  });
  assert.equal(staffDenied.status, 403);
  assert.equal((await staffDenied.json()).error.code, 'FORBIDDEN');
  const unauthenticated = await fixture.request('/api/v1/appointments', {
    method: 'POST',
    body: bookBody(doctor.accountId, slotId, patient.accountId),
  });
  assert.equal(unauthenticated.status, 401);
});

test('failed appointment persistence rolls back the booking transaction', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  fixture.database.exec(`
    CREATE TRIGGER test_fail_appointment_insert
    BEFORE INSERT ON appointments
    BEGIN SELECT RAISE(ABORT, 'fixture insertion failure'); END;
  `);
  const response = await book(fixture, patient, doctor.accountId, slotId, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  assert.equal(response.status, 500);
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS count FROM appointments').get().count, 0);
  fixture.database.exec('DROP TRIGGER test_fail_appointment_insert');
});

test('patients can cancel owned bookings; assigned doctors complete and terminal transitions conflict', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const booked = await book(fixture, patient, doctor.accountId, slotId, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  const appointmentId = (await booked.json()).data.appointmentId;

  const cancelled = await fixture.request(
    `/api/v1/appointments/${appointmentId}/cancellation`,
    { method: 'POST', headers: writeHeaders(fixture, patient) },
  );
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.status, 'CANCELLED');
  const repeatedCancellation = await fixture.request(
    `/api/v1/appointments/${appointmentId}/cancellation`,
    { method: 'POST', headers: writeHeaders(fixture, patient) },
  );
  assert.equal(repeatedCancellation.status, 409);
  assert.equal((await repeatedCancellation.json()).error.code, 'APPOINTMENT_STATE_CONFLICT');

  const otherPatient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, otherPatient.accountId);
  const concealed = await fixture.request(
    `/api/v1/appointments/${appointmentId}/cancellation`,
    { method: 'POST', headers: writeHeaders(fixture, otherPatient) },
  );
  assert.equal(concealed.status, 404);

  const secondSlot = seedSlot(fixture, doctor.accountId, {
    startAt: '2026-11-09T16:00:00.000Z',
    endAt: '2026-11-09T17:00:00.000Z',
  });
  const secondBooked = await book(fixture, patient, doctor.accountId, secondSlot, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  const secondId = (await secondBooked.json()).data.appointmentId;
  const complete = await fixture.request(
    `/api/v1/appointments/${secondId}/completion`,
    { method: 'POST', headers: writeHeaders(fixture, doctor) },
  );
  assert.equal(complete.status, 200);
  assert.equal((await complete.json()).data.status, 'COMPLETED');
  const repeatedCompletion = await fixture.request(
    `/api/v1/appointments/${secondId}/completion`,
    { method: 'POST', headers: writeHeaders(fixture, doctor) },
  );
  assert.equal(repeatedCompletion.status, 409);
  assert.equal((await repeatedCompletion.json()).error.code, 'APPOINTMENT_STATE_CONFLICT');

  const staff = createAccountSession(fixture, { role: 'STAFF' });
  const staffCompletion = await fixture.request(
    `/api/v1/appointments/${secondId}/completion`,
    { method: 'POST', headers: writeHeaders(fixture, staff) },
  );
  assert.equal(staffCompletion.status, 403);
  const noReschedule = await fixture.request(`/api/v1/appointments/${secondId}`, {
    method: 'PATCH',
    headers: writeHeaders(fixture, staff),
    body: { availabilitySlotId: slotId },
  });
  assert.equal(noReschedule.status, 404);
});

test('permission-scoped staff cancellation and cancellation releases only a future slot', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t, {
    appointmentCancellerAccountIds: [900],
  });
  const staff = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId,
    patientId: patient.accountId,
  });
  const cancelled = await fixture.request('/api/v1/appointments/1/cancellation', {
    method: 'POST',
    headers: writeHeaders(fixture, staff),
  });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).data.status, 'CANCELLED');

  const reuse = await book(fixture, patient, doctor.accountId, slotId, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  assert.equal(reuse.status, 201);

  const elapsedSlot = seedSlot(fixture, doctor.accountId, {
    startAt: '2026-11-07T15:00:00.000Z',
    endAt: '2026-11-07T16:00:00.000Z',
  });
  const elapsed = await book(fixture, patient, doctor.accountId, elapsedSlot, {
    [SELF_RECIPIENT]: patient.accountId,
  });
  assert.equal(elapsed.status, 409);
  assert.equal((await elapsed.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');
});

test('patient appointment list and doctor worklist expose only authorized minimal fields', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const beneficiaryId = seedBeneficiary(fixture, patient.accountId);
  const appointmentId = insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId,
    patientId: patient.accountId,
    beneficiaryId,
  });

  const patientList = await fixture.request('/api/v1/appointments?view=upcoming', {
    headers: { Cookie: patient.cookie },
  });
  assert.equal(patientList.status, 200);
  const patientData = (await patientList.json()).data;
  assert.equal(patientData.items[0].appointmentId, appointmentId);
  assert.equal(patientData.items[0].recipientType, 'BENEFICIARY');
  assert.equal(JSON.stringify(patientData).includes('private-'), false);

  const worklist = await fixture.request('/api/v1/appointments', {
    headers: { Cookie: doctor.cookie },
  });
  assert.equal(worklist.status, 200);
  const worklistData = (await worklist.json()).data;
  assert.equal(worklistData.items.length, 1);
  assert.equal(worklistData.items[0].recipientName, 'Fictional Beneficiary');
  for (const field of ['responsibleAccountId', 'initiatedByAccountId', 'contactEmail', 'contactPhone']) {
    assert.equal(Object.hasOwn(worklistData.items[0], field), false);
  }

  const wrongDoctor = createAccountSession(fixture, { role: 'DOCTOR' });
  seedDoctor(fixture, wrongDoctor.accountId, 'Unassigned Fictional Doctor');
  const denied = await fixture.request(`/api/v1/appointments/${appointmentId}`, {
    headers: { Cookie: wrongDoctor.cookie },
  });
  assert.equal(denied.status, 404);

  const otherPatient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, otherPatient.accountId);
  const concealed = await fixture.request(`/api/v1/appointments/${appointmentId}`, {
    headers: { Cookie: otherPatient.cookie },
  });
  assert.equal(concealed.status, 404);
});

test('patient history excludes pending adults and includes terminal and elapsed appointments', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const pendingAdult = seedBeneficiary(fixture, patient.accountId, {
    dateOfBirth: '1990-01-02',
    authorizationStatus: 'PENDING_AUTHORIZATION',
  });
  const pendingSlot = seedSlot(fixture, doctor.accountId, {
    startAt: '2026-11-09T16:00:00.000Z',
    endAt: '2026-11-09T17:00:00.000Z',
  });
  insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId: pendingSlot,
    patientId: patient.accountId,
    beneficiaryId: pendingAdult,
  });
  fixture.database.prepare(`
    UPDATE availability_slots SET start_at = ?, end_at = ? WHERE id = ?
  `).run('2026-11-07T15:00:00.000Z', '2026-11-07T16:00:00.000Z', slotId);
  insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId,
    patientId: patient.accountId,
    status: 'COMPLETED',
  });

  const history = await fixture.request('/api/v1/appointments?view=history', {
    headers: { Cookie: patient.cookie },
  });
  assert.equal(history.status, 200);
  const historyItems = (await history.json()).data.items;
  assert.equal(historyItems.length, 1);
  assert.equal(historyItems[0].status, 'COMPLETED');
  assert.equal(historyItems[0].recipientType, 'PATIENT');
});

test('staff appointment reads require view permission and minimize patient information', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t, {
    appointmentViewerAccountIds: [900],
  });
  const staff = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const unauthorizedStaff = createAccountSession(fixture, { role: 'STAFF' });
  const emptyList = await fixture.request('/api/v1/admin/appointments', {
    headers: { Cookie: staff.cookie },
  });
  assert.deepEqual((await emptyList.json()).data.items, []);
  insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId,
    patientId: patient.accountId,
  });

  const list = await fixture.request('/api/v1/admin/appointments', {
    headers: { Cookie: staff.cookie },
  });
  assert.equal(list.status, 200);
  const appointment = (await list.json()).data.items[0];
  assert.equal(appointment.responsibleAccountId, patient.accountId);
  assert.equal(appointment.recipientName, 'PATIENT Fixture Account');
  for (const field of ['contactEmail', 'contactPhone', 'email', 'passwordHash']) {
    assert.equal(Object.hasOwn(appointment, field), false);
  }

  const denied = await fixture.request('/api/v1/admin/appointments', {
    headers: { Cookie: unauthorizedStaff.cookie },
  });
  assert.equal(denied.status, 403);
  const deniedDetail = await fixture.request('/api/v1/appointments/1', {
    headers: { Cookie: unauthorizedStaff.cookie },
  });
  assert.equal(deniedDetail.status, 403);
});

test('admin dashboard and patient directory are permission-scoped with empty-list behavior', async (t) => {
  const fixture = await createHttpFixture(t, {
    adminDashboardAccountIds: [900],
    patientDirectoryViewerAccountIds: [900],
  });
  const staff = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const unauthorizedStaff = createAccountSession(fixture, { role: 'STAFF' });

  const dashboard = await fixture.request('/api/v1/admin/dashboard', {
    headers: { Cookie: staff.cookie },
  });
  assert.equal(dashboard.status, 200);
  assert.deepEqual(
    (await dashboard.json()).data.sections.map(({ key }) => key),
    ['patients', 'doctors', 'departments', 'appointments', 'availability', 'beneficiaryAuthorization'],
  );

  const patients = await fixture.request('/api/v1/admin/patients', {
    headers: { Cookie: staff.cookie },
  });
  assert.equal(patients.status, 200);
  assert.deepEqual((await patients.json()).data.items, []);

  const deniedDashboard = await fixture.request('/api/v1/admin/dashboard', {
    headers: { Cookie: unauthorizedStaff.cookie },
  });
  assert.equal(deniedDashboard.status, 403);
  const deniedPatients = await fixture.request('/api/v1/admin/patients', {
    headers: { Cookie: unauthorizedStaff.cookie },
  });
  assert.equal(deniedPatients.status, 403);

  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, patient.accountId);
  const list = await fixture.request('/api/v1/admin/patients', {
    headers: { Cookie: staff.cookie },
  });
  const patientRow = (await list.json()).data.items[0];
  assert.deepEqual(Object.keys(patientRow).sort(), ['dateOfBirth', 'fullName', 'patientAccountId']);
  assert.equal(JSON.stringify(patientRow).includes('private-'), false);
});

test('independent HTTP peers race on the same slot and only one booking commits', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const secondPatient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, secondPatient.accountId);
  const peer = await fixture.createPeer();
  const [first, second] = await Promise.all([
    book(fixture, patient, doctor.accountId, slotId, {
      [SELF_RECIPIENT]: patient.accountId,
    }),
    peer.request('/api/v1/appointments', {
      method: 'POST',
      headers: writeHeaders(fixture, secondPatient),
      body: bookBody(doctor.accountId, slotId, secondPatient.accountId),
    }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  const loser = first.status === 409 ? first : second;
  assert.equal((await loser.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');
  assert.equal(fixture.database.prepare(`
    SELECT COUNT(*) AS count FROM appointments WHERE status = 'BOOKED'
  `).get().count, 1);
});

test('active interval conflicts reject bookings even when overlapping slots predate integrity triggers', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const secondPatient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, secondPatient.accountId);

  fixture.database.exec(`
    DROP TRIGGER availability_slots_prevent_overlap_insert;
    DROP TRIGGER availability_slots_prevent_overlap_update;
  `);
  const overlappingSlot = seedSlot(fixture, doctor.accountId, {
    startAt: '2026-11-09T15:30:00.000Z',
    endAt: '2026-11-09T16:30:00.000Z',
  });
  fixture.database.exec(`
    CREATE TRIGGER availability_slots_prevent_overlap_insert
    BEFORE INSERT ON availability_slots FOR EACH ROW
    WHEN EXISTS (
      SELECT 1 FROM availability_slots AS existing
      WHERE existing.doctor_account_id = NEW.doctor_account_id
        AND existing.start_at < NEW.end_at AND existing.end_at > NEW.start_at
    )
    BEGIN
      SELECT RAISE(ABORT, 'Availability slot overlaps an existing slot for this doctor.');
    END;
    CREATE TRIGGER availability_slots_prevent_overlap_update
    BEFORE UPDATE ON availability_slots FOR EACH ROW
    WHEN EXISTS (
      SELECT 1 FROM availability_slots AS existing
      WHERE existing.id <> OLD.id
        AND existing.doctor_account_id = NEW.doctor_account_id
        AND existing.start_at < NEW.end_at AND existing.end_at > NEW.start_at
    )
    BEGIN
      SELECT RAISE(ABORT, 'Availability slot overlaps an existing slot for this doctor.');
    END;
  `);

  const [first, second] = await Promise.all([
    book(fixture, patient, doctor.accountId, slotId, {
      [SELF_RECIPIENT]: patient.accountId,
    }),
    book(fixture, secondPatient, doctor.accountId, overlappingSlot, {
      [SELF_RECIPIENT]: secondPatient.accountId,
    }),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  const loser = first.status === 409 ? first : second;
  assert.equal((await loser.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');
  assert.equal(fixture.database.prepare(`
    SELECT COUNT(*) AS count FROM appointments WHERE status = 'BOOKED'
  `).get().count, 1);
});

test('booking concurrent with cancellation is serialized and leaves no partial state', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const secondPatient = createAccountSession(fixture, { role: 'PATIENT' });
  seedPatient(fixture, secondPatient.accountId);
  const appointmentId = insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId,
    patientId: patient.accountId,
  });
  const peer = await fixture.createPeer();

  const [booking, cancellation] = await Promise.all([
    peer.request('/api/v1/appointments', {
      method: 'POST',
      headers: writeHeaders(fixture, secondPatient),
      body: bookBody(doctor.accountId, slotId, secondPatient.accountId),
    }),
    fixture.request(`/api/v1/appointments/${appointmentId}/cancellation`, {
      method: 'POST',
      headers: writeHeaders(fixture, patient),
    }),
  ]);
  assert.equal(cancellation.status, 200);
  if (booking.status === 409) {
    assert.equal((await booking.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');
    assert.equal(fixture.database.prepare(`
      SELECT status FROM appointments WHERE id = ?
    `).get(appointmentId).status, 'CANCELLED');
    assert.equal(fixture.database.prepare(`
      SELECT COUNT(*) AS count FROM appointments WHERE status = 'BOOKED'
    `).get().count, 0);
  } else {
    assert.equal(booking.status, 201);
    assert.equal(fixture.database.prepare(`
      SELECT status FROM appointments WHERE id = ?
    `).get(appointmentId).status, 'CANCELLED');
    assert.equal(fixture.database.prepare(`
      SELECT COUNT(*) AS count FROM appointments WHERE status = 'BOOKED'
    `).get().count, 1);
  }
});

test('competing cancellation and completion have exactly one winner', async (t) => {
  const { fixture, patient, doctor, slotId } = await createBase(t);
  const appointmentId = insertBookedAppointment(fixture, {
    doctorId: doctor.accountId,
    slotId,
    patientId: patient.accountId,
  });
  const peer = await fixture.createPeer();
  const [cancellation, completion] = await Promise.all([
    fixture.request(`/api/v1/appointments/${appointmentId}/cancellation`, {
      method: 'POST',
      headers: writeHeaders(fixture, patient),
    }),
    peer.request(`/api/v1/appointments/${appointmentId}/completion`, {
      method: 'POST',
      headers: writeHeaders(fixture, doctor),
    }),
  ]);
  assert.deepEqual([cancellation.status, completion.status].sort(), [200, 409]);
  const loser = cancellation.status === 409 ? cancellation : completion;
  assert.equal((await loser.json()).error.code, 'APPOINTMENT_STATE_CONFLICT');
  const finalStatus = fixture.database.prepare(`
    SELECT status FROM appointments WHERE id = ?
  `).get(appointmentId).status;
  assert.ok(['CANCELLED', 'COMPLETED'].includes(finalStatus));
});
