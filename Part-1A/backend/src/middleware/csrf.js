import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../shared/errors.js';

export function createCsrfToken(sessionToken) {
  return createHmac('sha256', sessionToken)
    .update('hms-cookie-csrf-v1', 'utf8')
    .digest('base64url');
}

function hasExpectedOrigin(origin, expectedOrigin) {
  if (typeof origin !== 'string' || origin === 'null') {
    return false;
  }
  try {
    return new URL(origin).origin === expectedOrigin && origin === expectedOrigin;
  } catch {
    return false;
  }
}

function tokenMatches(suppliedToken, expectedToken) {
  if (typeof suppliedToken !== 'string') {
    return false;
  }
  const supplied = Buffer.from(suppliedToken, 'utf8');
  const expected = Buffer.from(expectedToken, 'utf8');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createCsrfProtection(config) {
  return (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      next();
      return;
    }

    if (!request.sessionCookieToken || !request.auth) {
      next();
      return;
    }

    if (!hasExpectedOrigin(request.get('Origin'), config.applicationOrigin)) {
      next(new HttpError(403, 'FORBIDDEN', "You don't have permission to perform this action."));
      return;
    }

    const expectedToken = createCsrfToken(request.auth.sessionToken);
    if (!tokenMatches(request.get('X-CSRF-Token'), expectedToken)) {
      next(new HttpError(403, 'FORBIDDEN', "You don't have permission to perform this action."));
      return;
    }
    next();
  };
}
