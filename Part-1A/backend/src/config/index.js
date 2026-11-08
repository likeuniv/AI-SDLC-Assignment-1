import { validateTimeZone } from '../shared/time.js';

function parsePositiveInteger(value, name, fallback, maximum) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new TypeError(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return parsed;
}

export function createConfig({
  hospitalTimeZone,
  applicationOrigin = 'http://localhost:5173',
  nodeEnvironment = 'development',
  secureCookies,
  sessionTtlSeconds = 8 * 60 * 60,
  loginRateLimit = { maxRequests: 10, windowMs: 15 * 60 * 1000 },
  registrationRateLimit = { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  beneficiaryAuthorizationReviewerAccountIds = [],
  departmentManagerAccountIds = [],
  doctorManagerAccountIds = [],
  availabilityManagerAccountIds = [],
  availabilityViewerAccountIds = [],
  appointmentBookerAccountIds = [],
  appointmentCancellerAccountIds = [],
  appointmentViewerAccountIds = [],
  patientDirectoryViewerAccountIds = [],
  adminDashboardAccountIds = [],
  now = () => new Date(),
} = {}) {
  if (typeof hospitalTimeZone !== 'string' || hospitalTimeZone.trim() === '') {
    throw new TypeError('HOSPITAL_TIME_ZONE must be configured.');
  }
  validateTimeZone(hospitalTimeZone);

  let origin;
  try {
    origin = new URL(applicationOrigin);
  } catch (error) {
    throw new TypeError('APPLICATION_ORIGIN must be a valid HTTP(S) origin.', { cause: error });
  }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== applicationOrigin) {
    throw new TypeError('APPLICATION_ORIGIN must contain only an HTTP(S) scheme, host, and port.');
  }
  if (nodeEnvironment === 'production' && secureCookies === false) {
    throw new TypeError('Secure session cookies are required in production.');
  }

  const cookieSecure = secureCookies
    ?? (nodeEnvironment === 'production' || origin.protocol === 'https:');
  const sessionLifetime = parsePositiveInteger(
    String(sessionTtlSeconds),
    'SESSION_TTL_SECONDS',
    8 * 60 * 60,
    30 * 24 * 60 * 60,
  );
  const limits = {
    login: {
      maxRequests: parsePositiveInteger(
        String(loginRateLimit.maxRequests),
        'LOGIN_RATE_LIMIT_MAX',
        10,
        10000,
      ),
      windowMs: parsePositiveInteger(
        String(loginRateLimit.windowMs),
        'LOGIN_RATE_LIMIT_WINDOW_MS',
        15 * 60 * 1000,
        24 * 60 * 60 * 1000,
      ),
    },
    registration: {
      maxRequests: parsePositiveInteger(
        String(registrationRateLimit.maxRequests),
        'REGISTRATION_RATE_LIMIT_MAX',
        5,
        10000,
      ),
      windowMs: parsePositiveInteger(
        String(registrationRateLimit.windowMs),
        'REGISTRATION_RATE_LIMIT_WINDOW_MS',
        60 * 60 * 1000,
        24 * 60 * 60 * 1000,
      ),
    },
  };
  const permissionAccounts = {
    'beneficiary:review-authorization': beneficiaryAuthorizationReviewerAccountIds,
    'department:manage': departmentManagerAccountIds,
    'doctor:manage': doctorManagerAccountIds,
    'availability:manage': availabilityManagerAccountIds,
    'availability:view': availabilityViewerAccountIds,
    'appointment:book': appointmentBookerAccountIds,
    'appointment:cancel': appointmentCancellerAccountIds,
    'appointment:view': appointmentViewerAccountIds,
    'patient:view': patientDirectoryViewerAccountIds,
    'admin:dashboard': adminDashboardAccountIds,
  };
  for (const [permission, accountIds] of Object.entries(permissionAccounts)) {
    if (
      !Array.isArray(accountIds)
      || accountIds.some((accountId) => !Number.isSafeInteger(accountId) || accountId < 1)
    ) {
      throw new TypeError(`Configured ${permission} account IDs must be positive integers.`);
    }
  }
  const permissionAccountSets = new Map(
    Object.entries(permissionAccounts).map(([permission, accountIds]) => [
      permission,
      new Set(accountIds),
    ]),
  );

  return Object.freeze({
    hospitalTimeZone,
    applicationOrigin: origin.origin,
    nodeEnvironment,
    secureCookies: cookieSecure,
    sessionCookieName: 'hms_session',
    sessionTtlSeconds: sessionLifetime,
    bcryptCost: 12,
    rateLimits: Object.freeze({
      login: Object.freeze(limits.login),
      registration: Object.freeze(limits.registration),
    }),
    hasPermission(accountId, permission) {
      return permissionAccountSets.get(permission)?.has(accountId) ?? false;
    },
    now,
  });
}

export function loadConfig(environment = process.env) {
  const reviewerIds = environment.BENEFICIARY_AUTHORIZATION_REVIEWER_IDS;
  const departmentManagerIds = environment.DEPARTMENT_MANAGER_ACCOUNT_IDS;
  const doctorManagerIds = environment.DOCTOR_MANAGER_ACCOUNT_IDS;
  const availabilityManagerIds = environment.AVAILABILITY_MANAGER_ACCOUNT_IDS;
  const availabilityViewerIds = environment.AVAILABILITY_VIEWER_ACCOUNT_IDS;
  const appointmentBookerIds = environment.APPOINTMENT_BOOKER_ACCOUNT_IDS;
  const appointmentCancellerIds = environment.APPOINTMENT_CANCELLER_ACCOUNT_IDS;
  const appointmentViewerIds = environment.APPOINTMENT_VIEWER_ACCOUNT_IDS;
  const patientDirectoryViewerIds = environment.PATIENT_DIRECTORY_VIEWER_ACCOUNT_IDS;
  const adminDashboardIds = environment.ADMIN_DASHBOARD_ACCOUNT_IDS;
  const beneficiaryAuthorizationReviewerAccountIds = reviewerIds
    ? reviewerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const departmentManagerAccountIds = departmentManagerIds
    ? departmentManagerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const doctorManagerAccountIds = doctorManagerIds
    ? doctorManagerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const availabilityManagerAccountIds = availabilityManagerIds
    ? availabilityManagerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const availabilityViewerAccountIds = availabilityViewerIds
    ? availabilityViewerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const appointmentBookerAccountIds = appointmentBookerIds
    ? appointmentBookerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const appointmentCancellerAccountIds = appointmentCancellerIds
    ? appointmentCancellerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const appointmentViewerAccountIds = appointmentViewerIds
    ? appointmentViewerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const patientDirectoryViewerAccountIds = patientDirectoryViewerIds
    ? patientDirectoryViewerIds.split(',').map((value) => Number(value.trim()))
    : [];
  const adminDashboardAccountIds = adminDashboardIds
    ? adminDashboardIds.split(',').map((value) => Number(value.trim()))
    : [];
  return createConfig({
    hospitalTimeZone: environment.HOSPITAL_TIME_ZONE,
    applicationOrigin: environment.APPLICATION_ORIGIN ?? 'http://localhost:5173',
    nodeEnvironment: environment.NODE_ENV ?? 'development',
    secureCookies: environment.SESSION_COOKIE_SECURE === undefined
      ? undefined
      : environment.SESSION_COOKIE_SECURE === 'true',
    sessionTtlSeconds: environment.SESSION_TTL_SECONDS ?? 8 * 60 * 60,
    loginRateLimit: {
      maxRequests: environment.LOGIN_RATE_LIMIT_MAX ?? 10,
      windowMs: environment.LOGIN_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000,
    },
    registrationRateLimit: {
      maxRequests: environment.REGISTRATION_RATE_LIMIT_MAX ?? 5,
      windowMs: environment.REGISTRATION_RATE_LIMIT_WINDOW_MS ?? 60 * 60 * 1000,
    },
    beneficiaryAuthorizationReviewerAccountIds,
    departmentManagerAccountIds,
    doctorManagerAccountIds,
    availabilityManagerAccountIds,
    availabilityViewerAccountIds,
    appointmentBookerAccountIds,
    appointmentCancellerAccountIds,
    appointmentViewerAccountIds,
    patientDirectoryViewerAccountIds,
    adminDashboardAccountIds,
  });
}
