import { forbidden } from '../../shared/errors.js';
import { createAppointmentService } from '../appointments/service.js';
import { createPatientService } from '../patients/service.js';

const DASHBOARD_PERMISSION = 'admin:dashboard';

export function createAdminService(database, config) {
  const patients = createPatientService(database, config);
  const appointments = createAppointmentService(database, config);

  return Object.freeze({
    dashboard(actor) {
      if (
        actor.role !== 'STAFF'
        || !config.hasPermission(actor.accountId, DASHBOARD_PERMISSION)
      ) {
        throw forbidden();
      }
      return {
        sections: [
          { key: 'patients', path: '/api/v1/admin/patients' },
          { key: 'doctors', path: '/api/v1/doctors' },
          { key: 'departments', path: '/api/v1/departments' },
          { key: 'appointments', path: '/api/v1/admin/appointments' },
          { key: 'availability', path: '/api/v1/doctors/:doctorId/availability' },
          { key: 'beneficiaryAuthorization', path: '/api/v1/admin/beneficiaries' },
        ],
      };
    },
    listPatients(actor, query) {
      return patients.listForStaff(actor, query);
    },
    listAppointments(actor, query) {
      return appointments.list(actor, query);
    },
  });
}
