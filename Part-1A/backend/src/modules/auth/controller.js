import { createCsrfToken } from '../../middleware/csrf.js';
import { HttpError } from '../../shared/errors.js';
import { sendSuccess } from '../../shared/responses.js';
import { validateLogin, validateRegistration } from './validation.js';

function setSessionCookie(response, token, config) {
  response.cookie(config.sessionCookieName, token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: config.sessionTtlSeconds * 1000,
  });
}

export function createAuthController(service, config) {
  return Object.freeze({
    register: async (request, response) => {
      const account = await service.register(validateRegistration(request.body));
      sendSuccess(response, 201, 'Your account has been created successfully.', account);
    },
    login: async (request, response) => {
      const { token, account } = await service.login(
        validateLogin(request.body),
        request.auth?.sessionId,
      );
      setSessionCookie(response, token, config);
      sendSuccess(response, 200, 'Welcome back!', account);
    },
    session: (request, response) => {
      const { accountId, fullName, email, role } = request.auth;
      sendSuccess(response, 200, 'Session is active.', { accountId, fullName, email, role });
    },
    csrf: (request, response) => {
      if (!request.auth?.sessionToken) {
        throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
      }
      sendSuccess(response, 200, 'CSRF token issued.', {
        csrfToken: createCsrfToken(request.auth.sessionToken),
      });
    },
    logout: (request, response) => {
      service.invalidateSession(request.auth.sessionId);
      response.clearCookie(config.sessionCookieName, {
        httpOnly: true,
        secure: config.secureCookies,
        sameSite: 'lax',
        path: '/',
      });
      sendSuccess(response, 204, '', undefined);
    },
  });
}
