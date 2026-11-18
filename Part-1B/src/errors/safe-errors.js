const definitions = {
  INVALID_REQUEST: {
    status: 400,
    message: "Provide one non-empty transaction statement.",
  },
  REQUEST_TOO_LARGE: {
    status: 413,
    message: "The request exceeds the allowed size.",
  },
  MULTIPLE_TRANSACTIONS: {
    status: 422,
    message: "Submit one transaction at a time.",
  },
  PROVIDER_UNAVAILABLE: {
    status: 503,
    message: "The analysis service is temporarily unavailable.",
  },
  PROVIDER_TIMEOUT: {
    status: 504,
    message: "The analysis service took too long to respond.",
  },
  INVALID_MODEL_RESPONSE: {
    status: 502,
    message: "The analysis service returned an unusable result.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "An unexpected error occurred.",
  },
};

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

const diagnosticReasonCodes = new Set([
  "UNSUPPORTED_TRANSACTION_AMOUNT",
  "UNSUPPORTED_CURRENCY",
  "UNSUPPORTED_MERCHANT",
  "UNSUPPORTED_CATEGORY",
  "UNSUPPORTED_TRANSACTION_DIRECTION",
  "MULTIPLE_TRANSACTIONS_DETECTED",
  "UNTRUSTED_INSTRUCTION_INFLUENCE",
  "UNKNOWN_INVARIANT_FAILURE",
]);

export class SafeHttpError extends Error {
  constructor(code, diagnosticStage = null, diagnosticReasonCode = null) {
    const definition = definitions[code] ?? definitions.INTERNAL_ERROR;
    super(definition.message);
    this.name = "SafeHttpError";
    this.code = definitions[code] ? code : "INTERNAL_ERROR";
    this.status = definition.status;
    this.diagnosticStage = diagnosticStages.has(diagnosticStage)
      ? diagnosticStage
      : null;
    this.diagnosticReasonCode =
      this.diagnosticStage === "invariant_failure" &&
      diagnosticReasonCodes.has(diagnosticReasonCode)
      ? diagnosticReasonCode
      : null;
  }
}

export function createSafeError(
  code,
  diagnosticStage = null,
  diagnosticReasonCode = null,
) {
  return new SafeHttpError(code, diagnosticStage, diagnosticReasonCode);
}

export function isSafeDiagnosticReasonCode(value) {
  return diagnosticReasonCodes.has(value);
}

export function isSafeHttpError(error) {
  return error instanceof SafeHttpError;
}

export function toSafeHttpError(error) {
  return isSafeHttpError(error)
    ? error
    : createSafeError("INTERNAL_ERROR");
}
