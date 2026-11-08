import { forbidden, resourceNotFound } from '../../shared/errors.js';
import { fieldErrors, isValidEmail, readObjectBody } from '../../shared/validation.js';

export const RELATIONSHIPS = Object.freeze([
  'spouse',
  'parent',
  'child',
  'sibling',
  'other relative',
  'legal guardian',
  'other',
]);

const PROFILE_FIELDS = Object.freeze([
  'fullName',
  'dateOfBirth',
  'relationship',
  'relationshipDescription',
  'gender',
  'contactEmail',
  'contactPhone',
]);
const PROTECTED_FIELDS = new Set([
  'accountId',
  'authorizationStatus',
  'beneficiaryId',
  'id',
  'ownerAccountId',
  'owner_account_id',
  'role',
]);
const DECISION_FIELDS = Object.freeze([
  'outcome',
  'verificationMethod',
  'directConfirmation',
]);

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function rejectProtectedBeneficiaryFields(body) {
  if (
    body !== null
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.keys(body).some((field) => PROTECTED_FIELDS.has(field))
  ) {
    throw forbidden();
  }
}

export function parseBeneficiaryId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw resourceNotFound();
  }
  return Number(value);
}

export function validateBeneficiaryProfile(body, {
  hospitalLocalDate,
  current,
  partial = false,
}) {
  rejectProtectedBeneficiaryFields(body);
  const values = readObjectBody(body, PROFILE_FIELDS);
  const errors = [];
  const requiredFields = ['fullName', 'dateOfBirth', 'relationship'];

  if (partial && Object.keys(values).length === 0) {
    errors.push(['beneficiary', 'must include at least one permitted field']);
  }

  const merged = {
    fullName: '',
    dateOfBirth: '',
    relationship: '',
    relationshipDescription: null,
    gender: null,
    contactEmail: null,
    contactPhone: null,
    ...current,
    ...values,
  };
  if (!partial) {
    for (const field of requiredFields) {
      if (!Object.hasOwn(values, field)) {
        errors.push([field, 'is required']);
      }
    }
  }

  if (Object.hasOwn(values, 'fullName') || !partial) {
    if (typeof merged.fullName !== 'string' || !merged.fullName.trim() || merged.fullName.trim().length > 120) {
      errors.push(['fullName', 'must contain between 1 and 120 characters']);
    } else {
      merged.fullName = merged.fullName.trim();
    }
  }
  if (Object.hasOwn(values, 'dateOfBirth') || !partial) {
    if (!isCalendarDate(merged.dateOfBirth)) {
      errors.push(['dateOfBirth', 'must be a valid calendar date']);
    } else if (merged.dateOfBirth > hospitalLocalDate) {
      errors.push(['dateOfBirth', 'cannot be in the future']);
    }
  }
  if (Object.hasOwn(values, 'relationship') || !partial) {
    if (!RELATIONSHIPS.includes(merged.relationship)) {
      errors.push(['relationship', 'must be one of the approved relationship values']);
    }
  }

  if (Object.hasOwn(values, 'relationshipDescription')) {
    const description = values.relationshipDescription;
    if (
      description !== null
      && (typeof description !== 'string' || description.trim().length > 120)
    ) {
      errors.push(['relationshipDescription', 'must be null or at most 120 characters']);
    } else {
      merged.relationshipDescription = typeof description === 'string'
        ? description.trim()
        : null;
    }
  }
  if (merged.relationship === 'other' && !merged.relationshipDescription?.trim()) {
    errors.push(['relationshipDescription', 'is required when relationship is other']);
  }

  if (Object.hasOwn(values, 'gender')) {
    const gender = values.gender;
    if (
      gender !== null
      && (typeof gender !== 'string' || !gender.trim() || gender.trim().length > 80)
    ) {
      errors.push(['gender', 'must be null or contain between 1 and 80 characters']);
    } else {
      merged.gender = typeof gender === 'string' ? gender.trim() : null;
    }
  }
  for (const field of ['contactEmail', 'contactPhone']) {
    if (!Object.hasOwn(values, field)) {
      continue;
    }
    const value = values[field];
    if (value === null) {
      merged[field] = null;
    } else if (field === 'contactEmail') {
      if (typeof value !== 'string' || !isValidEmail(value.trim())) {
        errors.push([field, 'must be null or a valid email address']);
      } else {
        merged[field] = value.trim().toLowerCase();
      }
    } else {
      const phone = typeof value === 'string' ? value.trim() : '';
      if (!/^(?=.*\d)[+()\d.\-\s]{1,32}$/.test(phone)) {
        errors.push([field, 'must be null or a valid phone number of at most 32 characters']);
      } else {
        merged[field] = phone;
      }
    }
  }

  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return merged;
}

export function validateAuthorizationDecision(body) {
  const values = readObjectBody(body, DECISION_FIELDS);
  const errors = [];
  if (!['AUTHORIZED', 'REJECTED'].includes(values.outcome)) {
    errors.push(['outcome', 'must be AUTHORIZED or REJECTED']);
  }
  if (!['IN_PERSON', 'PHONE'].includes(values.verificationMethod)) {
    errors.push(['verificationMethod', 'must be IN_PERSON or PHONE']);
  }
  if (values.directConfirmation !== true) {
    errors.push(['directConfirmation', 'must confirm direct verification with the adult']);
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return {
    outcome: values.outcome,
    verificationMethod: values.verificationMethod,
  };
}
