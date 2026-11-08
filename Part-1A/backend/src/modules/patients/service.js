import { resourceNotFound } from '../../shared/errors.js';
import { createTimeService } from '../../shared/time.js';
import { createPatientRepository } from './repository.js';
import { validatePatientProfileUpdate } from './validation.js';

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
  });
}
