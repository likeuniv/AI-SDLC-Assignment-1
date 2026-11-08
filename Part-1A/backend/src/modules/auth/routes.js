import { Router } from 'express';
import { requireAuthenticated } from '../../middleware/authentication.js';
import { createRateLimit } from '../../middleware/rate-limit.js';
import { createAuthController } from './controller.js';
import { createAuthService } from './service.js';

export function createAuthRouter(database, config) {
  const router = Router();
  const controller = createAuthController(createAuthService(database, config), config);
  const loginRateLimit = createRateLimit({
    ...config.rateLimits.login,
    now: () => config.now().getTime(),
  });
  const registrationRateLimit = createRateLimit({
    ...config.rateLimits.registration,
    now: () => config.now().getTime(),
  });
  const csrfRateLimit = createRateLimit({
    ...config.rateLimits.login,
    now: () => config.now().getTime(),
  });
  const logoutRateLimit = createRateLimit({
    ...config.rateLimits.login,
    now: () => config.now().getTime(),
  });

  router.post('/register', registrationRateLimit, controller.register);
  router.post('/login', loginRateLimit, controller.login);
  router.get('/session', requireAuthenticated, controller.session);
  router.get('/csrf', csrfRateLimit, requireAuthenticated, controller.csrf);
  router.post('/logout', logoutRateLimit, requireAuthenticated, controller.logout);
  return router;
}
