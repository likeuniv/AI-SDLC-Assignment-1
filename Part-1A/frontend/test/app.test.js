import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { createServer } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiClient } from '../src/api/client.js';
import { isRouteAllowed, matchRoute } from '../src/app/useRoute.js';

const frontendDirectory = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Event: dom.window.Event,
  MouseEvent: dom.window.MouseEvent,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLSelectElement: dom.window.HTMLSelectElement,
  HTMLTextAreaElement: dom.window.HTMLTextAreaElement,
  history: dom.window.history,
  location: dom.window.location,
  addEventListener: dom.window.addEventListener.bind(dom.window),
  removeEventListener: dom.window.removeEventListener.bind(dom.window),
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.confirm = () => true;
const { createRoot } = await import('react-dom/client');

let vite;
let App;

function response(status, data, { code, message = 'Request failed.' } = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => status >= 400
      ? { success: false, message, error: { code, details: [] } }
      : { success: true, message: 'ok', data },
  };
}

function success(data, status = 200) {
  return response(status, data);
}

function failure(status, code) {
  return response(status, null, { code });
}

function account(role = 'PATIENT', accountId = 42) {
  return {
    accountId,
    fullName: role === 'PATIENT' ? 'Avery Patient' : `Casey ${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@example.test`,
    role,
  };
}

function sessionMock({ session = null, handler = async () => response(404, null, { code: 'RESOURCE_NOT_FOUND' }) } = {}) {
  const calls = [];
  let csrfGeneration = 0;
  const fetchMock = async (url, options) => {
    const path = String(url);
    calls.push({ path, options });
    if (path === '/api/v1/auth/session') {
      return session
        ? success(session)
        : failure(401, 'AUTHENTICATION_REQUIRED');
    }
    if (path === '/api/v1/auth/csrf') {
      csrfGeneration += 1;
      return success({ csrfToken: `csrf-${csrfGeneration}` });
    }
    return handler(path, options, calls);
  };
  return { calls, fetchMock };
}

async function settle() {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
}

async function mountApp(path, fetchMock) {
  globalThis.fetch = fetchMock;
  dom.window.history.replaceState({}, '', path);
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(App));
    await settle();
  });
  return {
    container,
    async unmount() {
      await act(async () => root.unmount());
    },
  };
}

function button(container, label) {
  const found = [...container.querySelectorAll('button')]
    .find((item) => item.textContent.trim() === label);
  assert.ok(found, `Expected button "${label}"`);
  return found;
}

async function click(element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
  });
}

async function setValue(element, value) {
  await act(async () => {
    const prototype = element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function submit(form) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  });
}

before(async () => {
  vite = await createServer({
    configFile: resolve(frontendDirectory, 'vite.config.js'),
    root: frontendDirectory,
    server: { middlewareMode: true },
    appType: 'custom',
  });
  App = (await vite.ssrLoadModule('/src/App.jsx')).default;
});

after(async () => {
  await vite.close();
  dom.window.close();
});

test('API client maps envelopes, attaches CSRF only to mutations, and never sets Origin', async () => {
  const calls = [];
  const client = createApiClient(async (path, options) => {
    calls.push({ path, options });
    return success({ ok: true });
  });
  client.setCsrfToken('session-bound-token');

  await client.get('/api/v1/doctors');
  await client.patch('/api/v1/patients/42', { gender: 'unspecified' });
  await client.post('/api/v1/auth/logout', {});

  assert.equal(calls[0].options.headers.get('X-CSRF-Token'), null);
  assert.equal(calls[1].options.headers.get('X-CSRF-Token'), 'session-bound-token');
  assert.equal(calls[2].options.headers.get('X-CSRF-Token'), 'session-bound-token');
  assert.equal(calls.every(({ options }) => options.headers.has('Origin')), false);
  assert.ok(calls.every(({ options }) => options.credentials === 'same-origin'));

  client.clearCsrfToken();
  await client.delete('/api/v1/test');
  assert.equal(calls[3].options.headers.get('X-CSRF-Token'), null);
});

test('API client returns only safe mapped errors and rejects malformed envelopes', async () => {
  const client = createApiClient(async () => response(409, null, {
    code: 'APPOINTMENT_STATE_CONFLICT',
    message: 'SQLITE_BUSY database detail',
  }));
  await assert.rejects(client.post('/api/v1/appointments/1/cancellation', {}), (error) => {
    assert.equal(error.code, 'APPOINTMENT_STATE_CONFLICT');
    assert.match(error.message, /already changed/);
    assert.doesNotMatch(error.message, /SQLITE/);
    return true;
  });

  const offlineClient = createApiClient(async () => {
    throw new TypeError('sensitive network internals');
  });
  await assert.rejects(offlineClient.get('/api/v1/test'), (error) => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.match(error.message, /Check your connection/);
    assert.doesNotMatch(error.message, /sensitive/);
    return true;
  });

  const invalidClient = createApiClient(async () => ({
    status: 200,
    ok: true,
    json: async () => ({ success: true }),
  }));
  await assert.rejects(invalidClient.get('/api/v1/test'), { code: 'INVALID_RESPONSE' });
});

test('route guards allow only the configured role and keep public department discovery accessible', () => {
  assert.equal(isRouteAllowed(matchRoute('/doctor/appointments'), account('DOCTOR')), true);
  assert.equal(isRouteAllowed(matchRoute('/doctor/appointments'), account('PATIENT')), false);
  assert.equal(isRouteAllowed(matchRoute('/departments'), null), true);
  assert.equal(isRouteAllowed(matchRoute('/profile'), null), false);
});

test('session restoration acquires CSRF and logout followed by login refreshes session CSRF', async () => {
  const mock = sessionMock({
    session: account(),
    handler: async (path, options) => {
      if (path === '/api/v1/auth/login') {
        return success(account());
      }
      if (path === '/api/v1/patients/42' && options.method === 'GET') {
        return success({
          accountId: 42,
          fullName: 'Avery Patient',
          email: 'patient@example.test',
          dateOfBirth: null,
          gender: null,
          contactEmail: null,
          contactPhone: null,
        });
      }
      if (path === '/api/v1/patients/42' && options.method === 'PATCH') {
        return success({
          accountId: 42,
          fullName: 'Avery Patient',
          email: 'patient@example.test',
          dateOfBirth: null,
          gender: null,
          contactEmail: null,
          contactPhone: JSON.parse(options.body).contactPhone,
        });
      }
      if (path === '/api/v1/auth/logout') {
        return { status: 204, ok: true };
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/profile', mock.fetchMock);
  await settle();
  assert.ok(mounted.container.textContent.includes('Your profile'));
  assert.ok(mock.calls.some(({ path }) => path === '/api/v1/auth/csrf'));
  assert.equal(dom.window.localStorage.length, 0);
  assert.equal(dom.window.sessionStorage.length, 0);

  await click(button(mounted.container, 'Sign out'));
  const logoutCall = mock.calls.find(({ path }) => path === '/api/v1/auth/logout');
  assert.equal(logoutCall.options.headers.get('X-CSRF-Token'), 'csrf-1');
  await click(button(mounted.container, 'Sign in'));
  await setValue(mounted.container.querySelector('[name="email"]'), 'patient@example.test');
  await setValue(mounted.container.querySelector('[name="password"]'), 'correct horse battery');
  await submit(mounted.container.querySelector('form[aria-label="Log in"]'));
  assert.equal(mock.calls.filter(({ path }) => path === '/api/v1/auth/csrf').length, 2);
  await click(button(mounted.container, 'My profile'));
  await settle();
  await setValue(mounted.container.querySelector('[name="contactPhone"]'), '5551230000');
  await submit(mounted.container.querySelector('form'));
  const updatedProfile = mock.calls.find(({ path, options }) => (
    path === '/api/v1/patients/42' && options.method === 'PATCH'
  ));
  assert.equal(updatedProfile.options.headers.get('X-CSRF-Token'), 'csrf-2');
  await mounted.unmount();
});

test('patient login, profile saving and sign-out show only confirmed outcomes', async () => {
  let patchResolver;
  const mock = sessionMock({
    handler: async (path, options) => {
      if (path === '/api/v1/auth/login') {
        return success(account());
      }
      if (path === '/api/v1/patients/42' && options.method === 'GET') {
        return success({
          accountId: 42,
          fullName: 'Avery Patient',
          email: 'patient@example.test',
          dateOfBirth: null,
          gender: null,
          contactEmail: null,
          contactPhone: null,
        });
      }
      if (path === '/api/v1/patients/42' && options.method === 'PATCH') {
        return new Promise((resolvePromise) => {
          patchResolver = () => resolvePromise(success({
            accountId: 42,
            fullName: 'Avery Patient',
            email: 'patient@example.test',
            dateOfBirth: null,
            gender: null,
            contactEmail: null,
            contactPhone: '5551230000',
          }));
        });
      }
      if (path === '/api/v1/auth/logout') {
        return { status: 204, ok: true };
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/login', mock.fetchMock);

  await setValue(mounted.container.querySelector('[name="email"]'), 'patient@example.test');
  await setValue(mounted.container.querySelector('[name="password"]'), 'correct horse battery');
  await submit(mounted.container.querySelector('form[aria-label="Log in"]'));
  await settle();
  assert.ok(mounted.container.textContent.includes('Welcome, Avery Patient'));
  assert.equal(mock.calls.filter(({ path }) => path === '/api/v1/auth/csrf').length, 1);
  const loginCall = mock.calls.find(({ path }) => path === '/api/v1/auth/login');
  assert.equal(loginCall.options.headers.get('X-CSRF-Token'), null);
  assert.equal(loginCall.options.headers.has('Origin'), false);

  await click(button(mounted.container, 'My profile'));
  await settle();
  const phone = mounted.container.querySelector('[name="contactPhone"]');
  await setValue(phone, '5551230000');
  await submit(phone.closest('form'));
  await settle();
  assert.equal(patchResolver instanceof Function, true);
  assert.equal(mounted.container.textContent.includes('Your profile was saved.'), false);
  const patchCall = mock.calls.find(({ path, options }) => (
    path === '/api/v1/patients/42' && options.method === 'PATCH'
  ));
  assert.equal(patchCall.options.headers.get('X-CSRF-Token'), 'csrf-1');

  await act(async () => {
    patchResolver();
    await settle();
  });
  assert.ok(mounted.container.textContent.includes('Your profile was saved.'));

  await click(button(mounted.container, 'Sign out'));
  assert.ok(mounted.container.textContent.includes('Create patient account'));
  const logoutCall = mock.calls.find(({ path }) => path === '/api/v1/auth/logout');
  assert.equal(logoutCall.options.headers.get('X-CSRF-Token'), 'csrf-1');
  assert.equal(dom.window.localStorage.length, 0);
  await mounted.unmount();
});

test('login failures use a generic message without revealing account existence', async () => {
  const mock = sessionMock({
    handler: async (path) => path === '/api/v1/auth/login'
      ? failure(401, 'INVALID_CREDENTIALS')
      : response(404, null, { code: 'RESOURCE_NOT_FOUND' }),
  });
  const mounted = await mountApp('/login', mock.fetchMock);

  await setValue(mounted.container.querySelector('[name="email"]'), 'unknown@example.test');
  await setValue(mounted.container.querySelector('[name="password"]'), 'incorrect password');
  await submit(mounted.container.querySelector('form[aria-label="Log in"]'));

  assert.ok(mounted.container.textContent.includes('Invalid email or password.'));
  assert.equal(mounted.container.textContent.includes('account does not exist'), false);
  assert.ok(mounted.container.querySelector('form[aria-label="Log in"]'));
  await mounted.unmount();
});

test('patient registration shows validation/network feedback and explicit success before sign-in', async () => {
  const mock = sessionMock({
    handler: async (path) => path === '/api/v1/auth/register'
      ? success({ accountId: 42 }, 201)
      : response(404, null, { code: 'RESOURCE_NOT_FOUND' }),
  });
  const mounted = await mountApp('/register', mock.fetchMock);
  await setValue(mounted.container.querySelector('[name="fullName"]'), 'Avery Patient');
  await setValue(mounted.container.querySelector('[name="email"]'), 'patient@example.test');
  await setValue(mounted.container.querySelector('[name="password"]'), 'correct horse battery');
  await submit(mounted.container.querySelector('form[aria-label="Register"]'));
  assert.ok(mounted.container.textContent.includes('Your patient account was created.'));
  assert.equal(mock.calls.some(({ path }) => path === '/api/v1/auth/csrf'), false);
  await click(button(mounted.container, 'Continue to sign in'));
  assert.ok(mounted.container.querySelector('form[aria-label="Log in"]'));
  await mounted.unmount();
});

test('beneficiary listing hides pending adult identity and supports an authorized minor update', async () => {
  let currentList = [
    { id: 11, fullName: 'Milo Patient', dateOfBirth: '2018-03-10', relationship: 'child', authorizationStatus: null },
    { beneficiaryId: 12, authorizationStatus: 'PENDING_AUTHORIZATION' },
  ];
  const mock = sessionMock({
    session: account(),
    handler: async (path, options) => {
      if (path === '/api/v1/beneficiaries' && options.method === 'GET') {
        return success(currentList);
      }
      if (path === '/api/v1/beneficiaries/11' && options.method === 'GET') {
        return success({
          id: 11,
          fullName: 'Milo Patient',
          dateOfBirth: '2018-03-10',
          relationship: 'child',
          relationshipDescription: null,
          gender: null,
          contactEmail: null,
          contactPhone: null,
          authorizationStatus: null,
        });
      }
      if (path === '/api/v1/beneficiaries/11' && options.method === 'PATCH') {
        return success({ ...JSON.parse(options.body), id: 11, authorizationStatus: null });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/beneficiaries', mock.fetchMock);
  await settle();
  assert.ok(mounted.container.textContent.includes('Milo Patient'));
  assert.ok(mounted.container.textContent.includes('Authorization review pending'));
  assert.equal(mounted.container.textContent.includes('Protected adult name'), false);
  assert.equal(mock.calls.some(({ path }) => path === '/api/v1/beneficiaries/12'), false);
  const pendingCard = [...mounted.container.querySelectorAll('.record-card')]
    .find((card) => card.textContent.includes('Authorization review pending'));
  assert.equal(pendingCard.querySelector('button'), null);

  await click(button(mounted.container, 'Edit profile'));
  await settle();
  assert.ok(mounted.container.querySelector('form'));
  assert.equal(mock.calls.some(({ path }) => path === '/api/v1/beneficiaries/11'), true);

  await setValue(mounted.container.querySelector('[name="fullName"]'), 'Milo Updated');
  await submit(mounted.container.querySelector('form'));
  currentList = [{ id: 11, fullName: 'Milo Updated', dateOfBirth: '2018-03-10', relationship: 'child', authorizationStatus: null }, ...currentList.slice(1)];
  await settle();
  assert.ok(mock.calls.some(({ path, options }) => (
    path === '/api/v1/beneficiaries/11' && options.method === 'PATCH'
  )));
  assert.ok(mounted.container.textContent.includes('Beneficiary profile updated.'));
  await mounted.unmount();
});

test('adult beneficiary creation shows safe validation/network feedback and only confirmed status', async () => {
  let currentList = [];
  let createAttempts = 0;
  const mock = sessionMock({
    session: account(),
    handler: async (path, options) => {
      if (path === '/api/v1/beneficiaries' && options.method === 'GET') {
        return success(currentList);
      }
      if (path === '/api/v1/beneficiaries' && options.method === 'POST') {
        createAttempts += 1;
        if (createAttempts === 1) {
          throw new TypeError('private network details');
        }
        currentList = [{ beneficiaryId: 13, authorizationStatus: 'PENDING_AUTHORIZATION' }];
        return success(currentList[0], 201);
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/beneficiaries', mock.fetchMock);
  await setValue(mounted.container.querySelector('[name="fullName"]'), 'Protected adult name');
  await setValue(mounted.container.querySelector('[name="dateOfBirth"]'), '1990-07-12');
  await setValue(mounted.container.querySelector('[name="relationship"]'), 'spouse');
  const form = mounted.container.querySelector('form');

  await submit(form);
  assert.ok(mounted.container.textContent.includes('service could not be reached'));
  assert.equal(mounted.container.textContent.includes('Beneficiary profile created.'), false);
  assert.equal(mounted.container.textContent.includes('Protected adult name'), false);

  await submit(form);
  assert.equal(createAttempts, 2);
  assert.ok(mounted.container.textContent.includes('Beneficiary profile created.'));
  assert.ok(mounted.container.textContent.includes('Authorization review pending'));
  assert.equal(mounted.container.textContent.includes('Protected adult name'), false);
  const createCall = mock.calls.filter(({ path, options }) => (
    path === '/api/v1/beneficiaries' && options.method === 'POST'
  )).at(-1);
  assert.equal(JSON.parse(createCall.options.body).relationship, 'spouse');
  assert.equal(JSON.parse(createCall.options.body).dateOfBirth, '1990-07-12');
  await mounted.unmount();
});

test('doctor discovery submits combined filters and uses stable bounded pagination', async () => {
  const mock = sessionMock({
    session: account(),
    handler: async (path) => {
      if (path.startsWith('/api/v1/doctors?')) {
        const query = new URL(path, 'http://localhost').searchParams;
        const items = query.get('page') === '2' ? [] : [{
          id: 81,
          professionalName: 'Dr. Morgan Lee',
          professionalSummary: 'Primary care',
          specializations: [{ id: 2, name: 'Family Medicine' }],
          departments: [{ id: 5, name: 'Primary Care', description: null }],
        }];
        return success({ items, page: Number(query.get('page')), pageSize: 10, total: 11 });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/discover', mock.fetchMock);
  await settle();
  await setValue(mounted.container.querySelector('[name="name"]'), 'Morgan');
  await setValue(mounted.container.querySelector('[name="specialization"]'), 'Family');
  await click(button(mounted.container, 'Search'));
  await settle();
  const filtered = mock.calls.find(({ path }) => (
    path.startsWith('/api/v1/doctors?') && path.includes('name=')
  ));
  assert.ok(filtered, JSON.stringify(mock.calls.map(({ path }) => path)));
  assert.ok(filtered.path.includes('name=Morgan'));
  assert.ok(filtered.path.includes('specialization=Family'));
  assert.ok(mounted.container.textContent.includes('Dr. Morgan Lee'));
  await click(button(mounted.container, 'Next'));
  await settle();
  assert.ok(mock.calls.some(({ path }) => path.includes('page=2')));
  assert.ok(mounted.container.textContent.includes('No doctors matched your search.'));
  await mounted.unmount();
});

test('patient booking and cancellation remain unconfirmed until the server responds', async () => {
  let bookResolver;
  let cancelResolver;
  let bookingAttempts = 0;
  const appointment = {
    appointmentId: 301,
    availabilitySlotId: 502,
    doctorAccountId: 81,
    doctorName: 'Dr. Morgan Lee',
    recipientType: 'PATIENT',
    recipientName: 'Avery Patient',
    startAt: '2026-12-02T15:00:00.000Z',
    endAt: '2026-12-02T15:30:00.000Z',
    status: 'BOOKED',
  };
  const mock = sessionMock({
    session: account(),
    handler: async (path, options) => {
      if (path.startsWith('/api/v1/appointments?')) {
        return success({ items: [], total: 0, page: 1, pageSize: 20 });
      }
      if (path === '/api/v1/doctors?page=1&pageSize=50') {
        return success({ items: [{ id: 81, professionalName: 'Dr. Morgan Lee' }], total: 1, page: 1, pageSize: 50 });
      }
      if (path === '/api/v1/beneficiaries') {
        return success([]);
      }
      if (path === '/api/v1/doctors/81/availability?page=1&pageSize=50') {
        return success({
          items: [
            { id: 501, startAt: '2026-12-01T14:00:00.000Z', endAt: '2026-12-01T14:30:00.000Z' },
            { id: 502, startAt: appointment.startAt, endAt: appointment.endAt },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        });
      }
      if (path === '/api/v1/appointments' && options.method === 'POST') {
        bookingAttempts += 1;
        if (bookingAttempts === 1) {
          return failure(409, 'APPOINTMENT_SLOT_UNAVAILABLE');
        }
        return new Promise((resolvePromise) => {
          bookResolver = () => resolvePromise(success(appointment, 201));
        });
      }
      if (path === '/api/v1/appointments/301/cancellation') {
        return new Promise((resolvePromise) => {
          cancelResolver = () => resolvePromise(success({ ...appointment, status: 'CANCELLED' }));
        });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/appointments', mock.fetchMock);
  await settle();
  await setValue(mounted.container.querySelector('select[required]'), '81');
  await settle();
  await setValue(mounted.container.querySelectorAll('select[required]')[1], '501');
  await click(button(mounted.container, 'Book appointment'));
  await settle();
  assert.ok(mounted.container.textContent.includes('no longer available'));
  assert.equal(mounted.container.textContent.includes('Appointment booked.'), false);
  assert.equal(bookingAttempts, 1);
  await setValue(mounted.container.querySelectorAll('select[required]')[1], '502');
  await click(button(mounted.container, 'Book appointment'));
  await settle();
  assert.equal(bookResolver instanceof Function, true);
  const bookingCall = mock.calls.filter(({ path, options }) => (
    path === '/api/v1/appointments' && options.method === 'POST'
  )).at(-1);
  assert.deepEqual(JSON.parse(bookingCall.options.body), {
    doctorAccountId: 81,
    availabilitySlotId: 502,
    patientRecipientAccountId: 42,
  });

  await act(async () => {
    bookResolver();
    await settle();
  });
  assert.ok(mounted.container.textContent.includes('The server confirmed this appointment.'));
  assert.ok(mounted.container.textContent.includes('BOOKED'));

  await click(button(mounted.container, 'Cancel appointment'));
  await settle();
  assert.equal(mounted.container.textContent.includes('Appointment cancelled.'), false);
  assert.equal(mounted.container.textContent.includes('BOOKED'), true);
  assert.equal(cancelResolver instanceof Function, true);
  await act(async () => {
    cancelResolver();
    await settle();
  });
  assert.ok(mounted.container.textContent.includes('Appointment cancelled. The server confirmed the change.'));
  assert.ok(mounted.container.textContent.includes('CANCELLED'));
  await mounted.unmount();
});

test('assigned doctor sees and completes worklist; staff view has no complete or reschedule actions', async () => {
  const appointment = {
    appointmentId: 411,
    doctorAccountId: 90,
    doctorName: 'Dr. Casey',
    recipientType: 'PATIENT',
    recipientName: 'Fictional Patient',
    startAt: '2026-12-02T15:00:00.000Z',
    endAt: '2026-12-02T15:30:00.000Z',
    status: 'BOOKED',
  };
  let completionResolver;
  const doctorMock = sessionMock({
    session: account('DOCTOR', 90),
    handler: async (path) => {
      if (path === '/api/v1/appointments?page=1&pageSize=50') {
        return success({ items: [appointment], total: 1, page: 1, pageSize: 50 });
      }
      if (path === '/api/v1/appointments/411/completion') {
        return new Promise((resolvePromise) => {
          completionResolver = () => resolvePromise(success({ ...appointment, status: 'COMPLETED' }));
        });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const doctorApp = await mountApp('/doctor/appointments', doctorMock.fetchMock);
  await settle();
  assert.ok(doctorApp.container.textContent.includes('Fictional Patient'));
  await click(button(doctorApp.container, 'Mark completed'));
  await settle();
  assert.equal(doctorApp.container.textContent.includes('Appointment completed.'), false);
  await act(async () => {
    completionResolver();
    await settle();
  });
  assert.ok(doctorApp.container.textContent.includes('Appointment completed. The server confirmed the change.'));
  assert.ok(doctorApp.container.textContent.includes('COMPLETED'));
  await doctorApp.unmount();

  const staffMock = sessionMock({
    session: account('STAFF', 900),
    handler: async (path) => {
      if (path === '/api/v1/admin/appointments?page=1&pageSize=20') {
        return success({ items: [appointment], total: 1, page: 1, pageSize: 20 });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const staffApp = await mountApp('/appointments', staffMock.fetchMock);
  await settle();
  assert.ok(staffApp.container.textContent.includes('Fictional Patient'));
  assert.equal(staffApp.container.textContent.includes('Mark completed'), false);
  assert.equal(staffApp.container.textContent.includes('Reschedule'), false);
  await staffApp.unmount();
});

test('doctor can update only the permitted professional summary', async () => {
  const mock = sessionMock({
    session: account('DOCTOR', 90),
    handler: async (path, options) => {
      if (path === '/api/v1/doctors/me' && options.method === 'GET') {
        return success({
          accountId: 90,
          professionalName: 'Dr. Casey',
          professionalSummary: 'Primary care',
          specializations: [{ id: 2, name: 'Family Medicine' }],
          departments: [{ id: 1, name: 'Primary Care' }],
        });
      }
      if (path === '/api/v1/doctors/me' && options.method === 'PATCH') {
        return success({
          accountId: 90,
          professionalName: 'Dr. Casey',
          professionalSummary: JSON.parse(options.body).professionalSummary,
          specializations: [{ id: 2, name: 'Family Medicine' }],
          departments: [{ id: 1, name: 'Primary Care' }],
        });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/doctor/profile', mock.fetchMock);
  await settle();
  assert.ok(mounted.container.textContent.includes('Family Medicine'));
  const summary = mounted.container.querySelector('textarea');
  await setValue(summary, 'Updated professional summary');
  await submit(summary.closest('form'));
  assert.ok(mounted.container.textContent.includes('Your professional profile was saved.'));
  assert.deepEqual(
    JSON.parse(mock.calls.find(({ path, options }) => (
      path === '/api/v1/doctors/me' && options.method === 'PATCH'
    )).options.body),
    { professionalSummary: 'Updated professional summary' },
  );
  await mounted.unmount();
});

test('doctor schedule displays booked slots as immutable and confirms schedule changes', async () => {
  const mock = sessionMock({
    session: account('DOCTOR', 90),
    handler: async (path, options) => {
      if (path === '/api/v1/doctors/90/availability?page=1&pageSize=50' && options.method === 'GET') {
        return success({
          items: [
            { id: 601, startAt: '2026-12-03T15:00:00.000Z', endAt: '2026-12-03T15:30:00.000Z', isBooked: true },
            { id: 602, startAt: '2026-12-04T15:00:00.000Z', endAt: '2026-12-04T15:30:00.000Z', isBooked: false },
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        });
      }
      if (path === '/api/v1/doctors/90/availability' && options.method === 'POST') {
        return success({
          id: 603,
          startAt: JSON.parse(options.body).startAt,
          endAt: JSON.parse(options.body).endAt,
          isBooked: false,
        }, 201);
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/doctor/schedule', mock.fetchMock);
  await settle();
  assert.ok(mounted.container.textContent.includes('Booked'));
  assert.equal(button(mounted.container, 'Edit').disabled, false);
  assert.equal(mounted.container.textContent.includes('Current display is UTC.'), true);

  const fields = mounted.container.querySelectorAll('input');
  await setValue(fields[0], '2026-12-05T10:00:00-05:00');
  await setValue(fields[1], '2026-12-05T10:30:00-05:00');
  await submit(mounted.container.querySelector('form'));
  assert.ok(mounted.container.textContent.includes('Availability was saved.'));
  const createCall = mock.calls.find(({ path, options }) => (
    path === '/api/v1/doctors/90/availability' && options.method === 'POST'
  ));
  assert.deepEqual(JSON.parse(createCall.options.body), {
    startAt: '2026-12-05T10:00:00-05:00',
    endAt: '2026-12-05T10:30:00-05:00',
  });
  assert.equal(createCall.options.headers.get('X-CSRF-Token'), 'csrf-1');
  await mounted.unmount();
});

test('staff department association changes call the API and refresh server-confirmed data', async () => {
  const department = {
    id: 1,
    name: 'Primary Care',
    description: 'General practice',
    doctors: [{ accountId: 90, professionalName: 'Dr. Casey' }],
  };
  const mock = sessionMock({
    session: account('STAFF', 900),
    handler: async (path, options) => {
      if (path === '/api/v1/departments' && options.method === 'GET') {
        return success([department]);
      }
      if (path === '/api/v1/departments/1' && options.method === 'PATCH') {
        return success({ ...department, ...JSON.parse(options.body) });
      }
      if (path === '/api/v1/departments/1/doctors' && options.method === 'PUT') {
        return success({ ...department, doctors: [{ accountId: 91, professionalName: 'Dr. Ellis' }] });
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/departments', mock.fetchMock);
  await settle();
  const nameInput = mounted.container.querySelector('.record-card input');
  await setValue(nameInput, 'Family Medicine');
  const associationInput = mounted.container.querySelector('.record-card input[aria-describedby]');
  await setValue(associationInput, '91');
  await click(button(mounted.container, 'Save department'));
  await settle();
  assert.ok(mounted.container.textContent.includes('Department changes saved.'));
  const associationCall = mock.calls.find(({ path, options }) => (
    path === '/api/v1/departments/1/doctors' && options.method === 'PUT'
  ));
  assert.deepEqual(JSON.parse(associationCall.options.body), { doctorAccountIds: [91] });
  await mounted.unmount();
});

test('staff dashboard provisions doctors and makes patient directory reads permission-scoped', async () => {
  const mock = sessionMock({
    session: account('STAFF', 900),
    handler: async (path, options) => {
      if (path === '/api/v1/admin/dashboard') {
        return success({ sections: [{ key: 'patients' }, { key: 'departments' }, { key: 'appointments' }] });
      }
      if (path === '/api/v1/admin/patients?page=1&pageSize=20') {
        return success({ items: [{ patientAccountId: 42, fullName: 'Avery Patient', dateOfBirth: '1990-01-01' }] });
      }
      if (path === '/api/v1/doctors' && options.method === 'POST') {
        return success({ accountId: 91, professionalName: 'Dr. Ellis' }, 201);
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/admin', mock.fetchMock);
  await settle();
  await click(button(mounted.container, 'View patient directory'));
  await settle();
  assert.ok(mounted.container.textContent.includes('Patient account #42'));
  assert.equal(mounted.container.textContent.includes('1990-01-01'), false);

  const form = mounted.container.querySelector('#doctors form');
  await setValue(form.querySelector('input[type="text"]') ?? form.querySelector('input'), 'Dr. Ellis');
  const inputs = form.querySelectorAll('input');
  await setValue(inputs[1], 'doctor@example.test');
  await setValue(inputs[2], 'temporary secure password');
  await setValue(form.querySelector('textarea'), 'Cardiology');
  await setValue(inputs[3], '1');
  await setValue(inputs[4], '1');
  await submit(form);
  assert.ok(mounted.container.textContent.includes('Doctor account provisioned.'));
  const provisionCall = mock.calls.find(({ path, options }) => (
    path === '/api/v1/doctors' && options.method === 'POST'
  ));
  assert.deepEqual(JSON.parse(provisionCall.options.body), {
    email: 'doctor@example.test',
    password: 'temporary secure password',
    professionalName: 'Dr. Ellis',
    professionalSummary: 'Cardiology',
    departmentIds: [1],
    specializationIds: [1],
  });
  assert.equal(mounted.container.textContent.includes('temporary secure password'), false);
  await mounted.unmount();
});

test('staff booking submits the patient and responsible-account fields with CSRF', async () => {
  const futureSlot = {
    id: 701,
    startAt: '2027-01-10T15:00:00.000Z',
    endAt: '2027-01-10T15:30:00.000Z',
    isBooked: false,
  };
  const mock = sessionMock({
    session: account('STAFF', 900),
    handler: async (path, options) => {
      if (path === '/api/v1/admin/dashboard') {
        return success({ sections: [{ key: 'appointments' }] });
      }
      if (path === '/api/v1/doctors/90/availability?page=1&pageSize=50') {
        return success({ items: [futureSlot], total: 1, page: 1, pageSize: 50 });
      }
      if (path === '/api/v1/appointments' && options.method === 'POST') {
        return success({
          appointmentId: 708,
          doctorAccountId: 90,
          availabilitySlotId: 701,
          recipientType: 'PATIENT',
          recipientName: 'Avery Patient',
          status: 'BOOKED',
        }, 201);
      }
      return response(403, null, { code: 'FORBIDDEN' });
    },
  });
  const mounted = await mountApp('/admin', mock.fetchMock);
  await settle();
  await setValue(mounted.container.querySelector('[name="responsibleAccountId"]'), '42');
  await setValue(mounted.container.querySelector('[name="doctorAccountId"]'), '90');
  await click(button(mounted.container, 'Find available slots'));
  await settle();
  await setValue(mounted.container.querySelector('[name="slotId"]'), '701');
  await click(button(mounted.container, 'Book for patient'));
  await settle();
  assert.ok(mounted.container.textContent.includes('Appointment booked. The server confirmed the change.'));
  const bookingCall = mock.calls.find(({ path, options }) => (
    path === '/api/v1/appointments' && options.method === 'POST'
  ));
  assert.deepEqual(JSON.parse(bookingCall.options.body), {
    doctorAccountId: 90,
    availabilitySlotId: 701,
    responsibleAccountId: 42,
    patientRecipientAccountId: 42,
  });
  assert.equal(bookingCall.options.headers.get('X-CSRF-Token'), 'csrf-1');
  await mounted.unmount();
});

test('staff booking controls hide after the API denies schedule access', async () => {
  const mock = sessionMock({
    session: account('STAFF', 900),
    handler: async (path) => {
      if (path === '/api/v1/admin/dashboard') {
        return success({ sections: [] });
      }
      if (path === '/api/v1/doctors/90/availability?page=1&pageSize=50') {
        return failure(403, 'FORBIDDEN');
      }
      return response(404, null, { code: 'RESOURCE_NOT_FOUND' });
    },
  });
  const mounted = await mountApp('/admin', mock.fetchMock);
  await settle();
  await setValue(mounted.container.querySelector('[name="responsibleAccountId"]'), '42');
  await setValue(mounted.container.querySelector('[name="doctorAccountId"]'), '90');
  await click(button(mounted.container, 'Find available slots'));
  await settle();
  assert.ok(mounted.container.textContent.includes("don't have permission"));
  assert.ok(mounted.container.textContent.includes('Booking controls are hidden'));
  assert.equal(mounted.container.querySelector('[name="doctorAccountId"]'), null);
  await mounted.unmount();
});
