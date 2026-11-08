import {
  duplicateResource,
  forbidden,
  invalidRequest,
  resourceNotFound,
} from '../../shared/errors.js';
import { fieldErrors, isValidEmail, readObjectBody } from '../../shared/validation.js';

const PROVISION_FIELDS = [
  'email',
  'password',
  'professionalName',
  'professionalSummary',
  'departmentIds',
  'specializationIds',
];
const DISCOVERY_QUERY_FIELDS = ['name', 'specialization', 'page', 'pageSize'];
const MAX_PAGE = 100000;
const MAX_PAGE_SIZE = 50;

export function parseDoctorAccountId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw resourceNotFound();
  }
  return Number(value);
}

function validateIdArray(value, field, errors, required) {
  if (!Array.isArray(value) || (required && value.length === 0)) {
    errors.push([field, required ? 'must contain at least one ID' : 'must be an array']);
    return [];
  }
  if (value.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    errors.push([field, 'must contain positive integer IDs']);
    return [];
  }
  if (new Set(value).size !== value.length) {
    throw duplicateResource();
  }
  return value;
}

export function validateDoctorProvision(body) {
  const values = readObjectBody(body, PROVISION_FIELDS);
  const errors = [];
  const email = typeof values.email === 'string' ? values.email.trim().toLowerCase() : '';
  const professionalName = typeof values.professionalName === 'string'
    ? values.professionalName.trim()
    : '';
  if (!isValidEmail(email)) {
    errors.push(['email', 'must be a valid work email address']);
  }
  if (!professionalName || professionalName.length > 120) {
    errors.push(['professionalName', 'must contain between 1 and 120 characters']);
  }
  if (
    typeof values.password !== 'string'
    || [...values.password].length < 12
    || Buffer.byteLength(values.password, 'utf8') > 72
  ) {
    errors.push(['password', 'must be at least 12 characters and no more than 72 UTF-8 bytes']);
  }
  let professionalSummary = null;
  if (values.professionalSummary !== undefined && values.professionalSummary !== null) {
    professionalSummary = typeof values.professionalSummary === 'string'
      ? values.professionalSummary.trim()
      : '';
    if (!professionalSummary || professionalSummary.length > 2000) {
      errors.push(['professionalSummary', 'must be null or contain between 1 and 2000 characters']);
    }
  }
  const departmentIds = validateIdArray(values.departmentIds, 'departmentIds', errors, true);
  const specializationIds = validateIdArray(values.specializationIds, 'specializationIds', errors, true);
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return {
    email,
    password: values.password,
    professionalName,
    professionalSummary,
    departmentIds,
    specializationIds,
  };
}

export function validateDoctorSelfUpdate(body) {
  if (
    body !== null
    && typeof body === 'object'
    && !Array.isArray(body)
    && Object.keys(body).some((field) => field !== 'professionalSummary')
  ) {
    throw forbidden();
  }
  const values = readObjectBody(body, ['professionalSummary']);
  if (!Object.hasOwn(values, 'professionalSummary')) {
    throw fieldErrors([['professionalSummary', 'is required']]);
  }
  const summary = values.professionalSummary;
  if (
    summary !== null
    && (typeof summary !== 'string' || !summary.trim() || summary.trim().length > 2000)
  ) {
    throw fieldErrors([
      ['professionalSummary', 'must be null or contain between 1 and 2000 characters'],
    ]);
  }
  return { professionalSummary: typeof summary === 'string' ? summary.trim() : null };
}

function readSingleQueryValue(query, field) {
  const value = query[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw invalidRequest('Query parameters must have a single value.');
  }
  return value;
}

function parseBoundedInteger(value, field, fallback, maximum) {
  if (value === undefined) {
    return fallback;
  }
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    throw invalidRequest('Pagination parameters must be positive integers.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw fieldErrors([[field, `must be between 1 and ${maximum}`]]);
  }
  return parsed;
}

export function validateDoctorDiscoveryQuery(query) {
  if (
    query === null
    || typeof query !== 'object'
    || Array.isArray(query)
    || Object.keys(query).some((field) => !DISCOVERY_QUERY_FIELDS.includes(field))
  ) {
    throw invalidRequest('The request contains unsupported query parameters.');
  }
  const name = readSingleQueryValue(query, 'name')?.trim() || null;
  const specialization = readSingleQueryValue(query, 'specialization')?.trim() || null;
  const errors = [];
  for (const [field, value] of [['name', name], ['specialization', specialization]]) {
    if (value && value.length > 120) {
      errors.push([field, 'must not exceed 120 characters']);
    }
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return {
    name,
    specialization,
    page: parseBoundedInteger(readSingleQueryValue(query, 'page'), 'page', 1, MAX_PAGE),
    pageSize: parseBoundedInteger(
      readSingleQueryValue(query, 'pageSize'),
      'pageSize',
      20,
      MAX_PAGE_SIZE,
    ),
  };
}
