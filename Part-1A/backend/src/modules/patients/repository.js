export function createPatientRepository(database) {
  const findByAccountId = database.prepare(`
    SELECT accounts.id AS accountId,
      accounts.full_name AS fullName,
      accounts.email_normalized AS email,
      patient_profiles.date_of_birth AS dateOfBirth,
      patient_profiles.gender AS gender,
      patient_profiles.contact_email AS contactEmail,
      patient_profiles.contact_phone AS contactPhone,
      patient_profiles.created_at AS createdAt,
      patient_profiles.updated_at AS updatedAt
    FROM patient_profiles
    JOIN accounts ON accounts.id = patient_profiles.account_id
    WHERE patient_profiles.account_id = ?
  `);
  const updateProfile = database.prepare(`
    UPDATE patient_profiles
    SET date_of_birth = ?,
      gender = ?,
      contact_email = ?,
      contact_phone = ?,
      updated_at = ?
    WHERE account_id = ?
  `);
  const countForStaff = database.prepare(`
    SELECT COUNT(*) AS total FROM patient_profiles
  `);
  const listForStaff = database.prepare(`
    SELECT patient_profiles.account_id AS patientAccountId,
      accounts.full_name AS fullName,
      patient_profiles.date_of_birth AS dateOfBirth
    FROM patient_profiles
    JOIN accounts ON accounts.id = patient_profiles.account_id
    ORDER BY accounts.full_name COLLATE NOCASE, patient_profiles.account_id
    LIMIT ? OFFSET ?
  `);

  return Object.freeze({
    findByAccountId(accountId) {
      return findByAccountId.get(accountId);
    },
    listForStaff(limit, offset) {
      return {
        total: countForStaff.get().total,
        items: listForStaff.all(limit, offset),
      };
    },
    updateProfile(accountId, values, updatedAt) {
      return updateProfile.run(
        values.dateOfBirth,
        values.gender,
        values.contactEmail,
        values.contactPhone,
        updatedAt,
        accountId,
      ).changes === 1;
    },
  });
}
