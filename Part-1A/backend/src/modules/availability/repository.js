export function createAvailabilityRepository(database) {
  const findDoctor = database.prepare(`
    SELECT account_id FROM doctor_profiles WHERE account_id = ?
  `);
  const findSlot = database.prepare(`
    SELECT id, doctor_account_id AS doctorAccountId,
      start_at AS startAt, end_at AS endAt,
      created_at AS createdAt, updated_at AS updatedAt
    FROM availability_slots
    WHERE doctor_account_id = ? AND id = ?
  `);
  const findOverlap = database.prepare(`
    SELECT id FROM availability_slots
    WHERE doctor_account_id = ?
      AND start_at < ?
      AND end_at > ?
      AND (? IS NULL OR id <> ?)
    LIMIT 1
  `);
  const findAppointment = database.prepare(`
    SELECT id, status FROM appointments WHERE availability_slot_id = ? LIMIT 1
  `);
  const countPatientSlots = database.prepare(`
    SELECT COUNT(*) AS total
    FROM availability_slots AS slot
    WHERE slot.doctor_account_id = ?
      AND slot.start_at > ?
      AND NOT EXISTS (
        SELECT 1 FROM appointments AS appointment
        WHERE appointment.availability_slot_id = slot.id
          AND appointment.status = 'BOOKED'
      )
  `);
  const listPatientSlots = database.prepare(`
    SELECT slot.id, slot.start_at AS startAt, slot.end_at AS endAt
    FROM availability_slots AS slot
    WHERE slot.doctor_account_id = ?
      AND slot.start_at > ?
      AND NOT EXISTS (
        SELECT 1 FROM appointments AS appointment
        WHERE appointment.availability_slot_id = slot.id
          AND appointment.status = 'BOOKED'
      )
    ORDER BY slot.start_at, slot.id
    LIMIT ? OFFSET ?
  `);
  const countScheduleSlots = database.prepare(`
    SELECT COUNT(*) AS total FROM availability_slots WHERE doctor_account_id = ?
  `);
  const listScheduleSlots = database.prepare(`
    SELECT slot.id, slot.start_at AS startAt, slot.end_at AS endAt,
      slot.created_at AS createdAt, slot.updated_at AS updatedAt,
      EXISTS (
        SELECT 1 FROM appointments AS appointment
        WHERE appointment.availability_slot_id = slot.id
          AND appointment.status = 'BOOKED'
      ) AS isBooked
    FROM availability_slots AS slot
    WHERE slot.doctor_account_id = ?
    ORDER BY slot.start_at, slot.id
    LIMIT ? OFFSET ?
  `);
  const insertSlot = database.prepare(`
    INSERT INTO availability_slots (doctor_account_id, start_at, end_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateSlot = database.prepare(`
    UPDATE availability_slots SET start_at = ?, end_at = ?, updated_at = ?
    WHERE doctor_account_id = ? AND id = ?
  `);
  const deleteSlot = database.prepare(`
    DELETE FROM availability_slots WHERE doctor_account_id = ? AND id = ?
  `);

  const createSlot = database.transaction((doctorId, startAt, endAt, timestamp) => {
    if (Date.parse(startAt) <= Date.parse(timestamp)) {
      return { invalid: [{ field: 'startAt', issue: 'must be in the future' }] };
    }
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      return { invalid: [{ field: 'endAt', issue: 'must be later than startAt' }] };
    }
    if (findOverlap.get(doctorId, endAt, startAt, null, null)) {
      return { overlap: true };
    }
    const id = insertSlot.run(doctorId, startAt, endAt, timestamp, timestamp).lastInsertRowid;
    return { slot: findSlot.get(doctorId, id) };
  });

  const editSlot = database.transaction((doctorId, slotId, values, timestamp) => {
    const current = findSlot.get(doctorId, slotId);
    if (!current) {
      return { notFound: true };
    }
    const startAt = values.startAt ?? current.startAt;
    const endAt = values.endAt ?? current.endAt;
    const invalid = [];
    if (Date.parse(startAt) <= Date.parse(timestamp)) {
      invalid.push({ field: 'startAt', issue: 'must be in the future' });
    }
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      invalid.push({ field: 'endAt', issue: 'must be later than startAt' });
    }
    if (invalid.length > 0) {
      return { invalid };
    }
    if (findAppointment.get(slotId)) {
      return { occupied: true };
    }
    if (findOverlap.get(doctorId, endAt, startAt, slotId, slotId)) {
      return { overlap: true };
    }
    updateSlot.run(startAt, endAt, timestamp, doctorId, slotId);
    return { slot: findSlot.get(doctorId, slotId) };
  });

  const removeSlot = database.transaction((doctorId, slotId) => {
    if (!findSlot.get(doctorId, slotId)) {
      return { notFound: true };
    }
    if (findAppointment.get(slotId)) {
      return { occupied: true };
    }
    deleteSlot.run(doctorId, slotId);
    return { deleted: true };
  });

  return Object.freeze({
    findDoctor,
    findSlot,
    countPatientSlots,
    listPatientSlots,
    countScheduleSlots,
    listScheduleSlots,
    createSlot: createSlot.immediate,
    editSlot: editSlot.immediate,
    removeSlot: removeSlot.immediate,
  });
}
