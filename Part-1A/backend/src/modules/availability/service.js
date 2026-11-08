import {
  appointmentSlotUnavailable,
  availabilityConflict,
  forbidden,
  resourceNotFound,
  validationFailed,
} from '../../shared/errors.js';
import { createTimeService } from '../../shared/time.js';
import { createAvailabilityRepository } from './repository.js';
import {
  validateAvailabilityCreate,
  validateAvailabilityQuery,
  validateAvailabilityUpdate,
} from './validation.js';

const AVAILABILITY_PERMISSION = 'availability:manage';

function assertCanManageSchedule(actor, doctorId, config) {
  if (actor.role === 'DOCTOR' && actor.accountId === doctorId) {
    return;
  }
  if (actor.role === 'STAFF' && config.hasPermission(actor.accountId, AVAILABILITY_PERMISSION)) {
    return;
  }
  throw forbidden();
}

function mapDatabaseError(error) {
  if (
    error.code === 'SQLITE_CONSTRAINT_TRIGGER'
    && error.message.includes('Availability slot overlaps an existing slot')
  ) {
    throw availabilityConflict();
  }
  throw error;
}

function pageResult(items, total, page, pageSize) {
  return { items, page, pageSize, total };
}

export function createAvailabilityService(database, config) {
  const repository = createAvailabilityRepository(database);
  const time = createTimeService({
    timeZone: config.hospitalTimeZone,
    now: config.now,
  });

  return Object.freeze({
    list(actor, doctorId, query) {
      if (actor.role === 'PATIENT') {
        if (!repository.findDoctor.get(doctorId)) {
          throw resourceNotFound();
        }
        const { page, pageSize } = validateAvailabilityQuery(query);
        const now = time.now().toISOString();
        const total = repository.countPatientSlots.get(doctorId, now).total;
        const items = repository.listPatientSlots.all(
          doctorId,
          now,
          pageSize,
          (page - 1) * pageSize,
        );
        return pageResult(items, total, page, pageSize);
      }

      assertCanManageSchedule(actor, doctorId, config);
      if (!repository.findDoctor.get(doctorId)) {
        throw resourceNotFound();
      }
      const { page, pageSize } = validateAvailabilityQuery(query);
      const total = repository.countScheduleSlots.get(doctorId).total;
      const items = repository.listScheduleSlots.all(
        doctorId,
        pageSize,
        (page - 1) * pageSize,
      );
      return pageResult(items, total, page, pageSize);
    },
    create(actor, doctorId, body) {
      assertCanManageSchedule(actor, doctorId, config);
      if (!repository.findDoctor.get(doctorId)) {
        throw resourceNotFound();
      }
      const now = time.now();
      const values = validateAvailabilityCreate(body, config.hospitalTimeZone, now);
      try {
        const result = repository.createSlot(
          doctorId,
          values.startAt,
          values.endAt,
          now.toISOString(),
        );
        if (result.invalid) {
          throw validationFailed(result.invalid);
        }
        if (result.overlap) {
          throw availabilityConflict();
        }
        return result.slot;
      } catch (error) {
        mapDatabaseError(error);
      }
    },
    update(actor, doctorId, slotId, body) {
      assertCanManageSchedule(actor, doctorId, config);
      const values = validateAvailabilityUpdate(body, config.hospitalTimeZone);
      const now = time.now();
      try {
        const result = repository.editSlot(
          doctorId,
          slotId,
          values,
          now.toISOString(),
        );
        if (result.notFound) {
          throw resourceNotFound();
        }
        if (result.invalid) {
          throw validationFailed(result.invalid);
        }
        if (result.occupied) {
          throw appointmentSlotUnavailable();
        }
        if (result.overlap) {
          throw availabilityConflict();
        }
        return result.slot;
      } catch (error) {
        mapDatabaseError(error);
      }
    },
    remove(actor, doctorId, slotId) {
      assertCanManageSchedule(actor, doctorId, config);
      try {
        const result = repository.removeSlot(doctorId, slotId);
        if (result.notFound) {
          throw resourceNotFound();
        }
        if (result.occupied) {
          throw appointmentSlotUnavailable();
        }
      } catch (error) {
        mapDatabaseError(error);
      }
    },
  });
}
