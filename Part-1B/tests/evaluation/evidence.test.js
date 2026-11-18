import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runEvaluation } from "../../.harness/harness-runner.js";
import {
  createEvidenceWriter,
  createOperationalLogWriter,
} from "../../.harness/evidence-writer.js";

const dataset = JSON.parse(
  readFileSync(new URL("../../evals/dataset.json", import.meta.url), "utf8"),
);
const config = JSON.parse(
  readFileSync(new URL("../../.harness/config.json", import.meta.url), "utf8"),
);

function evidenceResult(runId, evaluationStatus) {
  const passed = evaluationStatus === "PASS";
  const score = passed ? 1 : 0;
  return {
    run_id: runId,
    mode: "mocked",
    effective_model: "gpt-6-luna",
    evaluation_status: evaluationStatus,
    case_count: 0,
    request_counts: {
      expected_logical_provider_call_count: 0,
      logical_provider_call_count: 0,
      actual_api_attempt_count: 0,
      retry_attempt_count: 0,
      transport_success_count: 0,
      transport_failure_count: 0,
      completed_response_count: 0,
      non_completed_response_count: 0,
      usable_response_count: 0,
      successful_extraction_count: 0,
      failed_outcome_count: 0,
      failed_transport_outcome_count: 0,
      failed_provider_outcome_count: 0,
      failed_parse_outcome_count: 0,
      failed_extraction_outcome_count: 0,
      maximum_estimated_api_attempts: 0,
    },
    cases: [],
    scores: {
      structural: score,
      behavioral: score,
      adversarial: score,
      semantic: score,
      aggregate: score,
      passed,
    },
    weights: { structural: 0.4, behavioral: 0.4, semantic: 0.2 },
    thresholds: {
      structural: 1,
      behavioral: 1,
      adversarial: 1,
      semantic: 0.85,
      aggregate: 0.97,
    },
    max_repair_cycles: 2,
    repair_cycles: [],
    repair_unavailable_cases: [],
    passed,
  };
}

test("operational log writer permits only metadata fields", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-harness-"));
  try {
    const write = createOperationalLogWriter({ directory });
    await write({
      case_id: "EC-001",
      check_id: "structural",
      outcome: "PASS",
      duration_ms: 10,
      safe_error_code: null,
      statement: "SYNTHETIC-PRIVATE-STATEMENT",
    });
    const files = await (await import("node:fs/promises")).readdir(directory);
    const content = await readFile(path.join(directory, files[0]), "utf8");
    assert.equal(content.includes("SYNTHETIC-PRIVATE-STATEMENT"), false);
    const entry = JSON.parse(content);
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["case_id", "check_id", "duration_ms", "outcome", "safe_error_code"],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("run evidence records a safe no-progress repair outcome", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-no-progress-"));
  const result = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174003",
    "FAIL",
  );
  result.repair_unavailable_cases = [
    { case_id: "EC-003", reason: "no_progress" },
  ];
  try {
    await createEvidenceWriter({ directory })(result);
    const runDirectory = path.join(directory, result.run_id);
    const savedResult = JSON.parse(
      await readFile(path.join(runDirectory, "eval-results.json"), "utf8"),
    );
    const harnessLog = await readFile(
      path.join(runDirectory, "harness-log.md"),
      "utf8",
    );

    assert.deepEqual(savedResult.repair_unavailable_cases, [
      { case_id: "EC-003", reason: "no_progress" },
    ]);
    assert.match(harnessLog, /Repair unavailable for EC-003: no_progress/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("evidence retains only allowlisted invariant reason codes and failure stages", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-reason-evidence-"));
  const result = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174007",
    "FAIL",
  );
  result.case_count = 1;
  result.cases = [
    {
      case_id: "EC-003",
      duration_ms: 12,
      safe_error_code: "INVALID_MODEL_RESPONSE",
      safe_failure_stage: "invariant_failure",
      safe_failure_reason_code: "UNSUPPORTED_TRANSACTION_AMOUNT",
      execution_mode: "openai",
      adversarial_passed: null,
      layers: {
        structural: {
          passed: false,
          findings: ["SAFE_ERROR_SHAPE_INVALID"],
        },
        behavioral: {
          passed: false,
          findings: ["UNEXPECTED_EXTRACTION_ERROR"],
        },
        semantic: {
          passed: false,
          findings: ["EXPECTED_RESULT_MISSING"],
        },
      },
    },
    {
      case_id: "EC-020",
      duration_ms: 20,
      safe_error_code: null,
      safe_failure_stage: null,
      safe_failure_reason_code: null,
      execution_mode: "openai",
      adversarial_passed: null,
      layers: {
        structural: { passed: true, findings: [] },
        behavioral: { passed: true, findings: [] },
        semantic: { passed: true, findings: [] },
      },
      logical_calls: [
        {
          role: "prior",
          outcome: "FAIL",
          error_code: "INVALID_MODEL_RESPONSE",
          diagnostic_stage: "invariant_failure",
          safe_failure_reason_code: "UNSUPPORTED_MERCHANT",
          duration_ms: 9,
        },
        {
          role: "current",
          outcome: "PASS",
          error_code: null,
          diagnostic_stage: null,
          safe_failure_reason_code: null,
          duration_ms: 11,
        },
      ],
    },
  ];
  result.case_count = result.cases.length;
  result.scores = {
    structural: 0.5,
    behavioral: 0.5,
    adversarial: 1,
    semantic: 0.5,
    aggregate: 0.5,
    passed: false,
  };
  result.weights = { structural: 0.4, behavioral: 0.4, semantic: 0.2 };
  result.passed = false;
  try {
    await createEvidenceWriter({ directory })(result);
    const runDirectory = path.join(directory, result.run_id);
    const retained = JSON.parse(
      await readFile(path.join(runDirectory, "eval-results.json"), "utf8"),
    );
    const harnessLog = await readFile(
      path.join(runDirectory, "harness-log.md"),
      "utf8",
    );

    assert.equal(
      retained.cases[0].safe_failure_reason_code,
      "UNSUPPORTED_TRANSACTION_AMOUNT",
    );
    assert.equal(
      retained.cases[1].logical_calls[0].safe_failure_reason_code,
      "UNSUPPORTED_MERCHANT",
    );
    assert.match(
      harnessLog,
      /\| EC-003 \| structural \| FAIL \| 12 \| INVALID_MODEL_RESPONSE \| invariant_failure \| UNSUPPORTED_TRANSACTION_AMOUNT \|/u,
    );
    assert.doesNotMatch(
      JSON.stringify(retained) + harnessLog,
      /SYNTHETIC-(?:STATEMENT|PROVIDER|SECRET)/u,
    );

    await assert.rejects(
      createEvidenceWriter({ directory })({
        ...result,
        run_id: "123e4567-e89b-42d3-a456-426614174008",
        cases: [
          {
            ...result.cases[0],
            safe_failure_reason_code: "raw provider output",
          },
          result.cases[1],
        ],
      }),
      /invalid evaluation case metadata/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("run-specific evidence preserves an earlier FAIL when a later run PASSes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-immutable-fail-"));
  const write = createEvidenceWriter({ directory });
  const failedRun = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174001",
    "FAIL",
  );
  const passedRun = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174002",
    "PASS",
  );
  try {
    await write(failedRun);
    const original = await readFile(
      path.join(directory, failedRun.run_id, "eval-results.json"),
      "utf8",
    );
    await write(passedRun);
    assert.equal(
      await readFile(
        path.join(directory, failedRun.run_id, "eval-results.json"),
        "utf8",
      ),
      original,
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(directory, passedRun.run_id, "eval-results.json"),
          "utf8",
        ),
      ).evaluation_status,
      "PASS",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("run-specific evidence preserves an earlier PASS when a later run FAILs", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-immutable-pass-"));
  const write = createEvidenceWriter({ directory });
  const passedRun = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174003",
    "PASS",
  );
  const failedRun = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174004",
    "FAIL",
  );
  try {
    await write(passedRun);
    const original = await readFile(
      path.join(directory, passedRun.run_id, "eval-results.json"),
      "utf8",
    );
    await write(failedRun);
    assert.equal(
      await readFile(
        path.join(directory, passedRun.run_id, "eval-results.json"),
        "utf8",
      ),
      original,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("duplicate run IDs fail without overwriting existing evidence", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-duplicate-run-"));
  const write = createEvidenceWriter({ directory });
  const first = evidenceResult(
    "123e4567-e89b-42d3-a456-426614174005",
    "FAIL",
  );
  try {
    await write(first);
    const file = path.join(directory, first.run_id, "eval-results.json");
    const original = await readFile(file, "utf8");
    await assert.rejects(write.reserve(first.run_id));
    await assert.rejects(
      write({ ...first, evaluation_status: "PASS", passed: true }),
    );
    assert.equal(await readFile(file, "utf8"), original);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("writing a run-specific record leaves the historical evidence hash unchanged", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-history-hash-"));
  const historicalPath = new URL("../../evidence/eval-results.json", import.meta.url);
  const historical = await readFile(historicalPath);
  const originalHash = createHash("sha256").update(historical).digest("hex");
  assert.equal(
    originalHash,
    "4e18aba6d05cb0f9d20981aed6118f002083636daeef70ca47337ce5b5deba08",
  );
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "eval-results.json"), historical);
    await createEvidenceWriter({ directory })(
      evidenceResult("123e4567-e89b-42d3-a456-426614174006", "PASS"),
    );
    const retainedHash = createHash("sha256")
      .update(await readFile(path.join(directory, "eval-results.json")))
      .digest("hex");
    const sourceHashAfter = createHash("sha256")
      .update(await readFile(historicalPath))
      .digest("hex");
    assert.equal(retainedHash, originalHash);
    assert.equal(sourceHashAfter, originalHash);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retained evidence serializes content-free aggregate metadata", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-evidence-"));
  try {
    const write = createEvidenceWriter({ directory });
    await write({
      run_id: "synthetic-run",
      mode: "mocked",
      effective_model: "gpt-6-luna",
      evaluation_status: "PASS",
      case_count: 1,
      request_counts: {
        expected_logical_provider_call_count: 1,
        logical_provider_call_count: 1,
        actual_api_attempt_count: 0,
        retry_attempt_count: 0,
        transport_success_count: 0,
        transport_failure_count: 0,
        completed_response_count: 0,
        non_completed_response_count: 0,
        usable_response_count: 0,
        successful_extraction_count: 0,
        failed_outcome_count: 0,
        failed_transport_outcome_count: 0,
        failed_provider_outcome_count: 0,
        failed_parse_outcome_count: 0,
        failed_extraction_outcome_count: 0,
        maximum_estimated_api_attempts: 6,
      },
      cases: [
        {
          case_id: "EC-001",
          duration_ms: 10,
          safe_error_code: null,
          safe_failure_stage: "parse_failure",
          execution_mode: "mocked",
          adversarial_passed: null,
          layers: {
            structural: { passed: true, findings: [] },
            behavioral: { passed: true, findings: [] },
            semantic: { passed: true, findings: [] },
          },
        },
      ],
      scores: {
        structural: 1,
        behavioral: 1,
        adversarial: 1,
        semantic: 1,
        aggregate: 1,
        passed: true,
      },
      weights: { structural: 0.4, behavioral: 0.4, semantic: 0.2 },
      thresholds: {
        structural: 1,
        behavioral: 1,
        adversarial: 1,
        semantic: 0.85,
        aggregate: 0.97,
      },
      max_repair_cycles: 2,
      passed: true,
      repair_cycles: [],
      repair_unavailable_cases: [],
    });
    const runDirectory = path.join(directory, "synthetic-run");
    const content = await readFile(
      path.join(runDirectory, "eval-results.json"),
      "utf8",
    );
    const harnessLog = await readFile(
      path.join(runDirectory, "harness-log.md"),
      "utf8",
    );
    assert.equal(content.includes("SYNTHETIC-PRIVATE-STATEMENT"), false);
    assert.equal(content.includes("SYNTHETIC-GENERATED-DETAIL"), false);
    assert.equal(
      JSON.parse(content).cases[0].case_id,
      "EC-001",
    );
    const retained = JSON.parse(content);
    assert.equal(retained.effective_model, "gpt-6-luna");
    assert.equal(retained.cases[0].safe_failure_stage, "parse_failure");
    assert.match(harnessLog, /\| parse_failure \|/u);
    assert.deepEqual(retained.request_counts, {
      expected_logical_provider_call_count: 1,
      logical_provider_call_count: 1,
      actual_api_attempt_count: 0,
      retry_attempt_count: 0,
      transport_success_count: 0,
      transport_failure_count: 0,
      completed_response_count: 0,
      non_completed_response_count: 0,
      usable_response_count: 0,
      successful_extraction_count: 0,
      failed_outcome_count: 0,
      failed_transport_outcome_count: 0,
      failed_provider_outcome_count: 0,
      failed_parse_outcome_count: 0,
      failed_extraction_outcome_count: 0,
      maximum_estimated_api_attempts: 6,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("different run IDs retain separate result and log records", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-evidence-preserve-"));
  const write = createEvidenceWriter({ directory });
  const base = {
    mode: "mocked",
    effective_model: "gpt-6-luna",
    case_count: 0,
    cases: [],
    scores: {
      structural: 1,
      behavioral: 1,
      adversarial: 1,
      semantic: 1,
      aggregate: 1,
      passed: true,
    },
    weights: { structural: 0.4, behavioral: 0.4, semantic: 0.2 },
    thresholds: {
      structural: 1,
      behavioral: 1,
      adversarial: 1,
      semantic: 0.85,
      aggregate: 0.97,
    },
    max_repair_cycles: 2,
    repair_cycles: [],
    repair_unavailable_cases: [],
    passed: true,
    request_counts: {
      expected_logical_provider_call_count: 0,
      logical_provider_call_count: 0,
      actual_api_attempt_count: 0,
      retry_attempt_count: 0,
      transport_success_count: 0,
      transport_failure_count: 0,
      completed_response_count: 0,
      non_completed_response_count: 0,
      usable_response_count: 0,
      successful_extraction_count: 0,
      failed_outcome_count: 0,
      failed_transport_outcome_count: 0,
      failed_provider_outcome_count: 0,
      failed_parse_outcome_count: 0,
      failed_extraction_outcome_count: 0,
      maximum_estimated_api_attempts: 0,
    },
  };
  const firstRun = {
    ...base,
    run_id: "synthetic-run",
    evaluation_status: "PASS",
  };
  const secondRunId = "123e4567-e89b-42d3-a456-426614174000";
  const failedRun = {
    ...base,
    run_id: secondRunId,
    evaluation_status: "FAIL",
    passed: false,
    scores: {
      structural: 0,
      behavioral: 0,
      adversarial: 0,
      semantic: 0,
      aggregate: 0,
      passed: false,
    },
  };

  try {
    await write(firstRun);
    const firstLogPath = path.join(
      directory,
      firstRun.run_id,
      "harness-log.md",
    );
    const firstLog = await readFile(firstLogPath, "utf8");
    await write(failedRun);
    const original = JSON.parse(
      await readFile(
        path.join(directory, firstRun.run_id, "eval-results.json"),
        "utf8",
      ),
    );
    assert.equal(original.evaluation_status, "PASS");
    const files = await readdir(directory);
    assert.ok(files.includes(firstRun.run_id));
    assert.ok(files.includes(secondRunId));
    assert.equal(
      await readFile(firstLogPath, "utf8"),
      firstLog,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("evidence writer rejects disallowed raw values", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-evidence-"));
  try {
    const write = createEvidenceWriter({ directory });
    await assert.rejects(
      write({
        cases: [{ case_id: "EC-001", raw_provider_response: "SYNTHETIC-RAW" }],
      }),
      /unsupported evidence shape/i,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("harness evidence and operational logs exclude statements and provider content", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-harness-evidence-"));
  const evidenceDirectory = path.join(directory, "evidence");
  const operationalLogDirectory = path.join(directory, "logs");
  const providerResponseMarker = "SYNTHETIC-RAW-PROVIDER-RESPONSE";
  const exceptionMarker = "SYNTHETIC-RAW-EXCEPTION";
  let calls = 0;
  try {
    await runEvaluation({
      dataset,
      config,
      mode: "mocked",
      provider: {
        async analyze() {
          if (calls++ === 0) {
            throw new Error(exceptionMarker);
          }
          return {
            provider_response: providerResponseMarker,
          };
        },
      },
      evidenceDirectory,
      operationalLogDirectory,
      runId: "synthetic-run",
    });

    const runDirectory = path.join(evidenceDirectory, "synthetic-run");
    const evidence = await readFile(
      path.join(runDirectory, "eval-results.json"),
      "utf8",
    );
    const harnessLog = await readFile(
      path.join(runDirectory, "harness-log.md"),
      "utf8",
    );
    const operationalFiles = await readdir(operationalLogDirectory);
    const operationalLogs = await Promise.all(
      operationalFiles.map((name) =>
        readFile(path.join(operationalLogDirectory, name), "utf8"),
      ),
    );
    const retained = [evidence, harnessLog, ...operationalLogs].join("\n");
    const statements = dataset.cases
      .map((item) => item.input.statement)
      .filter((statement) => typeof statement === "string" && statement);
    for (const marker of [
      ...statements,
      providerResponseMarker,
      exceptionMarker,
    ]) {
      assert.equal(retained.includes(marker), false);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retains safe independent-request outcomes and diagnostic stages only", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "spend-independent-evidence-"));
  const evidenceDirectory = path.join(directory, "evidence");
  const operationalLogDirectory = path.join(directory, "logs");
  const priorMarker = "SYNTHETIC-PRIOR-STATEMENT-MARKER";
  const currentMarker = "SYNTHETIC-CURRENT-STATEMENT-MARKER";
  const prior = dataset.cases.find((item) => item.case_id === "EC-020")
    .input.prior_statement;
  const current = dataset.cases.find((item) => item.case_id === "EC-020")
    .input.statement;

  try {
    await runEvaluation({
      dataset,
      config,
      mode: "mocked",
      provider: {
        async analyze(statement) {
          if (statement === prior) {
            throw Object.assign(new Error(priorMarker), {
              code: "INVALID_MODEL_RESPONSE",
              diagnosticStage: "parse_failure",
            });
          }
          return {
            amount: 20,
            currency: "INR",
            category: "FOOD",
            transaction_type: "DEBIT",
            merchant_or_person: "Tea shop",
            description: "Paid at tea shop",
            confidence: 0.9,
            requires_clarification: false,
            clarification_question: null,
          };
        },
      },
      evidenceDirectory,
      operationalLogDirectory,
      runId: "synthetic-run",
    });

    const runDirectory = path.join(evidenceDirectory, "synthetic-run");
    const evidence = await readFile(
      path.join(runDirectory, "eval-results.json"),
      "utf8",
    );
    const harnessLog = await readFile(
      path.join(runDirectory, "harness-log.md"),
      "utf8",
    );
    const retained = JSON.parse(evidence);
    const evaluated = retained.cases.find((item) => item.case_id === "EC-020");

    assert.deepEqual(
      evaluated.logical_calls.map(
        ({ role, outcome, error_code, diagnostic_stage }) => ({
          role,
          outcome,
          error_code,
          diagnostic_stage,
        }),
      ),
      [
        {
          role: "prior",
          outcome: "FAIL",
          error_code: "INVALID_MODEL_RESPONSE",
          diagnostic_stage: "parse_failure",
        },
        {
          role: "current",
          outcome: "PASS",
          error_code: null,
          diagnostic_stage: null,
        },
      ],
    );
    for (const marker of [priorMarker, currentMarker, prior, current]) {
      assert.equal(evidence.includes(marker), false);
      assert.equal(harnessLog.includes(marker), false);
    }
    assert.match(harnessLog, /prior request \| FAIL/u);
    assert.match(harnessLog, /parse_failure/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
