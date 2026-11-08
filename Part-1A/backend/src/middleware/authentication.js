import { createHash } from 'node:crypto';
import { authenticationRequired, forbidden } from '../shared/errors.js';

function readCookie(request, cookieName) {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== 'string') {
    return null;
  }

  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== cookieName) {
      continue;
    }
    try {
      const value = decodeURIComponent(item.slice(separator + 1).trim());
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function sessionTokenHash(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createAuthenticationMiddleware(database, config) {
  const findSession = database.prepare(`
    SELECT sessions.id AS sessionId, sessions.account_id AS accountId,
      sessions.expires_at AS expiresAt, accounts.role AS role,
      accounts.full_name AS fullName, accounts.email_normalized AS email
    FROM sessions
    JOIN accounts ON accounts.id = sessions.account_id
    WHERE sessions.token_hash = ?
      AND sessions.invalidated_at IS NULL
      AND sessions.expires_at > ?
  `);

  return (request, response, next) => {
    try {
      const token = readCookie(request, config.sessionCookieName);
      request.sessionCookieToken = token;
      request.auth = null;
      if (token) {
        const now = config.now().toISOString();
        const session = findSession.get(sessionTokenHash(token), now);
        if (session) {
          request.auth = { ...session, sessionToken: token };
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAuthenticated(request, response, next) {
  if (!request.auth) {
    next(authenticationRequired());
    return;
  }
  next();
}

export function requireRoles(...roles) {
  return (request, response, next) => {
    if (!request.auth) {
      next(authenticationRequired());
      return;
    }
    if (!roles.includes(request.auth.role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
