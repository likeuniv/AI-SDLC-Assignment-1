import bcrypt from 'bcrypt';
import {
  duplicateResource,
  forbidden,
  resourceNotFound,
} from '../../shared/errors.js';
import { createDoctorRepository } from './repository.js';
import {
  validateDoctorProvision,
  validateDoctorDiscoveryQuery,
  validateDoctorSelfUpdate,
} from './validation.js';

const DOCTOR_MANAGEMENT_PERMISSION = 'doctor:manage';

function assertDoctorManagement(config, accountId) {
  if (!config.hasPermission(accountId, DOCTOR_MANAGEMENT_PERMISSION)) {
    throw forbidden();
  }
}

export function createDoctorService(database, config) {
  const repository = createDoctorRepository(database);

  return Object.freeze({
    async provision(actor, body) {
      assertDoctorManagement(config, actor.accountId);
      const values = validateDoctorProvision(body);
      const departments = repository.findDepartments(values.departmentIds);
      const specializations = repository.findSpecializations(values.specializationIds);
      if (
        departments.length !== values.departmentIds.length
        || specializations.length !== values.specializationIds.length
      ) {
        throw resourceNotFound();
      }
      const passwordHash = await bcrypt.hash(values.password, config.bcryptCost);
      let accountId;
      try {
        accountId = repository.createDoctor.immediate({
          email: values.email,
          passwordHash,
          professionalName: values.professionalName,
          professionalSummary: values.professionalSummary,
          departmentIds: values.departmentIds,
          specializationIds: values.specializationIds,
        });
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw duplicateResource();
        }
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          throw resourceNotFound();
        }
        throw error;
      }
      return repository.getOwnProfile(accountId);
    },
    search(actor, query) {
      if (actor.role !== 'PATIENT') {
        throw forbidden();
      }
      const { name, specialization, page, pageSize } = validateDoctorDiscoveryQuery(query);
      const total = repository.countDiscoverable.get(
        name,
        name,
        specialization,
        specialization,
      ).total;
      const doctors = repository.searchDiscoverable.all(
        name,
        name,
        specialization,
        specialization,
        pageSize,
        (page - 1) * pageSize,
      );
      return {
        items: doctors.map((doctor) => ({
          ...doctor,
          departments: repository.getDiscoveryDepartments.all(doctor.id),
          specializations: repository.getDiscoverySpecializations.all(doctor.id),
        })),
        page,
        pageSize,
        total,
      };
    },
    getOwnProfile(actor) {
      if (actor.role !== 'DOCTOR') {
        throw forbidden();
      }
      const profile = repository.getOwnProfile(actor.accountId);
      if (!profile) {
        throw resourceNotFound();
      }
      return profile;
    },
    updateOwnProfile(actor, body) {
      if (actor.role !== 'DOCTOR') {
        throw forbidden();
      }
      const values = validateDoctorSelfUpdate(body);
      if (!repository.findOwnProfile.get(actor.accountId)) {
        throw resourceNotFound();
      }
      repository.updateOwnProfile.run(
        values.professionalSummary,
        config.now().toISOString(),
        actor.accountId,
      );
      return repository.getOwnProfile(actor.accountId);
    },
  });
}
