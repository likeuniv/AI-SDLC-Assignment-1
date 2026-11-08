import { Router } from 'express';
import { requireAuthenticated } from '../../middleware/authentication.js';
import { createAvailabilityController } from './controller.js';
import { createAvailabilityService } from './service.js';

export function createAvailabilityRouter(database, config) {
  const router = Router({ mergeParams: true });
  const controller = createAvailabilityController(
    createAvailabilityService(database, config),
  );

  router.use(requireAuthenticated);
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:slotId', controller.update);
  router.delete('/:slotId', controller.remove);
  return router;
}
