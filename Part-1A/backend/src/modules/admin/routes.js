import { Router } from 'express';
import { requireAuthenticated, requireRoles } from '../../middleware/authentication.js';
import { createAdminController } from './controller.js';
import { createAdminService } from './service.js';

export function createAdminRouter(database, config) {
  const router = Router();
  const controller = createAdminController(createAdminService(database, config));

  router.use(requireAuthenticated, requireRoles('STAFF'));
  router.get('/dashboard', controller.dashboard);
  router.get('/patients', controller.listPatients);
  router.get('/appointments', controller.listAppointments);
  return router;
}
