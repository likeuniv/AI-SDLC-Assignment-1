import { forbidden, resourceNotFound } from '../../shared/errors.js';
import { fieldErrors, isValidEmail, readObjectBody } from '../../shared/validation.js';

const PROFILE_FIELDS = ['dateOfBirth', 'gender', 'contactEmail', 'contactPhone'];
const PROTECTED_FIELDS = new Set([
  'accountId',
  'email',
  'fullName',
  'id',
  'ownerAccountId',
  'role',
]);

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parsePatientAccountId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw resourceNotFound();
  }
  return Number(value);
}

export function validatePatientProfileUpdate(body, hospitalLocalDate) {
  if (
    body !== null
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.keys(body).some((field) => PROTECTED_FIELDS.has(field))
  ) {
    throw forbidden();
  }
  const values = readObjectBody(body, PROFILE_FIELDS);
  const errors = [];
  if (Object.keys(values).length === 0) {
    errors.push(['profile', 'must include at least one permitted field']);
  }

  if (Object.hasOwn(values, 'dateOfBirth') && values.dateOfBirth !== null) {
    if (!isCalendarDate(values.dateOfBirth)) {
      errors.push(['dateOfBirth', 'must be a valid calendar date']);
    } else if (values.dateOfBirth > hospitalLocalDate) {
      errors.push(['dateOfBirth', 'cannot be in the future']);
    }
  }
  if (Object.hasOwn(values, 'gender') && values.gender !== null) {
    if (typeof values.gender !== 'string' || !values.gender.trim() || values.gender.trim().length > 80) {
      errors.push(['gender', 'must contain between 1 and 80 characters']);
    } else {
      values.gender = values.gender.trim();
    }
  }
  if (Object.hasOwn(values, 'contactEmail') && values.contactEmail !== null) {
    if (typeof values.contactEmail !== 'string' || !isValidEmail(values.contactEmail.trim())) {
      errors.push(['contactEmail', 'must be a valid email address']);
    } else {
      values.contactEmail = values.contactEmail.trim().toLowerCase();
    }
  }
  if (Object.hasOwn(values, 'contactPhone') && values.contactPhone !== null) {
    const phone = typeof values.contactPhone === 'string' ? values.contactPhone.trim() : '';
    if (!/^(?=.*\d)[+()\d.\-\s]{1,32}$/.test(phone)) {
      errors.push(['contactPhone', 'must be a valid phone number of at most 32 characters']);
    } else {
      values.contactPhone = phone;
    }
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return values;
}
