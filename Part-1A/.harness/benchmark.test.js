import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BENCHMARK_PROTOCOL,
  createBenchmarkOperations,
  measureTargetBatches,
  nearestRankPercentile,
  runBenchmark,
  runDeterministicBatches,
} from './benchmark.js';
import { generateFixture } from './fixtures/generator.js';

test('benchmark protocol fixes warm-ups, measured count, page size and concurrency', () => {
  assert.deepEqual(BENCHMARK_PROTOCOL, {
    warmupRequestCount: 10,
    measuredSampleCount: 100,
    maximumConcurrentClients: 3,
    pageSize: 20,
  });
  const fixture = generateFixture({ hospitalTimeZone: 'America/New_York' });
  const operations = createBenchmarkOperations(fixture);
  assert.deepEqual(operations.map(({ key }) => key), [
    'doctorSearch',
    'paginatedPatientReads',
    'paginatedAppointmentReads',
    'appointmentBooking',
    'appointmentCancellation',
  ]);
  assert.equal(operations[0].expectedResultCount, 20);
  assert.equal(operations[1].expectedResultCount, 200);
  assert.equal(operations[2].expectedResultCount, 500);
  assert.equal(operations.slice(0, 3).every(({ query }) => query.includes('pageSize=20')), true);
});

test('nearest-rank percentile uses the ceil(p*n) 1-based rank without mutating samples', () => {
  const values = Array.from({ length: 100 }, (_, index) => index + 1);
  const original = [...values];
  assert.equal(nearestRankPercentile(values, 0.5), 50);
  assert.equal(nearestRankPercentile(values, 0.95), 95);
  assert.equal(nearestRankPercentile(values, 0.99), 99);
  assert.deepEqual(values, original);
  assert.equal(nearestRankPercentile([9, 1, 5], 0.95), 9);
  assert.throws(() => nearestRankPercentile([], 0.95), TypeError);
  assert.throws(() => nearestRankPercentile([1, Number.NaN], 0.95), TypeError);
});

test('deterministic batching preserves order and never exceeds three active requests', async () => {
  const items = Array.from({ length: 10 }, (_, index) => index);
  const result = await runDeterministicBatches(items, 3, async (item) => {
    await new Promise((resolve) => setImmediate(resolve));
    return item * 2;
  });
  assert.deepEqual(result.results, items.map((item) => item * 2));
  assert.ok(result.maximumActive <= 3);
  await assert.rejects(
    runDeterministicBatches(items, 4, async () => {}),
    TypeError,
  );
});

test('reset and setup time are excluded from measured request durations', async () => {
  let clock = 0;
  clock += 50_000;
  const measured = await measureTargetBatches({
    targets: ['one', 'two'],
    concurrency: 1,
    now: () => clock,
    async execute(_target, index) {
      clock += 7 + index;
      return { status: 200 };
    },
  });
  assert.deepEqual(measured.results.map(({ durationMs }) => durationMs), [7, 8]);
  assert.equal(measured.maximumActive, 1);
});

test('booking and cancellation measurements use distinct future fixture targets', () => {
  const fixture = generateFixture({ hospitalTimeZone: 'America/New_York' });
  const operations = createBenchmarkOperations(fixture);
  const booking = operations.find(({ key }) => key === 'appointmentBooking');
  const cancellation = operations.find(({ key }) => key === 'appointmentCancellation');
  const bookingTargets = Array.from({ length: 100 }, (_, index) => booking.targetFor(index));
  const cancellationTargets = Array.from(
    { length: 100 },
    (_, index) => cancellation.targetFor(index),
  );
  assert.equal(new Set(bookingTargets.map(({ body }) => body.availabilitySlotId)).size, 100);
  assert.equal(new Set(cancellationTargets.map(({ path }) => path)).size, 100);
  assert.ok(bookingTargets.every(({ body }) => body.availabilitySlotId >= 7001));
  assert.ok(cancellationTargets.every(({ path }) => path.includes('/cancellation')));
  assert.ok(cancellation.targets.every(({ status }) => status === 'BOOKED'));
});

test('independent benchmark records all samples, warm-ups, concurrency and sanitized outcomes', async () => {
  const report = await runBenchmark({ hospitalTimeZone: 'America/New_York' });
  assert.deepEqual(report.operations.map(({ operation }) => operation), [
    'doctorSearch',
    'paginatedPatientReads',
    'paginatedAppointmentReads',
    'appointmentBooking',
    'appointmentCancellation',
  ]);
  assert.equal(report.benchmarkClockAnchor, '2026-11-07T00:00:00.000Z');
  assert.equal(report.operations.every(({ warmupRequestCount }) => warmupRequestCount === 10), true);
  assert.equal(report.operations.every(({ measuredSampleCount }) => measuredSampleCount === 100), true);
  assert.equal(report.operations.every(({ samples }) => samples.length === 100), true);
  assert.equal(report.operations.every(({ maximumConcurrentRequests }) => (
    maximumConcurrentRequests <= 3
  )), true);
  assert.equal(report.operations.every(({ failures }) => failures.length === 0), true);
  assert.equal(report.operations.every(({ accepted }) => accepted), true);
  assert.equal(report.operations[3].distinctMutationTargets, 100);
  assert.equal(report.operations[4].distinctMutationTargets, 100);
  for (const operation of report.operations) {
    assert.equal(
      operation.durationMs.p95,
      nearestRankPercentile(operation.samples.map(({ durationMs }) => durationMs), 0.95),
    );
  }
  assert.equal(report.protocol.automaticRetries, 0);
  assert.equal(report.measuredFailureCount, 0);
  const evidenceText = JSON.stringify(report);
  assert.doesNotMatch(evidenceText, /password|csrfToken|sessionToken|hms_session=|@example\.test/i);
});
