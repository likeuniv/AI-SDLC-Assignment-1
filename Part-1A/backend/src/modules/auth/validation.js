import { fieldErrors, isValidEmail, readObjectBody } from '../../shared/validation.js';

export function validateRegistration(body) {
  const values = readObjectBody(body, ['fullName', 'email', 'password']);
  const fullName = typeof values.fullName === 'string' ? values.fullName.trim() : '';
  const email = typeof values.email === 'string' ? values.email.trim().toLowerCase() : '';
  const password = values.password;
  const errors = [];

  if (fullName.length < 1 || [...fullName].length > 120) {
    errors.push(['fullName', 'must contain between 1 and 120 characters']);
  }
  if (!isValidEmail(email)) {
    errors.push(['email', 'must be a valid email address']);
  }
  if (
    typeof password !== 'string'
    || [...password].length < 12
    || Buffer.byteLength(password, 'utf8') > 72
  ) {
    errors.push(['password', 'must be at least 12 characters and no more than 72 UTF-8 bytes']);
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return { fullName, email, password };
}

export function validateLogin(body) {
  const values = readObjectBody(body, ['email', 'password']);
  const email = typeof values.email === 'string' ? values.email.trim().toLowerCase() : '';
  const password = values.password;
  const errors = [];
  if (!isValidEmail(email)) {
    errors.push(['email', 'must be a valid email address']);
  }
  if (typeof password !== 'string' || password.length === 0 || Buffer.byteLength(password, 'utf8') > 72) {
    errors.push(['password', 'is required and must be no more than 72 UTF-8 bytes']);
  }
  if (errors.length > 0) {
    throw fieldErrors(errors);
  }
  return { email, password };
}
