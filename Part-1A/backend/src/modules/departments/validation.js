import { fieldErrors, readObjectBody } from '../../shared/validation.js';
import { resourceNotFound } from '../../shared/errors.js';

const DEPARTMENT_FIELDS = ['name', 'description'];

export function parseDepartmentId(value) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw resourceNotFound();
  }
  return Number(value);
}

export function validateDepartment(body, { partial = false } = {}) {
  const values = readObjectBody(body, DEPARTMENT_FIELDS);
  const errors = [];
  if (partial && Object.keys(values).length === 0) {
    errors.push(['department', 'must include at least one permitted field']);
  }
  if (!partial && !Object.hasOwn(values, 'name')) {
    errors.push(['name', 'is required']);
  }

  let name;
  if (Object.hasOwn(values, 'name')) {
    name = typeof values.name === 'string' ? values.name.trim() : '';
    if (!name || name.length > 120) {
      errors.push(['name', 'must contain between 1 and 120 characters']);
    }
  }

  let description;
  if (Object.hasOwn(values, 'description')) {
    if (values.description === null) {
      description = null;
    } else {
      description = typeof values.description === 'string' ? values.description.trim() : '';
      if (!description || description.length > 1000) {
        errors.push(['description', 'must be null or contain between 1 and 1000 characters']);
      }
    }
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return {
    ...(Object.hasOwn(values, 'name') ? { name } : {}),
    ...(Object.hasOwn(values, 'description') ? { description } : {}),
  };
}

export function validateDoctorAccountIds(body) {
  const values = readObjectBody(body, ['doctorAccountIds']);
  const errors = [];
  if (!Array.isArray(values.doctorAccountIds)) {
    errors.push(['doctorAccountIds', 'must be an array of doctor account IDs']);
  } else if (values.doctorAccountIds.some(
    (id) => !Number.isSafeInteger(id) || id < 1,
  )) {
    errors.push(['doctorAccountIds', 'must contain positive integer IDs']);
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  if (new Set(values.doctorAccountIds).size !== values.doctorAccountIds.length) {
    return { duplicate: true };
  }
  return { doctorAccountIds: values.doctorAccountIds };
}
