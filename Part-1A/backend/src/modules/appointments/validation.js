import { invalidRequest } from '../../shared/errors.js';
import { fieldErrors, readObjectBody } from '../../shared/validation.js';

const PATIENT_BOOKING_FIELDS = [
  'doctorAccountId',
  'availabilitySlotId',
  'patientRecipientAccountId',
  'beneficiaryId',
];
const STAFF_BOOKING_FIELDS = [
  ...PATIENT_BOOKING_FIELDS,
  'responsibleAccountId',
];
const STATUSES = ['BOOKED', 'CANCELLED', 'COMPLETED'];
const MAX_PAGE = 100000;
const MAX_PAGE_SIZE = 50;

function positiveId(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw fieldErrors([[field, 'must be a positive integer']]);
  }
  return value;
}

export function parseAppointmentId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw invalidRequest('The appointment ID is invalid.');
  }
  return Number(value);
}

export function validateBooking(body, role) {
  const allowedFields = role === 'STAFF' ? STAFF_BOOKING_FIELDS : PATIENT_BOOKING_FIELDS;
  const values = readObjectBody(body, allowedFields);
  const errors = [];
  for (const field of ['doctorAccountId', 'availabilitySlotId']) {
    if (!Object.hasOwn(values, field)) {
      errors.push([field, 'is required']);
    }
  }
  if (role === 'STAFF' && !Object.hasOwn(values, 'responsibleAccountId')) {
    errors.push(['responsibleAccountId', 'is required']);
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  const hasPatient = Object.hasOwn(values, 'patientRecipientAccountId');
  const hasBeneficiary = Object.hasOwn(values, 'beneficiaryId');
  if (hasPatient === hasBeneficiary) {
    return { invalidRecipient: true };
  }
  return {
    doctorAccountId: positiveId(values.doctorAccountId, 'doctorAccountId'),
    availabilitySlotId: positiveId(values.availabilitySlotId, 'availabilitySlotId'),
    patientRecipientAccountId: hasPatient
      ? positiveId(values.patientRecipientAccountId, 'patientRecipientAccountId')
      : null,
    beneficiaryId: hasBeneficiary ? positiveId(values.beneficiaryId, 'beneficiaryId') : null,
    responsibleAccountId: role === 'STAFF'
      ? positiveId(values.responsibleAccountId, 'responsibleAccountId')
      : null,
  };
}

function parsePage(query, field, fallback, maximum) {
  const value = query[field];
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
}

export function validateAppointmentQuery(query, {
  allowStatus = true,
  allowView = true,
} = {}) {
  const fields = [
    'page',
    'pageSize',
    ...(allowStatus ? ['status'] : []),
    ...(allowView ? ['view'] : []),
  ];
  if (
    query === null
    || typeof query !== 'object'
    || Array.isArray(query)
    || Object.keys(query).some((field) => !fields.includes(field))
  ) {
    throw invalidRequest('The request contains unsupported query parameters.');
  }
  if (
    allowStatus
    && query.status !== undefined
    && (typeof query.status !== 'string' || !STATUSES.includes(query.status))
  ) {
    throw fieldErrors([['status', 'must be a valid appointment status']]);
  }
  if (
    allowView
    && query.view !== undefined
    && (typeof query.view !== 'string' || !['upcoming', 'history'].includes(query.view))
  ) {
    throw fieldErrors([['view', 'must be upcoming or history']]);
  }
  return {
    page: parsePage(query, 'page', 1, MAX_PAGE),
    pageSize: parsePage(query, 'pageSize', 20, MAX_PAGE_SIZE),
    status: query.status,
    view: query.view,
  };
}
