import { sessionTokenHash } from '../../middleware/authentication.js';

export function createAuthRepository(database) {
  const findAccountByEmail = database.prepare(`
    SELECT id, full_name AS fullName, email_normalized AS email,
      password_hash AS passwordHash, role
    FROM accounts
    WHERE email_normalized = ?
  `);
  const insertAccount = database.prepare(`
    INSERT INTO accounts (full_name, email_normalized, password_hash, role)
    VALUES (?, ?, ?, 'PATIENT')
  `);
  const insertPatientProfile = database.prepare(`
    INSERT INTO patient_profiles (account_id) VALUES (?)
  `);
  const createPatient = database.transaction(({ fullName, email, passwordHash }) => {
    const accountId = insertAccount.run(fullName, email, passwordHash).lastInsertRowid;
    insertPatientProfile.run(accountId);
    return { accountId, fullName, email, role: 'PATIENT' };
  });

  const insertSession = database.prepare(`
    INSERT INTO sessions (account_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `);
  const invalidateSession = database.prepare(`
    UPDATE sessions SET invalidated_at = ?
    WHERE id = ? AND invalidated_at IS NULL
  `);
  const rotateSession = database.transaction(({
    accountId,
    tokenHash,
    expiresAt,
    previousSessionId,
    now,
  }) => {
    if (previousSessionId) {
      invalidateSession.run(now, previousSessionId);
    }
    insertSession.run(accountId, tokenHash, now, expiresAt);
  });

  return Object.freeze({
    findAccountByEmail(email) {
      return findAccountByEmail.get(email);
    },
    createPatient,
    createSession(accountId, token, expiresAt, previousSessionId, now) {
      rotateSession.immediate({
        accountId,
        tokenHash: sessionTokenHash(token),
        expiresAt,
        previousSessionId,
        now,
      });
    },
    invalidateSession(sessionId, invalidatedAt) {
      return invalidateSession.run(invalidatedAt, sessionId).changes === 1;
    },
  });
}
