import { readFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import {
  APPROVED_EVALUATION_MODEL,
  MAX_RETRIES,
  createOpenAIAdapter,
} from "../src/ai/openai-adapter.js";
import { createExtractionService } from "../src/services/extraction-service.js";
import {
  createSafeError,
  isSafeHttpError,
} from "../src/errors/safe-errors.js";
import {
  createEvidenceWriter,
  createOperationalLogWriter,
  createRunId,
} from "./evidence-writer.js";
import { evaluateCase } from "./sensor.js";

const defaultDataset = JSON.parse(
  readFileSync(new URL("../evals/dataset.json", import.meta.url), "utf8"),
);
const defaultConfig = JSON.parse(
  readFileSync(new URL("./config.json", import.meta.url), "utf8"),
);
const expectedCaseIds = Array.from(
  { length: 21 },
  (_, index) => `EC-${String(index + 1).padStart(3, "0")}`,
);
const approvedWeights = {
  structural: 0.4,
  behavioral: 0.4,
  semantic: 0.2,
};
const approvedThresholds = {
  structural: 1,
  behavioral: 1,
  adversarial: 1,
  semantic: 0.85,
  aggregate: 0.97,
};

function assertApprovedScoring(scoring, repairLimit = 2) {
  const sameValues = (actual, expected) =>
    actual &&
    Object.keys(expected).length === Object.keys(actual).length &&
    Object.entries(expected).every(([key, value]) => actual[key] === value);
  if (
    !sameValues(scoring?.weights, approvedWeights) ||
    !sameValues(scoring?.thresholds, approvedThresholds) ||
    repairLimit !== 2
  ) {
    throw new Error("Evaluation scoring gates and repair limit are fixed.");
  }
}

function failureSignature(item) {
  const failedLayers = Object.entries(item.layers)
    .filter(([, layer]) => !layer.passed)
    .map(([checkId, layer]) => [checkId, [...layer.findings].sort()])
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    failedLayers,
    safeErrorCode: item.safe_error_code,
    safeFailureStage: item.safe_failure_stage,
  });
}

function repairContextFor(item) {
  const failedChecks = Object.entries(item.layers)
    .filter(([, layer]) => !layer.passed)
    .map(([checkId]) => checkId)
    .sort();
  const failedFindings = Object.entries(item.layers)
    .filter(([, layer]) => !layer.passed)
    .flatMap(([, layer]) => layer.findings)
    .sort();
  return {
    failedChecks,
    failedFindings,
    ...(item.safe_error_code ? { safeErrorCode: item.safe_error_code } : {}),
    ...(item.safe_failure_stage
      ? { safeFailureStage: item.safe_failure_stage }
      : {}),
  };
}

function assertCompleteDataset(dataset, config) {
  assertApprovedScoring(config.scoring, config.repair?.max_cycles);
  if (config.evaluation?.model !== APPROVED_EVALUATION_MODEL) {
    throw new Error("Evaluation model must be the approved gpt-6-luna model.");
  }
  if (
    !Array.isArray(dataset?.cases) ||
    dataset.cases.length !== config.evaluation.expected_case_count ||
    dataset.cases.length !== expectedCaseIds.length ||
    dataset.cases.some((item, index) => item.case_id !== expectedCaseIds[index])
  ) {
    throw new Error("Evaluation dataset must contain all 21 cases in order.");
  }
}

function expectedLogicalProviderCalls(dataset) {
  return dataset.cases.reduce((count, item) => {
    if (
      ["validator_boundary", "provider_output", "provider_error", "request_error"].includes(
        item.input.type,
      )
    ) {
      return count;
    }
    return count + (item.input.type === "independent_statement" ? 2 : 1);
  }, 0);
}

export function createPreRunSummary({
  dataset = defaultDataset,
  config = defaultConfig,
  mode = "openai",
  maxRepairCycles = config.repair.max_cycles,
  repairEnabled = false,
} = {}) {
  assertCompleteDataset(dataset, config);
  const expectedLogicalCalls = expectedLogicalProviderCalls(dataset);
  const boundedRepairCycles = repairEnabled
    ? Math.max(0, Math.min(config.repair.max_cycles, Math.floor(maxRepairCycles)))
    : 0;
  const maximumLogicalCalls =
    expectedLogicalCalls * (boundedRepairCycles + 1);
  const maximumEstimatedApiAttempts =
    maximumLogicalCalls * (MAX_RETRIES + 1);

  return {
    effective_model: config.evaluation.model,
    dataset_case_count: dataset.cases.length,
    expected_logical_provider_call_count: expectedLogicalCalls,
    maximum_logical_provider_call_count: maximumLogicalCalls,
    maximum_retry_allowance: MAX_RETRIES,
    maximum_repair_cycle_allowance: config.repair.max_cycles,
    repair_enabled: boundedRepairCycles > 0,
    maximum_estimated_api_attempts: maximumEstimatedApiAttempts,
    mode,
    run_type: mode === "openai" ? "live" : "mocked",
    token_usage_estimate: "UNKNOWN",
    estimated_cost: "UNKNOWN",
  };
}

export function createRequestCounts(
  dataset,
  provider,
  mode,
  logicalCalls,
  maximumEstimatedApiAttempts,
) {
  const metrics =
    mode === "openai" &&
    provider?.isLiveApiAdapter === true &&
    typeof provider.getAttemptMetrics === "function"
      ? provider.getAttemptMetrics()
      : {};
  const expectedCalls = expectedLogicalProviderCalls(dataset);
  const zeroMetrics = {
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
  };

  return {
    expected_logical_provider_call_count: expectedCalls,
    logical_provider_call_count: logicalCalls,
    ...(mode === "openai" && provider?.isLiveApiAdapter === true
      ? Object.fromEntries(
          Object.keys(zeroMetrics).map((key) => [
            key,
            metrics[key] ?? zeroMetrics[key],
          ]),
        )
      : zeroMetrics),
    maximum_estimated_api_attempts: maximumEstimatedApiAttempts,
  };
}

export function calculateScores(metrics, scoring) {
  assertApprovedScoring(scoring);
  const weights = scoring.weights;
  const thresholds = scoring.thresholds;
  const aggregate =
    weights.structural * metrics.structural +
    weights.behavioral * metrics.behavioral +
    weights.semantic * metrics.semantic;
  const scores = {
    structural: metrics.structural,
    behavioral: metrics.behavioral,
    adversarial: metrics.adversarial,
    semantic: metrics.semantic,
    aggregate: Number(aggregate.toFixed(6)),
  };
  const passed =
    scores.structural >= thresholds.structural &&
    scores.behavioral >= thresholds.behavioral &&
    scores.adversarial >= thresholds.adversarial &&
    scores.semantic >= thresholds.semantic &&
    scores.aggregate >= thresholds.aggregate;

  return { ...scores, passed };
}

function candidateForFixture(input) {
  if (input.fixture === "malformed-json") {
    return "{ malformed provider JSON";
  }
  if (input.fixture === "invalid-schema") {
    return {
      amount: 20,
      currency: "INR",
      category: "INVALID",
      transaction_type: "DEBIT",
      merchant_or_person: "Sample Cafe",
      description: "Cafe purchase",
      confidence: 0.9,
      requires_clarification: false,
      clarification_question: null,
      unexpected: "synthetic",
    };
  }
  return null;
}

function safeErrorDetails(error) {
  const safeError = createSafeError(
    error?.code,
    error?.diagnosticStage,
    error?.diagnosticReasonCode,
  );
  return {
    errorCode: safeError.code,
    status: safeError.status,
    diagnosticStage: safeError.diagnosticStage,
    diagnosticReasonCode: safeError.diagnosticReasonCode,
  };
}

function summarizeFailedChecks(cases) {
  return cases.flatMap((item) =>
    Object.entries(item.layers)
      .filter(([, layer]) => !layer.passed)
      .map(([check_id]) => ({ case_id: item.case_id, check_id })),
  );
}

function average(items) {
  if (items.length === 0) {
    return 1;
  }
  return items.filter(Boolean).length / items.length;
}

async function evaluateAllCases({
  dataset,
  caseDefinitions = dataset.cases,
  provider,
  mode,
  requestCounts,
  writeOperationalEntry,
  repairContextsByCaseId = new Map(),
}) {
  const cases = [];
  for (const caseDefinition of caseDefinitions) {
    const startedAt = process.hrtime.bigint();
    const input = caseDefinition.input;
    let output = null;
    let errorCode = null;
    let status = null;
    let diagnosticStage = null;
    let diagnosticReasonCode = null;
    let contextIsolated = true;
    let executionMode = mode;
    const providerStatements = [];
    const logicalCalls = [];
    let providerWasInvoked = false;

    if (input.type === "validator_boundary") {
      output = input.output;
      executionMode = "validator_fixture";
    } else {
      const requestProvider = {
        async analyze(statement, options) {
          providerStatements.push(statement);
          if (input.type === "provider_output") {
            executionMode = "provider_fixture";
            return candidateForFixture(input);
          }
          if (input.type === "provider_error") {
            executionMode = "provider_fixture";
            throw Object.assign(new Error("Synthetic provider failure."), {
              code: input.code,
            });
          }
          requestCounts.logical_provider_call_count += 1;
          providerWasInvoked = true;
          return provider.analyze(statement, options);
        },
        recordExtractionOutcome(success) {
          if (providerWasInvoked) {
            provider.recordExtractionOutcome?.(success);
          }
        },
      };
      const service = createExtractionService({ provider: requestProvider });
      const repairOptions = repairContextsByCaseId.has(caseDefinition.case_id)
        ? { repairContext: repairContextsByCaseId.get(caseDefinition.case_id) }
        : undefined;

      if (input.type === "independent_statement") {
        async function runLogicalCall(role, statement) {
          const callStartedAt = process.hrtime.bigint();
          try {
            const result = await service.extract(statement, repairOptions);
            logicalCalls.push({
              role,
              outcome: "PASS",
              error_code: null,
              diagnostic_stage: null,
              safe_failure_reason_code: null,
              duration_ms: Math.round(
                Number(process.hrtime.bigint() - callStartedAt) / 1e6,
              ),
            });
            return { output: result };
          } catch (error) {
            if (!isSafeHttpError(error)) {
              throw error;
            }
            const safe = safeErrorDetails(error);
            logicalCalls.push({
              role,
              outcome: "FAIL",
              error_code: safe.errorCode,
              diagnostic_stage: safe.diagnosticStage,
              safe_failure_reason_code: safe.diagnosticReasonCode,
              duration_ms: Math.round(
                Number(process.hrtime.bigint() - callStartedAt) / 1e6,
              ),
            });
            return { error: safe };
          }
        }

        await runLogicalCall("prior", input.prior_statement);
        const currentCall = await runLogicalCall("current", input.statement);
        output = currentCall.output ?? null;
        if (currentCall.error) {
          errorCode = currentCall.error.errorCode;
          status = currentCall.error.status;
          diagnosticStage = currentCall.error.diagnosticStage;
          diagnosticReasonCode = currentCall.error.diagnosticReasonCode;
        }
        contextIsolated =
          providerStatements.length === 2 &&
          providerStatements[0] === input.prior_statement &&
          providerStatements[1] === input.statement;
      } else {
        try {
          output = await service.extract(input.statement, repairOptions);
        } catch (error) {
          const safe = safeErrorDetails(error);
          errorCode = safe.errorCode;
          status = safe.status;
          diagnosticStage = safe.diagnosticStage;
          diagnosticReasonCode = safe.diagnosticReasonCode;
        }
      }
    }

    if (input.type === "validator_boundary") {
      const { validateOutput } = await import("./schema-validator.js");
      if (!validateOutput(output)) {
        errorCode = "INVALID_MODEL_RESPONSE";
        status = 502;
        diagnosticStage = "canonical_schema_failure";
      }
    }

    const result = evaluateCase({
      caseDefinition,
      output,
      statement: input.statement,
      errorCode,
      status,
      contextIsolated,
    });
    const durationMs = Math.round(
      Number(process.hrtime.bigint() - startedAt) / 1e6,
    );
    const evaluated = {
      ...result,
      duration_ms: durationMs,
      safe_error_code: errorCode,
      execution_mode: executionMode,
    };
    evaluated.safe_failure_stage = diagnosticStage;
    evaluated.safe_failure_reason_code = diagnosticReasonCode;
    if (logicalCalls.length > 0) {
      evaluated.logical_calls = logicalCalls;
    }
    cases.push(evaluated);

    for (const [checkId, layer] of Object.entries(result.layers)) {
      await writeOperationalEntry?.({
        case_id: caseDefinition.case_id,
        check_id: checkId,
        outcome: layer.passed ? "PASS" : "FAIL",
        duration_ms: durationMs,
        safe_error_code: errorCode,
      });
    }
  }
  return cases;
}

function failedCases(cases) {
  return cases.filter((item) =>
    Object.values(item.layers).some((layer) => !layer.passed),
  );
}

function isRepairableCase(caseDefinition) {
  return ["statement", "independent_statement"].includes(
    caseDefinition.input.type,
  );
}

function aggregateCaseScores(cases, scoring) {
  const layerValues = {
    structural: cases.map((item) => item.layers.structural.passed),
    behavioral: cases.map((item) => item.layers.behavioral.passed),
    semantic: cases.map((item) => item.layers.semantic.passed),
    adversarial: cases
      .filter((item) => item.adversarial_passed !== null)
      .map((item) => item.adversarial_passed),
  };
  return calculateScores(
    {
      structural: average(layerValues.structural),
      behavioral: average(layerValues.behavioral),
      semantic: average(layerValues.semantic),
      adversarial: average(layerValues.adversarial),
    },
    scoring,
  );
}

export async function runEvaluation({
  dataset = defaultDataset,
  config = defaultConfig,
  provider,
  mode = provider ? "mocked" : "openai",
  repair,
  maxRepairCycles = config.repair.max_cycles,
  writeEvidence = true,
  evidenceDirectory = path.resolve("evidence/runs"),
  operationalLogDirectory = path.resolve(".harness/logs"),
  runId = createRunId(),
} = {}) {
  if (!Number.isFinite(maxRepairCycles) || maxRepairCycles < 0) {
    throw new Error("Repair cycle allowance must be a non-negative number.");
  }
  const repairsEnabled =
    (repair === true || typeof repair === "function") && maxRepairCycles > 0;
  const boundedRepairCycles = repairsEnabled
    ? Math.max(0, Math.min(config.repair.max_cycles, Math.floor(maxRepairCycles)))
    : 0;
  const preRunSummary = createPreRunSummary({
    dataset,
    config,
    mode,
    maxRepairCycles: boundedRepairCycles,
    repairEnabled: repairsEnabled,
  });
  if (
    mode === "openai" &&
    process.env.OPENAI_MODEL &&
    process.env.OPENAI_MODEL !== preRunSummary.effective_model
  ) {
    throw new Error("Unexpected model override; no evaluation request was made.");
  }
  const activeProvider =
    provider ??
    createOpenAIAdapter({ model: preRunSummary.effective_model });
  const effectiveModel = preRunSummary.effective_model;
  const evidenceWriter = writeEvidence
    ? createEvidenceWriter({ directory: evidenceDirectory })
    : null;
  await evidenceWriter?.reserve(runId);
  const maxCycles = boundedRepairCycles;
  const writeOperationalEntry = writeEvidence
    ? createOperationalLogWriter({
        directory: operationalLogDirectory,
        runId,
      })
    : undefined;
  const repairCycles = [];
  const repairUnavailableCases = [];
  const lastAttemptedFailureSignatures = new Map();
  const requestCounts = { logical_provider_call_count: 0 };
  let cases = await evaluateAllCases({
    dataset,
    provider: activeProvider,
    mode,
    requestCounts,
    writeOperationalEntry,
  });
  let scores = aggregateCaseScores(cases, config.scoring);

  if (boundedRepairCycles === 0 && !scores.passed) {
    for (const item of failedCases(cases)) {
      const definition = dataset.cases.find(
        (entry) => entry.case_id === item.case_id,
      );
      repairUnavailableCases.push({
        case_id: item.case_id,
        reason:
          definition && isRepairableCase(definition)
            ? "repairs_disabled"
            : "not_provider_backed",
      });
    }
  }

  for (let cycle = 1; !scores.passed && cycle <= maxCycles; cycle += 1) {
    const before = scores;
    const currentFailures = failedCases(cases);
    const repairableFailures = currentFailures.filter((item) => {
      const definition = dataset.cases.find(
        (entry) => entry.case_id === item.case_id,
      );
      return definition && isRepairableCase(definition);
    });
    const noProgressFailures = repairableFailures.filter(
      (item) =>
        lastAttemptedFailureSignatures.get(item.case_id) ===
        failureSignature(item),
    );
    for (const item of noProgressFailures) {
      if (
        !repairUnavailableCases.some(
          (unavailable) =>
            unavailable.case_id === item.case_id &&
            unavailable.reason === "no_progress",
        )
      ) {
        repairUnavailableCases.push({
          case_id: item.case_id,
          reason: "no_progress",
        });
      }
    }
    const noProgressIds = new Set(
      noProgressFailures.map((item) => item.case_id),
    );
    const eligibleFailures = repairableFailures.filter(
      (item) => !noProgressIds.has(item.case_id),
    );
    const eligibleCases = eligibleFailures
      .map((item) =>
        dataset.cases.find((definition) => definition.case_id === item.case_id),
      )
      .filter(Boolean);
    if (cycle === 1) {
      for (const item of currentFailures) {
        const definition = dataset.cases.find(
          (entry) => entry.case_id === item.case_id,
        );
        if (!definition || !isRepairableCase(definition)) {
          repairUnavailableCases.push({
            case_id: item.case_id,
            reason: "not_provider_backed",
          });
        }
      }
    }
    if (eligibleCases.length === 0) {
      break;
    }

    const failedChecks = summarizeFailedChecks(eligibleFailures);
    const affectedCaseIds = eligibleCases.map((item) => item.case_id);
    const repairContextsByCaseId = new Map(
      eligibleFailures.map((item) => [
        item.case_id,
        repairContextFor(item),
      ]),
    );
    for (const item of eligibleFailures) {
      lastAttemptedFailureSignatures.set(
        item.case_id,
        failureSignature(item),
      );
    }
    const beforeLogicalCalls = requestCounts.logical_provider_call_count;
    const beforeApiAttempts =
      activeProvider.isLiveApiAdapter === true &&
      typeof activeProvider.getAttemptMetrics === "function"
        ? activeProvider.getAttemptMetrics().actual_api_attempt_count
        : 0;
    if (typeof repair === "function") {
      await repair({
        cycle,
        findings: failedChecks,
        case_ids: affectedCaseIds,
        scores: { ...scores },
      });
    }

    const replacements = await evaluateAllCases({
      dataset,
      caseDefinitions: eligibleCases,
      provider: activeProvider,
      mode,
      requestCounts,
      writeOperationalEntry,
      repairContextsByCaseId,
    });
    const replacementsById = new Map(
      replacements.map((item) => [item.case_id, item]),
    );
    cases = cases.map((item) => replacementsById.get(item.case_id) ?? item);
    scores = aggregateCaseScores(cases, config.scoring);
    const afterApiAttempts =
      activeProvider.isLiveApiAdapter === true &&
      typeof activeProvider.getAttemptMetrics === "function"
        ? activeProvider.getAttemptMetrics().actual_api_attempt_count
        : 0;
    const replacementIds = new Set(replacements.map((item) => item.case_id));
    repairCycles.push({
      cycle,
      reason: "Re-evaluated eligible failed cases through the extraction service.",
      failed_checks: failedChecks,
      affected_case_ids: affectedCaseIds,
      outcomes: replacements.map((item) => ({
        case_id: item.case_id,
        outcome: Object.values(item.layers).every((layer) => layer.passed)
          ? "PASS"
          : "FAIL",
      })),
      logical_provider_calls:
        requestCounts.logical_provider_call_count - beforeLogicalCalls,
      actual_api_attempts: Math.max(0, afterApiAttempts - beforeApiAttempts),
      improved: scores.aggregate > before.aggregate,
    });
    if (replacementIds.size !== affectedCaseIds.length) {
      throw new Error("Repair results did not match the eligible case set.");
    }
  }

  const result = {
    run_id: runId,
    mode,
    effective_model: effectiveModel,
    pre_run_summary: preRunSummary,
    evaluation_status: scores.passed ? "PASS" : "FAIL",
    case_count: cases.length,
    request_counts: createRequestCounts(
      dataset,
      activeProvider,
      mode,
      requestCounts.logical_provider_call_count,
      preRunSummary.maximum_estimated_api_attempts,
    ),
    logical_provider_call_count: requestCounts.logical_provider_call_count,
    expected_logical_provider_call_count:
      preRunSummary.expected_logical_provider_call_count,
    maximum_estimated_api_attempts:
      preRunSummary.maximum_estimated_api_attempts,
    cases,
    scores,
    weights: { ...config.scoring.weights },
    thresholds: { ...config.scoring.thresholds },
    max_repair_cycles: config.repair.max_cycles,
    repair_cycles: repairCycles,
    repair_unavailable_cases: repairUnavailableCases,
    passed: scores.passed,
  };

  if (writeEvidence) {
    await evidenceWriter(result);
  }
  return result;
}

async function main() {
  let preRunSummary;
  try {
    preRunSummary = createPreRunSummary({
      dataset: defaultDataset,
      config: defaultConfig,
      mode: "openai",
      repairEnabled: true,
    });
  } catch {
    process.stdout.write(
      "Live OpenAI evaluation NOT RUN: configured model or evaluation policy is not approved.\n",
    );
    return;
  }
  process.stdout.write(
    `Pre-run usage estimate: ${JSON.stringify(preRunSummary)}\n`,
  );
  if (
    process.env.OPENAI_MODEL &&
    process.env.OPENAI_MODEL !== preRunSummary.effective_model
  ) {
    process.stdout.write(
      "Live OpenAI evaluation NOT RUN: unexpected model override was detected.\n",
    );
    return;
  }

  const liveEvidenceWriter = createEvidenceWriter({
    directory: path.resolve("evidence/runs"),
  });
  if (!process.env.OPENAI_API_KEY) {
    await liveEvidenceWriter({
      run_id: createRunId(),
      mode: "openai",
      effective_model: preRunSummary.effective_model,
      pre_run_summary: preRunSummary,
      evaluation_status: "NOT RUN",
      not_run_reason:
        "OPENAI_API_KEY is not available in the process environment; no credential file was read.",
      case_count: 0,
      request_counts: createRequestCounts(
        defaultDataset,
        null,
        "openai",
        0,
        preRunSummary.maximum_estimated_api_attempts,
      ),
      cases: [],
      scores: null,
      weights: defaultConfig.scoring.weights,
      thresholds: defaultConfig.scoring.thresholds,
      max_repair_cycles: defaultConfig.repair.max_cycles,
      repair_cycles: [],
      repair_unavailable_cases: [],
      passed: false,
    });
    process.stdout.write(
      "Live OpenAI evaluation NOT RUN: backend credential unavailable in process environment.\n",
    );
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stdout.write(
      "Live OpenAI evaluation NOT RUN: interactive confirmation is required.\n",
    );
    return;
  }
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const confirmation = await terminal.question(
    'Type "yes" to start the live evaluation: ',
  );
  terminal.close();
  if (confirmation.trim().toLowerCase() !== "yes") {
    process.stdout.write("Live OpenAI evaluation NOT RUN: not confirmed.\n");
    return;
  }

  const result = await runEvaluation({
    dataset: defaultDataset,
    config: defaultConfig,
    provider: createOpenAIAdapter(),
    mode: "openai",
    repair: true,
  });
  process.stdout.write(
    `${JSON.stringify({
      run_id: result.run_id,
      status: result.evaluation_status,
      case_count: result.case_count,
      effective_model: result.effective_model,
      request_counts: result.request_counts,
      scores: result.scores,
    })}\n`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
