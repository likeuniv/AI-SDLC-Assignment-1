import { createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  BENCHMARK_CLOCK_ANCHOR,
  FIXTURE_SEED,
  generateFixture,
  fixtureManifestHash,
} from './fixtures/generator.js';
import { formatHospitalOffsetDateTime } from './fixtures/time.js';
import { apiRequest, authenticate } from './api.js';
import { createIsolatedApplication } from './runtime.js';

const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url));
const Database = requireBackend('better-sqlite3');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function safeAction(name, response, expectedStatus, expectedCode = null) {
  const passed = response.status === expectedStatus
    && (expectedCode === null || response.code === expectedCode);
  const item = {
    name,
    status: response.status,
    expectedStatus,
    ...(response.code ? { code: response.code } : {}),
    passed,
  };
  if (!passed) {
    throw new Error(`Preflight API step "${name}" returned an unexpected response.`);
  }
  return item;
}

async function independentDatabaseChecks(databasePath, reviewedBeneficiaries) {
  const database = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = database.pragma('integrity_check');
    const foreignKeyViolations = database.pragma('foreign_key_check');
    const counts = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM patient_profiles WHERE account_id BETWEEN 1001 AND 1200) AS patients,
        (SELECT COUNT(*) FROM beneficiaries WHERE id BETWEEN 6001 AND 6100) AS beneficiaries,
        (SELECT COUNT(*) FROM doctor_profiles WHERE account_id BETWEEN 2001 AND 2020) AS doctors,
        (SELECT COUNT(*) FROM departments WHERE name LIKE 'Fixture Department %') AS departments,
        (SELECT COUNT(*) FROM availability_slots WHERE id BETWEEN 7001 AND 7300) AS availabilitySlots,
        (SELECT COUNT(*) FROM appointments WHERE id BETWEEN 8001 AND 8500) AS appointments
    `).get();
    const appointmentStatuses = database.prepare(`
      SELECT status, COUNT(*) AS count
      FROM appointments
      WHERE id BETWEEN 8001 AND 8500
      GROUP BY status ORDER BY status
    `).all();
    const activeOverlapCount = database.prepare(`
      SELECT COUNT(*) AS count
      FROM appointments AS first_appointment
      JOIN availability_slots AS first_slot
        ON first_slot.id = first_appointment.availability_slot_id
      JOIN appointments AS second_appointment
        ON second_appointment.id > first_appointment.id
        AND second_appointment.doctor_account_id = first_appointment.doctor_account_id
      JOIN availability_slots AS second_slot
        ON second_slot.id = second_appointment.availability_slot_id
      WHERE first_appointment.status = 'BOOKED'
        AND second_appointment.status = 'BOOKED'
        AND first_slot.start_at < second_slot.end_at
        AND first_slot.end_at > second_slot.start_at
    `).get().count;
    const auditMismatches = database.prepare(`
      SELECT COUNT(*) AS count
      FROM beneficiaries AS beneficiary
      WHERE beneficiary.id BETWEEN 6001 AND 6100
        AND beneficiary.authorization_status IN ('AUTHORIZED', 'REJECTED')
        AND NOT EXISTS (
          SELECT 1
          FROM beneficiary_authorization_audit AS audit
          WHERE audit.beneficiary_id = beneficiary.id
            AND audit.outcome = beneficiary.authorization_status
        )
    `).get().count;
    const reviewedAuditResults = reviewedBeneficiaries.map(({ beneficiaryId, outcome }) => {
      const entries = database.prepare(`
        SELECT outcome, verification_method AS verificationMethod,
          reviewer_role AS reviewerRole, reviewed_at AS reviewedAt
        FROM beneficiary_authorization_audit
        WHERE beneficiary_id = ?
        ORDER BY id
      `).all(beneficiaryId);
      return {
        outcome: entries.length === 1 ? entries[0].outcome : null,
        verificationMethod: entries.length === 1 ? entries[0].verificationMethod : null,
        reviewerRole: entries.length === 1 ? entries[0].reviewerRole : null,
        reviewedAtIsUtc: entries.length === 1 && entries[0].reviewedAt.endsWith('Z'),
        passed: entries.length === 1
          && entries[0].outcome === outcome
          && entries[0].reviewerRole === 'STAFF'
          && entries[0].reviewedAt.endsWith('Z'),
      };
    });
    const sessionCount = database.prepare(`
      SELECT COUNT(*) AS count
      FROM sessions
      WHERE token_hash IS NOT NULL AND length(token_hash) = 64
    `).get().count;
    const seededTimestamps = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM accounts
          WHERE (id BETWEEN 1001 AND 1200 OR id BETWEEN 2001 AND 2020 OR id = 3001)
            AND created_at = ?) AS accounts,
        (SELECT COUNT(*) FROM patient_profiles
          WHERE account_id BETWEEN 1001 AND 1200 AND created_at = ?) AS patients,
        (SELECT COUNT(*) FROM doctor_profiles
          WHERE account_id BETWEEN 2001 AND 2020 AND created_at = ?) AS doctors
    `).get(
      '2026-11-07T00:00:00.000Z',
      '2026-11-07T00:00:00.000Z',
      '2026-11-07T00:00:00.000Z',
    );

    assert(integrity.length === 1 && integrity[0].integrity_check === 'ok', 'SQLite integrity check failed.');
    assert(foreignKeyViolations.length === 0, 'SQLite foreign-key check found a violation.');
    assert(
      Object.values(counts).every((count, index) => count === [200, 100, 20, 10, 300, 500][index]),
      'Read-only SQLite counts do not match the fixture manifest.',
    );
    assert(activeOverlapCount === 0, 'SQLite contains conflicting active appointment intervals.');
    assert(auditMismatches === 0, 'SQLite authorization decisions are missing matching audit records.');
    assert(
      reviewedAuditResults.every(({ passed }) => passed),
      'Read-only SQLite inspection did not confirm the preflight authorization audit entries.',
    );
    assert(sessionCount >= 3, 'Expected authenticated sessions were not persisted as token hashes.');
    assert(
      seededTimestamps.accounts === 221
        && seededTimestamps.patients === 200
        && seededTimestamps.doctors === 20,
      'Seeded account and profile timestamps do not match the fixed clock anchor.',
    );

    return {
      integrityCheck: 'ok',
      foreignKeyViolations: 0,
      fixtureCounts: counts,
      fixtureAppointmentStatusCounts: Object.fromEntries(
        appointmentStatuses.map(({ status, count }) => [status, count]),
      ),
      activeAppointmentOverlapCount: activeOverlapCount,
      missingAuthorizationAuditCount: auditMismatches,
      reviewedBeneficiaryAuditResults: reviewedAuditResults,
      hashedSessionRecordCount: sessionCount,
      seededTimestampsMatchAnchor: true,
      connectionMode: 'read-only SQLite connection',
    };
  } finally {
    database.close();
  }
}

export async function runPreflight({
  hospitalTimeZone,
  seed = FIXTURE_SEED,
  anchor = BENCHMARK_CLOCK_ANCHOR,
} = {}) {
  const fixture = generateFixture({ seed, anchor, hospitalTimeZone });
  const app = await createIsolatedApplication({ fixture });
  assert(
    app.config.now().toISOString() === fixture.manifest.benchmarkClockAnchor,
    'Isolated application clock was not fixed to the manifest anchor.',
  );
  const actions = [];
  const password = randomBytes(32).toString('base64url');
  const email = `phase9-preflight-${seed}@example.test`;
  const patientRegistration = {
    fullName: 'Fictional Harness Patient',
    email,
    password,
  };
  let independentChecks;
  try {
    let response = await apiRequest(app.baseUrl, {
      path: '/api/v1/auth/register',
      method: 'POST',
      body: patientRegistration,
    });
    actions.push(safeAction('patient-registration', response, 201));
    const patientAccountId = response.data.accountId;

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/auth/register',
      method: 'POST',
      body: patientRegistration,
    });
    actions.push(safeAction('duplicate-registration-rejected', response, 409, 'DUPLICATE_RESOURCE'));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/auth/login',
      method: 'POST',
      body: { email: 'unknown-phase9@example.test', password },
    });
    actions.push(safeAction('unknown-account-login-rejected-generically', response, 401, 'INVALID_CREDENTIALS'));

    const patient = await authenticate(app.baseUrl, { email, password });
    actions.push({
      name: 'patient-login-session-and-csrf-acquisition',
      status: 200,
      expectedStatus: 200,
      passed: true,
    });
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/patients/${patientAccountId}`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('patient-profile-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/patients/${patientAccountId}`,
      method: 'PATCH',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: { contactPhone: '5550109000' },
    });
    actions.push(safeAction('patient-profile-update', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/patients/1002',
      cookie: patient.cookie,
    });
    actions.push(safeAction('cross-account-profile-concealment', response, 404, 'RESOURCE_NOT_FOUND'));

    const minorBody = {
      fullName: 'Fictional Minor Beneficiary',
      dateOfBirth: '2015-03-10',
      relationship: 'child',
    };
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/beneficiaries',
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: minorBody,
    });
    actions.push(safeAction('minor-beneficiary-create', response, 201));
    const minorId = response.data.id;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${minorId}`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('minor-beneficiary-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${minorId}`,
      method: 'PATCH',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: { contactPhone: '5550109001' },
    });
    actions.push(safeAction('minor-beneficiary-update', response, 200));

    const staff = await authenticate(app.baseUrl, app.credentials.staff);
    actions.push({
      name: 'staff-login-session-and-csrf-acquisition',
      status: 200,
      expectedStatus: 200,
      passed: true,
    });
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/beneficiaries',
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: {
        fullName: 'Fictional Pending Adult',
        dateOfBirth: '1990-07-12',
        relationship: 'sibling',
      },
    });
    actions.push(safeAction('adult-beneficiary-pending-create', response, 201));
    const pendingBeneficiaryId = response.data.beneficiaryId;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${pendingBeneficiaryId}`,
      cookie: patient.cookie,
    });
    actions.push(safeAction(
      'pending-adult-details-concealed',
      response,
      422,
      'BENEFICIARY_NOT_AUTHORIZED',
    ));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${pendingBeneficiaryId}/authorization-status`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('pending-adult-safe-status-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/admin/beneficiaries/${pendingBeneficiaryId}/authorization-decision`,
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: {
        outcome: 'AUTHORIZED',
        verificationMethod: 'PHONE',
        directConfirmation: true,
      },
    });
    actions.push(safeAction('adult-beneficiary-authorized-by-staff', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/admin/beneficiaries/${pendingBeneficiaryId}/authorization-decision`,
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: {
        outcome: 'REJECTED',
        verificationMethod: 'PHONE',
        directConfirmation: true,
      },
    });
    actions.push(safeAction(
      'repeated-authorization-transition-rejected',
      response,
      409,
      'BENEFICIARY_STATE_CONFLICT',
    ));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${pendingBeneficiaryId}`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('authorized-adult-profile-read', response, 200));

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/beneficiaries',
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: {
        fullName: 'Fictional Rejected Adult',
        dateOfBirth: '1989-04-04',
        relationship: 'parent',
      },
    });
    actions.push(safeAction('second-adult-beneficiary-pending-create', response, 201));
    const rejectedBeneficiaryId = response.data.beneficiaryId;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/admin/beneficiaries/${rejectedBeneficiaryId}/authorization-decision`,
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: {
        outcome: 'REJECTED',
        verificationMethod: 'IN_PERSON',
        directConfirmation: true,
      },
    });
    actions.push(safeAction('adult-beneficiary-rejected-by-staff', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${rejectedBeneficiaryId}`,
      cookie: patient.cookie,
    });
    actions.push(safeAction(
      'rejected-adult-details-concealed',
      response,
      422,
      'BENEFICIARY_NOT_AUTHORIZED',
    ));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/beneficiaries/${rejectedBeneficiaryId}/authorization-status`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('rejected-adult-safe-status-read', response, 200));

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/doctors?name=Fixture%20Doctor&page=1&pageSize=20',
      cookie: patient.cookie,
    });
    actions.push(safeAction('doctor-search', response, 200));
    assert(response.data.total === 20, 'Doctor discovery did not return the deterministic fixture cohort.');
    response = await apiRequest(app.baseUrl, { path: '/api/v1/departments' });
    actions.push(safeAction('department-discovery', response, 200));
    assert(response.data.length >= fixture.departments.length, 'Department discovery omitted seeded departments.');
    const fixtureDepartmentId = fixture.departments[0].id;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/departments/${fixtureDepartmentId}`,
    });
    actions.push(safeAction('department-read', response, 200));

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/departments',
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: { name: 'Phase 9 Harness Department', description: 'Fictional preflight department' },
    });
    actions.push(safeAction('staff-department-create', response, 201));
    const createdDepartmentId = response.data.id;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/departments/${createdDepartmentId}`,
      method: 'PATCH',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: { description: 'Updated fictional department' },
    });
    actions.push(safeAction('staff-department-update', response, 200));

    const doctorPassword = randomBytes(32).toString('base64url');
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/doctors',
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: {
        email: `phase9-doctor-${seed}@example.test`,
        password: doctorPassword,
        professionalName: 'Harness Provisioned Doctor',
        professionalSummary: 'Fictional preflight profile',
        departmentIds: [createdDepartmentId],
        specializationIds: [fixture.specializations[0].id],
      },
    });
    actions.push(safeAction('staff-doctor-provision', response, 201));
    const provisionedDoctorId = response.data.accountId;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/departments/${createdDepartmentId}/doctors`,
      method: 'PUT',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: { doctorAccountIds: [provisionedDoctorId] },
    });
    actions.push(safeAction('staff-doctor-department-association', response, 200));

    const doctor = await authenticate(app.baseUrl, {
      email: `phase9-doctor-${seed}@example.test`,
      password: doctorPassword,
    });
    actions.push({
      name: 'doctor-login-session-and-csrf-acquisition',
      status: 200,
      expectedStatus: 200,
      passed: true,
    });
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/admin/dashboard',
      cookie: doctor.cookie,
    });
    actions.push(safeAction('doctor-denied-staff-dashboard', response, 403, 'FORBIDDEN'));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/doctors/me',
      cookie: doctor.cookie,
    });
    actions.push(safeAction('doctor-own-profile-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/doctors/me',
      method: 'PATCH',
      cookie: doctor.cookie,
      csrfToken: doctor.csrfToken,
      body: { professionalSummary: 'Updated fictional preflight profile' },
    });
    actions.push(safeAction('doctor-own-profile-update', response, 200));

    const firstStart = new Date(Date.parse(anchor) + 45 * 24 * 60 * 60 * 1000);
    const secondStart = new Date(firstStart.getTime() + 24 * 60 * 60 * 1000);
    const thirdStart = new Date(secondStart.getTime() + 24 * 60 * 60 * 1000);
    async function createSlot(start, end, name) {
      const slotResponse = await apiRequest(app.baseUrl, {
        path: `/api/v1/doctors/${provisionedDoctorId}/availability`,
        method: 'POST',
        cookie: doctor.cookie,
        csrfToken: doctor.csrfToken,
        body: {
          startAt: formatHospitalOffsetDateTime(start, hospitalTimeZone),
          endAt: formatHospitalOffsetDateTime(end, hospitalTimeZone),
        },
      });
      actions.push(safeAction(name, slotResponse, 201));
      return slotResponse.data.id;
    }
    const firstSlotId = await createSlot(
      firstStart,
      new Date(firstStart.getTime() + 30 * 60 * 1000),
      'doctor-availability-create',
    );
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/doctors/${provisionedDoctorId}/availability?page=1&pageSize=20`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('patient-future-availability-read', response, 200));
    assert(
      response.data.items.some(({ id }) => id === firstSlotId),
      'Patient availability discovery omitted the newly available future slot.',
    );

    const secondSlotId = await createSlot(
      secondStart,
      new Date(secondStart.getTime() + 30 * 60 * 1000),
      'second-doctor-availability-create',
    );
    const thirdSlotId = await createSlot(
      thirdStart,
      new Date(thirdStart.getTime() + 30 * 60 * 1000),
      'third-doctor-availability-create',
    );
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/appointments',
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: {
        doctorAccountId: provisionedDoctorId,
        availabilitySlotId: firstSlotId,
        patientRecipientAccountId: patientAccountId,
      },
    });
    actions.push(safeAction('patient-appointment-booking', response, 201));
    const patientAppointmentId = response.data.appointmentId;
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/appointments?page=1&pageSize=20&view=upcoming',
      cookie: patient.cookie,
    });
    actions.push(safeAction('patient-upcoming-appointments', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/appointments/${patientAppointmentId}`,
      cookie: patient.cookie,
    });
    actions.push(safeAction('patient-appointment-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/appointments/${patientAppointmentId}/cancellation`,
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
    });
    actions.push(safeAction('patient-appointment-cancellation', response, 200));
    assert(response.data.status === 'CANCELLED', 'Patient cancellation did not reach the expected terminal state.');

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/appointments',
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
      body: {
        doctorAccountId: provisionedDoctorId,
        availabilitySlotId: secondSlotId,
        responsibleAccountId: patientAccountId,
        patientRecipientAccountId: patientAccountId,
      },
    });
    actions.push(safeAction('staff-on-behalf-appointment-booking', response, 201));
    const staffAppointmentId = response.data.appointmentId;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/appointments/${staffAppointmentId}/cancellation`,
      method: 'POST',
      cookie: staff.cookie,
      csrfToken: staff.csrfToken,
    });
    actions.push(safeAction('permission-scoped-staff-appointment-cancellation', response, 200));

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/appointments',
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
      body: {
        doctorAccountId: provisionedDoctorId,
        availabilitySlotId: thirdSlotId,
        patientRecipientAccountId: patientAccountId,
      },
    });
    actions.push(safeAction('second-patient-appointment-booking', response, 201));
    const completionAppointmentId = response.data.appointmentId;
    response = await apiRequest(app.baseUrl, {
      path: `/api/v1/appointments/${completionAppointmentId}/completion`,
      method: 'POST',
      cookie: doctor.cookie,
      csrfToken: doctor.csrfToken,
    });
    actions.push(safeAction('assigned-doctor-appointment-completion', response, 200));

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/admin/patients?page=1&pageSize=20',
      cookie: staff.cookie,
    });
    actions.push(safeAction('staff-paginated-patient-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/admin/appointments?page=1&pageSize=20',
      cookie: staff.cookie,
    });
    actions.push(safeAction('permission-scoped-staff-appointment-read', response, 200));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/admin/dashboard',
      cookie: staff.cookie,
    });
    actions.push(safeAction('staff-dashboard-read', response, 200));

    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/auth/logout',
      method: 'POST',
      cookie: patient.cookie,
      csrfToken: patient.csrfToken,
    });
    actions.push(safeAction('patient-logout', response, 204));
    response = await apiRequest(app.baseUrl, {
      path: '/api/v1/auth/session',
      cookie: patient.cookie,
    });
    actions.push(safeAction(
      'invalidated-session-rejected',
      response,
      401,
      'AUTHENTICATION_REQUIRED',
    ));

    await app.shutdown();
    independentChecks = await independentDatabaseChecks(app.databasePath, [
      { beneficiaryId: pendingBeneficiaryId, outcome: 'AUTHORIZED' },
      { beneficiaryId: rejectedBeneficiaryId, outcome: 'REJECTED' },
    ]);
    assert(
      app.logEntries.length === 0,
      'Application logged an unexpected server error during the public API preflight.',
    );

    return {
      manifest: fixture.manifest,
      manifestSha256: fixtureManifestHash(fixture.manifest),
      benchmarkClockAnchor: fixture.manifest.benchmarkClockAnchor,
      hospitalTimeZone,
      applicationClock: app.config.now().toISOString(),
      clockScope: 'clock injection is confined to the isolated app configuration',
      actionCount: actions.length,
      actions,
      independentDatabaseChecks: independentChecks,
      sanitized: true,
    };
  } finally {
    await app.dispose();
  }
}

export function preflightFingerprint(result) {
  const deterministic = {
    manifestSha256: result.manifestSha256,
    benchmarkClockAnchor: result.benchmarkClockAnchor,
    hospitalTimeZone: result.hospitalTimeZone,
    actionCount: result.actionCount,
    actions: result.actions,
    independentDatabaseChecks: result.independentDatabaseChecks,
  };
  return createHash('sha256').update(JSON.stringify(deterministic)).digest('hex');
}
