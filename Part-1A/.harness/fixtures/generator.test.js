import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BENCHMARK_CLOCK_ANCHOR,
  FIXTURE_SEED,
  generateFixture,
  fixtureManifestHash,
  validateFixture,
} from './generator.js';

const TIME_ZONE = 'America/New_York';

test('fixture manifest, fixed clock and entity cohorts match the approved dataset', () => {
  const fixture = generateFixture({ hospitalTimeZone: TIME_ZONE });
  assert.equal(fixture.manifest.seed, FIXTURE_SEED);
  assert.equal(fixture.manifest.benchmarkClockAnchor, BENCHMARK_CLOCK_ANCHOR);
  assert.equal(fixture.manifest.hospitalTimeZone, TIME_ZONE);
  assert.equal(fixture.manifest.generatorRevision, 'phase9-fixture-v1');
  assert.ok(fixture.manifest.dateOffsetRules);
  assert.equal(fixture.manifest.dateOffsetRules.referenceInstant, BENCHMARK_CLOCK_ANCHOR);
  assert.equal(fixture.manifest.counts.patients, 200);
  assert.deepEqual(fixture.manifest.counts.beneficiaries, {
    total: 100,
    minor: 40,
    pendingAdult: 20,
    authorizedAdult: 20,
    rejectedAdult: 20,
  });
  assert.equal(fixture.manifest.counts.doctors, 20);
  assert.equal(fixture.manifest.counts.departments, 10);
  assert.deepEqual(fixture.manifest.counts.availabilitySlots, {
    total: 300,
    unbooked: 200,
    futureBookedCancellationTargets: 100,
  });
  assert.deepEqual(fixture.manifest.counts.appointments, {
    BOOKED: 100,
    CANCELLED: 200,
    COMPLETED: 200,
  });
  assert.equal(fixture.manifest.search.expectedResultCount, 20);
  assert.equal(fixture.manifest.search.pageSize, 20);
  assert.equal(validateFixture(fixture), true);
  assert.match(fixtureManifestHash(fixture.manifest), /^[a-f0-9]{64}$/);
});

test('the same seed, anchor and hospital zone produce byte-identical fixture data and dates', () => {
  const first = generateFixture({
    seed: FIXTURE_SEED,
    anchor: BENCHMARK_CLOCK_ANCHOR,
    hospitalTimeZone: TIME_ZONE,
  });
  const second = generateFixture({
    seed: FIXTURE_SEED,
    anchor: BENCHMARK_CLOCK_ANCHOR,
    hospitalTimeZone: TIME_ZONE,
  });
  assert.deepEqual(second, first);
  assert.equal(fixtureManifestHash(second.manifest), fixtureManifestHash(first.manifest));
});

test('fixture date offsets, relationships, active intervals and mutation targets are valid', () => {
  const fixture = generateFixture({ hospitalTimeZone: TIME_ZONE });
  const anchor = Date.parse(BENCHMARK_CLOCK_ANCHOR);
  for (const [index, slot] of fixture.availabilitySlots.entries()) {
    assert.equal(
      Date.parse(slot.startAt),
      anchor + 7 * 24 * 60 * 60 * 1000 + index * 2 * 60 * 60 * 1000,
    );
    assert.equal(Date.parse(slot.endAt) - Date.parse(slot.startAt), 30 * 60 * 1000);
    assert.ok(Date.parse(slot.startAt) > anchor);
  }
  assert.ok(fixture.appointments.every(({ createdAt }) => createdAt === BENCHMARK_CLOCK_ANCHOR));
  assert.equal(new Set(fixture.appointments
    .filter(({ status }) => status === 'BOOKED')
    .map(({ availabilitySlotId }) => availabilitySlotId)).size, 100);
  assert.equal(fixture.availabilitySlots.filter(({ id }) => !fixture.appointments.some(
    ({ availabilitySlotId }) => availabilitySlotId === id,
  )).length, 200);
  assert.equal(
    fixture.beneficiaries.filter(({ authorizationStatus }) => (
      authorizationStatus === 'AUTHORIZED' || authorizationStatus === 'REJECTED'
    )).length,
    fixture.authorizationAudits.length,
  );
  assert.ok(fixture.beneficiaries.every((beneficiary) => (
    beneficiary.authorizationStatus === null
      ? Date.parse(`${beneficiary.dateOfBirth}T00:00:00.000Z`)
        > Date.parse('2008-11-06T00:00:00.000Z')
      : Date.parse(`${beneficiary.dateOfBirth}T00:00:00.000Z`)
        <= Date.parse('2008-11-06T00:00:00.000Z')
  )));
});
