import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfig } from '../../src/config/index.js';
import { createDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrate.js';
import { createAppointmentService } from '../../src/modules/appointments/service.js';

const PASSWORD_HASH = `$2b$12$${'a'.repeat(53)}`;

function createAppointmentFixture() {
  const database = createDatabase({ filename: ':memory:' });
  runMigrations(database);
  const insertAccount = database.prepare(`
    INSERT INTO accounts (full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  const patientId = insertAccount.run(
    'Fictional Unit Patient',
    'unit-patient@example.test',
    PASSWORD_HASH,
    'PATIENT',
  ).lastInsertRowid;
  const doctorId = insertAccount.run(
    'Fictional Unit Doctor',
    'unit-doctor@example.test',
    PASSWORD_HASH,
    'DOCTOR',
  ).lastInsertRowid;
  database.prepare('INSERT INTO patient_profiles (account_id) VALUES (?)').run(patientId);
  database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name) VALUES (?, ?)
  `).run(doctorId, 'Fictional Unit Doctor');
  const slotId = database.prepare(`
    INSERT INTO availability_slots (doctor_account_id, start_at, end_at)
    VALUES (?, ?, ?)
  `).run(
    doctorId,
    '2026-11-09T15:00:00.000Z',
    '2026-11-09T16:00:00.000Z',
  ).lastInsertRowid;
  const config = createConfig({
    hospitalTimeZone: 'America/New_York',
    now: () => new Date('2026-11-08T10:00:00.000Z'),
  });
  return {
    database,
    patientId,
    doctorId,
    slotId,
    service: createAppointmentService(database, config),
  };
}

test('appointment service validates recipients, books atomically and maps slot conflicts', (t) => {
  const fixture = createAppointmentFixture();
  t.after(() => fixture.database.close());
  const patient = { accountId: fixture.patientId, role: 'PATIENT' };

  assert.throws(
    () => fixture.service.book(patient, {
      doctorAccountId: fixture.doctorId,
      availabilitySlotId: fixture.slotId,
    }),
    (error) => error.code === 'INVALID_APPOINTMENT_RECIPIENT',
  );
  const appointment = fixture.service.book(patient, {
    doctorAccountId: fixture.doctorId,
    availabilitySlotId: fixture.slotId,
    patientRecipientAccountId: fixture.patientId,
  });
  assert.equal(appointment.status, 'BOOKED');
  assert.equal(Object.hasOwn(appointment, 'initiatedByAccountId'), false);

  assert.throws(
    () => fixture.service.book(patient, {
      doctorAccountId: fixture.doctorId,
      availabilitySlotId: fixture.slotId,
      patientRecipientAccountId: fixture.patientId,
    }),
    (error) => error.code === 'APPOINTMENT_SLOT_UNAVAILABLE',
  );
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM appointments').get().count,
    1,
  );
});

test('appointment service exposes only terminal conditional transitions', (t) => {
  const fixture = createAppointmentFixture();
  t.after(() => fixture.database.close());
  const patient = { accountId: fixture.patientId, role: 'PATIENT' };
  const doctor = { accountId: fixture.doctorId, role: 'DOCTOR' };
  const appointment = fixture.service.book(patient, {
    doctorAccountId: fixture.doctorId,
    availabilitySlotId: fixture.slotId,
    patientRecipientAccountId: fixture.patientId,
  });

  assert.equal(fixture.service.complete(doctor, appointment.appointmentId).status, 'COMPLETED');
  assert.throws(
    () => fixture.service.cancel(patient, appointment.appointmentId),
    (error) => error.code === 'APPOINTMENT_STATE_CONFLICT',
  );
});
