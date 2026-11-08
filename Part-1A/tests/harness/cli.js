import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../backend/src/config/index.js';
import { runBenchmark } from './benchmark.js';
import { generateFixture, fixtureManifestHash } from './fixtures/generator.js';
import { runPreflight } from './preflight.js';

const harnessDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(harnessDirectory, '../..');
const evidenceDirectory = resolve(projectDirectory, 'tests/evidence');

function saveEvidence(filename, result, command, exitStatus = 0) {
  mkdirSync(evidenceDirectory, { recursive: true });
  const evidence = {
    command,
    exitStatus,
    runAtUtc: new Date().toISOString(),
    ...result,
  };
  writeFileSync(
    resolve(evidenceDirectory, filename),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  return evidence;
}

const [command] = process.argv.slice(2);
const config = loadConfig();
const fixture = generateFixture({ hospitalTimeZone: config.hospitalTimeZone });
mkdirSync(evidenceDirectory, { recursive: true });
writeFileSync(
  resolve(evidenceDirectory, 'phase9-fixture-manifest.json'),
  `${JSON.stringify({
    ...fixture.manifest,
    manifestSha256: fixtureManifestHash(fixture.manifest),
  }, null, 2)}\n`,
  { mode: 0o600 },
);

if (command === 'preflight') {
  const result = await runPreflight({ hospitalTimeZone: config.hospitalTimeZone });
  const evidence = saveEvidence(
    'phase9-preflight-results.json',
    result,
    'HOSPITAL_TIME_ZONE=<configured> node tests/harness/cli.js preflight',
  );
  console.log(JSON.stringify({
    command: evidence.command,
    exitStatus: evidence.exitStatus,
    manifestSha256: result.manifestSha256,
    actionCount: result.actionCount,
    passedActions: result.actions.filter(({ passed }) => passed).length,
    independentDatabaseChecks: result.independentDatabaseChecks,
    evidenceFile: 'tests/evidence/phase9-preflight-results.json',
  }, null, 2));
} else if (command === 'benchmark') {
  const result = await runBenchmark({ hospitalTimeZone: config.hospitalTimeZone });
  const evidence = saveEvidence(
    'phase9-benchmark-results.json',
    result,
    'HOSPITAL_TIME_ZONE=<configured> node tests/harness/cli.js benchmark',
    result.accepted ? 0 : 1,
  );
  console.log(JSON.stringify({
    command: evidence.command,
    exitStatus: result.accepted ? 0 : 1,
    manifestSha256: result.manifestSha256,
    measuredFailureCount: result.measuredFailureCount,
    operations: result.operations.map((operation) => ({
      operation: operation.operation,
      warmupRequestCount: operation.warmupRequestCount,
      measuredSampleCount: operation.measuredSampleCount,
      p95Ms: operation.durationMs.p95,
      latencyLimitMs: operation.latencyLimitMs,
      accepted: operation.accepted,
    })),
    evidenceFile: 'tests/evidence/phase9-benchmark-results.json',
  }, null, 2));
  if (!result.accepted) {
    process.exitCode = 1;
  }
} else {
  throw new TypeError('Expected a harness command: preflight or benchmark.');
}
