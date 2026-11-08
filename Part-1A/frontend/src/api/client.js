const SAFE_MESSAGES = Object.freeze({
  APPOINTMENT_SLOT_UNAVAILABLE: 'That appointment slot is no longer available. Choose another slot.',
  APPOINTMENT_STATE_CONFLICT: 'This appointment has already changed. Refresh the list and try again.',
  AVAILABILITY_CONFLICT: 'This schedule conflicts with another slot.',
  BENEFICIARY_NOT_AUTHORIZED: 'Adult authorization is required before this action can continue.',
  BENEFICIARY_STATE_CONFLICT: 'This authorization has already been reviewed.',
  DUPLICATE_RESOURCE: 'A record with those details already exists.',
  FORBIDDEN: "You don't have permission to perform this action.",
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  INVALID_REQUEST: 'The request could not be understood.',
  NETWORK_ERROR: 'The service could not be reached. Check your connection and try again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  RESOURCE_NOT_FOUND: 'The requested record could not be found.',
  RESOURCE_IN_USE: 'This record is still in use and cannot be changed.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again.',
  VALIDATION_FAILED: 'Please correct the highlighted fields.',
});

export class ApiError extends Error {
  constructor({ status, code, message, details = [] }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details)
      ? details.filter((detail) => (
        detail
        && typeof detail.field === 'string'
        && typeof (detail.issue ?? detail.message) === 'string'
        && (detail.issue ?? detail.message).length <= 200
      )).map((detail) => ({
        field: detail.field.slice(0, 80),
        issue: (detail.issue ?? detail.message).slice(0, 200),
      }))
      : [];
  }
}

function safeMessage(status, code) {
  if (status >= 500) {
    return 'Something went wrong. Please try again.';
  }
  if (SAFE_MESSAGES[code]) {
    return SAFE_MESSAGES[code];
  }
  if (status === 401) {
    return 'Your session may have expired. Sign in and try again.';
  }
  if (status === 409) {
    return 'This change conflicts with the current record. Refresh and try again.';
  }
  if (status === 422) {
    return SAFE_MESSAGES.VALIDATION_FAILED;
  }
  return 'The request could not be completed.';
}

export function createApiClient(fetchImplementation) {
  let csrfToken = null;

  async function request(path, {
    method = 'GET',
    body,
    headers = {},
  } = {}) {
    const requestMethod = method.toUpperCase();
    const requestHeaders = new Headers(headers);
    requestHeaders.set('Accept', 'application/json');
    if (body !== undefined) {
      requestHeaders.set('Content-Type', 'application/json');
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(requestMethod) && csrfToken) {
      requestHeaders.set('X-CSRF-Token', csrfToken);
    }

    const fetchRequest = fetchImplementation ?? globalThis.fetch;
    let response;
    try {
      response = await fetchRequest(path, {
        method: requestMethod,
        credentials: 'same-origin',
        headers: requestHeaders,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: SAFE_MESSAGES.NETWORK_ERROR,
      });
    }

    if (response.status === 204) {
      return null;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'The server returned an invalid response.',
      });
    }

    if (!response.ok) {
      const error = payload?.error ?? {};
      throw new ApiError({
        status: response.status,
        code: typeof error.code === 'string' ? error.code : 'REQUEST_FAILED',
        message: safeMessage(response.status, error.code),
        details: error.details,
      });
    }
    if (
      payload === null
      || typeof payload !== 'object'
      || payload.success !== true
      || !Object.hasOwn(payload, 'data')
    ) {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: 'The server returned an invalid response.',
      });
    }
    return payload.data;
  }

  return Object.freeze({
    request,
    get(path) {
      return request(path);
    },
    post(path, body) {
      return request(path, { method: 'POST', body });
    },
    patch(path, body) {
      return request(path, { method: 'PATCH', body });
    },
    put(path, body) {
      return request(path, { method: 'PUT', body });
    },
    delete(path) {
      return request(path, { method: 'DELETE' });
    },
    setCsrfToken(token) {
      csrfToken = typeof token === 'string' && token.length > 0 ? token : null;
    },
    clearCsrfToken() {
      csrfToken = null;
    },
  });
}

export const api = createApiClient();
