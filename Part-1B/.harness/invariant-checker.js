import { checkTransactionInvariants } from "../src/transaction-invariants.js";

const safeErrorCodes = new Set([
  "INVALID_REQUEST",
  "REQUEST_TOO_LARGE",
  "MULTIPLE_TRANSACTIONS",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "INVALID_MODEL_RESPONSE",
  "INTERNAL_ERROR",
]);

export function evaluateBehavior({
  caseDefinition,
  statement,
  output,
  errorCode,
  status,
  contextIsolated = true,
}) {
  const expected = caseDefinition.expected;
  const findings = [];

  if (caseDefinition.input.type === "validator_boundary") {
    return { passed: true, findings };
  }

  if (expected.type === "validator_boundaries") {
    return { passed: true, findings };
  }

  if (expected.type === "error") {
    if (errorCode !== expected.code || status !== expected.status) {
      findings.push("SAFE_ERROR_MISMATCH");
    }
    return { passed: findings.length === 0, findings };
  }

  if (expected.type === "validator_boundaries") {
    return { passed: true, findings };
  }

  if (errorCode) {
    findings.push("UNEXPECTED_EXTRACTION_ERROR");
  } else if (typeof statement === "string" && statement.trim() !== "") {
    const invariantViolations = checkTransactionInvariants(statement, output);
    if (invariantViolations.length > 0) {
      findings.push("TRANSACTION_INVARIANT_VIOLATION");
    }
  }

  if (caseDefinition.case_id === "EC-020" && !contextIsolated) {
    findings.push("REQUEST_CONTEXT_REUSED");
  }

  return { passed: findings.length === 0, findings };
}

export { safeErrorCodes };
