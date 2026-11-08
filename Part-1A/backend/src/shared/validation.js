import { invalidRequest, validationFailed } from './errors.js';

export function readObjectBody(body, allowedFields) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest('A JSON object is required.');
  }

  const allowed = new Set(allowedFields);
  if (Object.keys(body).some((field) => !allowed.has(field))) {
    throw invalidRequest('The request contains unsupported fields.');
  }
  return body;
}

export function fieldErrors(entries) {
  return validationFailed(entries.map(([field, issue]) => ({ field, issue })));
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && Buffer.byteLength(email, 'utf8') <= 254;
}
