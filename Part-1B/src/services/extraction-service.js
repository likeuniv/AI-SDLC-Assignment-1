import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import {
  checkProtectedOutput,
  checkTransactionInvariants,
  hasImplicitSecondTransaction,
  invariantFailureReasonCode,
} from "../transaction-invariants.js";
import { createOpenAIAdapter } from "../ai/openai-adapter.js";
import {
  createSafeError,
  isSafeHttpError,
} from "../errors/safe-errors.js";
import { isIso4217Currency } from "../iso4217-format.js";

const outputSchema = JSON.parse(
  readFileSync(
    new URL("../../specs/001-ai-spend-analyzer/contracts/output-schema.json", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({
  allErrors: true,
  coerceTypes: false,
  removeAdditional: false,
  useDefaults: false,
  strict: false,
});
ajv.addFormat("iso-4217-currency", {
  type: "string",
  validate: isIso4217Currency,
});
const validateOutput = ajv.compile(outputSchema);
const barePaymentWithoutPurpose =
  /^\s*(?:i\s+)?(?:paid|spent)\s+(?:(?:inr|rs\.?|rupees?)\s*)?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:inr|rs\.?|rupees?))?\s*[.!?]*\s*$/iu;

function clarificationQuestionIsRelevant(statement, result) {
  const question = result.clarification_question;

  if (
    result.amount === null &&
    !/\b(?:amount|how much|what sum|cost|price|value)\b/iu.test(question)
  ) {
    return false;
  }

  if (
    result.transaction_type === "UNKNOWN" &&
    !/\b(?:credit|debit|paid|pay|receive|received|direction|spend|spent|sent|transfer)\b/iu.test(
      question,
    )
  ) {
    return false;
  }

  if (
    result.category === "UNKNOWN" &&
    barePaymentWithoutPurpose.test(statement) &&
    !/\b(?:purpose|what.{0,30}\bfor\b|what.{0,20}\b(?:paid|payment|buy|bought|purchase)\b)\b/iu.test(
      question,
    )
  ) {
    return false;
  }

  return true;
}

export function createExtractionService({
  provider = createOpenAIAdapter(),
} = {}) {
  async function extract(statement, { repairContext } = {}) {
    if (typeof statement !== "string" || statement.trim() === "") {
      throw createSafeError("INVALID_REQUEST");
    }

    if (hasImplicitSecondTransaction(statement)) {
      throw createSafeError(
        "MULTIPLE_TRANSACTIONS",
        "invariant_failure",
        "MULTIPLE_TRANSACTIONS_DETECTED",
      );
    }

    let result;
    try {
      result = await provider.analyze(
        statement,
        repairContext === undefined ? undefined : { repairContext },
      );
    } catch (error) {
      if (isSafeHttpError(error)) {
        throw error;
      }
      if (
        ["PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "INVALID_MODEL_RESPONSE"].includes(
          error?.code,
        )
      ) {
        throw createSafeError(
          error.code,
          error?.diagnosticStage,
          error?.diagnosticReasonCode,
        );
      }
      throw createSafeError("INTERNAL_ERROR");
    }

    if (!validateOutput(result)) {
      provider.recordExtractionOutcome?.(false);
      throw createSafeError(
        "INVALID_MODEL_RESPONSE",
        "canonical_schema_failure",
      );
    }

    if (checkProtectedOutput(result).length > 0) {
      provider.recordExtractionOutcome?.(false);
      throw createSafeError(
        "INVALID_MODEL_RESPONSE",
        "invariant_failure",
        "UNTRUSTED_INSTRUCTION_INFLUENCE",
      );
    }

    const violations = checkTransactionInvariants(statement, result);
    if (violations.includes("Statement contains multiple distinct transactions.")) {
      provider.recordExtractionOutcome?.(false);
      throw createSafeError(
        "MULTIPLE_TRANSACTIONS",
        "invariant_failure",
        "MULTIPLE_TRANSACTIONS_DETECTED",
      );
    }
    if (violations.length > 0) {
      provider.recordExtractionOutcome?.(false);
      throw createSafeError(
        "INVALID_MODEL_RESPONSE",
        "invariant_failure",
        invariantFailureReasonCode(violations),
      );
    }

    if (
      result.requires_clarification &&
      !clarificationQuestionIsRelevant(statement, result)
    ) {
      provider.recordExtractionOutcome?.(false);
      throw createSafeError(
        "INVALID_MODEL_RESPONSE",
        "invariant_failure",
        "UNKNOWN_INVARIANT_FAILURE",
      );
    }

    provider.recordExtractionOutcome?.(true);
    return result;
  }

  return Object.freeze({ extract });
}
