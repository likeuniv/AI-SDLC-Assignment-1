import { Router } from 'express';
import { requireAuthenticated } from '../../middleware/authentication.js';
import { createAppointmentController } from './controller.js';
import { createAppointmentService } from './service.js';

export function createAppointmentRouter(database, config) {
  const router = Router();
  const controller = createAppointmentController(
    createAppointmentService(database, config),
  );

  router.use(requireAuthenticated);
  router.post('/', controller.book);
  router.get('/', controller.list);
  router.get('/:appointmentId', controller.get);
  router.post('/:appointmentId/cancellation', controller.cancel);
  router.post('/:appointmentId/completion', controller.complete);
  return router;
}
