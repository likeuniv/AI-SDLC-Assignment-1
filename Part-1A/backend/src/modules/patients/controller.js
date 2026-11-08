import { sendSuccess } from '../../shared/responses.js';
import { parsePatientAccountId } from './validation.js';

export function createPatientController(service) {
  return Object.freeze({
    getProfile(request, response) {
      const accountId = parsePatientAccountId(request.params.patientAccountId);
      const profile = service.getProfile(request.auth.accountId, accountId);
      sendSuccess(response, 200, 'Patient profile retrieved.', profile);
    },
    updateProfile(request, response) {
      const accountId = parsePatientAccountId(request.params.patientAccountId);
      const profile = service.updateProfile(request.auth.accountId, accountId, request.body);
      sendSuccess(response, 200, 'Patient profile updated.', profile);
    },
  });
}
