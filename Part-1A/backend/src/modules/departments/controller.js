import { sendSuccess } from '../../shared/responses.js';
import { parseDepartmentId } from './validation.js';

export function createDepartmentController(service) {
  return Object.freeze({
    list(_request, response) {
      sendSuccess(response, 200, 'Departments retrieved.', service.list());
    },
    get(request, response) {
      const department = service.get(parseDepartmentId(request.params.departmentId));
      sendSuccess(response, 200, 'Department retrieved.', department);
    },
    create(request, response) {
      const department = service.create(request.auth, request.body);
      sendSuccess(response, 201, 'Department created.', department);
    },
    update(request, response) {
      const department = service.update(
        request.auth,
        parseDepartmentId(request.params.departmentId),
        request.body,
      );
      sendSuccess(response, 200, 'Department updated.', department);
    },
    replaceDoctors(request, response) {
      const department = service.replaceDoctors(
        request.auth,
        parseDepartmentId(request.params.departmentId),
        request.body,
      );
      sendSuccess(response, 200, 'Department doctor associations updated.', department);
    },
  });
}
