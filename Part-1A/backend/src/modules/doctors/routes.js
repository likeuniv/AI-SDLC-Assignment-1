import { Router } from 'express';
import { requireAuthenticated, requireRoles } from '../../middleware/authentication.js';
import { createDoctorController } from './controller.js';
import { createDoctorService } from './service.js';

export function createDoctorRouter(database, config) {
  const router = Router();
  const controller = createDoctorController(createDoctorService(database, config));

  router.get(
    '/',
    requireAuthenticated,
    requireRoles('PATIENT'),
    controller.search,
  );
  router.post(
    '/',
    requireAuthenticated,
    requireRoles('STAFF'),
    controller.provision,
  );
  router.get(
    '/me',
    requireAuthenticated,
    requireRoles('DOCTOR'),
    controller.getOwnProfile,
  );
  router.patch(
    '/me',
    requireAuthenticated,
    requireRoles('DOCTOR'),
    controller.updateOwnProfile,
  );
  return router;
}
