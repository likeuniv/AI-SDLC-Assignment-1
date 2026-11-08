import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrate.js';

const TEST_PASSWORD_HASH = `$2b$12$${'a'.repeat(53)}`;

function createIntegrityFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'hms-db-integrity-'));
  const database = createDatabase({ filename: join(directory, 'integrity.sqlite') });
  t.after(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  assert.deepEqual(runMigrations(database), [1, 2, 3]);

  const insertAccount = database.prepare(`
    INSERT INTO accounts (full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, ?)
  `);
  const patientA = insertAccount.run(
    'Fictional Patient A',
    'patient-a@example.test',
    TEST_PASSWORD_HASH,
    'PATIENT',
  ).lastInsertRowid;
  const patientB = insertAccount.run(
    'Fictional Patient B',
    'patient-b@example.test',
    TEST_PASSWORD_HASH,
    'PATIENT',
  ).lastInsertRowid;
  const doctorA = insertAccount.run(
    'Fictional Doctor A',
    'doctor-a@example.test',
    TEST_PASSWORD_HASH,
    'DOCTOR',
  ).lastInsertRowid;
  const doctorB = insertAccount.run(
    'Fictional Doctor B',
    'doctor-b@example.test',
    TEST_PASSWORD_HASH,
    'DOCTOR',
  ).lastInsertRowid;
  const staff = insertAccount.run(
    'Fictional Staff',
    'staff@example.test',
    TEST_PASSWORD_HASH,
    'STAFF',
  ).lastInsertRowid;

  database.prepare('INSERT INTO patient_profiles (account_id) VALUES (?)').run(patientA);
  database.prepare('INSERT INTO patient_profiles (account_id) VALUES (?)').run(patientB);
  const insertDoctor = database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name) VALUES (?, ?)
  `);
  insertDoctor.run(doctorA, 'Fictional Doctor A');
  insertDoctor.run(doctorB, 'Fictional Doctor B');

  const beneficiaryId = database.prepare(`
    INSERT INTO beneficiaries (
      owner_account_id, full_name, date_of_birth, relationship,
      relationship_description, authorization_status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    patientA,
    'Fictional Beneficiary',
    '2000-01-02',
    'child',
    null,
    'AUTHORIZED',
  ).lastInsertRowid;

  const insertSlot = database.prepare(`
    INSERT INTO availability_slots (doctor_account_id, start_at, end_at)
    VALUES (?, ?, ?)
  `);
  const insertAppointment = database.prepare(`
    INSERT INTO appointments (
      availability_slot_id, doctor_account_id, beneficiary_recipient_id,
      responsible_account_id, initiated_by_account_id, initiated_by_role, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAudit = database.prepare(`
    INSERT INTO beneficiary_authorization_audit (
      beneficiary_id, reviewer_account_id, verification_method, outcome, reviewed_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  return {
    database,
    doctorA,
    doctorB,
    patientA,
    patientB,
    staff,
    beneficiaryId,
    insertSlot,
    insertAppointment,
    insertAudit,
  };
}

function addSlot(fixture, doctorId, startAt, endAt) {
  return fixture.insertSlot.run(doctorId, startAt, endAt).lastInsertRowid;
}

function addStaffAppointment(fixture, slotId, overrides = {}) {
  const values = {
    doctorId: fixture.doctorA,
    beneficiaryId: fixture.beneficiaryId,
    responsibleAccountId: fixture.patientA,
    actorId: fixture.staff,
    status: 'BOOKED',
    ...overrides,
  };
  return fixture.insertAppointment.run(
    slotId,
    values.doctorId,
    values.beneficiaryId,
    values.responsibleAccountId,
    values.actorId,
    'STAFF',
    values.status,
  ).lastInsertRowid;
}

test('rejects overlapping availability inserts for the same doctor', (t) => {
  const fixture = createIntegrityFixture(t);
  const { database, doctorA } = fixture;
  addSlot(fixture, doctorA, '2030-01-01T10:00:00.000Z', '2030-01-01T11:00:00.000Z');

  assert.throws(
    () => addSlot(fixture, doctorA, '2030-01-01T10:30:00.000Z', '2030-01-01T11:30:00.000Z'),
    /Availability slot overlaps an existing slot for this doctor/,
  );
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM availability_slots').get().count, 1);
});

test('rejects overlapping availability updates but allows adjacent slots', (t) => {
  const fixture = createIntegrityFixture(t);
  const { database, doctorA } = fixture;
  const firstSlot = addSlot(
    fixture,
    doctorA,
    '2030-01-01T10:00:00.000Z',
    '2030-01-01T11:00:00.000Z',
  );
  const adjacentSlot = addSlot(
    fixture,
    doctorA,
    '2030-01-01T11:00:00.000Z',
    '2030-01-01T12:00:00.000Z',
  );
  const updateSlot = database.prepare(`
    UPDATE availability_slots SET start_at = ?, end_at = ? WHERE id = ?
  `);

  assert.throws(
    () => updateSlot.run('2030-01-01T10:30:00.000Z', '2030-01-01T11:30:00.000Z', adjacentSlot),
    /Availability slot overlaps an existing slot for this doctor/,
  );
  assert.deepEqual(
    database.prepare('SELECT start_at, end_at FROM availability_slots WHERE id = ?')
      .get(adjacentSlot),
    { start_at: '2030-01-01T11:00:00.000Z', end_at: '2030-01-01T12:00:00.000Z' },
  );
  assert.doesNotThrow(() => updateSlot.run(
    '2030-01-01T10:00:00.000Z',
    '2030-01-01T11:00:00.000Z',
    firstSlot,
  ));
});

test('allows overlapping intervals for different doctors', (t) => {
  const fixture = createIntegrityFixture(t);
  const firstSlot = addSlot(
    fixture,
    fixture.doctorA,
    '2030-01-01T10:00:00.000Z',
    '2030-01-01T11:00:00.000Z',
  );
  const secondSlot = addSlot(
    fixture,
    fixture.doctorB,
    '2030-01-01T10:30:00.000Z',
    '2030-01-01T11:30:00.000Z',
  );

  assert.notEqual(firstSlot, secondSlot);
  assert.equal(
    fixture.database.prepare('SELECT COUNT(*) AS count FROM availability_slots').get().count,
    2,
  );
});

test('rejects updates and deletes of authorization audit records', (t) => {
  const fixture = createIntegrityFixture(t);
  const { database, beneficiaryId, staff } = fixture;
  const auditId = fixture.insertAudit.run(
    beneficiaryId,
    staff,
    'PHONE',
    'AUTHORIZED',
    '2026-11-08T00:00:00.000Z',
  ).lastInsertRowid;

  assert.throws(
    () => database.prepare(`
      UPDATE beneficiary_authorization_audit SET outcome = ? WHERE id = ?
    `).run('REJECTED', auditId),
    /Beneficiary authorization audit records are immutable/,
  );
  assert.throws(
    () => database.prepare(`
      DELETE FROM beneficiary_authorization_audit WHERE id = ?
    `).run(auditId),
    /Beneficiary authorization audit records cannot be deleted/,
  );
  assert.deepEqual(
    database.prepare(`
      SELECT outcome, verification_method FROM beneficiary_authorization_audit WHERE id = ?
    `).get(auditId),
    { outcome: 'AUTHORIZED', verification_method: 'PHONE' },
  );
});

test('rejects invalid foreign keys, slot uniqueness and CHECK constraints', (t) => {
  const fixture = createIntegrityFixture(t);
  const { database, doctorA, patientA, patientB, staff, beneficiaryId } = fixture;
  const slot = addSlot(
    fixture,
    doctorA,
    '2030-01-01T10:00:00.000Z',
    '2030-01-01T11:00:00.000Z',
  );
  addStaffAppointment(fixture, slot);

  assert.throws(
    () => addSlot(fixture, 9999, '2030-01-01T12:00:00.000Z', '2030-01-01T13:00:00.000Z'),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => addSlot(fixture, doctorA, '2030-01-01T12:00:00.000Z', '2030-01-01T12:00:00.000Z'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => addStaffAppointment(fixture, slot),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => addStaffAppointment(fixture, slot, {
      status: 'RESCHEDULED',
    }),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => fixture.insertAudit.run(
      beneficiaryId,
      patientA,
      'PHONE',
      'AUTHORIZED',
      '2026-11-08T00:00:00.000Z',
    ),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => fixture.insertAudit.run(
      beneficiaryId,
      staff,
      'EMAIL',
      'AUTHORIZED',
      '2026-11-08T00:00:00.000Z',
    ),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => fixture.insertAudit.run(
      beneficiaryId,
      staff,
      'PHONE',
      'PENDING_AUTHORIZATION',
      '2026-11-08T00:00:00.000Z',
    ),
    /CHECK constraint failed/,
  );

  const otherBeneficiary = database.prepare(`
    INSERT INTO beneficiaries (
      owner_account_id, full_name, date_of_birth, relationship, authorization_status
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    patientB,
    'Fictional Other Beneficiary',
    '2001-02-03',
    'child',
    'AUTHORIZED',
  ).lastInsertRowid;
  assert.throws(
    () => addStaffAppointment(fixture, slot, {
      status: 'CANCELLED',
      beneficiaryId: otherBeneficiary,
    }),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => fixture.insertAppointment.run(
      slot,
      doctorA,
      null,
      patientA,
      staff,
      'STAFF',
      'CANCELLED',
    ),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => fixture.insertAppointment.run(
      slot,
      doctorA,
      beneficiaryId,
      patientB,
      staff,
      'STAFF',
      'CANCELLED',
    ),
    /FOREIGN KEY constraint failed/,
  );
});

test('rolls back the complete transaction when an availability trigger rejects a write', (t) => {
  const fixture = createIntegrityFixture(t);
  const { database, doctorA } = fixture;
  addSlot(fixture, doctorA, '2030-01-01T10:00:00.000Z', '2030-01-01T11:00:00.000Z');

  const insertConflictingSlots = database.transaction(() => {
    addSlot(fixture, doctorA, '2030-01-01T12:00:00.000Z', '2030-01-01T13:00:00.000Z');
    addSlot(fixture, doctorA, '2030-01-01T10:30:00.000Z', '2030-01-01T11:30:00.000Z');
  });

  assert.throws(
    () => insertConflictingSlots.immediate(),
    /Availability slot overlaps an existing slot for this doctor/,
  );
  assert.deepEqual(
    database.prepare(`
      SELECT start_at FROM availability_slots ORDER BY start_at
    `).all(),
    [{ start_at: '2030-01-01T10:00:00.000Z' }],
  );
});

test('reapplying migrations leaves schema and triggers unchanged', (t) => {
  const { database } = createIntegrityFixture(t);
  const initialHistory = database.prepare(`
    SELECT version, applied_at FROM schema_migrations ORDER BY version
  `).all();
  const initialTriggers = database.prepare(`
    SELECT name, tbl_name, sql FROM sqlite_master
    WHERE type = 'trigger' ORDER BY name
  `).all();

  assert.deepEqual(runMigrations(database), []);
  assert.deepEqual(
    database.prepare(`
      SELECT version, applied_at FROM schema_migrations ORDER BY version
    `).all(),
    initialHistory,
  );
  assert.deepEqual(
    database.prepare(`
      SELECT name, tbl_name, sql FROM sqlite_master
      WHERE type = 'trigger' ORDER BY name
    `).all(),
    initialTriggers,
  );
});
