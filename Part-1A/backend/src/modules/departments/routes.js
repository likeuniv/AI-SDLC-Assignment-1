import { Router } from 'express';
import { requireAuthenticated, requireRoles } from '../../middleware/authentication.js';
import { createDepartmentController } from './controller.js';
import { createDepartmentService } from './service.js';

export function createDepartmentRouter(database, config) {
  const router = Router();
  const controller = createDepartmentController(createDepartmentService(database, config));

  router.get('/', controller.list);
  router.get('/:departmentId', controller.get);

  router.post(
    '/',
    requireAuthenticated,
    requireRoles('STAFF'),
    controller.create,
  );
  router.patch(
    '/:departmentId',
    requireAuthenticated,
    requireRoles('STAFF'),
    controller.update,
  );
  router.put(
    '/:departmentId/doctors',
    requireAuthenticated,
    requireRoles('STAFF'),
    controller.replaceDoctors,
  );
  return router;
}
