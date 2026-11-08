import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrate.js';

const TEST_PASSWORD_HASH = `$2b$12$${'a'.repeat(53)}`;

function createSchemaDatabase(t) {
  const directory = mkdtempSync(join(tmpdir(), 'hms-schema-'));
  const database = createDatabase({ filename: join(directory, 'schema.sqlite') });
  t.after(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });
  assert.deepEqual(runMigrations(database), [1]);
  return database;
}

function insertAccount(database, role, email = `${role.toLowerCase()}@example.test`) {
  return database.prepare(`
    INSERT INTO accounts (full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(`${role} Person`, email, TEST_PASSWORD_HASH, role).lastInsertRowid;
}

function insertDepartment(database, name = 'Cardiology') {
  return database.prepare('INSERT INTO departments (name) VALUES (?)').run(name).lastInsertRowid;
}

function insertSpecialization(database, name = 'Cardiology') {
  return database.prepare('INSERT INTO specializations (name) VALUES (?)').run(name).lastInsertRowid;
}

function insertBeneficiary(database, ownerAccountId, overrides = {}) {
  const values = {
    fullName: 'Fictional Beneficiary',
    dateOfBirth: '2000-01-02',
    relationship: 'other',
    relationshipDescription: 'Fictional relationship',
    authorizationStatus: null,
    ...overrides,
  };
  return database.prepare(`
    INSERT INTO beneficiaries (
      owner_account_id,
      full_name,
      date_of_birth,
      relationship,
      relationship_description,
      authorization_status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    ownerAccountId,
    values.fullName,
    values.dateOfBirth,
    values.relationship,
    values.relationshipDescription,
    values.authorizationStatus,
  ).lastInsertRowid;
}

test('creates all T006 schema tables and primary keys', (t) => {
  const database = createSchemaDatabase(t);
  const expectedTables = [
    'accounts',
    'patient_profiles',
    'beneficiaries',
    'doctor_profiles',
    'departments',
    'specializations',
    'doctor_departments',
    'doctor_specializations',
    'sessions',
  ];
  const actualTables = database.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      AND name <> 'schema_migrations'
    ORDER BY name
  `).all().map(({ name }) => name);

  assert.deepEqual(actualTables, [...expectedTables].sort());

  for (const tableName of expectedTables) {
    const columns = database.pragma(`table_info(${tableName})`);
    assert.ok(columns.some(({ pk }) => pk > 0), `${tableName} should have a primary key`);
  }
});

test('enforces account requirements and normalized email uniqueness', (t) => {
  const database = createSchemaDatabase(t);
  insertAccount(database, 'PATIENT');

  assert.throws(
    () => database.prepare(`
      INSERT INTO accounts (full_name, email_normalized, password_hash, role)
      VALUES (?, ?, ?, ?)
      `).run('Second Patient', 'patient@example.test', TEST_PASSWORD_HASH, 'PATIENT'),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO accounts (full_name, email_normalized, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Invalid Role', 'invalid@example.test', TEST_PASSWORD_HASH, 'BENEFICIARY'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO accounts (full_name, email_normalized, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Whitespace Email', ' user@example.test ', TEST_PASSWORD_HASH, 'PATIENT'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO accounts (full_name, email_normalized, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Plaintext Password', 'plaintext@example.test', 'plaintext-password', 'PATIENT'),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => database.prepare(`
      INSERT INTO accounts (id, full_name, email_normalized, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(1, 'Duplicate ID', 'duplicate-id@example.test', TEST_PASSWORD_HASH, 'PATIENT'),
    /UNIQUE constraint failed/,
  );
});

test('enforces patient profile one-to-one and patient account ownership', (t) => {
  const database = createSchemaDatabase(t);
  const patientAccountId = insertAccount(database, 'PATIENT');
  const profileInsert = database.prepare(`
    INSERT INTO patient_profiles (account_id, date_of_birth, gender)
    VALUES (?, ?, ?)
  `);
  profileInsert.run(patientAccountId, '1990-02-28', 'Self-described');

  assert.throws(
    () => profileInsert.run(patientAccountId, null, null),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => profileInsert.run(9999, null, null),
    /FOREIGN KEY constraint failed/,
  );
  const doctorAccountId = insertAccount(database, 'DOCTOR', 'doctor@example.test');
  assert.throws(
    () => profileInsert.run(doctorAccountId, null, null),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => profileInsert.run(patientAccountId + 100, '2001-02-28', null),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => profileInsert.run(patientAccountId + 1, '2001-02-29', null),
    /CHECK constraint failed/,
  );
});

test('enforces beneficiary ownership, approved relationships, dates and nullable authorization status', (t) => {
  const database = createSchemaDatabase(t);
  const patientAccountId = insertAccount(database, 'PATIENT');
  const staffAccountId = insertAccount(database, 'STAFF', 'staff@example.test');
  const minorId = insertBeneficiary(database, patientAccountId, {
    fullName: 'Fictional Minor',
    dateOfBirth: '2012-01-02',
    relationship: 'child',
    relationshipDescription: null,
  });
  assert.equal(
    database.prepare('SELECT authorization_status FROM beneficiaries WHERE id = ?')
      .get(minorId).authorization_status,
    null,
  );

  assert.throws(
    () => insertBeneficiary(database, 9999),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => insertBeneficiary(database, staffAccountId),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => insertBeneficiary(database, patientAccountId, {
      relationship: 'cousin',
      relationshipDescription: null,
    }),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertBeneficiary(database, patientAccountId, {
      relationship: 'other',
      relationshipDescription: '  ',
    }),
    /CHECK constraint failed/,
  );
  assert.throws(
    () => insertBeneficiary(database, patientAccountId, {
      relationship: 'child',
      relationshipDescription: null,
      dateOfBirth: '2001-02-29',
    }),
    /CHECK constraint failed/,
  );
  const columns = database.pragma('table_info(beneficiaries)').map(({ name }) => name);
  assert.equal(columns.includes('account_id'), false);
  assert.equal(columns.includes('password_hash'), false);
});

test('accepts only the approved adult beneficiary authorization states', (t) => {
  const database = createSchemaDatabase(t);
  const patientAccountId = insertAccount(database, 'PATIENT');
  const approvedStatuses = [
    'PENDING_AUTHORIZATION',
    'AUTHORIZED',
    'REJECTED',
  ];

  for (const [index, authorizationStatus] of approvedStatuses.entries()) {
    insertBeneficiary(database, patientAccountId, {
      fullName: `Fictional Adult ${index + 1}`,
      dateOfBirth: '1990-01-02',
      relationship: 'child',
      relationshipDescription: null,
      authorizationStatus,
    });
  }

  assert.deepEqual(
    database.prepare(`
      SELECT authorization_status FROM beneficiaries ORDER BY id
    `).all().map(({ authorization_status: status }) => status),
    approvedStatuses,
  );
  assert.throws(
    () => insertBeneficiary(database, patientAccountId, {
      fullName: 'Fictional Adult Invalid State',
      dateOfBirth: '1990-01-02',
      relationship: 'child',
      relationshipDescription: null,
      authorizationStatus: 'UNDER_REVIEW',
    }),
    /CHECK constraint failed/,
  );
});

test('enforces doctor profiles belong uniquely to doctor accounts', (t) => {
  const database = createSchemaDatabase(t);
  const doctorAccountId = insertAccount(database, 'DOCTOR');
  const doctorInsert = database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name)
    VALUES (?, ?)
  `);
  doctorInsert.run(doctorAccountId, 'Fictional Doctor');

  assert.throws(
    () => doctorInsert.run(doctorAccountId, 'Another Name'),
    /UNIQUE constraint failed/,
  );
  const patientAccountId = insertAccount(database, 'PATIENT', 'patient@example.test');
  assert.throws(
    () => doctorInsert.run(patientAccountId, 'Wrong Role'),
    /FOREIGN KEY constraint failed/,
  );
});

test('enforces unique department and specialization names case-insensitively', (t) => {
  const database = createSchemaDatabase(t);
  insertDepartment(database);
  insertSpecialization(database);

  assert.throws(() => insertDepartment(database, 'CARDIOLOGY'), /UNIQUE constraint failed/);
  assert.throws(
    () => insertSpecialization(database, 'CARDIOLOGY'),
    /UNIQUE constraint failed/,
  );
});

test('enforces session token-hash uniqueness and account references', (t) => {
  const database = createSchemaDatabase(t);
  const patientAccountId = insertAccount(database, 'PATIENT');
  const sessionInsert = database.prepare(`
    INSERT INTO sessions (account_id, token_hash, expires_at) VALUES (?, ?, ?)
  `);
  sessionInsert.run(patientAccountId, 'fictional-session-token-hash', '2999-01-01T00:00:00.000Z');

  assert.throws(
    () => sessionInsert.run(patientAccountId, 'fictional-session-token-hash', '2999-01-02T00:00:00.000Z'),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => sessionInsert.run(9999, 'another-fictional-session-hash', '2999-01-02T00:00:00.000Z'),
    /FOREIGN KEY constraint failed/,
  );
});

test('enforces unique doctor-department and doctor-specialization associations', (t) => {
  const database = createSchemaDatabase(t);
  const doctorAccountId = insertAccount(database, 'DOCTOR');
  database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name) VALUES (?, ?)
  `).run(doctorAccountId, 'Fictional Doctor');
  const departmentId = insertDepartment(database);
  const specializationId = insertSpecialization(database);

  const departmentAssociation = database.prepare(`
    INSERT INTO doctor_departments (doctor_account_id, department_id) VALUES (?, ?)
  `);
  const specializationAssociation = database.prepare(`
    INSERT INTO doctor_specializations (doctor_account_id, specialization_id) VALUES (?, ?)
  `);
  departmentAssociation.run(doctorAccountId, departmentId);
  specializationAssociation.run(doctorAccountId, specializationId);

  assert.throws(
    () => departmentAssociation.run(doctorAccountId, departmentId),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => specializationAssociation.run(doctorAccountId, specializationId),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => departmentAssociation.run(9999, departmentId),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => specializationAssociation.run(doctorAccountId, 9999),
    /FOREIGN KEY constraint failed/,
  );
});

test('enforces restrictive deletion for dependent profiles, beneficiaries, associations and sessions', (t) => {
  const database = createSchemaDatabase(t);
  const patientAccountId = insertAccount(database, 'PATIENT');
  const doctorAccountId = insertAccount(database, 'DOCTOR', 'doctor@example.test');
  const profile = database.prepare(`
    INSERT INTO patient_profiles (account_id) VALUES (?)
  `);
  profile.run(patientAccountId);
  insertBeneficiary(database, patientAccountId);
  database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name) VALUES (?, ?)
  `).run(doctorAccountId, 'Fictional Doctor');
  const departmentId = insertDepartment(database);
  const specializationId = insertSpecialization(database);
  database.prepare(`
    INSERT INTO doctor_departments (doctor_account_id, department_id) VALUES (?, ?)
  `).run(doctorAccountId, departmentId);
  database.prepare(`
    INSERT INTO doctor_specializations (doctor_account_id, specialization_id) VALUES (?, ?)
  `).run(doctorAccountId, specializationId);
  database.prepare(`
    INSERT INTO sessions (account_id, token_hash, expires_at) VALUES (?, ?, ?)
  `).run(patientAccountId, 'fictional-hash-1', '2999-01-01T00:00:00.000Z');

  const deleteAccount = database.prepare('DELETE FROM accounts WHERE id = ?');
  assert.throws(() => deleteAccount.run(patientAccountId), /FOREIGN KEY constraint failed/);
  assert.throws(() => deleteAccount.run(doctorAccountId), /FOREIGN KEY constraint failed/);
  assert.throws(() => database.prepare('DELETE FROM departments WHERE id = ?').run(departmentId), /FOREIGN KEY constraint failed/);
  assert.throws(
    () => database.prepare('DELETE FROM specializations WHERE id = ?').run(specializationId),
    /FOREIGN KEY constraint failed/,
  );
  assert.throws(
    () => database.prepare('DELETE FROM doctor_profiles WHERE account_id = ?').run(doctorAccountId),
    /FOREIGN KEY constraint failed/,
  );
});

test('creates required lookup indexes and remains repeatable', (t) => {
  const database = createSchemaDatabase(t);
  const initialSchemaObjects = database.prepare(`
    SELECT type, name, tbl_name FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();
  const indexNames = initialSchemaObjects
    .filter(({ type }) => type === 'index')
    .map(({ name }) => name);

  assert.deepEqual(runMigrations(database), []);
  assert.deepEqual(
    database.prepare(`
      SELECT type, name, tbl_name FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `).all(),
    initialSchemaObjects,
  );
  for (const name of [
    'idx_beneficiaries_owner_status',
    'idx_doctor_profiles_name',
    'idx_doctor_departments_department',
    'idx_doctor_specializations_specialization',
    'idx_sessions_account_expiry',
  ]) {
    assert.ok(indexNames.includes(name), `expected index ${name}`);
  }
});
