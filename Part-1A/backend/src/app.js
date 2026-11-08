import express from 'express';
import { loadConfig } from './config/index.js';
import { createAuthenticationMiddleware } from './middleware/authentication.js';
import { createCsrfProtection } from './middleware/csrf.js';
import { createErrorHandler } from './middleware/error-handler.js';
import { requestContext } from './middleware/request-context.js';
import { resourceNotFound } from './shared/errors.js';
import { createAuthRouter } from './modules/auth/routes.js';
import { createPatientRouter } from './modules/patients/routes.js';
import {
  createBeneficiaryAdminRouter,
  createBeneficiaryRouter,
} from './modules/beneficiaries/routes.js';

export function createApp({
  database,
  config = loadConfig(),
  logger = console,
} = {}) {
  if (!database) {
    throw new TypeError('A database connection is required to create the application.');
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext);
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(createAuthenticationMiddleware(database, config));
  app.use(createCsrfProtection(config));

  app.use('/api/v1/auth', createAuthRouter(database, config));
  app.use('/api/v1/patients', createPatientRouter(database, config));
  app.use('/api/v1/beneficiaries', createBeneficiaryRouter(database, config));
  app.use('/api/v1/admin/beneficiaries', createBeneficiaryAdminRouter(database, config));

  app.use((request, response, next) => {
    next(resourceNotFound());
  });
  app.use(createErrorHandler(logger));
  return app;
}
