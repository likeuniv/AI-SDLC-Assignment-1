import assert from 'node:assert/strict';
import test from 'node:test';
import { createCsrfToken } from '../../src/middleware/csrf.js';
import {
  createAccountSession,
  createHttpFixture,
} from '../helpers/http-fixture.js';

function writeHeaders(fixture, session) {
  return {
    Cookie: session.cookie,
    Origin: fixture.config.applicationOrigin,
    'X-CSRF-Token': createCsrfToken(session.token),
  };
}

function seedDoctor(fixture, professionalName = 'Fictional Availability Doctor') {
  const session = createAccountSession(fixture, { role: 'DOCTOR' });
  fixture.database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name)
    VALUES (?, ?)
  `).run(session.accountId, professionalName);
  return session;
}

function slotPath(doctorId) {
  return `/api/v1/doctors/${doctorId}/availability`;
}

async function createSlot(fixture, doctor, {
  startAt = '2026-11-09T10:00:00-05:00',
  endAt = '2026-11-09T11:00:00-05:00',
} = {}) {
  return fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    headers: writeHeaders(fixture, doctor),
    body: { startAt, endAt },
  });
}

function bookSlotForTest(fixture, slotId, doctorId, patientId) {
  fixture.database.prepare('INSERT INTO patient_profiles (account_id) VALUES (?)').run(patientId);
  fixture.database.prepare(`
    INSERT INTO appointments (
      availability_slot_id, doctor_account_id, patient_recipient_account_id,
      responsible_account_id, initiated_by_account_id, initiated_by_role, status
    ) VALUES (?, ?, ?, ?, ?, 'PATIENT', 'BOOKED')
  `).run(slotId, doctorId, patientId, patientId, patientId);
}

test('doctor creates future availability using explicit-offset hospital-local time and persists UTC', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const response = await createSlot(fixture, doctor);

  assert.equal(response.status, 201);
  const slot = (await response.json()).data;
  assert.equal(slot.doctorAccountId, doctor.accountId);
  assert.equal(slot.startAt, '2026-11-09T15:00:00.000Z');
  assert.equal(slot.endAt, '2026-11-09T16:00:00.000Z');
  assert.equal(
    fixture.database.prepare('SELECT start_at FROM availability_slots WHERE id = ?').get(slot.id)
      .start_at,
    '2026-11-09T15:00:00.000Z',
  );
});

test('availability rejects malformed offsets, DST gaps, past times and nonpositive intervals', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);

  for (const body of [
    { startAt: '2026-11-09T10:00:00', endAt: '2026-11-09T11:00:00-05:00' },
    { startAt: '2026-11-09T10:00:00-04:00', endAt: '2026-11-09T11:00:00-05:00' },
    { startAt: '2026-03-08T02:30:00-05:00', endAt: '2026-03-08T03:30:00-04:00' },
    { startAt: '2026-11-08T04:59:00-05:00', endAt: '2026-11-08T05:30:00-05:00' },
    { startAt: '2026-11-09T10:00:00-05:00', endAt: '2026-11-09T10:00:00-05:00' },
  ]) {
    const response = await fixture.request(slotPath(doctor.accountId), {
      method: 'POST',
      headers: writeHeaders(fixture, doctor),
      body,
    });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
  }
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM availability_slots').get().count,
    0,
  );
});

test('future time on the current hospital-local date is allowed while elapsed time is rejected', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const response = await createSlot(fixture, doctor, {
    startAt: '2026-11-08T05:01:00-05:00',
    endAt: '2026-11-08T05:31:00-05:00',
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).data.startAt, '2026-11-08T10:01:00.000Z');
});

test('repeated DST wall times require valid explicit offsets and persist as distinct instants', async (t) => {
  const fixture = await createHttpFixture(t);
  fixture.setTime('2026-10-31T12:00:00.000Z');
  const doctor = seedDoctor(fixture);

  const daylightTime = await createSlot(fixture, doctor, {
    startAt: '2026-11-01T01:30:00-04:00',
    endAt: '2026-11-01T01:45:00-04:00',
  });
  const standardTime = await createSlot(fixture, doctor, {
    startAt: '2026-11-01T01:30:00-05:00',
    endAt: '2026-11-01T01:45:00-05:00',
  });
  assert.equal(daylightTime.status, 201);
  assert.equal(standardTime.status, 201);
  assert.equal(
    (await daylightTime.json()).data.startAt,
    '2026-11-01T05:30:00.000Z',
  );
  assert.equal(
    (await standardTime.json()).data.startAt,
    '2026-11-01T06:30:00.000Z',
  );
});

test('same-doctor overlaps conflict, adjacent half-open intervals are accepted, and updates are transactional', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const first = await createSlot(fixture, doctor);
  assert.equal(first.status, 201);

  const overlap = await createSlot(fixture, doctor, {
    startAt: '2026-11-09T10:30:00-05:00',
    endAt: '2026-11-09T11:30:00-05:00',
  });
  assert.equal(overlap.status, 409);
  assert.equal((await overlap.json()).error.code, 'AVAILABILITY_CONFLICT');

  const adjacent = await createSlot(fixture, doctor, {
    startAt: '2026-11-09T11:00:00-05:00',
    endAt: '2026-11-09T12:00:00-05:00',
  });
  assert.equal(adjacent.status, 201);
  const adjacentSlot = (await adjacent.json()).data;

  const update = await fixture.request(
    `${slotPath(doctor.accountId)}/${adjacentSlot.id}`,
    {
      method: 'PATCH',
      headers: writeHeaders(fixture, doctor),
      body: {
        startAt: '2026-11-09T10:30:00-05:00',
        endAt: '2026-11-09T11:30:00-05:00',
      },
    },
  );
  assert.equal(update.status, 409);
  assert.equal((await update.json()).error.code, 'AVAILABILITY_CONFLICT');
  assert.deepEqual(
    fixture.database.prepare(`
      SELECT start_at, end_at FROM availability_slots WHERE id = ?
    `).get(adjacentSlot.id),
    {
      start_at: '2026-11-09T16:00:00.000Z',
      end_at: '2026-11-09T17:00:00.000Z',
    },
  );
});

test('doctor can update and remove an unbooked future slot', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const created = await createSlot(fixture, doctor);
  const slot = (await created.json()).data;
  const updated = await fixture.request(
    `${slotPath(doctor.accountId)}/${slot.id}`,
    {
      method: 'PATCH',
      headers: writeHeaders(fixture, doctor),
      body: { endAt: '2026-11-09T11:30:00-05:00' },
    },
  );
  assert.equal(updated.status, 200);
  assert.equal(
    (await updated.json()).data.endAt,
    '2026-11-09T16:30:00.000Z',
  );

  const removed = await fixture.request(
    `${slotPath(doctor.accountId)}/${slot.id}`,
    { method: 'DELETE', headers: writeHeaders(fixture, doctor) },
  );
  assert.equal(removed.status, 204);
  assert.equal(await removed.text(), '');
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM availability_slots').get().count,
    0,
  );
});

test('concurrent overlapping schedule writes produce one slot and one conflict', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const [first, second] = await Promise.all([
    createSlot(fixture, doctor),
    createSlot(fixture, doctor),
  ]);
  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  const conflict = first.status === 409 ? first : second;
  assert.equal((await conflict.json()).error.code, 'AVAILABILITY_CONFLICT');
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM availability_slots').get().count,
    1,
  );
});

test('only the doctor owner or permitted staff can manage a schedule', async (t) => {
  const fixture = await createHttpFixture(t, { availabilityManagerAccountIds: [900] });
  const doctor = seedDoctor(fixture);
  const otherDoctor = seedDoctor(fixture, 'Another Fictional Doctor');
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const authorizedStaff = createAccountSession(fixture, { accountId: 900, role: 'STAFF' });
  const unauthorizedStaff = createAccountSession(fixture, { role: 'STAFF' });

  const unauthorized = await fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    headers: writeHeaders(fixture, patient),
    body: {
      startAt: '2026-11-09T10:00:00-05:00',
      endAt: '2026-11-09T11:00:00-05:00',
    },
  });
  assert.equal(unauthorized.status, 403);

  const crossDoctor = await fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    headers: writeHeaders(fixture, otherDoctor),
    body: {
      startAt: '2026-11-09T10:00:00-05:00',
      endAt: '2026-11-09T11:00:00-05:00',
    },
  });
  assert.equal(crossDoctor.status, 403);

  const deniedStaff = await fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    headers: writeHeaders(fixture, unauthorizedStaff),
    body: {
      startAt: '2026-11-09T10:00:00-05:00',
      endAt: '2026-11-09T11:00:00-05:00',
    },
  });
  assert.equal(deniedStaff.status, 403);

  const allowedStaff = await fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    headers: writeHeaders(fixture, authorizedStaff),
    body: {
      startAt: '2026-11-09T10:00:00-05:00',
      endAt: '2026-11-09T11:00:00-05:00',
    },
  });
  assert.equal(allowedStaff.status, 201);

  const staffSchedule = await fixture.request(slotPath(doctor.accountId), {
    headers: { Cookie: authorizedStaff.cookie },
  });
  assert.equal(staffSchedule.status, 200);
  const deniedSchedule = await fixture.request(slotPath(doctor.accountId), {
    headers: { Cookie: unauthorizedStaff.cookie },
  });
  assert.equal(deniedSchedule.status, 403);

  const unauthenticated = await fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    body: {
      startAt: '2026-11-09T12:00:00-05:00',
      endAt: '2026-11-09T13:00:00-05:00',
    },
  });
  assert.equal(unauthenticated.status, 401);
});

test('staff schedule viewing has an independent permission from schedule management', async (t) => {
  const fixture = await createHttpFixture(t, {
    availabilityViewerAccountIds: [901],
  });
  const doctor = seedDoctor(fixture);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const staffViewer = createAccountSession(fixture, { accountId: 901, role: 'STAFF' });
  await createSlot(fixture, doctor);

  const visible = await fixture.request(slotPath(doctor.accountId), {
    headers: { Cookie: staffViewer.cookie },
  });
  assert.equal(visible.status, 200);
  const deniedWrite = await fixture.request(slotPath(doctor.accountId), {
    method: 'POST',
    headers: writeHeaders(fixture, staffViewer),
    body: {
      startAt: '2026-11-09T12:00:00-05:00',
      endAt: '2026-11-09T13:00:00-05:00',
    },
  });
  assert.equal(deniedWrite.status, 403);
  const deniedPatient = await fixture.request(slotPath(doctor.accountId), {
    headers: { Cookie: patient.cookie },
  });
  assert.equal(deniedPatient.status, 200);
});

test('booked slots cannot be modified or removed and patient schedules hide them and expose no patient data', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const bookedResponse = await createSlot(fixture, doctor);
  const bookedSlot = (await bookedResponse.json()).data;
  bookSlotForTest(fixture, bookedSlot.id, doctor.accountId, patient.accountId);
  const availableResponse = await createSlot(fixture, doctor, {
    startAt: '2026-11-09T12:00:00-05:00',
    endAt: '2026-11-09T13:00:00-05:00',
  });
  const availableSlot = (await availableResponse.json()).data;
  fixture.database.prepare(`
    INSERT INTO availability_slots (doctor_account_id, start_at, end_at)
    VALUES (?, ?, ?)
  `).run(
    doctor.accountId,
    '2026-11-07T15:00:00.000Z',
    '2026-11-07T16:00:00.000Z',
  );

  const patch = await fixture.request(
    `${slotPath(doctor.accountId)}/${bookedSlot.id}`,
    {
      method: 'PATCH',
      headers: writeHeaders(fixture, doctor),
      body: {
        startAt: '2026-11-09T10:30:00-05:00',
        endAt: '2026-11-09T11:30:00-05:00',
      },
    },
  );
  assert.equal(patch.status, 409);
  assert.equal((await patch.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');

  const remove = await fixture.request(
    `${slotPath(doctor.accountId)}/${bookedSlot.id}`,
    { method: 'DELETE', headers: writeHeaders(fixture, doctor) },
  );
  assert.equal(remove.status, 409);
  assert.equal((await remove.json()).error.code, 'APPOINTMENT_SLOT_UNAVAILABLE');

  const publicSchedule = await fixture.request(slotPath(doctor.accountId), {
    headers: { Cookie: patient.cookie },
  });
  assert.equal(publicSchedule.status, 200);
  const publicData = (await publicSchedule.json()).data;
  assert.deepEqual(publicData.items.map(({ id }) => id), [availableSlot.id]);
  assert.deepEqual(
    Object.keys(publicData.items[0]).sort(),
    ['endAt', 'id', 'startAt'],
  );
  assert.equal(JSON.stringify(publicData).includes('Fictional Patient'), false);

  const doctorSchedule = await fixture.request(slotPath(doctor.accountId), {
    headers: { Cookie: doctor.cookie },
  });
  const doctorData = (await doctorSchedule.json()).data;
  assert.equal(doctorData.items.find(({ id }) => id === bookedSlot.id).isBooked, 1);
  assert.equal(JSON.stringify(doctorData).includes('Fictional Patient'), false);
});

test('schedule reads use stable bounded pagination and strict query validation', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  for (let hour = 10; hour < 13; hour += 1) {
    await createSlot(fixture, doctor, {
      startAt: `2026-11-09T${hour}:00:00-05:00`,
      endAt: `2026-11-09T${hour + 1}:00:00-05:00`,
    });
  }
  const patient = createAccountSession(fixture, { role: 'PATIENT' });
  const headers = { Cookie: patient.cookie };
  const first = await fixture.request(`${slotPath(doctor.accountId)}?page=1&pageSize=1`, { headers });
  const repeated = await fixture.request(
    `${slotPath(doctor.accountId)}?page=1&pageSize=1`,
    { headers },
  );
  const second = await fixture.request(`${slotPath(doctor.accountId)}?page=2&pageSize=1`, { headers });
  const firstData = (await first.json()).data;
  assert.deepEqual(firstData.items, (await repeated.json()).data.items);
  assert.notEqual(firstData.items[0].id, (await second.json()).data.items[0].id);
  assert.equal(firstData.total, 3);

  for (const [query, status] of [
    ['?page=1.5', 400],
    ['?page=0', 422],
    ['?pageSize=51', 422],
    ['?other=x', 400],
  ]) {
    const response = await fixture.request(`${slotPath(doctor.accountId)}${query}`, { headers });
    assert.equal(response.status, status);
  }
});

test('direct SQL overlap triggers and service conflicts leave schedule unchanged', async (t) => {
  const fixture = await createHttpFixture(t);
  const doctor = seedDoctor(fixture);
  const first = await createSlot(fixture, doctor);
  const firstSlot = (await first.json()).data;
  const adjacent = await createSlot(fixture, doctor, {
    startAt: '2026-11-09T11:00:00-05:00',
    endAt: '2026-11-09T12:00:00-05:00',
  });
  const adjacentSlot = (await adjacent.json()).data;

  assert.throws(
    () => fixture.database.prepare(`
      INSERT INTO availability_slots (doctor_account_id, start_at, end_at)
      VALUES (?, ?, ?)
    `).run(
      doctor.accountId,
      '2026-11-09T15:30:00.000Z',
      '2026-11-09T16:30:00.000Z',
    ),
    /Availability slot overlaps an existing slot for this doctor/,
  );
  assert.throws(
    () => fixture.database.prepare(`
      UPDATE availability_slots SET start_at = ?, end_at = ? WHERE id = ?
    `).run(
      '2026-11-09T15:30:00.000Z',
      '2026-11-09T16:30:00.000Z',
      adjacentSlot.id,
    ),
    /Availability slot overlaps an existing slot for this doctor/,
  );
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM availability_slots').get().count,
    2,
  );
  assert.equal(
    fixture.database.prepare('SELECT start_at FROM availability_slots WHERE id = ?')
      .get(firstSlot.id).start_at,
    '2026-11-09T15:00:00.000Z',
  );
  assert.equal(
    fixture.database.prepare('SELECT start_at FROM availability_slots WHERE id = ?')
      .get(adjacentSlot.id).start_at,
    '2026-11-09T16:00:00.000Z',
  );
});
