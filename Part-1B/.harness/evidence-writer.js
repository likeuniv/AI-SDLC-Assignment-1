import { randomUUID } from "node:crypto";
import {
  mkdir,
  appendFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { isSafeDiagnosticReasonCode } from "../src/errors/safe-errors.js";

const evidenceKeys = new Set([
  "run_id",
  "mode",
  "effective_model",
  "evaluation_status",
  "not_run_reason",
  "generated_at",
  "case_count",
  "request_counts",
  "pre_run_summary",
  "cases",
  "scores",
  "weights",
  "thresholds",
  "max_repair_cycles",
  "repair_cycles",
  "repair_unavailable_cases",
  "passed",
]);
const caseKeys = new Set([
  "case_id",
  "duration_ms",
  "safe_error_code",
  "safe_failure_stage",
  "safe_failure_reason_code",
  "execution_mode",
  "layers",
  "adversarial_passed",
  "logical_calls",
]);
const logicalCallKeys = new Set([
  "role",
  "outcome",
  "error_code",
  "diagnostic_stage",
  "safe_failure_reason_code",
  "duration_ms",
]);
const layerKeys = new Set(["passed", "findings"]);
const repairKeys = new Set([
  "cycle",
  "reason",
  "failed_checks",
  "affected_case_ids",
  "outcomes",
  "logical_provider_calls",
  "actual_api_attempts",
  "improved",
]);
const repairUnavailableKeys = new Set(["case_id", "reason"]);
const safeErrorCodes = new Set([
  "INVALID_REQUEST",
  "REQUEST_TOO_LARGE",
  "MULTIPLE_TRANSACTIONS",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "INVALID_MODEL_RESPONSE",
  "INTERNAL_ERROR",
]);
const diagnosticStages = new Set([
  "refusal",
  "incomplete_response",
  "provider_response_failed",
  "provider_response_not_completed",
  "empty_output",
  "parse_failure",
  "field_shape_failure",
  "canonical_schema_failure",
  "invariant_failure",
]);
const layerNames = new Set([
  "structural",
  "behavioral",
  "adversarial",
  "semantic",
]);
const weightedLayerNames = new Set(["structural", "behavioral", "semantic"]);
const requestCountNames = new Set([
  "expected_logical_provider_call_count",
  "logical_provider_call_count",
  "actual_api_attempt_count",
  "retry_attempt_count",
  "transport_success_count",
  "transport_failure_count",
  "completed_response_count",
  "non_completed_response_count",
  "usable_response_count",
  "successful_extraction_count",
  "failed_outcome_count",
  "failed_transport_outcome_count",
  "failed_provider_outcome_count",
  "failed_parse_outcome_count",
  "failed_extraction_outcome_count",
  "maximum_estimated_api_attempts",
]);
const preRunSummaryNames = new Set([
  "effective_model",
  "dataset_case_count",
  "expected_logical_provider_call_count",
  "maximum_logical_provider_call_count",
  "maximum_retry_allowance",
  "maximum_repair_cycle_allowance",
  "repair_enabled",
  "maximum_estimated_api_attempts",
  "mode",
  "run_type",
  "token_usage_estimate",
  "estimated_cost",
]);
const scoreNames = new Set([
  "structural",
  "behavioral",
  "adversarial",
  "semantic",
  "aggregate",
]);
const approvedNotRunReason =
  "OPENAI_API_KEY is not available in the process environment; no credential file was read.";
const unsafeKeyPattern =
  /(?:statement|provider_response|prompt|credential|secret|exception|transaction_details|generated_output|raw_|api_key)/iu;
const caseIdPattern = /^EC-(?:00[1-9]|0(?:1\d|2[01]))$/u;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRunId(value) {
  return value === "synthetic-run" || uuidPattern.test(value ?? "");
}

function assertSafeKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertSafeKeys(item);
    }
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (unsafeKeyPattern.test(key)) {
      throw new Error("Unsupported evidence shape.");
    }
    assertSafeKeys(nested);
  }
}

function pick(value, allowedKeys) {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([key]) => allowedKeys.has(key)),
  );
}

function pickFiniteNumbers(value, allowedKeys) {
  const picked = pick(value, allowedKeys);
  for (const [key, number] of Object.entries(picked)) {
    if (!Number.isFinite(number)) {
      throw new Error(`Invalid evidence metric: ${key}.`);
    }
  }
  return picked;
}

function sanitizeLayer(layer) {
  const safe = pick(layer, layerKeys);
  if (typeof safe.passed !== "boolean") {
    throw new Error("Invalid evidence layer.");
  }
  safe.findings = Array.isArray(safe.findings) ? safe.findings : [];
  if (
    safe.findings.some(
      (finding) =>
        typeof finding !== "string" ||
        !/^[A-Z][A-Z0-9_]{0,79}$/u.test(finding),
    )
  ) {
    throw new Error("Invalid evidence finding.");
  }
  return safe;
}

function sanitizeLogicalCall(call) {
  const safe = pick(call, logicalCallKeys);
  if (
    !["prior", "current"].includes(safe.role) ||
    !["PASS", "FAIL"].includes(safe.outcome) ||
    (safe.error_code !== null && !safeErrorCodes.has(safe.error_code)) ||
    (safe.diagnostic_stage !== null &&
      !diagnosticStages.has(safe.diagnostic_stage)) ||
    (safe.safe_failure_reason_code != null &&
      !isSafeDiagnosticReasonCode(safe.safe_failure_reason_code)) ||
    (safe.safe_failure_reason_code != null &&
      safe.diagnostic_stage !== "invariant_failure") ||
    !Number.isFinite(safe.duration_ms) ||
    safe.duration_ms < 0 ||
    (safe.outcome === "PASS" &&
      (safe.error_code !== null ||
        safe.diagnostic_stage !== null ||
        safe.safe_failure_reason_code != null)) ||
    (safe.outcome === "FAIL" && safe.error_code === null)
  ) {
    throw new Error("Invalid logical provider call evidence.");
  }
  safe.safe_failure_reason_code ??= null;
  return safe;
}

function sanitizeCase(item) {
  const safe = pick(item, caseKeys);
  if (
    !caseIdPattern.test(safe.case_id ?? "") ||
    !Number.isFinite(safe.duration_ms) ||
    safe.duration_ms < 0 ||
    (safe.safe_error_code !== null &&
      !safeErrorCodes.has(safe.safe_error_code)) ||
    (safe.execution_mode !== undefined &&
      !["openai", "mocked", "provider_fixture", "validator_fixture"].includes(
        safe.execution_mode,
      )      ) ||
      (safe.safe_failure_stage !== undefined &&
        safe.safe_failure_stage !== null &&
        !diagnosticStages.has(safe.safe_failure_stage)) ||
      (safe.safe_failure_reason_code !== undefined &&
        safe.safe_failure_reason_code !== null &&
        (!isSafeDiagnosticReasonCode(safe.safe_failure_reason_code) ||
          safe.safe_failure_stage !== "invariant_failure"))
  ) {
      throw new Error("Invalid evaluation case metadata.");
  }
  safe.safe_failure_stage ??= null;
  safe.safe_failure_reason_code ??= null;
  if (safe.adversarial_passed !== null && typeof safe.adversarial_passed !== "boolean") {
    throw new Error("Invalid adversarial evidence.");
  }
  safe.layers = Object.fromEntries(
    Object.entries(item.layers ?? {}).map(([name, layer]) => [
      name,
      sanitizeLayer(layer),
    ]),
  );
  if (
    ![3, 4].includes(Object.keys(safe.layers).length) ||
    Object.keys(safe.layers).some((name) => !layerNames.has(name)) ||
    !["structural", "behavioral", "semantic"].every((name) =>
      Object.hasOwn(safe.layers, name),
    )
  ) {
    throw new Error("Invalid evaluation layers.");
  }
  if (
    (Object.hasOwn(safe.layers, "adversarial") &&
      safe.adversarial_passed !== safe.layers.adversarial.passed) ||
    (!Object.hasOwn(safe.layers, "adversarial") &&
      safe.adversarial_passed !== null)
  ) {
    throw new Error("Inconsistent adversarial evidence.");
  }
  if (safe.logical_calls !== undefined) {
    if (
      !Array.isArray(safe.logical_calls) ||
      safe.logical_calls.length !== 2 ||
      safe.logical_calls[0].role !== "prior" ||
      safe.logical_calls[1].role !== "current"
    ) {
      throw new Error("Invalid independent request evidence.");
    }
    safe.logical_calls = safe.logical_calls.map(sanitizeLogicalCall);
  }
  return safe;
}

function sanitizeRequestCounts(counts, mode) {
  const safe = pickFiniteNumbers(counts, requestCountNames);
  if (
    Object.keys(safe).length !== requestCountNames.size ||
    Object.values(safe).some(
      (count) => !Number.isInteger(count) || count < 0,
    ) ||
    safe.actual_api_attempt_count !==
      safe.transport_success_count + safe.transport_failure_count ||
    safe.completed_response_count + safe.non_completed_response_count !==
      safe.transport_success_count ||
    safe.transport_failure_count !== safe.failed_transport_outcome_count ||
    safe.failed_outcome_count !==
      safe.failed_transport_outcome_count +
        safe.failed_provider_outcome_count +
        safe.failed_parse_outcome_count +
        safe.failed_extraction_outcome_count ||
    safe.usable_response_count > safe.completed_response_count ||
    safe.successful_extraction_count + safe.failed_extraction_outcome_count >
      safe.usable_response_count ||
    safe.retry_attempt_count > safe.actual_api_attempt_count ||
    safe.retry_attempt_count > safe.logical_provider_call_count ||
    safe.actual_api_attempt_count > safe.maximum_estimated_api_attempts ||
    safe.logical_provider_call_count >
      safe.expected_logical_provider_call_count * 3 ||
    (mode === "mocked" &&
      (safe.actual_api_attempt_count !== 0 ||
        safe.retry_attempt_count !== 0 ||
        safe.transport_success_count !== 0 ||
        safe.transport_failure_count !== 0 ||
        safe.completed_response_count !== 0 ||
        safe.non_completed_response_count !== 0 ||
        safe.usable_response_count !== 0 ||
        safe.successful_extraction_count !== 0 ||
        safe.failed_outcome_count !== 0 ||
        safe.failed_transport_outcome_count !== 0 ||
        safe.failed_provider_outcome_count !== 0 ||
        safe.failed_parse_outcome_count !== 0 ||
        safe.failed_extraction_outcome_count !== 0))
  ) {
    throw new Error("Invalid provider request accounting.");
  }
  return safe;
}

function sanitizePreRunSummary(summary, mode, effectiveModel) {
  const safe = pick(summary, preRunSummaryNames);
  if (
    safe.effective_model !== effectiveModel ||
    safe.mode !== mode ||
    safe.run_type !== (mode === "openai" ? "live" : "mocked") ||
    !Number.isInteger(safe.dataset_case_count) ||
    safe.dataset_case_count !== 21 ||
    !Number.isInteger(safe.expected_logical_provider_call_count) ||
    !Number.isInteger(safe.maximum_logical_provider_call_count) ||
    safe.maximum_retry_allowance !== 1 ||
    safe.maximum_repair_cycle_allowance !== 2 ||
    typeof safe.repair_enabled !== "boolean" ||
    !Number.isInteger(safe.maximum_estimated_api_attempts) ||
    safe.maximum_logical_provider_call_count !==
      safe.expected_logical_provider_call_count *
        (safe.repair_enabled
          ? safe.maximum_repair_cycle_allowance + 1
          : 1) ||
    safe.maximum_estimated_api_attempts !==
      safe.maximum_logical_provider_call_count *
        (safe.maximum_retry_allowance + 1) ||
    safe.token_usage_estimate !== "UNKNOWN" ||
    safe.estimated_cost !== "UNKNOWN"
  ) {
    throw new Error("Invalid pre-run usage estimate.");
  }
  return safe;
}

function sanitizeEvaluation(result) {
  assertSafeKeys(result);
  const safe = pick(result, evidenceKeys);
  if (
    !isRunId(safe.run_id) ||
    !["openai", "mocked"].includes(safe.mode) ||
    safe.effective_model !== "gpt-6-luna" ||
    !["PASS", "FAIL", "NOT RUN"].includes(safe.evaluation_status) ||
    typeof safe.passed !== "boolean"
  ) {
    throw new Error("Invalid evaluation evidence metadata.");
  }
  if (
    safe.evaluation_status === "NOT RUN" &&
    safe.not_run_reason !== approvedNotRunReason
  ) {
    throw new Error("Invalid NOT RUN evidence reason.");
  }
  if (safe.evaluation_status !== "NOT RUN") {
    delete safe.not_run_reason;
  }
  if (
    (safe.evaluation_status === "PASS") !== safe.passed ||
    (safe.evaluation_status === "NOT RUN" &&
      (safe.case_count !== 0 || safe.scores !== null)) ||
    (safe.evaluation_status !== "NOT RUN" &&
      safe.scores?.passed !== safe.passed)
  ) {
    throw new Error("Inconsistent evaluation evidence status.");
  }
  safe.scores =
    safe.scores === null
      ? null
      : pickFiniteNumbers(safe.scores, scoreNames);
  safe.request_counts = sanitizeRequestCounts(safe.request_counts, safe.mode);
  if (safe.pre_run_summary !== undefined) {
    safe.pre_run_summary = sanitizePreRunSummary(
      safe.pre_run_summary,
      safe.mode,
      safe.effective_model,
    );
  }
  safe.weights = pickFiniteNumbers(safe.weights, weightedLayerNames);
  safe.thresholds = pickFiniteNumbers(
    safe.thresholds,
    new Set([...scoreNames]),
  );
  if (
    !Number.isInteger(safe.case_count) ||
    safe.case_count < 0 ||
    !Number.isInteger(safe.max_repair_cycles) ||
    safe.max_repair_cycles !== 2
  ) {
    throw new Error("Invalid evaluation counts.");
  }
  safe.cases = Array.isArray(result.cases)
    ? result.cases.map(sanitizeCase)
    : [];
  if (safe.cases.length !== safe.case_count) {
    throw new Error("Evaluation case count mismatch.");
  }
  safe.repair_cycles = Array.isArray(result.repair_cycles)
    ? result.repair_cycles.map((cycle) => {
        const safeCycle = pick(cycle, repairKeys);
        if (
          !Number.isInteger(safeCycle.cycle) ||
          safeCycle.cycle < 1 ||
          safeCycle.cycle > 2 ||
          safeCycle.reason !==
            "Re-evaluated eligible failed cases through the extraction service." ||
          !Array.isArray(safeCycle.failed_checks) ||
          !Array.isArray(safeCycle.affected_case_ids) ||
          safeCycle.affected_case_ids.length === 0 ||
          safeCycle.affected_case_ids.some(
            (caseId) => !caseIdPattern.test(caseId),
          ) ||
          !Array.isArray(safeCycle.outcomes) ||
          safeCycle.outcomes.length !== safeCycle.affected_case_ids.length ||
          safeCycle.outcomes.some(
            (outcome, index) =>
              outcome?.case_id !== safeCycle.affected_case_ids[index] ||
              !["PASS", "FAIL"].includes(outcome?.outcome),
          ) ||
          !Number.isInteger(safeCycle.logical_provider_calls) ||
          safeCycle.logical_provider_calls < 0 ||
          !Number.isInteger(safeCycle.actual_api_attempts) ||
          safeCycle.actual_api_attempts < 0 ||
          safeCycle.failed_checks.some(
            (finding) =>
              !caseIdPattern.test(finding?.case_id ?? "") ||
              !["structural", "behavioral", "adversarial", "semantic"].includes(
                finding?.check_id,
              ),
          ) ||
          typeof safeCycle.improved !== "boolean"
        ) {
          throw new Error("Invalid repair-cycle evidence.");
        }
        return safeCycle;
      })
    : [];
  safe.repair_unavailable_cases = Array.isArray(result.repair_unavailable_cases)
    ? result.repair_unavailable_cases.map((item) => {
        const unavailable = pick(item, repairUnavailableKeys);
        if (
          !caseIdPattern.test(unavailable.case_id ?? "") ||
          !["not_provider_backed", "repairs_disabled", "no_progress"].includes(
            unavailable.reason,
          )
        ) {
          throw new Error("Invalid unavailable repair evidence.");
        }
        return unavailable;
      })
    : [];
  if (safe.repair_cycles.length > 2) {
    throw new Error("Repair-cycle evidence exceeds the configured maximum.");
  }
  return safe;
}

function createHarnessLog(result) {
  const lines = [
    "# Evaluation Harness Log",
    "",
    `- Run: ${result.run_id ?? "unavailable"}`,
    `- Mode: ${result.mode ?? "unspecified"}`,
    `- Effective model: ${result.effective_model ?? "unknown"}`,
    `- Status: ${result.evaluation_status ?? (result.passed ? "PASS" : "FAIL")}`,
    `- Cases: ${result.case_count ?? result.cases?.length ?? 0}`,
    `- Logical provider calls: ${result.request_counts?.logical_provider_call_count ?? 0}`,
    `- API attempts: ${result.request_counts?.actual_api_attempt_count ?? 0}`,
    `- Retry attempts: ${result.request_counts?.retry_attempt_count ?? 0}`,
    `- Transport failures: ${result.request_counts?.transport_failure_count ?? 0}`,
    `- Aggregate score: ${result.scores?.aggregate ?? "unknown"}`,
    `- Pre-run maximum API attempts: ${result.pre_run_summary?.maximum_estimated_api_attempts ?? result.request_counts?.maximum_estimated_api_attempts ?? 0}`,
    `- Token usage estimate: ${result.pre_run_summary?.token_usage_estimate ?? "UNKNOWN"}`,
    `- Estimated monetary cost: ${result.pre_run_summary?.estimated_cost ?? "UNKNOWN"}`,
    "",
    `- Transport successes: ${result.request_counts?.transport_success_count ?? 0}`,
    `- Completed provider responses: ${result.request_counts?.completed_response_count ?? 0}`,
    `- Usable provider responses: ${result.request_counts?.usable_response_count ?? 0}`,
    `- Successful extractions: ${result.request_counts?.successful_extraction_count ?? 0}`,
    `- Failed outcomes: ${result.request_counts?.failed_outcome_count ?? 0}`,
    "| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage | Failure reason |",
    "|---|---|---|---:|---|---|---|",
  ];

  for (const item of result.cases ?? []) {
    for (const [layerName, layer] of Object.entries(item.layers ?? {})) {
      lines.push(
        `| ${item.case_id} | ${layerName} | ${layer.passed ? "PASS" : "FAIL"} | ${item.duration_ms ?? 0} | ${item.safe_error_code ?? ""} | ${item.safe_failure_stage ?? ""} | ${item.safe_failure_reason_code ?? ""} |`,
      );
    }
    for (const call of item.logical_calls ?? []) {
      lines.push(
        `| ${item.case_id} | ${call.role} request | ${call.outcome} | ${call.duration_ms} | ${call.error_code ?? ""} | ${call.diagnostic_stage ?? ""} | ${call.safe_failure_reason_code ?? ""} |`,
      );
    }
  }

  if (result.not_run_reason) {
    lines.push("", `NOT RUN: ${result.not_run_reason}`);
  }

  if (Array.isArray(result.repair_cycles)) {
    for (const cycle of result.repair_cycles) {
      lines.push(
        `- Repair cycle ${cycle.cycle}: ${cycle.improved ? "improved" : "did not improve"}; ${cycle.reason}; affected cases: ${cycle.affected_case_ids.join(", ")}; outcomes: ${cycle.outcomes.map((item) => `${item.case_id}/${item.outcome}`).join(", ")}; logical calls: ${cycle.logical_provider_calls}; actual API attempts: ${cycle.actual_api_attempts}`,
      );
    }
  }
  for (const item of result.repair_unavailable_cases ?? []) {
    lines.push(
      `- Repair unavailable for ${item.case_id}: ${item.reason}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function createEvidenceWriter({
  directory = path.resolve("evidence/runs"),
} = {}) {
  const reservedRunIds = new Set();
  async function reserveRun(runId) {
    if (!isRunId(runId)) {
      throw new Error("Invalid evidence run ID.");
    }
    if (reservedRunIds.has(runId)) {
      throw new Error("Evidence run ID has already been reserved.");
    }
    await mkdir(directory, { recursive: true });
    await mkdir(path.join(directory, runId));
    reservedRunIds.add(runId);
  }

  const writeEvidence = async function writeEvidence(result) {
    const safeResult = sanitizeEvaluation(result);
    if (!reservedRunIds.has(safeResult.run_id)) {
      await reserveRun(safeResult.run_id);
    }
    const runDirectory = path.join(directory, safeResult.run_id);
    const logContent = createHarnessLog(safeResult);
    await Promise.all([
      writeFile(
        path.join(runDirectory, "eval-results.json"),
        `${JSON.stringify(safeResult, null, 2)}\n`,
        { encoding: "utf8", flag: "wx" },
      ),
      writeFile(path.join(runDirectory, "harness-log.md"), logContent, {
        encoding: "utf8",
        flag: "wx",
      }),
    ]);
  };
  writeEvidence.reserve = reserveRun;
  return writeEvidence;
}

export function createOperationalLogWriter({
  directory = path.resolve(".harness/logs"),
  runId = randomUUID(),
} = {}) {
  if (!isRunId(runId)) {
    throw new Error("Invalid operational log run ID.");
  }
  const filePath = path.join(directory, `${runId}.log`);

  return async function writeOperationalEntry(entry) {
    const safeEntry = {
      case_id: entry.case_id,
      check_id: entry.check_id,
      outcome: entry.outcome,
      duration_ms: entry.duration_ms,
      safe_error_code: entry.safe_error_code ?? null,
    };
    if (
      typeof safeEntry.case_id !== "string" ||
      !caseIdPattern.test(safeEntry.case_id) ||
      typeof safeEntry.check_id !== "string" ||
      !["structural", "behavioral", "adversarial", "semantic"].includes(
        safeEntry.check_id,
      ) ||
      !["PASS", "FAIL"].includes(safeEntry.outcome) ||
      !Number.isFinite(safeEntry.duration_ms) ||
      safeEntry.duration_ms < 0 ||
      (safeEntry.safe_error_code !== null &&
        !safeErrorCodes.has(safeEntry.safe_error_code))
    ) {
      throw new Error("Invalid operational log metadata.");
    }

    await mkdir(directory, { recursive: true });
    await appendFile(filePath, `${JSON.stringify(safeEntry)}\n`, "utf8");
  };
}

export function createRunId() {
  return randomUUID();
}
