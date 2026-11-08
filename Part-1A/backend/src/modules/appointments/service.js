import {
  appointmentSlotUnavailable,
  appointmentStateConflict,
  beneficiaryNotAuthorized,
  forbidden,
  invalidAppointmentRecipient,
  resourceNotFound,
  serviceUnavailable,
} from '../../shared/errors.js';
import { createTimeService } from '../../shared/time.js';
import { createAppointmentRepository } from './repository.js';
import { validateAppointmentQuery, validateBooking } from './validation.js';

const BOOK_PERMISSION = 'appointment:book';
const CANCEL_PERMISSION = 'appointment:cancel';
const VIEW_PERMISSION = 'appointment:view';

function assertStaffPermission(actor, config, permission) {
  if (actor.role !== 'STAFF' || !config.hasPermission(actor.accountId, permission)) {
    throw forbidden();
  }
}

function isBusyError(error) {
  return error.code === 'SQLITE_BUSY' || error.code === 'SQLITE_LOCKED';
}

function publicAppointment(appointment, role) {
  const result = {
    appointmentId: appointment.appointmentId,
    availabilitySlotId: appointment.availabilitySlotId,
    doctorAccountId: appointment.doctorAccountId,
    doctorName: appointment.doctorName,
    recipientType: appointment.recipientType,
    recipientName: appointment.recipientName,
    recipientDateOfBirth: appointment.recipientDateOfBirth,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
  if (role === 'STAFF') {
    result.responsibleAccountId = appointment.responsibleAccountId;
    result.initiatedByAccountId = appointment.initiatedByAccountId;
    result.initiatedByRole = appointment.initiatedByRole;
  }
  return result;
}

function pageResult(items, total, page, pageSize) {
  return { items, page, pageSize, total };
}

function mapTransitionResult(result) {
  if (result.notFound) {
    throw resourceNotFound();
  }
  if (result.doctorNotFound) {
    throw resourceNotFound();
  }
  if (result.beneficiaryNotAuthorized) {
    throw beneficiaryNotAuthorized();
  }
  if (result.stateConflict) {
    throw appointmentStateConflict();
  }
  return result.appointment;
}

export function createAppointmentService(database, config) {
  const repository = createAppointmentRepository(database);
  const time = createTimeService({ timeZone: config.hospitalTimeZone, now: config.now });

  function isAdult(dateOfBirth) {
    return time.ageOnDate(dateOfBirth) >= 18;
  }

  function findAuthorizedAppointment(actor, appointmentId) {
    const appointment = repository.findById.get(appointmentId);
    if (!appointment) {
      throw resourceNotFound();
    }
    if (actor.role === 'PATIENT') {
      if (appointment.responsibleAccountId !== actor.accountId) {
        throw resourceNotFound();
      }
      if (appointment.beneficiaryId) {
        const beneficiary = repository.findBeneficiary.get(appointment.beneficiaryId);
        if (!beneficiary || beneficiary.ownerAccountId !== actor.accountId) {
          throw resourceNotFound();
        }
        if (
          isAdult(beneficiary.dateOfBirth)
          && beneficiary.authorizationStatus !== 'AUTHORIZED'
        ) {
          throw beneficiaryNotAuthorized();
        }
      }
    } else if (actor.role === 'DOCTOR') {
      if (appointment.doctorAccountId !== actor.accountId) {
        throw resourceNotFound();
      }
    } else {
      assertStaffPermission(actor, config, VIEW_PERMISSION);
    }
    return appointment;
  }

  return Object.freeze({
    book(actor, body) {
      if (actor.role === 'STAFF') {
        assertStaffPermission(actor, config, BOOK_PERMISSION);
      } else if (actor.role !== 'PATIENT') {
        throw forbidden();
      }
      const values = validateBooking(body, actor.role);
      if (values.invalidRecipient) {
        throw invalidAppointmentRecipient();
      }
      if (actor.role === 'PATIENT') {
        if (
          values.patientRecipientAccountId !== null
          && values.patientRecipientAccountId !== actor.accountId
        ) {
          throw resourceNotFound();
        }
        values.responsibleAccountId = actor.accountId;
      } else {
        if (
          values.patientRecipientAccountId !== null
          && values.patientRecipientAccountId !== values.responsibleAccountId
        ) {
          throw resourceNotFound();
        }
      }
      const now = time.now().toISOString();
      try {
        const result = repository.book({
          ...values,
          actor: { accountId: actor.accountId, role: actor.role },
          now,
          isAdult,
        });
        if (result.notFound) {
          throw resourceNotFound();
        }
        if (result.beneficiaryNotAuthorized) {
          throw beneficiaryNotAuthorized();
        }
        if (result.slotUnavailable) {
          throw appointmentSlotUnavailable();
        }
        return publicAppointment(result.appointment, actor.role);
      } catch (error) {
        if (isBusyError(error)) {
          throw serviceUnavailable();
        }
        if (
          error.code === 'SQLITE_CONSTRAINT_UNIQUE'
          || (
            error.code === 'SQLITE_CONSTRAINT_TRIGGER'
            && error.message.includes('Availability slot overlaps an existing slot')
          )
        ) {
          throw appointmentSlotUnavailable();
        }
        throw error;
      }
    },
    get(actor, appointmentId) {
      return publicAppointment(findAuthorizedAppointment(actor, appointmentId), actor.role);
    },
    list(actor, query) {
      const filters = validateAppointmentQuery(query, {
        allowStatus: actor.role !== 'DOCTOR',
        allowView: actor.role === 'PATIENT',
      });
      const now = time.now();
      let appointments;
      if (actor.role === 'PATIENT') {
        appointments = repository.listForPatient.all(actor.accountId);
        appointments = appointments.filter((appointment) => {
          const eligible = !appointment.beneficiaryId
            || !isAdult(appointment.recipientDateOfBirth)
            || appointment.beneficiaryAuthorizationStatus === 'AUTHORIZED';
          if (!eligible) {
            return false;
          }
          if (filters.status && appointment.status !== filters.status) {
            return false;
          }
          if (filters.view === 'upcoming') {
            return appointment.status === 'BOOKED'
              && Date.parse(appointment.endAt) > now.getTime();
          }
          if (filters.view === 'history') {
            return appointment.status !== 'BOOKED'
              || Date.parse(appointment.endAt) <= now.getTime();
          }
          return true;
        });
      } else if (actor.role === 'DOCTOR') {
        appointments = repository.listForDoctor.all(actor.accountId, now.toISOString());
      } else {
        assertStaffPermission(actor, config, VIEW_PERMISSION);
        appointments = repository.listForStaff.all(
          filters.status ?? null,
          filters.status ?? null,
        );
      }
      const total = appointments.length;
      const offset = (filters.page - 1) * filters.pageSize;
      const items = appointments.slice(offset, offset + filters.pageSize)
        .map((appointment) => publicAppointment(appointment, actor.role));
      return pageResult(items, total, filters.page, filters.pageSize);
    },
    cancel(actor, appointmentId) {
      if (actor.role === 'STAFF') {
        assertStaffPermission(actor, config, CANCEL_PERMISSION);
      } else if (actor.role !== 'PATIENT') {
        throw forbidden();
      }
      try {
        const result = repository.transitionAppointment({
          appointmentId,
          actor: { accountId: actor.accountId, role: actor.role },
          action: 'CANCEL',
          now: time.now().toISOString(),
          isAdult,
        });
        return publicAppointment(mapTransitionResult(result), actor.role);
      } catch (error) {
        if (isBusyError(error)) {
          throw serviceUnavailable();
        }
        throw error;
      }
    },
    complete(actor, appointmentId) {
      if (actor.role !== 'DOCTOR') {
        throw forbidden();
      }
      try {
        const result = repository.transitionAppointment({
          appointmentId,
          actor: { accountId: actor.accountId, role: actor.role },
          action: 'COMPLETE',
          now: time.now().toISOString(),
          isAdult,
        });
        return publicAppointment(mapTransitionResult(result), actor.role);
      } catch (error) {
        if (isBusyError(error)) {
          throw serviceUnavailable();
        }
        throw error;
      }
    },
  });
}
