import { createHash, randomBytes } from 'node:crypto';
import { availableParallelism, cpus, platform, release, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import {
  BENCHMARK_CLOCK_ANCHOR,
  FIXTURE_PATIENT_ACCOUNT_ID,
  FIXTURE_SEED,
  generateFixture,
  fixtureManifestHash,
} from './fixtures/generator.js';
import { authenticate, apiRequest } from './api.js';
import { createIsolatedApplication, createRuntimeCredentials } from './runtime.js';

export const BENCHMARK_PROTOCOL = Object.freeze({
  warmupRequestCount: 10,
  measuredSampleCount: 100,
  maximumConcurrentClients: 3,
  pageSize: 20,
});
const { warmupRequestCount: WARMUP_COUNT, measuredSampleCount: SAMPLE_COUNT } = BENCHMARK_PROTOCOL;
const CONCURRENCY = BENCHMARK_PROTOCOL.maximumConcurrentClients;
const PAGE_SIZE = BENCHMARK_PROTOCOL.pageSize;

export function nearestRankPercentile(values, percentile) {
  if (
    !Array.isArray(values)
    || values.length === 0
    || values.some((value) => !Number.isFinite(value) || value < 0)
    || !Number.isFinite(percentile)
    || percentile <= 0
    || percentile > 1
  ) {
    throw new TypeError('Nearest-rank percentile requires finite non-negative samples and p in (0, 1].');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(percentile * sorted.length);
  return sorted[rank - 1];
}

export async function runDeterministicBatches(items, concurrency, callback) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 3) {
    throw new TypeError('Harness batch concurrency must be between 1 and 3.');
  }
  let active = 0;
  let maximumActive = 0;
  const results = [];
  for (let offset = 0; offset < items.length; offset += concurrency) {
    const batch = items.slice(offset, offset + concurrency);
    const batchResults = await Promise.all(batch.map(async (item, batchIndex) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      try {
        return await callback(item, offset + batchIndex);
      } finally {
        active -= 1;
      }
    }));
    results.push(...batchResults);
  }
  return { results, maximumActive };
}

export async function measureTargetBatches({
  targets,
  concurrency = CONCURRENCY,
  execute,
  now = () => performance.now(),
} = {}) {
  if (!Array.isArray(targets) || typeof execute !== 'function' || typeof now !== 'function') {
    throw new TypeError('Measured batches require targets, an execution callback, and a clock.');
  }
  return runDeterministicBatches(targets, concurrency, async (target, index) => {
    const started = now();
    const result = await execute(target, index);
    const durationMs = now() - started;
    return {
      ...result,
      durationMs: Number(durationMs.toFixed(3)),
    };
  });
}

function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function benchmarkActorCredentials(fixture) {
  return createRuntimeCredentials(fixture);
}

async function benchmarkRequest(baseUrl, options) {
  try {
    return await apiRequest(baseUrl, options);
  } catch {
    return { status: 0, code: 'NETWORK_ERROR', data: null };
  }
}

async function setupBenchmarkApp(fixture, credentials) {
  const app = await createIsolatedApplication({ fixture, credentials });
  try {
    const patient = await authenticate(app.baseUrl, credentials.patient);
    const staff = await authenticate(app.baseUrl, credentials.staff);
    return { app, patient, staff };
  } catch (error) {
    await app.dispose();
    throw error;
  }
}

export function createBenchmarkOperations(fixture) {
  const bookedTargets = fixture.appointments.filter(({ status }) => status === 'BOOKED');
  const unbookedTargets = fixture.availabilitySlots.filter(({ id }) => (
    !fixture.appointments.some(({ availabilitySlotId }) => availabilitySlotId === id)
  ));
  return [
    {
      key: 'doctorSearch',
      endpoint: '/api/v1/doctors',
      actorRole: 'PATIENT',
      expectedStatus: 200,
      expectedResultCount: fixture.manifest.search.expectedResultCount,
      query: `/api/v1/doctors?name=${encodeURIComponent(fixture.manifest.search.query)}&page=1&pageSize=${PAGE_SIZE}`,
      targetFor: () => ({ path: `/api/v1/doctors?name=${encodeURIComponent(fixture.manifest.search.query)}&page=1&pageSize=${PAGE_SIZE}` }),
    },
    {
      key: 'paginatedPatientReads',
      endpoint: '/api/v1/admin/patients',
      actorRole: 'STAFF',
      expectedStatus: 200,
      expectedResultCount: fixture.patients.length,
      query: `/api/v1/admin/patients?page=1&pageSize=${PAGE_SIZE}`,
      targetFor: () => ({ path: `/api/v1/admin/patients?page=1&pageSize=${PAGE_SIZE}` }),
    },
    {
      key: 'paginatedAppointmentReads',
      endpoint: '/api/v1/admin/appointments',
      actorRole: 'STAFF',
      expectedStatus: 200,
      expectedResultCount: fixture.appointments.length,
      query: `/api/v1/admin/appointments?page=1&pageSize=${PAGE_SIZE}`,
      targetFor: () => ({ path: `/api/v1/admin/appointments?page=1&pageSize=${PAGE_SIZE}` }),
    },
    {
      key: 'appointmentBooking',
      endpoint: '/api/v1/appointments',
      actorRole: 'PATIENT',
      expectedStatus: 201,
      expectedResultCount: null,
      query: null,
      targetFor: (index) => {
        const slot = unbookedTargets[index];
        if (!slot) {
          throw new Error('Booking benchmark ran out of unique unbooked fixture slots.');
        }
        return {
          path: '/api/v1/appointments',
          method: 'POST',
          body: {
            doctorAccountId: slot.doctorAccountId,
            availabilitySlotId: slot.id,
            patientRecipientAccountId: FIXTURE_PATIENT_ACCOUNT_ID,
          },
        };
      },
      targets: unbookedTargets,
      mutation: true,
    },
    {
      key: 'appointmentCancellation',
      endpoint: '/api/v1/appointments/:appointmentId/cancellation',
      actorRole: 'PATIENT',
      expectedStatus: 200,
      expectedResultCount: null,
      query: null,
      targetFor: (index) => {
        const appointment = bookedTargets[index];
        if (!appointment) {
          throw new Error('Cancellation benchmark ran out of unique future booked appointments.');
        }
        return {
          path: `/api/v1/appointments/${appointment.appointmentId}/cancellation`,
          method: 'POST',
        };
      },
      targets: bookedTargets,
      mutation: true,
    },
  ];
}

function sampleCheck(response, spec) {
  const resultCountMatches = spec.expectedResultCount === null
    || response.data?.total === spec.expectedResultCount;
  const writeStateMatches = spec.key === 'appointmentBooking'
    ? response.data?.status === 'BOOKED'
    : spec.key === 'appointmentCancellation'
      ? response.data?.status === 'CANCELLED'
      : true;
  return {
    success: response.status === spec.expectedStatus && resultCountMatches && writeStateMatches,
    resultCountMatches,
    writeStateMatches,
  };
}

function mutationTargetIdentity(spec, index) {
  const target = spec.targetFor(index);
  if (spec.key === 'appointmentBooking') {
    return `slot:${target.body.availabilitySlotId}`;
  }
  if (spec.key === 'appointmentCancellation') {
    return `appointment:${target.path}`;
  }
  return target.path;
}

async function runOperation(fixture, spec, credentials) {
  let context = await setupBenchmarkApp(fixture, credentials);
  const sqliteVersion = context.app.database
    .prepare('SELECT sqlite_version() AS version')
    .get().version;
  const warmupTargets = Array.from({ length: WARMUP_COUNT }, (_, index) => index);
  const initialWarmups = await runDeterministicBatches(
    warmupTargets,
    CONCURRENCY,
    async (index) => {
      const target = spec.targetFor(index);
      const actor = spec.actorRole === 'STAFF' ? context.staff : context.patient;
      return benchmarkRequest(context.app.baseUrl, { ...target, ...actor });
    },
  );
  const warmupResults = initialWarmups.results.map((response) => ({
    status: response.status,
    code: response.code,
  }));
  if (warmupResults.some(({ status }) => status !== spec.expectedStatus)) {
    await context.app.dispose();
    return {
      operation: spec.key,
      expectedStatus: spec.expectedStatus,
      warmupRequestCount: WARMUP_COUNT,
      warmupResults,
      measuredSampleCount: 0,
      samples: [],
      failures: [{ phase: 'warmup', reason: 'unexpected_status' }],
      maximumConcurrentRequests: initialWarmups.maximumActive,
      sqliteVersion,
      accepted: false,
    };
  }

  if (spec.mutation) {
    await context.app.dispose();
    context = await setupBenchmarkApp(fixture, credentials);
  }

  const measuredTargets = Array.from({ length: SAMPLE_COUNT }, (_, index) => index);
  const measured = await measureTargetBatches({
    targets: measuredTargets,
    concurrency: CONCURRENCY,
    execute: async (targetIndex, sampleIndex) => {
      const target = spec.targetFor(targetIndex);
      const actor = spec.actorRole === 'STAFF' ? context.staff : context.patient;
      const response = await benchmarkRequest(context.app.baseUrl, { ...target, ...actor });
      const check = sampleCheck(response, spec);
      return {
        sample: sampleIndex + 1,
        targetIndex,
        status: response.status,
        ...(response.code ? { code: response.code } : {}),
        ...check,
      };
    },
  });
  const samples = measured.results;
  const failures = samples
    .filter(({ success }) => !success)
    .map(({ sample, status, code, resultCountMatches, writeStateMatches }) => ({
      sample,
      status,
      ...(code ? { code } : {}),
      resultCountMatches,
      writeStateMatches,
    }));
  const durations = samples.map(({ durationMs }) => durationMs);
  const sorted = [...durations].sort((left, right) => left - right);
  const accepted = failures.length === 0 && durations.length === SAMPLE_COUNT;
  await context.app.dispose();

  return {
    operation: spec.key,
    endpoint: spec.endpoint,
    actorRole: spec.actorRole,
    query: spec.query,
    pageSize: spec.query === null ? null : PAGE_SIZE,
    expectedStatus: spec.expectedStatus,
    expectedResultCount: spec.expectedResultCount,
    sqliteVersion,
    stableSortOrder: spec.key === 'doctorSearch'
      ? fixture.manifest.search.sortOrder
      : spec.key === 'paginatedPatientReads'
        ? fixture.manifest.pagination.patientSortOrder
        : spec.key === 'paginatedAppointmentReads'
          ? fixture.manifest.pagination.appointmentSortOrder
          : null,
    warmupRequestCount: WARMUP_COUNT,
    warmupResults,
    measuredSampleCount: samples.length,
    maximumConcurrentRequests: Math.max(initialWarmups.maximumActive, measured.maximumActive),
    concurrencyLimit: CONCURRENCY,
    resetAfterWarmupAndBeforeMeasurement: Boolean(spec.mutation),
    resetIncludedInMeasurement: false,
    distinctMutationTargets: spec.mutation
      ? new Set(samples.map(({ targetIndex }) => mutationTargetIdentity(spec, targetIndex))).size
      : null,
    durationMs: {
      min: sorted[0] ?? null,
      p50: sorted.length ? nearestRankPercentile(sorted, 0.5) : null,
      p95: sorted.length ? nearestRankPercentile(sorted, 0.95) : null,
      p99: sorted.length ? nearestRankPercentile(sorted, 0.99) : null,
      max: sorted.at(-1) ?? null,
      nearestRank: true,
    },
    failures,
    accepted,
    samples,
  };
}

export async function runBenchmark({
  hospitalTimeZone,
  seed = FIXTURE_SEED,
  anchor = BENCHMARK_CLOCK_ANCHOR,
} = {}) {
  const fixture = generateFixture({ seed, anchor, hospitalTimeZone });
  const credentials = benchmarkActorCredentials(fixture);
  const specs = createBenchmarkOperations(fixture);
  const operations = [];
  for (const spec of specs) {
    operations.push(await runOperation(fixture, spec, credentials));
  }
  const measuredFailureCount = operations.reduce(
    (total, operation) => total + operation.failures.length,
    0,
  );
  const latencyLimitsMs = {
    doctorSearch: 1000,
    paginatedPatientReads: 1000,
    paginatedAppointmentReads: 1000,
    appointmentBooking: 2000,
    appointmentCancellation: 2000,
  };
  for (const operation of operations) {
    const limit = latencyLimitsMs[operation.operation];
    operation.latencyLimitMs = limit;
    operation.latencyTargetPassed = operation.durationMs.p95 !== null
      && operation.durationMs.p95 <= limit;
    operation.accepted = operation.accepted && operation.latencyTargetPassed;
  }
  const cpu = cpus()[0];
  const manifestSha256 = fixtureManifestHash(fixture.manifest);
  const report = {
    runAtUtc: new Date().toISOString(),
    nodeVersion: process.version,
    runtimeVersions: {
      node: process.versions.node,
      v8: process.versions.v8,
      sqlite: operations[0]?.sqliteVersion ?? 'unavailable',
    },
    environment: {
      os: `${platform()} ${release()}`,
      architecture: process.arch,
      cpuModel: cpu?.model ?? 'unavailable',
      cpuCount: availableParallelism(),
      totalMemoryBytes: totalmem(),
    },
    seed,
    generatorRevision: fixture.manifest.generatorRevision,
    manifestSha256,
    benchmarkClockAnchor: fixture.manifest.benchmarkClockAnchor,
    hospitalTimeZone,
    dateOffsetRules: fixture.manifest.dateOffsetRules,
    fixtureCounts: fixture.manifest.counts,
    protocol: {
      database: 'fresh isolated SQLite database populated from the deterministic fixture per operation',
      warmupRequestsPerOperation: WARMUP_COUNT,
      measuredSamplesPerOperation: SAMPLE_COUNT,
      maximumConcurrentClients: CONCURRENCY,
      deterministicBatches: true,
      automaticRetries: 0,
      measuredDuration: 'Client-observed request and response-envelope parsing; setup/reset excluded.',
      percentile: 'Nearest-rank: sorted[ceil(p*n)-1], 1-based rank.',
      sameActorAndReadParameters: true,
      pageSize: PAGE_SIZE,
    },
    operations,
    measuredFailureCount,
    allSamplesSucceeded: measuredFailureCount === 0
      && operations.every(({ measuredSampleCount }) => measuredSampleCount === SAMPLE_COUNT),
    allLatencyTargetsPassed: operations.every(({ latencyTargetPassed }) => latencyTargetPassed),
    accepted: operations.every(({ accepted }) => accepted),
  };
  return report;
}
