import { Router } from 'express';
import { requireAuthenticated, requireRoles } from '../../middleware/authentication.js';
import { createPatientController } from './controller.js';
import { createPatientService } from './service.js';

export function createPatientRouter(database, config) {
  const router = Router();
  const controller = createPatientController(createPatientService(database, config));
  router.use(requireAuthenticated, requireRoles('PATIENT'));
  router.get('/:patientAccountId', controller.getProfile);
  router.patch('/:patientAccountId', controller.updateProfile);
  return router;
}
