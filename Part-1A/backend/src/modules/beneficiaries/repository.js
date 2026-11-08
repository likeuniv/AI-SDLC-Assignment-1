const BENEFICIARY_COLUMNS = `
  id,
  owner_account_id AS ownerAccountId,
  full_name AS fullName,
  date_of_birth AS dateOfBirth,
  relationship,
  relationship_description AS relationshipDescription,
  gender,
  contact_email AS contactEmail,
  contact_phone AS contactPhone,
  authorization_status AS authorizationStatus,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

export function createBeneficiaryRepository(database) {
  const findById = database.prepare(`
    SELECT ${BENEFICIARY_COLUMNS}
    FROM beneficiaries
    WHERE id = ?
  `);
  const findOwnedById = database.prepare(`
    SELECT ${BENEFICIARY_COLUMNS}
    FROM beneficiaries
    WHERE id = ? AND owner_account_id = ?
  `);
  const listOwned = database.prepare(`
    SELECT ${BENEFICIARY_COLUMNS}
    FROM beneficiaries
    WHERE owner_account_id = ?
    ORDER BY id
  `);
  const insert = database.prepare(`
    INSERT INTO beneficiaries (
      owner_account_id,
      full_name,
      date_of_birth,
      relationship,
      relationship_description,
      gender,
      contact_email,
      contact_phone,
      authorization_status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateProfile = database.prepare(`
    UPDATE beneficiaries
    SET full_name = ?,
      date_of_birth = ?,
      relationship = ?,
      relationship_description = ?,
      gender = ?,
      contact_email = ?,
      contact_phone = ?,
      updated_at = ?
    WHERE id = ? AND owner_account_id = ?
  `);
  const markPending = database.prepare(`
    UPDATE beneficiaries
    SET authorization_status = 'PENDING_AUTHORIZATION',
      updated_at = ?
    WHERE id = ? AND authorization_status IS NULL
  `);
  const updateDecisionState = database.prepare(`
    UPDATE beneficiaries
    SET authorization_status = ?,
      updated_at = ?
    WHERE id = ? AND authorization_status = 'PENDING_AUTHORIZATION'
  `);
  const insertAudit = database.prepare(`
    INSERT INTO beneficiary_authorization_audit (
      beneficiary_id,
      reviewer_account_id,
      verification_method,
      outcome,
      reviewed_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const withWriteTransaction = (operation) => database.transaction(operation).immediate;

  return Object.freeze({
    findById,
    findOwnedById,
    listOwned,
    insert,
    updateProfile,
    markPending,
    updateDecisionState,
    insertAudit,
    withWriteTransaction,
  });
}
