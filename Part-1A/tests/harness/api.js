import { HARNESS_ORIGIN } from './runtime.js';

async function readEnvelope(response) {
  if (response.status === 204) {
    return { status: response.status, data: null, code: null };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    return { status: response.status, data: null, code: 'INVALID_RESPONSE' };
  }
  return {
    status: response.status,
    data: payload?.data ?? null,
    code: payload?.error?.code ?? null,
  };
}

export async function apiRequest(baseUrl, {
  path,
  method = 'GET',
  body,
  cookie,
  csrfToken,
} = {}) {
  const headers = new Headers();
  if (cookie) {
    headers.set('Cookie', cookie);
  }
  const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  if (isMutation && cookie) {
    headers.set('Origin', HARNESS_ORIGIN);
    headers.set('X-CSRF-Token', csrfToken);
  }
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return readEnvelope(response);
}

export async function authenticate(baseUrl, credentials) {
  const loginResponse = await fetch(new URL('/api/v1/auth/login', baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: HARNESS_ORIGIN,
    },
    body: JSON.stringify(credentials),
  });
  const login = await readEnvelope(loginResponse);
  if (login.status !== 200 || !login.data) {
    throw new Error('Harness actor authentication failed.');
  }
  const setCookie = loginResponse.headers.get('set-cookie');
  const cookie = setCookie?.split(';', 1)[0];
  if (!cookie?.startsWith('hms_session=')) {
    throw new Error('Harness actor authentication did not establish a session cookie.');
  }

  const sessionResponse = await apiRequest(baseUrl, {
    path: '/api/v1/auth/session',
    cookie,
  });
  if (sessionResponse.status !== 200) {
    throw new Error('Harness actor session verification failed.');
  }
  const csrfResponse = await apiRequest(baseUrl, {
    path: '/api/v1/auth/csrf',
    cookie,
  });
  if (
    csrfResponse.status !== 200
    || typeof csrfResponse.data?.csrfToken !== 'string'
  ) {
    throw new Error('Harness actor CSRF token acquisition failed.');
  }

  return {
    cookie,
    csrfToken: csrfResponse.data.csrfToken,
    accountId: login.data.accountId,
    role: login.data.role,
  };
}
