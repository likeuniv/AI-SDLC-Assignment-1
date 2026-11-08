import { forbidden, invalidRequest, resourceNotFound } from '../../shared/errors.js';
import { createTimeService } from '../../shared/time.js';
import { createPatientRepository } from './repository.js';
import { validatePatientProfileUpdate } from './validation.js';
import { fieldErrors } from '../../shared/validation.js';

const PATIENT_VIEW_PERMISSION = 'patient:view';

function validateListQuery(query) {
  if (
    query === null
    || typeof query !== 'object'
    || Array.isArray(query)
    || Object.keys(query).some((field) => !['page', 'pageSize'].includes(field))
  ) {
    throw invalidRequest('The request contains unsupported query parameters.');
  }
  const parse = (value, field, fallback, maximum) => {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)$/.test(value)) {
      throw invalidRequest(`${field} must be a single positive integer.`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
      throw fieldErrors([[field, `must be between 1 and ${maximum}`]]);
    }
    return parsed;
  };
  return {
    page: parse(query.page, 'page', 1, 100000),
    pageSize: parse(query.pageSize, 'pageSize', 20, 50),
  };
}

export function createPatientService(database, config) {
  const repository = createPatientRepository(database);
  const time = createTimeService({ timeZone: config.hospitalTimeZone, now: config.now });

  return Object.freeze({
    getProfile(requesterAccountId, patientAccountId) {
      if (requesterAccountId !== patientAccountId) {
        throw resourceNotFound();
      }
      const profile = repository.findByAccountId(patientAccountId);
      if (!profile) {
        throw resourceNotFound();
      }
      return profile;
    },
    updateProfile(requesterAccountId, patientAccountId, body) {
      if (requesterAccountId !== patientAccountId) {
        throw resourceNotFound();
      }
      const current = repository.findByAccountId(patientAccountId);
      if (!current) {
        throw resourceNotFound();
      }
      const changes = validatePatientProfileUpdate(body, time.hospitalLocalDate());
      const updated = { ...current, ...changes };
      if (!repository.updateProfile(patientAccountId, updated, time.now().toISOString())) {
        throw resourceNotFound();
      }
      return repository.findByAccountId(patientAccountId);
    },
    listForStaff(actor, query) {
      if (
        actor.role !== 'STAFF'
        || !config.hasPermission(actor.accountId, PATIENT_VIEW_PERMISSION)
      ) {
        throw forbidden();
      }
      const { page, pageSize } = validateListQuery(query);
      const offset = (page - 1) * pageSize;
      const patients = repository.listForStaff(pageSize, offset);
      return {
        items: patients.items,
        page,
        pageSize,
        total: patients.total,
      };
    },
  });
}
