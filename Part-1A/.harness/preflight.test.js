import assert from 'node:assert/strict';
import test from 'node:test';
import { createConfig } from '../backend/src/config/index.js';
import { preflightFingerprint, runPreflight } from './preflight.js';

test('public-API preflight is repeatable under different host dates and checks read-only SQLite state', async (t) => {
  const hospitalTimeZone = 'America/New_York';
  t.mock.timers.enable({
    apis: ['Date'],
    now: Date.parse('2040-01-01T00:00:00.000Z'),
  });
  const farFutureHostDate = await runPreflight({ hospitalTimeZone });

  t.mock.timers.setTime(Date.parse('2000-01-01T00:00:00.000Z'));
  const farPastHostDate = await runPreflight({ hospitalTimeZone });

  assert.equal(preflightFingerprint(farFutureHostDate), preflightFingerprint(farPastHostDate));
  assert.equal(farFutureHostDate.benchmarkClockAnchor, '2026-11-07T00:00:00.000Z');
  assert.equal(farFutureHostDate.applicationClock, farFutureHostDate.benchmarkClockAnchor);
  assert.equal(farFutureHostDate.hospitalTimeZone, hospitalTimeZone);
  assert.equal(
    farFutureHostDate.clockScope,
    'clock injection is confined to the isolated app configuration',
  );
  assert.ok(farFutureHostDate.actions.length >= 40);
  assert.ok(farFutureHostDate.actions.every(({ passed }) => passed));
  assert.ok(farFutureHostDate.actions.some(({ name }) => name === 'doctor-availability-create'));
  assert.ok(farFutureHostDate.actions.some(({ name }) => name === 'patient-appointment-booking'));
  assert.ok(farFutureHostDate.actions.some(
    ({ name }) => name === 'adult-beneficiary-authorized-by-staff',
  ));
  assert.deepEqual(farFutureHostDate.independentDatabaseChecks.fixtureCounts, {
    patients: 200,
    beneficiaries: 100,
    doctors: 20,
    departments: 10,
    availabilitySlots: 300,
    appointments: 500,
  });
  assert.equal(farFutureHostDate.independentDatabaseChecks.integrityCheck, 'ok');
  assert.equal(farFutureHostDate.independentDatabaseChecks.foreignKeyViolations, 0);
  assert.equal(farFutureHostDate.independentDatabaseChecks.activeAppointmentOverlapCount, 0);
  assert.equal(farFutureHostDate.independentDatabaseChecks.missingAuthorizationAuditCount, 0);
  const evidenceText = JSON.stringify(farFutureHostDate);
  assert.doesNotMatch(evidenceText, /password|csrfToken|sessionToken|hms_session=|@example\.test/i);

  t.mock.timers.reset();
  const normalClock = new Date();
  assert.ok(normalClock.getUTCFullYear() < 2040);
  const normalApplicationClock = createConfig({ hospitalTimeZone }).now().getTime();
  assert.ok(Math.abs(normalApplicationClock - Date.now()) < 1000);
});
