import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { createSafeError, isSafeHttpError } from "../errors/safe-errors.js";
import { buildPrompt } from "../prompt-builder.js";

const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_RETRIES = 1;
export const APPROVED_EVALUATION_MODEL = "gpt-6-luna";
const canonicalSchema = JSON.parse(
  readFileSync(
    new URL("../../specs/001-ai-spend-analyzer/contracts/output-schema.json", import.meta.url),
    "utf8",
  ),
);
const OUTPUT_FIELDS = Object.freeze(Object.keys(canonicalSchema.properties));

function openAiType(propertySchema) {
  if (propertySchema.type) {
    return Array.isArray(propertySchema.type)
      ? [...propertySchema.type]
      : propertySchema.type;
  }

  if (Array.isArray(propertySchema.oneOf)) {
    return [...new Set(propertySchema.oneOf.map((branch) => branch.type))];
  }

  return undefined;
}

export function projectSchemaForOpenAI(schema = canonicalSchema) {
  const properties = {};

  for (const [field, propertySchema] of Object.entries(schema.properties)) {
    const type = openAiType(propertySchema);
    const projectedProperty = {};

    if (type !== undefined) {
      projectedProperty.type = type;
    }
    if (propertySchema.enum) {
      projectedProperty.enum = [...propertySchema.enum];
    }

    properties[field] = projectedProperty;
  }

  return {
    type: schema.type,
    properties,
    required: [...schema.required],
    additionalProperties: schema.additionalProperties,
  };
}

function responseText(response) {
  for (const item of response.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content ?? []) {
      if (content.type === "refusal") {
        throw createSafeError("INVALID_MODEL_RESPONSE", "refusal");
      }
    }
  }

  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const text = (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text")
    .map((content) => content.text)
    .join("");

  return text || null;
}

function normalizeCandidate(candidate) {
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    throw createSafeError("INVALID_MODEL_RESPONSE", "field_shape_failure");
  }

  const keys = Object.keys(candidate);
  if (
    keys.length !== OUTPUT_FIELDS.length ||
    OUTPUT_FIELDS.some((field) => !Object.hasOwn(candidate, field))
  ) {
    throw createSafeError("INVALID_MODEL_RESPONSE", "field_shape_failure");
  }

  return Object.fromEntries(OUTPUT_FIELDS.map((field) => [field, candidate[field]]));
}

function isTimeout(error) {
  return (
    error?.name === "APIConnectionTimeoutError" ||
    error?.name === "TimeoutError" ||
    error?.name === "AbortError" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "ECONNABORTED"
  );
}

function isRetryable(error) {
  const status = Number(error?.status);
  return (
    isTimeout(error) ||
    status === 429 ||
    status >= 500 ||
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "EPIPE",
      "EAI_AGAIN",
      "ENOTFOUND",
      "UND_ERR_CONNECT_TIMEOUT",
    ].includes(error?.code)
  );
}

function mapProviderError(error) {
  if (isSafeHttpError(error)) {
    return error;
  }

  return createSafeError(
    isTimeout(error)
      ? "PROVIDER_TIMEOUT"
      : Number(error?.status) === 429 || Number(error?.status) >= 500 ||
          isRetryable(error)
        ? "PROVIDER_UNAVAILABLE"
        : "INTERNAL_ERROR",
  );
}

export function createOpenAIAdapter({
  client: injectedClient,
  apiKey: injectedApiKey,
  model = APPROVED_EVALUATION_MODEL,
} = {}) {
  const hasInjectedClient =
    injectedClient !== undefined && injectedClient !== null;
  if (
    model !== APPROVED_EVALUATION_MODEL ||
    (process.env.OPENAI_MODEL &&
      process.env.OPENAI_MODEL !== APPROVED_EVALUATION_MODEL)
  ) {
    throw new Error("The approved evaluation model is gpt-6-luna.");
  }

  let client = injectedClient;
  const attemptMetrics = {
    actual_api_attempt_count: 0,
    simulated_api_attempt_count: 0,
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

  function recordProviderFailure(kind) {
    attemptMetrics.failed_outcome_count += 1;
    if (kind === "provider") {
      attemptMetrics.failed_provider_outcome_count += 1;
    } else {
      attemptMetrics.failed_parse_outcome_count += 1;
    }
  }

  function getClient() {
    if (client) {
      return client;
    }

    const apiKey = injectedApiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw createSafeError("INTERNAL_ERROR");
    }

    client = new OpenAI({
      apiKey,
      maxRetries: 0,
      timeout: REQUEST_TIMEOUT_MS,
    });
    return client;
  }

  async function analyze(statement, { repairContext } = {}) {
    const prompt = buildPrompt(statement, repairContext);
    const request = {
      model,
      input: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      tools: [],
      text: {
        format: {
          type: "json_schema",
          name: "transaction_extraction",
          strict: true,
          schema: projectSchemaForOpenAI(),
        },
      },
      store: false,
    };

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      let activeClient;
      try {
        activeClient = getClient();
      } catch (error) {
        throw mapProviderError(error);
      }

      if (hasInjectedClient) {
        attemptMetrics.simulated_api_attempt_count += 1;
      } else {
        attemptMetrics.actual_api_attempt_count += 1;
      }
      if (attempt > 0) {
        attemptMetrics.retry_attempt_count += 1;
      }

      let response;
      try {
        response = await activeClient.responses.create(request, {
          timeout: REQUEST_TIMEOUT_MS,
        });
        //---User added code for debugging purposes start---
        if (process.env.DEBUG_MODEL_RESPONSE === "true") {
          console.log("\n========== MODEL RESPONSE DEBUG ==========");
          console.dir(
            {
              id: response?.id,
              status: response?.status,
              output: response?.output,
              output_text: response?.output_text,
              incomplete_details: response?.incomplete_details,
              error: response?.error,
            },
            { depth: null, colors: false },
          );
          console.log("========== END MODEL RESPONSE DEBUG ==========\n");
        }
        //---User added code for debugging purposes end---
      } catch (error) {
        attemptMetrics.transport_failure_count += 1;
        attemptMetrics.failed_transport_outcome_count += 1;
        attemptMetrics.failed_outcome_count += 1;
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          continue;
        }
        throw mapProviderError(error);
      }
      attemptMetrics.transport_success_count += 1;

      if (response?.status !== "completed") {
        attemptMetrics.non_completed_response_count += 1;
        recordProviderFailure("provider");
      } else {
        attemptMetrics.completed_response_count += 1;
      }
      if (response?.status !== "completed") {
        const diagnosticStage =
          response?.status === "incomplete"
            ? "incomplete_response"
            : response?.status === "failed"
              ? "provider_response_failed"
              : "provider_response_not_completed";
        throw createSafeError(
          "INVALID_MODEL_RESPONSE",
          diagnosticStage,
        );
      }

      let text;
      try {
        text = responseText(response);
      } catch (error) {
        if (isSafeHttpError(error)) {
          recordProviderFailure("provider");
        }
        throw error;
      }
      if (!text) {
        recordProviderFailure("parse");
        throw createSafeError("INVALID_MODEL_RESPONSE", "empty_output");
      }

      let candidate;
      try {
        candidate = JSON.parse(text);
      } catch {
        recordProviderFailure("parse");
        throw createSafeError("INVALID_MODEL_RESPONSE", "parse_failure");
      }

      let normalizedCandidate;
      try {
        normalizedCandidate = normalizeCandidate(candidate);
      } catch (error) {
        recordProviderFailure("parse");
        throw error;
      }
      attemptMetrics.usable_response_count += 1;
      return normalizedCandidate;
    }

    throw createSafeError("PROVIDER_UNAVAILABLE");
  }

  return Object.freeze({
    analyze,
    getAttemptMetrics: () => ({ ...attemptMetrics }),
    recordExtractionOutcome(success) {
      if (success) {
        attemptMetrics.successful_extraction_count += 1;
      } else {
        attemptMetrics.failed_extraction_outcome_count += 1;
        attemptMetrics.failed_outcome_count += 1;
      }
    },
    model,
    isLiveApiAdapter: !hasInjectedClient,
  });
}
