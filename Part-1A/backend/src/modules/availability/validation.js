import { invalidRequest, resourceNotFound } from '../../shared/errors.js';
import { parseOffsetDateTime } from '../../shared/time.js';
import { fieldErrors, readObjectBody } from '../../shared/validation.js';

const CREATE_FIELDS = ['startAt', 'endAt'];
const MAX_PAGE = 100000;
const MAX_PAGE_SIZE = 50;

export function parseAvailabilityId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw resourceNotFound();
  }
  return Number(value);
}

function parseUtcField(value, field, timeZone) {
  try {
    return parseOffsetDateTime(value, timeZone);
  } catch (error) {
    if (!(error instanceof TypeError)) {
      throw error;
    }
    throw fieldErrors([[
      field,
      'must be an ISO 8601 date-time with an explicit offset valid in the hospital timezone',
    ]]);
  }
}

export function validateAvailabilityCreate(body, timeZone, now) {
  const values = readObjectBody(body, CREATE_FIELDS);
  const errors = [];
  for (const field of CREATE_FIELDS) {
    if (!Object.hasOwn(values, field)) {
      errors.push([field, 'is required']);
    }
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  const startAt = parseUtcField(values.startAt, 'startAt', timeZone);
  const endAt = parseUtcField(values.endAt, 'endAt', timeZone);
  const intervalErrors = [];
  if (Date.parse(startAt) <= now.getTime()) {
    intervalErrors.push(['startAt', 'must be in the future']);
  }
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    intervalErrors.push(['endAt', 'must be later than startAt']);
  }
  if (intervalErrors.length > 0) {
    throw fieldErrors(intervalErrors);
  }
  return { startAt, endAt };
}

export function validateAvailabilityUpdate(body, timeZone) {
  const values = readObjectBody(body, CREATE_FIELDS);
  const fields = Object.keys(values);
  if (fields.length === 0) {
    throw fieldErrors([['availability', 'must include startAt or endAt']]);
  }
  return {
    ...(Object.hasOwn(values, 'startAt')
      ? { startAt: parseUtcField(values.startAt, 'startAt', timeZone) }
      : {}),
    ...(Object.hasOwn(values, 'endAt')
      ? { endAt: parseUtcField(values.endAt, 'endAt', timeZone) }
      : {}),
  };
}

function parsePageValue(value, field, fallback, maximum) {
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

export function validateAvailabilityQuery(query) {
  const allowedFields = ['page', 'pageSize'];
  if (
    query === null
    || typeof query !== 'object'
    || Array.isArray(query)
    || Object.keys(query).some((field) => !allowedFields.includes(field))
  ) {
    throw invalidRequest('The request contains unsupported query parameters.');
  }
  return {
    page: parsePageValue(query.page, 'page', 1, MAX_PAGE),
    pageSize: parsePageValue(query.pageSize, 'pageSize', 20, MAX_PAGE_SIZE),
  };
}
