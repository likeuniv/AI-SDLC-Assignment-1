export function createDepartmentRepository(database) {
  const findById = database.prepare(`
    SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt
    FROM departments WHERE id = ?
  `);
  const list = database.prepare(`
    SELECT id, name, description, created_at AS createdAt, updated_at AS updatedAt
    FROM departments ORDER BY name COLLATE NOCASE, id
  `);
  const insertDepartment = database.prepare(`
    INSERT INTO departments (name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const updateDepartment = database.prepare(`
    UPDATE departments SET name = ?, description = ?, updated_at = ?
    WHERE id = ?
  `);
  const findDoctors = database.prepare(`
    SELECT doctors.account_id AS accountId,
      doctors.professional_name AS professionalName,
      doctors.professional_summary AS professionalSummary
    FROM doctor_departments
    JOIN doctor_profiles AS doctors
      ON doctors.account_id = doctor_departments.doctor_account_id
    WHERE doctor_departments.department_id = ?
    ORDER BY doctors.professional_name COLLATE NOCASE, doctors.account_id
  `);
  const findMissingDoctors = database.prepare(`
    SELECT requested.value AS accountId
    FROM json_each(?) AS requested
    LEFT JOIN doctor_profiles
      ON doctor_profiles.account_id = CAST(requested.value AS INTEGER)
    WHERE doctor_profiles.account_id IS NULL
  `);
  const deleteAssociations = database.prepare(`
    DELETE FROM doctor_departments WHERE department_id = ?
  `);
  const insertAssociation = database.prepare(`
    INSERT INTO doctor_departments (doctor_account_id, department_id)
    VALUES (?, ?)
  `);
  const countOtherDepartments = database.prepare(`
    SELECT COUNT(*) AS count
    FROM doctor_departments
    WHERE doctor_account_id = ? AND department_id <> ?
  `);

  const replaceDoctorAssociations = database.transaction((departmentId, doctorIds) => {
    if (!findById.get(departmentId)) {
      return { missingDepartment: true };
    }
    const missingDoctors = findMissingDoctors.all(JSON.stringify(doctorIds));
    if (missingDoctors.length > 0) {
      return { missingDoctor: true };
    }

    const currentDoctorIds = database.prepare(`
      SELECT doctor_account_id AS doctorAccountId
      FROM doctor_departments WHERE department_id = ?
    `).all(departmentId).map(({ doctorAccountId }) => doctorAccountId);
    const requestedIds = new Set(doctorIds);
    for (const doctorId of currentDoctorIds) {
      if (!requestedIds.has(doctorId) && countOtherDepartments.get(doctorId, departmentId).count === 0) {
        return { resourceInUse: true };
      }
    }

    deleteAssociations.run(departmentId);
    for (const doctorId of doctorIds) {
      insertAssociation.run(doctorId, departmentId);
    }
    return { doctors: findDoctors.all(departmentId) };
  });

  return Object.freeze({
    findById,
    list,
    insertDepartment,
    updateDepartment,
    findDoctors,
    replaceDoctorAssociations: replaceDoctorAssociations.immediate,
  });
}
