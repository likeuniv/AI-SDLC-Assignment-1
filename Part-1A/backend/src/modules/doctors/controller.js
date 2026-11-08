import { sendSuccess } from '../../shared/responses.js';

export function createDoctorController(service) {
  return Object.freeze({
    search: (request, response) => {
      sendSuccess(response, 200, 'Doctors retrieved.', service.search(request.auth, request.query));
    },
    provision: async (request, response) => {
      const doctor = await service.provision(request.auth, request.body);
      sendSuccess(response, 201, 'Doctor provisioned.', doctor);
    },
    getOwnProfile: (request, response) => {
      sendSuccess(response, 200, 'Doctor profile retrieved.', service.getOwnProfile(request.auth));
    },
    updateOwnProfile: (request, response) => {
      const doctor = service.updateOwnProfile(request.auth, request.body);
      sendSuccess(response, 200, 'Doctor profile updated.', doctor);
    },
  });
}
