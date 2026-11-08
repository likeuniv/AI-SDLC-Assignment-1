import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { HttpError, duplicateResource } from '../../shared/errors.js';
import { createAuthRepository } from './repository.js';

export function createAuthService(database, config) {
  const repository = createAuthRepository(database);

  return Object.freeze({
    async register({ fullName, email, password }) {
      const passwordHash = await bcrypt.hash(password, config.bcryptCost);
      try {
        return repository.createPatient({ fullName, email, passwordHash });
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw duplicateResource();
        }
        throw error;
      }
    },
    async login({ email, password }, previousSessionId) {
      const account = repository.findAccountByEmail(email);
      const matches = account
        ? await bcrypt.compare(password, account.passwordHash)
        : false;
      if (!account || !matches) {
        throw new HttpError(
          401,
          'INVALID_CREDENTIALS',
          'Invalid email or password. Please try again.',
        );
      }

      const token = randomBytes(32).toString('base64url');
      const now = config.now();
      const expiresAt = new Date(now.getTime() + config.sessionTtlSeconds * 1000).toISOString();
      repository.createSession(
        account.id,
        token,
        expiresAt,
        previousSessionId,
        now.toISOString(),
      );
      return {
        token,
        account: {
          accountId: account.id,
          fullName: account.fullName,
          email: account.email,
          role: account.role,
        },
      };
    },
    invalidateSession(sessionId) {
      return repository.invalidateSession(sessionId, config.now().toISOString());
    },
  });
}
