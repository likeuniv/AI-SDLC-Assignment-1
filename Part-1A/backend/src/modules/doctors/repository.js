export function createDoctorRepository(database) {
  const countDiscoverable = database.prepare(`
    SELECT COUNT(*) AS total
    FROM doctor_profiles AS doctor
    WHERE (? IS NULL OR instr(lower(doctor.professional_name), lower(?)) > 0)
      AND (
        ? IS NULL
        OR EXISTS (
          SELECT 1
          FROM doctor_specializations AS association
          JOIN specializations AS specialization
            ON specialization.id = association.specialization_id
          WHERE association.doctor_account_id = doctor.account_id
            AND instr(lower(specialization.name), lower(?)) > 0
        )
      )
  `);
  const searchDiscoverable = database.prepare(`
    SELECT doctor.account_id AS id,
      doctor.professional_name AS professionalName,
      doctor.professional_summary AS professionalSummary
    FROM doctor_profiles AS doctor
    WHERE (? IS NULL OR instr(lower(doctor.professional_name), lower(?)) > 0)
      AND (
        ? IS NULL
        OR EXISTS (
          SELECT 1
          FROM doctor_specializations AS association
          JOIN specializations AS specialization
            ON specialization.id = association.specialization_id
          WHERE association.doctor_account_id = doctor.account_id
            AND instr(lower(specialization.name), lower(?)) > 0
        )
      )
    ORDER BY doctor.professional_name COLLATE NOCASE, doctor.account_id
    LIMIT ? OFFSET ?
  `);
  const discoverySpecializations = database.prepare(`
    SELECT specialization.id, specialization.name
    FROM doctor_specializations AS association
    JOIN specializations AS specialization
      ON specialization.id = association.specialization_id
    WHERE association.doctor_account_id = ?
    ORDER BY specialization.name COLLATE NOCASE, specialization.id
  `);
  const discoveryDepartments = database.prepare(`
    SELECT department.id, department.name, department.description
    FROM doctor_departments AS association
    JOIN departments AS department
      ON department.id = association.department_id
    WHERE association.doctor_account_id = ?
    ORDER BY department.name COLLATE NOCASE, department.id
  `);
  const findSpecializations = database.prepare(`
    SELECT id, name FROM specializations
    WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
    ORDER BY name COLLATE NOCASE, id
  `);
  const findDepartments = database.prepare(`
    SELECT id, name FROM departments
    WHERE id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))
    ORDER BY name COLLATE NOCASE, id
  `);
  const insertAccount = database.prepare(`
    INSERT INTO accounts (full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, 'DOCTOR')
  `);
  const insertProfile = database.prepare(`
    INSERT INTO doctor_profiles (account_id, professional_name, professional_summary)
    VALUES (?, ?, ?)
  `);
  const insertDoctorDepartment = database.prepare(`
    INSERT INTO doctor_departments (doctor_account_id, department_id)
    VALUES (?, ?)
  `);
  const insertDoctorSpecialization = database.prepare(`
    INSERT INTO doctor_specializations (doctor_account_id, specialization_id)
    VALUES (?, ?)
  `);
  const findOwnProfile = database.prepare(`
    SELECT account_id AS accountId,
      professional_name AS professionalName,
      professional_summary AS professionalSummary
    FROM doctor_profiles WHERE account_id = ?
  `);
  const updateOwnProfile = database.prepare(`
    UPDATE doctor_profiles SET professional_summary = ?, updated_at = ?
    WHERE account_id = ?
  `);
  const profileAssignments = database.prepare(`
    SELECT specialization.id AS id,
      specialization.name AS name
    FROM doctor_specializations AS association
    JOIN specializations AS specialization
      ON specialization.id = association.specialization_id
    WHERE association.doctor_account_id = ?
    ORDER BY specialization.name COLLATE NOCASE, specialization.id
  `);
  const departmentAssignments = database.prepare(`
    SELECT department.id AS id,
      department.name AS name
    FROM doctor_departments AS association
    JOIN departments AS department
      ON department.id = association.department_id
    WHERE association.doctor_account_id = ?
    ORDER BY department.name COLLATE NOCASE, department.id
  `);
  const createDoctor = database.transaction(({
    email,
    passwordHash,
    professionalName,
    professionalSummary,
    departmentIds,
    specializationIds,
  }) => {
    const accountId = insertAccount.run(
      professionalName,
      email,
      passwordHash,
    ).lastInsertRowid;
    insertProfile.run(accountId, professionalName, professionalSummary);
    for (const departmentId of departmentIds) {
      insertDoctorDepartment.run(accountId, departmentId);
    }
    for (const specializationId of specializationIds) {
      insertDoctorSpecialization.run(accountId, specializationId);
    }
    return accountId;
  });

  return Object.freeze({
    countDiscoverable,
    searchDiscoverable,
    getDiscoveryDepartments: discoveryDepartments,
    getDiscoverySpecializations: discoverySpecializations,
    findSpecializations(ids) {
      return findSpecializations.all(JSON.stringify(ids));
    },
    findDepartments(ids) {
      return findDepartments.all(JSON.stringify(ids));
    },
    createDoctor,
    findOwnProfile,
    updateOwnProfile,
    getOwnProfile(accountId) {
      const profile = findOwnProfile.get(accountId);
      if (!profile) {
        return null;
      }
      return {
        ...profile,
        specializations: profileAssignments.all(accountId),
        departments: departmentAssignments.all(accountId),
      };
    },
  });
}
