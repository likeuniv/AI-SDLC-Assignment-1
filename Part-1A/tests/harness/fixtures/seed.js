const PLACEHOLDER_PASSWORD_HASH = `$2b$04$${'a'.repeat(53)}`;

export function seedFixture(database, fixture, {
  patientPasswordHash = PLACEHOLDER_PASSWORD_HASH,
  staffPasswordHash = PLACEHOLDER_PASSWORD_HASH,
} = {}) {
  const insertAccount = database.prepare(`
    INSERT INTO accounts (
      id, full_name, email_normalized, password_hash, role, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPatient = database.prepare(`
    INSERT INTO patient_profiles (account_id, date_of_birth, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertDepartment = database.prepare(`
    INSERT INTO departments (id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertSpecialization = database.prepare(`
    INSERT INTO specializations (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const insertDoctor = database.prepare(`
    INSERT INTO doctor_profiles (
      account_id, professional_name, professional_summary, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertDoctorDepartment = database.prepare(`
    INSERT INTO doctor_departments (doctor_account_id, department_id)
    VALUES (?, ?)
  `);
  const insertDoctorSpecialization = database.prepare(`
    INSERT INTO doctor_specializations (doctor_account_id, specialization_id)
    VALUES (?, ?)
  `);
  const insertBeneficiary = database.prepare(`
    INSERT INTO beneficiaries (
      id, owner_account_id, full_name, date_of_birth, relationship,
      authorization_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSlot = database.prepare(`
    INSERT INTO availability_slots (
      id, doctor_account_id, start_at, end_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAppointment = database.prepare(`
    INSERT INTO appointments (
      id, availability_slot_id, doctor_account_id, patient_recipient_account_id,
      beneficiary_recipient_id, responsible_account_id, initiated_by_account_id,
      initiated_by_role, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAudit = database.prepare(`
    INSERT INTO beneficiary_authorization_audit (
      beneficiary_id, reviewer_account_id, verification_method, outcome, reviewed_at
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const anchor = fixture.manifest.benchmarkClockAnchor;

  database.transaction(() => {
    for (const department of fixture.departments) {
      insertDepartment.run(
        department.id,
        department.name,
        department.description,
        anchor,
        anchor,
      );
    }
    for (const specialization of fixture.specializations) {
      insertSpecialization.run(
        specialization.id,
        specialization.name,
        anchor,
        anchor,
      );
    }
    for (const patient of fixture.patients) {
      insertAccount.run(
        patient.accountId,
        patient.fullName,
        patient.email,
        patient.accountId === fixture.patients[0].accountId
          ? patientPasswordHash
          : PLACEHOLDER_PASSWORD_HASH,
        'PATIENT',
        anchor,
        anchor,
      );
      insertPatient.run(patient.accountId, patient.dateOfBirth, anchor, anchor);
    }
    insertAccount.run(
      fixture.staff.accountId,
      fixture.staff.fullName,
      fixture.staff.email,
      staffPasswordHash,
      'STAFF',
      anchor,
      anchor,
    );
    for (const doctor of fixture.doctors) {
      insertAccount.run(
        doctor.accountId,
        doctor.fullName,
        doctor.email,
        PLACEHOLDER_PASSWORD_HASH,
        'DOCTOR',
        anchor,
        anchor,
      );
      insertDoctor.run(
        doctor.accountId,
        doctor.professionalName,
        doctor.professionalSummary,
        anchor,
        anchor,
      );
      for (const departmentId of doctor.departmentIds) {
        insertDoctorDepartment.run(doctor.accountId, departmentId);
      }
      for (const specializationId of doctor.specializationIds) {
        insertDoctorSpecialization.run(doctor.accountId, specializationId);
      }
    }
    for (const beneficiary of fixture.beneficiaries) {
      insertBeneficiary.run(
        beneficiary.id,
        beneficiary.ownerAccountId,
        beneficiary.fullName,
        beneficiary.dateOfBirth,
        beneficiary.relationship,
        beneficiary.authorizationStatus,
        beneficiary.createdAt,
        beneficiary.updatedAt,
      );
    }
    for (const slot of fixture.availabilitySlots) {
      insertSlot.run(
        slot.id,
        slot.doctorAccountId,
        slot.startAt,
        slot.endAt,
        slot.createdAt,
        slot.updatedAt,
      );
    }
    for (const appointment of fixture.appointments) {
      insertAppointment.run(
        appointment.appointmentId,
        appointment.availabilitySlotId,
        appointment.doctorAccountId,
        appointment.patientRecipientAccountId,
        appointment.beneficiaryId,
        appointment.responsibleAccountId,
        appointment.initiatedByAccountId,
        appointment.initiatedByRole,
        appointment.status,
        appointment.createdAt,
        appointment.updatedAt,
      );
    }
    for (const audit of fixture.authorizationAudits) {
      insertAudit.run(
        audit.beneficiaryId,
        audit.reviewerAccountId,
        audit.verificationMethod,
        audit.outcome,
        audit.reviewedAt,
      );
    }
  }).immediate();

  return {
    patients: fixture.patients.length,
    beneficiaries: fixture.beneficiaries.length,
    doctors: fixture.doctors.length,
    departments: fixture.departments.length,
    availabilitySlots: fixture.availabilitySlots.length,
    appointments: fixture.appointments.length,
    authorizationAudits: fixture.authorizationAudits.length,
  };
}
