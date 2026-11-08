export class HttpError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function invalidRequest(message = 'The request is invalid.') {
  return new HttpError(400, 'INVALID_REQUEST', message);
}

export function validationFailed(details, message = 'Please correct the highlighted fields.') {
  return new HttpError(422, 'VALIDATION_FAILED', message, details);
}

export function authenticationRequired() {
  return new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.');
}

export function forbidden() {
  return new HttpError(403, 'FORBIDDEN', "You don't have permission to perform this action.");
}

export function resourceNotFound() {
  return new HttpError(404, 'RESOURCE_NOT_FOUND', 'This information is unavailable.');
}

export function duplicateResource() {
  return new HttpError(409, 'DUPLICATE_RESOURCE', 'A resource with these details already exists.');
}

export function resourceInUse() {
  return new HttpError(409, 'RESOURCE_IN_USE', 'The resource is in use and cannot be changed.');
}

export function beneficiaryStateConflict() {
  return new HttpError(
    409,
    'BENEFICIARY_STATE_CONFLICT',
    'The beneficiary authorization decision conflicts with the current state.',
  );
}

export function beneficiaryNotAuthorized() {
  return new HttpError(
    422,
    'BENEFICIARY_NOT_AUTHORIZED',
    'This beneficiary is not authorized for the requested operation.',
  );
}

export function rateLimitExceeded() {
  return new HttpError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.');
}

export function serviceUnavailable() {
  return new HttpError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable.');
}
