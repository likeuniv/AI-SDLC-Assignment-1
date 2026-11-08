const APPOINTMENT_PROJECTION = `
  appointment.id AS appointmentId,
  appointment.availability_slot_id AS availabilitySlotId,
  appointment.doctor_account_id AS doctorAccountId,
  doctor.professional_name AS doctorName,
  appointment.patient_recipient_account_id AS patientRecipientAccountId,
  appointment.beneficiary_recipient_id AS beneficiaryId,
  appointment.responsible_account_id AS responsibleAccountId,
  appointment.initiated_by_account_id AS initiatedByAccountId,
  appointment.initiated_by_role AS initiatedByRole,
  CASE
    WHEN appointment.patient_recipient_account_id IS NOT NULL THEN 'PATIENT'
    ELSE 'BENEFICIARY'
  END AS recipientType,
  COALESCE(patient.full_name, beneficiary.full_name) AS recipientName,
  COALESCE(patient_profile.date_of_birth, beneficiary.date_of_birth) AS recipientDateOfBirth,
  beneficiary.authorization_status AS beneficiaryAuthorizationStatus,
  slot.start_at AS startAt,
  slot.end_at AS endAt,
  appointment.status,
  appointment.created_at AS createdAt,
  appointment.updated_at AS updatedAt
`;
const APPOINTMENT_FROM = `
  FROM appointments AS appointment
  JOIN availability_slots AS slot
    ON slot.id = appointment.availability_slot_id
  JOIN doctor_profiles AS doctor
    ON doctor.account_id = appointment.doctor_account_id
  LEFT JOIN accounts AS patient
    ON patient.id = appointment.patient_recipient_account_id
  LEFT JOIN patient_profiles AS patient_profile
    ON patient_profile.account_id = appointment.patient_recipient_account_id
  LEFT JOIN beneficiaries AS beneficiary
    ON beneficiary.id = appointment.beneficiary_recipient_id
`;

export function createAppointmentRepository(database) {
  const findPatient = database.prepare(`
    SELECT account_id AS accountId
    FROM patient_profiles WHERE account_id = ?
  `);
  const findDoctor = database.prepare(`
    SELECT account_id FROM doctor_profiles WHERE account_id = ?
  `);
  const findBeneficiary = database.prepare(`
    SELECT id, owner_account_id AS ownerAccountId,
      date_of_birth AS dateOfBirth, authorization_status AS authorizationStatus
    FROM beneficiaries WHERE id = ?
  `);
  const findSlot = database.prepare(`
    SELECT id, doctor_account_id AS doctorAccountId,
      start_at AS startAt, end_at AS endAt
    FROM availability_slots WHERE id = ?
  `);
  const findBookedConflict = database.prepare(`
    SELECT appointment.id
    FROM appointments AS appointment
    JOIN availability_slots AS existing
      ON existing.id = appointment.availability_slot_id
    WHERE appointment.doctor_account_id = ?
      AND appointment.status = 'BOOKED'
      AND existing.start_at < ?
      AND existing.end_at > ?
    LIMIT 1
  `);
  const insertAppointment = database.prepare(`
    INSERT INTO appointments (
      availability_slot_id,
      doctor_account_id,
      patient_recipient_account_id,
      beneficiary_recipient_id,
      responsible_account_id,
      initiated_by_account_id,
      initiated_by_role,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'BOOKED', ?, ?)
  `);
  const markBeneficiaryPending = database.prepare(`
    UPDATE beneficiaries
    SET authorization_status = 'PENDING_AUTHORIZATION', updated_at = ?
    WHERE id = ? AND authorization_status IS NULL
  `);
  const findById = database.prepare(`
    SELECT ${APPOINTMENT_PROJECTION}
    ${APPOINTMENT_FROM}
    WHERE appointment.id = ?
  `);
  const listForPatient = database.prepare(`
    SELECT ${APPOINTMENT_PROJECTION}
    ${APPOINTMENT_FROM}
    WHERE appointment.responsible_account_id = ?
    ORDER BY slot.start_at DESC, appointment.id DESC
  `);
  const listForDoctor = database.prepare(`
    SELECT ${APPOINTMENT_PROJECTION}
    ${APPOINTMENT_FROM}
    WHERE appointment.doctor_account_id = ?
      AND appointment.status = 'BOOKED'
      AND slot.end_at > ?
    ORDER BY slot.start_at, appointment.id
  `);
  const listForStaff = database.prepare(`
    SELECT ${APPOINTMENT_PROJECTION}
    ${APPOINTMENT_FROM}
    WHERE (? IS NULL OR appointment.status = ?)
    ORDER BY slot.start_at DESC, appointment.id DESC
  `);
  const transition = database.prepare(`
    UPDATE appointments
    SET status = ?, updated_at = ?
    WHERE id = ? AND status = 'BOOKED'
  `);

  const book = database.transaction((values) => {
    const patientId = values.responsibleAccountId;
    if (!findPatient.get(patientId)) {
      return { notFound: true };
    }
    if (!findDoctor.get(values.doctorAccountId)) {
      return { doctorNotFound: true };
    }

    if (values.patientRecipientAccountId !== null) {
      if (values.patientRecipientAccountId !== patientId || !findPatient.get(patientId)) {
        return { notFound: true };
      }
    } else {
      const beneficiary = findBeneficiary.get(values.beneficiaryId);
      if (!beneficiary || beneficiary.ownerAccountId !== patientId) {
        return { notFound: true };
      }
      if (values.isAdult(beneficiary.dateOfBirth)) {
        if (beneficiary.authorizationStatus === null) {
          markBeneficiaryPending.run(values.now, beneficiary.id);
          return { beneficiaryNotAuthorized: true };
        }
        if (beneficiary.authorizationStatus !== 'AUTHORIZED') {
          return { beneficiaryNotAuthorized: true };
        }
      }
    }

    const slot = findSlot.get(values.availabilitySlotId);
    if (
      !slot
      || slot.doctorAccountId !== values.doctorAccountId
      || Date.parse(slot.startAt) <= Date.parse(values.now)
    ) {
      return { slotUnavailable: true };
    }
    if (findBookedConflict.get(slot.doctorAccountId, slot.endAt, slot.startAt)) {
      return { slotUnavailable: true };
    }

    const appointmentId = insertAppointment.run(
      slot.id,
      slot.doctorAccountId,
      values.patientRecipientAccountId,
      values.beneficiaryId,
      patientId,
      values.actor.accountId,
      values.actor.role,
      values.now,
      values.now,
    ).lastInsertRowid;
    return { appointment: findById.get(appointmentId) };
  });

  const transitionAppointment = database.transaction(({
    appointmentId,
    actor,
    action,
    now,
    isAdult,
  }) => {
    const appointment = findById.get(appointmentId);
    if (!appointment) {
      return { notFound: true };
    }
    if (action === 'CANCEL' && actor.role === 'PATIENT') {
      if (appointment.patientRecipientAccountId !== actor.accountId) {
        if (!appointment.beneficiaryId) {
          return { notFound: true };
        }
        const beneficiary = findBeneficiary.get(appointment.beneficiaryId);
        if (!beneficiary || beneficiary.ownerAccountId !== actor.accountId) {
          return { notFound: true };
        }
        if (
          isAdult(beneficiary.dateOfBirth)
          && beneficiary.authorizationStatus !== 'AUTHORIZED'
        ) {
          return { beneficiaryNotAuthorized: true };
        }
      }
    } else if (action === 'COMPLETE' && appointment.doctorAccountId !== actor.accountId) {
      return { notFound: true };
    }
    if (appointment.status !== 'BOOKED') {
      return { stateConflict: true };
    }
    if (!transition.run(
      action === 'CANCEL' ? 'CANCELLED' : 'COMPLETED',
      now,
      appointmentId,
    ).changes) {
      return { stateConflict: true };
    }
    return { appointment: findById.get(appointmentId) };
  });

  return Object.freeze({
    findPatient,
    findDoctor,
    findBeneficiary,
    findSlot,
    book: book.immediate,
    findById,
    listForPatient,
    listForDoctor,
    listForStaff,
    transitionAppointment: transitionAppointment.immediate,
  });
}
