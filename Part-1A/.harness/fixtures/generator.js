import { createHash } from 'node:crypto';

export const FIXTURE_SEED = 20261107;
export const BENCHMARK_CLOCK_ANCHOR = '2026-11-07T00:00:00.000Z';
export const GENERATOR_REVISION = 'phase9-fixture-v1';
export const FIXTURE_PATIENT_ACCOUNT_ID = 1001;
export const FIXTURE_STAFF_ACCOUNT_ID = 3001;

const PATIENT_COUNT = 200;
const BENEFICIARY_COUNT = 100;
const DOCTOR_COUNT = 20;
const DEPARTMENT_COUNT = 10;
const SLOT_COUNT = 300;
const APPOINTMENT_COUNT = 500;
const SLOT_DURATION_MS = 30 * 60 * 1000;
const SLOT_STEP_MS = 2 * 60 * 60 * 1000;
const SLOT_INITIAL_OFFSET_MS = 7 * 24 * 60 * 60 * 1000;
const RELATIONSHIPS = ['spouse', 'parent', 'child', 'sibling', 'other relative', 'legal guardian'];

function assertDate(value, label) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical UTC ISO instant.`);
  }
  return date;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function hospitalDate(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOffset(date, years) {
  const source = new Date(`${date}T00:00:00.000Z`);
  source.setUTCFullYear(source.getUTCFullYear() - years);
  return source.toISOString().slice(0, 10);
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertFixture(fixture) {
  const { patients, beneficiaries, doctors, departments, availabilitySlots, appointments } = fixture;
  const { counts } = fixture.manifest;
  if (
    patients.length !== PATIENT_COUNT
    || beneficiaries.length !== BENEFICIARY_COUNT
    || doctors.length !== DOCTOR_COUNT
    || departments.length !== DEPARTMENT_COUNT
    || availabilitySlots.length !== SLOT_COUNT
    || appointments.length !== APPOINTMENT_COUNT
  ) {
    throw new Error('Generated fixture entity counts do not match the approved harness dataset.');
  }

  const patientIds = new Set(patients.map(({ accountId }) => accountId));
  const doctorIds = new Set(doctors.map(({ accountId }) => accountId));
  const slotIds = new Set(availabilitySlots.map(({ id }) => id));
  const beneficiaryIds = new Set(beneficiaries.map(({ id }) => id));
  if (
    beneficiaries.some(({ ownerAccountId }) => !patientIds.has(ownerAccountId))
    || availabilitySlots.some(({ doctorAccountId }) => !doctorIds.has(doctorAccountId))
    || appointments.some((appointment) => (
      !slotIds.has(appointment.availabilitySlotId)
      || !doctorIds.has(appointment.doctorAccountId)
      || !patientIds.has(appointment.responsibleAccountId)
      || (
        appointment.beneficiaryId !== null
        && !beneficiaryIds.has(appointment.beneficiaryId)
      )
    ))
  ) {
    throw new Error('Generated fixture contains an invalid owner, recipient, doctor, or slot reference.');
  }

  const slotsById = new Map(availabilitySlots.map((slot) => [slot.id, slot]));
  const beneficiariesById = new Map(beneficiaries.map((beneficiary) => [beneficiary.id, beneficiary]));
  const activeByDoctor = new Map();
  const activeByPatient = new Map();
  for (const appointment of appointments.filter(({ status }) => status === 'BOOKED')) {
    const slot = slotsById.get(appointment.availabilitySlotId);
    if (slot.doctorAccountId !== appointment.doctorAccountId) {
      throw new Error('Generated appointment doctor does not match the configured slot doctor.');
    }
    if (
      appointment.patientRecipientAccountId !== null
      && appointment.patientRecipientAccountId !== appointment.responsibleAccountId
    ) {
      throw new Error('Generated self appointment has mismatched recipient and owner accounts.');
    }
    if (
      appointment.initiatedByRole === 'PATIENT'
      && appointment.initiatedByAccountId !== appointment.responsibleAccountId
    ) {
      throw new Error('Generated patient booking actor does not match its responsible account.');
    }
    if (appointment.beneficiaryId !== null) {
      const beneficiary = beneficiariesById.get(appointment.beneficiaryId);
      if (
        beneficiary.ownerAccountId !== appointment.responsibleAccountId
        || beneficiary.authorizationStatus !== 'AUTHORIZED'
      ) {
        throw new Error('Generated beneficiary appointment is not owned and authorized.');
      }
    }
    const intervals = activeByDoctor.get(appointment.doctorAccountId) ?? [];
    if (intervals.some(({ startAt, endAt }) => slot.startAt < endAt && slot.endAt > startAt)) {
      throw new Error('Generated fixture contains overlapping active appointments for a doctor.');
    }
    intervals.push({ startAt: slot.startAt, endAt: slot.endAt });
    activeByDoctor.set(appointment.doctorAccountId, intervals);
    const patientIntervals = activeByPatient.get(appointment.responsibleAccountId) ?? [];
    if (
      patientIntervals.some(({ startAt, endAt }) => slot.startAt < endAt && slot.endAt > startAt)
    ) {
      throw new Error('Generated fixture contains overlapping active appointments for a patient.');
    }
    patientIntervals.push({ startAt: slot.startAt, endAt: slot.endAt });
    activeByPatient.set(appointment.responsibleAccountId, patientIntervals);
  }

  const availabilityByDoctor = new Map();
  for (const slot of availabilitySlots) {
    const intervals = availabilityByDoctor.get(slot.doctorAccountId) ?? [];
    if (intervals.some(({ startAt, endAt }) => slot.startAt < endAt && slot.endAt > startAt)) {
      throw new Error('Generated fixture contains overlapping availability for a doctor.');
    }
    intervals.push({ startAt: slot.startAt, endAt: slot.endAt });
    availabilityByDoctor.set(slot.doctorAccountId, intervals);
  }

  const activeSlots = new Set(appointments
    .filter(({ status }) => status === 'BOOKED')
    .map(({ availabilitySlotId }) => availabilitySlotId));
  const unbooked = availabilitySlots.filter(({ id }) => !appointments
    .some((appointment) => appointment.availabilitySlotId === id));
  const futureBookedTargets = new Set(appointments
    .filter(({ status, availabilitySlotId }) => (
      status === 'BOOKED' && activeSlots.has(availabilitySlotId)
    ))
    .map(({ appointmentId }) => appointmentId));
  if (unbooked.length < 100 || futureBookedTargets.size < 100) {
    throw new Error('Generated fixture does not include the required distinct mutation targets.');
  }
  if (
    counts.beneficiaries.minor !== 40
    || counts.beneficiaries.pendingAdult !== 20
    || counts.beneficiaries.authorizedAdult !== 20
    || counts.beneficiaries.rejectedAdult !== 20
    || counts.appointments.BOOKED !== 100
    || counts.appointments.CANCELLED !== 200
    || counts.appointments.COMPLETED !== 200
  ) {
    throw new Error('Generated fixture authorization or appointment cohorts do not match the manifest.');
  }
}

export function generateFixture({
  seed = FIXTURE_SEED,
  anchor = BENCHMARK_CLOCK_ANCHOR,
  hospitalTimeZone,
} = {}) {
  if (!Number.isSafeInteger(seed) || seed < 0) {
    throw new TypeError('Fixture seed must be a non-negative safe integer.');
  }
  if (typeof hospitalTimeZone !== 'string' || hospitalTimeZone.trim() === '') {
    throw new TypeError('A configured hospital IANA time zone is required.');
  }
  try {
    new Intl.DateTimeFormat('en', { timeZone: hospitalTimeZone });
  } catch (error) {
    throw new TypeError('The fixture hospital time zone must be a valid IANA zone.', { cause: error });
  }
  const anchorDate = assertDate(anchor, 'Fixture anchor');
  const random = seededRandom(seed);
  const localAnchorDate = hospitalDate(anchorDate, hospitalTimeZone);
  const createdAt = anchorDate.toISOString();

  const departments = Array.from({ length: DEPARTMENT_COUNT }, (_, index) => ({
    id: 4001 + index,
    name: `Fixture Department ${String(index + 1).padStart(2, '0')}`,
    description: `Fictional department ${index + 1}`,
  }));
  const specializations = Array.from({ length: 5 }, (_, index) => ({
    id: 5001 + index,
    name: `Fixture Specialty ${String(index + 1).padStart(2, '0')}`,
  }));
  const patients = Array.from({ length: PATIENT_COUNT }, (_, index) => {
    const accountId = 1001 + index;
    const cohortAge = 18 + Math.floor(random() * 60);
    return {
      accountId,
      fullName: `Fixture Patient ${String(index + 1).padStart(3, '0')}`,
      email: `fixture-patient-${String(index + 1).padStart(3, '0')}-${seed}@example.test`,
      dateOfBirth: dateOffset(localAnchorDate, cohortAge),
    };
  });
  const beneficiaries = Array.from({ length: BENEFICIARY_COUNT }, (_, index) => {
    const minor = index < 40;
    const status = minor
      ? null
      : index < 60
        ? 'PENDING_AUTHORIZATION'
        : index < 80
          ? 'AUTHORIZED'
          : 'REJECTED';
    const age = minor ? 1 + Math.floor(random() * 17) : 18 + Math.floor(random() * 53);
    return {
      id: 6001 + index,
      ownerAccountId: 1001 + (index % PATIENT_COUNT),
      fullName: `Fixture Beneficiary ${String(index + 1).padStart(3, '0')}`,
      dateOfBirth: dateOffset(localAnchorDate, age),
      relationship: minor ? 'child' : RELATIONSHIPS[Math.floor(random() * RELATIONSHIPS.length)],
      authorizationStatus: status,
      createdAt,
      updatedAt: createdAt,
    };
  });
  const doctors = Array.from({ length: DOCTOR_COUNT }, (_, index) => ({
    accountId: 2001 + index,
    fullName: `Fixture Doctor ${String(index + 1).padStart(2, '0')}`,
    email: `fixture-doctor-${String(index + 1).padStart(2, '0')}-${seed}@example.test`,
    professionalName: `Fixture Doctor ${String(index + 1).padStart(2, '0')}`,
    professionalSummary: `Fictional professional profile ${index + 1}`,
    departmentIds: [departments[index % departments.length].id],
    specializationIds: [specializations[index % specializations.length].id],
  }));
  const availabilitySlots = Array.from({ length: SLOT_COUNT }, (_, index) => {
    const start = new Date(
      anchorDate.getTime() + SLOT_INITIAL_OFFSET_MS + index * SLOT_STEP_MS,
    );
    return {
      id: 7001 + index,
      doctorAccountId: doctors[index % doctors.length].accountId,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + SLOT_DURATION_MS).toISOString(),
      createdAt,
      updatedAt: createdAt,
    };
  });
  const appointments = [];
  const statuses = ['BOOKED', 'CANCELLED', 'CANCELLED', 'COMPLETED', 'COMPLETED'];
  for (let slotIndex = 200; slotIndex < SLOT_COUNT; slotIndex += 1) {
    const slot = availabilitySlots[slotIndex];
    for (const [statusIndex, status] of statuses.entries()) {
      const ownerAccountId = status === 'BOOKED'
        ? FIXTURE_PATIENT_ACCOUNT_ID
        : patients[(slotIndex + statusIndex) % patients.length].accountId;
      const authorizedBeneficiary = beneficiaries.find(({ authorizationStatus }) => (
        authorizationStatus === 'AUTHORIZED'
      ));
      const useBeneficiary = statusIndex > 0 && slotIndex < 220 && statusIndex % 2 === 0;
      const beneficiary = useBeneficiary ? authorizedBeneficiary : null;
      const responsibleAccountId = beneficiary?.ownerAccountId ?? ownerAccountId;
      appointments.push({
        appointmentId: 8001 + appointments.length,
        availabilitySlotId: slot.id,
        doctorAccountId: slot.doctorAccountId,
        patientRecipientAccountId: beneficiary ? null : responsibleAccountId,
        beneficiaryId: beneficiary?.id ?? null,
        responsibleAccountId,
        initiatedByAccountId: responsibleAccountId,
        initiatedByRole: 'PATIENT',
        status,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  const authorizationAudits = beneficiaries
    .filter(({ authorizationStatus }) => (
      authorizationStatus === 'AUTHORIZED' || authorizationStatus === 'REJECTED'
    ))
    .map((beneficiary, index) => ({
      beneficiaryId: beneficiary.id,
      reviewerAccountId: FIXTURE_STAFF_ACCOUNT_ID,
      verificationMethod: index % 2 === 0 ? 'PHONE' : 'IN_PERSON',
      outcome: beneficiary.authorizationStatus,
      reviewedAt: createdAt,
    }));

  const counts = {
    patients: patients.length,
    beneficiaries: {
      total: beneficiaries.length,
      minor: beneficiaries.filter(({ authorizationStatus }) => authorizationStatus === null).length,
      pendingAdult: beneficiaries.filter(
        ({ authorizationStatus }) => authorizationStatus === 'PENDING_AUTHORIZATION',
      ).length,
      authorizedAdult: beneficiaries.filter(
        ({ authorizationStatus }) => authorizationStatus === 'AUTHORIZED',
      ).length,
      rejectedAdult: beneficiaries.filter(
        ({ authorizationStatus }) => authorizationStatus === 'REJECTED',
      ).length,
    },
    doctors: doctors.length,
    departments: departments.length,
    availabilitySlots: {
      total: availabilitySlots.length,
      unbooked: availabilitySlots.slice(0, 200).length,
      futureBookedCancellationTargets: 100,
    },
    appointments: appointments.reduce((result, { status }) => {
      result[status] += 1;
      return result;
    }, { BOOKED: 0, CANCELLED: 0, COMPLETED: 0 }),
    authorizationAudits: authorizationAudits.length,
  };
  const fixture = {
    manifest: {
      seed,
      benchmarkClockAnchor: anchorDate.toISOString(),
      hospitalTimeZone,
      generatorRevision: GENERATOR_REVISION,
      dateOffsetRules: {
        referenceInstant: anchorDate.toISOString(),
        localCalendarReference: localAnchorDate,
        beneficiaryBirthDates: 'Hospital-local anchor date minus seeded whole-year ages; minors 1-17, adults 18-70.',
        availabilityStart: 'UTC anchor plus 7 days plus 2 hours per slot index.',
        availabilityDuration: '30 minutes per slot; per-doctor intervals are non-overlapping.',
        appointmentDate: 'Appointment slots inherit their deterministic availability UTC instants.',
        createdUpdatedAt: 'Fixed benchmark clock anchor for seeded database timestamps.',
      },
      counts,
      search: {
        query: 'Fixture Doctor',
        expectedResultCount: doctors.length,
        pageSize: 20,
        sortOrder: 'professionalName ASC, accountId ASC',
      },
      pagination: {
        pageSize: 20,
        patientSortOrder: 'fullName ASC, patientAccountId ASC',
        appointmentSortOrder: 'startAt DESC, appointmentId DESC',
      },
    },
    departments,
    specializations,
    patients,
    beneficiaries,
    doctors,
    availabilitySlots,
    appointments,
    authorizationAudits,
    staff: {
      accountId: FIXTURE_STAFF_ACCOUNT_ID,
      fullName: 'Fixture Hospital Staff',
      email: `fixture-staff-${seed}@example.test`,
    },
  };
  assertFixture(fixture);
  return fixture;
}

export function fixtureManifestHash(manifest) {
  return stableHash(manifest);
}

export function validateFixture(fixture) {
  assertFixture(fixture);
  return true;
}
