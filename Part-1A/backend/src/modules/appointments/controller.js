import { sendSuccess } from '../../shared/responses.js';
import { parseAppointmentId } from './validation.js';

export function createAppointmentController(service) {
  return Object.freeze({
    book(request, response) {
      const appointment = service.book(request.auth, request.body);
      sendSuccess(response, 201, 'Appointment booked.', appointment);
    },
    list(request, response) {
      sendSuccess(response, 200, 'Appointments retrieved.', service.list(request.auth, request.query));
    },
    get(request, response) {
      const appointment = service.get(
        request.auth,
        parseAppointmentId(request.params.appointmentId),
      );
      sendSuccess(response, 200, 'Appointment retrieved.', appointment);
    },
    cancel(request, response) {
      const appointment = service.cancel(
        request.auth,
        parseAppointmentId(request.params.appointmentId),
      );
      sendSuccess(response, 200, 'Appointment cancelled.', appointment);
    },
    complete(request, response) {
      const appointment = service.complete(
        request.auth,
        parseAppointmentId(request.params.appointmentId),
      );
      sendSuccess(response, 200, 'Appointment completed.', appointment);
    },
  });
}
