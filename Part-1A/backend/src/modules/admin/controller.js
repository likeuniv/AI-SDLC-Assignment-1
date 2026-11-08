import { sendSuccess } from '../../shared/responses.js';

export function createAdminController(service) {
  return Object.freeze({
    dashboard(request, response) {
      sendSuccess(response, 200, 'Administrative dashboard retrieved.', service.dashboard(request.auth));
    },
    listPatients(request, response) {
      sendSuccess(response, 200, 'Patients retrieved.', service.listPatients(request.auth, request.query));
    },
    listAppointments(request, response) {
      sendSuccess(
        response,
        200,
        'Appointments retrieved.',
        service.listAppointments(request.auth, request.query),
      );
    },
  });
}
