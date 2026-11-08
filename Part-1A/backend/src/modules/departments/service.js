import {
  duplicateResource,
  forbidden,
  resourceInUse,
  resourceNotFound,
} from '../../shared/errors.js';
import { createDepartmentRepository } from './repository.js';
import { validateDepartment, validateDoctorAccountIds } from './validation.js';

const DEPARTMENT_PERMISSION = 'department:manage';

function assertPermission(config, accountId) {
  if (!config.hasPermission(accountId, DEPARTMENT_PERMISSION)) {
    throw forbidden();
  }
}

function mapDatabaseError(error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw duplicateResource();
  }
  if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    throw resourceNotFound();
  }
  throw error;
}

export function createDepartmentService(database, config) {
  const repository = createDepartmentRepository(database);

  return Object.freeze({
    list() {
      return repository.list.all().map((department) => ({
        ...department,
        doctors: repository.findDoctors.all(department.id),
      }));
    },
    get(departmentId) {
      const department = repository.findById.get(departmentId);
      if (!department) {
        throw resourceNotFound();
      }
      return { ...department, doctors: repository.findDoctors.all(departmentId) };
    },
    create(actor, body) {
      assertPermission(config, actor.accountId);
      const values = validateDepartment(body);
      const now = config.now().toISOString();
      try {
        const id = repository.insertDepartment.run(
          values.name,
          values.description ?? null,
          now,
          now,
        ).lastInsertRowid;
        return this.get(id);
      } catch (error) {
        mapDatabaseError(error);
      }
    },
    update(actor, departmentId, body) {
      assertPermission(config, actor.accountId);
      const current = repository.findById.get(departmentId);
      if (!current) {
        throw resourceNotFound();
      }
      const values = { ...current, ...validateDepartment(body, { partial: true }) };
      try {
        repository.updateDepartment.run(
          values.name,
          values.description,
          config.now().toISOString(),
          departmentId,
        );
        return this.get(departmentId);
      } catch (error) {
        mapDatabaseError(error);
      }
    },
    replaceDoctors(actor, departmentId, body) {
      assertPermission(config, actor.accountId);
      const { doctorAccountIds, duplicate } = validateDoctorAccountIds(body);
      if (duplicate) {
        throw duplicateResource();
      }
      const result = repository.replaceDoctorAssociations(departmentId, doctorAccountIds);
      if (result.missingDepartment || result.missingDoctor) {
        throw resourceNotFound();
      }
      if (result.resourceInUse) {
        throw resourceInUse();
      }
      return this.get(departmentId);
    },
  });
}
