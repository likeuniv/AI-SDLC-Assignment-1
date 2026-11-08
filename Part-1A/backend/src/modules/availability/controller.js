import { sendSuccess } from '../../shared/responses.js';
import { parseAvailabilityId } from './validation.js';

export function createAvailabilityController(service) {
  return Object.freeze({
    list(request, response) {
      const schedule = service.list(
        request.auth,
        parseAvailabilityId(request.params.doctorId),
        request.query,
      );
      sendSuccess(response, 200, 'Availability retrieved.', schedule);
    },
    create(request, response) {
      const slot = service.create(
        request.auth,
        parseAvailabilityId(request.params.doctorId),
        request.body,
      );
      sendSuccess(response, 201, 'Availability created.', slot);
    },
    update(request, response) {
      const slot = service.update(
        request.auth,
        parseAvailabilityId(request.params.doctorId),
        parseAvailabilityId(request.params.slotId),
        request.body,
      );
      sendSuccess(response, 200, 'Availability updated.', slot);
    },
    remove(request, response) {
      service.remove(
        request.auth,
        parseAvailabilityId(request.params.doctorId),
        parseAvailabilityId(request.params.slotId),
      );
      sendSuccess(response, 204, 'Availability removed.', null);
    },
  });
}
