import { Router } from 'express';
import { requireAuthenticated, requireRoles } from '../../middleware/authentication.js';
import { createBeneficiaryController } from './controller.js';
import { createBeneficiaryService } from './service.js';

export function createBeneficiaryRouter(database, config) {
  const router = Router();
  const controller = createBeneficiaryController(
    createBeneficiaryService(database, config),
  );
  router.use(requireAuthenticated, requireRoles('PATIENT'));
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:beneficiaryId/authorization-status', controller.getAuthorizationStatus);
  router.get('/:beneficiaryId', controller.getProfile);
  router.patch('/:beneficiaryId', controller.update);
  return router;
}

export function createBeneficiaryAdminRouter(database, config) {
  const router = Router();
  const controller = createBeneficiaryController(
    createBeneficiaryService(database, config),
  );
  router.use(requireAuthenticated, requireRoles('STAFF'));
  router.post('/:beneficiaryId/authorization-decision', controller.reviewAuthorization);
  return router;
}
