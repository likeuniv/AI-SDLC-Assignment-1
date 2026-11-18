import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createExtractionService } from "../../src/services/extraction-service.js";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));
const canonicalSchema = JSON.parse(
  await readFile(
    path.join(
      projectRoot,
      "specs/001-ai-spend-analyzer/contracts/output-schema.json",
    ),
    "utf8",
  ),
);
const expectedFields = Object.keys(canonicalSchema.properties);

function validResult(overrides = {}) {
  return {
    amount: 20,
    currency: "INR",
    category: "FOOD",
    transaction_type: "DEBIT",
    merchant_or_person: "Sample Cafe",
    description: "Cafe purchase",
    confidence: 0.9,
    requires_clarification: false,
    clarification_question: null,
    ...overrides,
  };
}

function completedResponse(result = validResult()) {
  return {
    status: "completed",
    output_text: JSON.stringify(result),
  };
}

async function loadAdapter() {
  return import("../../src/ai/openai-adapter.js");
}

function fakeClient(responseOrHandler) {
  const requests = [];
  const client = {
    responses: {
      async create(request, options) {
        requests.push({ request, options });
        if (typeof responseOrHandler === "function") {
          return responseOrHandler(request, options, requests.length);
        }
        return responseOrHandler;
      },
    },
  };
  return { client, requests };
}

function assertSafeError(error, code, excludedMarkers = []) {
  assert.equal(error.code, code);
  assert.ok(error.message.length > 0);
  for (const marker of excludedMarkers) {
    assert.equal(error.message.includes(marker), false);
  }
}

test("uses the configured gpt-6-luna model for Responses API requests", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client, requests } = fakeClient(completedResponse());
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_MODEL = "gpt-6-luna";
  try {
    const adapter = createOpenAIAdapter({
      client,
      apiKey: "synthetic-api-key",
    });

    await adapter.analyze("Paid 20 rupees at Sample Cafe");

    assert.equal(requests[0].request.model, "gpt-6-luna");
  } finally {
    if (previousModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = previousModel;
    }
  }
});

test("rejects an unexpected model override before sending a request", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client, requests } = fakeClient(completedResponse());
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_MODEL = "gpt-6-luna-unapproved";
  try {
    assert.throws(
      () => createOpenAIAdapter({ client }),
      /approved evaluation model/i,
    );
    assert.equal(requests.length, 0);
    assert.throws(
      () => createOpenAIAdapter({ client, model: "another-model" }),
      /approved evaluation model/i,
    );
  } finally {
    if (previousModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = previousModel;
    }
  }
});

test("builds a Responses API request with separate trusted and untrusted input", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const statement = "SYNTHETIC-STATEMENT-MARKER";
  const { client, requests } = fakeClient(completedResponse());

  await createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  }).analyze(statement);

  const request = requests[0].request;
  assert.ok(Array.isArray(request.input));
  assert.deepEqual(
    request.input.map(({ role }) => role),
    ["system", "user"],
  );
  assert.equal(request.input[1].content, statement);
  assert.equal(request.store, false);
  assert.deepEqual(request.tools, []);
});

test("requests strict Structured Outputs derived from the canonical schema", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client, requests } = fakeClient(completedResponse());

  await createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  }).analyze("Paid 20 rupees at Sample Cafe");

  const format = requests[0].request.text.format;
  assert.equal(format.type, "json_schema");
  assert.equal(format.strict, true);
  assert.deepEqual(
    Object.keys(format.schema.properties).sort(),
    [...expectedFields].sort(),
  );
  assert.deepEqual([...format.schema.required].sort(), [...expectedFields].sort());
  assert.equal(format.schema.additionalProperties, false);
  assert.deepEqual(
    Object.keys(format.schema.properties.category).sort(),
    ["enum", "type"],
  );
  assert.deepEqual(
    format.schema.properties.amount.type,
    ["number", "null"],
  );
  assert.equal(format.schema.properties.currency.format, undefined);
  assert.equal(format.schema.properties.description.maxLength, undefined);
  assert.equal(format.schema.allOf, undefined);
});

test("normalizes a successful response to exactly the nine canonical fields", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client } = fakeClient(completedResponse());

  const result = await createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  }).analyze("Paid 20 rupees at Sample Cafe");

  assert.deepEqual(Object.keys(result), expectedFields);
  assert.deepEqual(result, validResult());
});

test("rejects malformed JSON with a sanitized unusable-output error", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const marker = "SYNTHETIC-RAW-OUTPUT-MARKER";
  const { client } = fakeClient({
    status: "completed",
    output_text: `{"description":"${marker}"`,
  });

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey: "synthetic-api-key" }).analyze(
      "SYNTHETIC-STATEMENT-MARKER",
    ),
    (error) => {
      assertSafeError(error, "INVALID_MODEL_RESPONSE", [marker, "SYNTHETIC-STATEMENT-MARKER"]);
      assert.equal(error.diagnosticStage, "parse_failure");
      return true;
    },
  );
});

test("rejects output that does not match the canonical field shape", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const invalid = validResult();
  delete invalid.confidence;
  invalid.unexpected = true;
  const { client } = fakeClient(completedResponse(invalid));

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey: "synthetic-api-key" }).analyze(
      "Paid 20 rupees at Sample Cafe",
    ),
    (error) => {
      assertSafeError(error, "INVALID_MODEL_RESPONSE");
      assert.equal(error.diagnosticStage, "field_shape_failure");
      return true;
    },
  );
});

test("maps provider refusals to a safe unusable-output error", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const marker = "SYNTHETIC-REFUSAL-DETAIL";
  const { client } = fakeClient({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "refusal", refusal: marker }],
      },
    ],
  });

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey: "synthetic-api-key" }).analyze(
      "SYNTHETIC-STATEMENT-MARKER",
    ),
    (error) => {
      assertSafeError(error, "INVALID_MODEL_RESPONSE", [marker, "SYNTHETIC-STATEMENT-MARKER"]);
      assert.equal(error.diagnosticStage, "refusal");
      return true;
    },
  );
});

test("maps incomplete Responses API results to a safe unusable-output error", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client } = fakeClient({
    status: "incomplete",
    incomplete_details: { reason: "max_output_tokens" },
  });

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey: "synthetic-api-key" }).analyze(
      "Paid 20 rupees at Sample Cafe",
    ),
    (error) => {
      assertSafeError(error, "INVALID_MODEL_RESPONSE");
      assert.equal(error.diagnosticStage, "incomplete_response");
      return true;
    },
  );
});

test("classifies failed and other non-completed provider statuses without retaining status content", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  for (const [status, expectedStage] of [
    ["failed", "provider_response_failed"],
    ["in_progress", "provider_response_not_completed"],
    [undefined, "provider_response_not_completed"],
  ]) {
    const response = { output_text: "SYNTHETIC-PRIVATE-OUTPUT" };
    if (status !== undefined) {
      response.status = status;
    }
    const { client } = fakeClient(response);
    await assert.rejects(
      createOpenAIAdapter({ client }).analyze("SYNTHETIC-PRIVATE-STATEMENT"),
      (error) => {
        assertSafeError(
          error,
          "INVALID_MODEL_RESPONSE",
          [
            "SYNTHETIC-PRIVATE-OUTPUT",
            "SYNTHETIC-PRIVATE-STATEMENT",
            status,
          ].filter(Boolean),
        );
        assert.equal(error.diagnosticStage, expectedStage);
        return true;
      },
    );
  }
});

test("classifies empty provider output without retaining provider content", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client } = fakeClient({ status: "completed", output_text: "" });

  await assert.rejects(
    createOpenAIAdapter({ client }).analyze("SYNTHETIC-STATEMENT-MARKER"),
    (error) => {
      assertSafeError(error, "INVALID_MODEL_RESPONSE", [
        "SYNTHETIC-STATEMENT-MARKER",
      ]);
      assert.equal(error.diagnosticStage, "empty_output");
      return true;
    },
  );
});

test("maps provider API failures without exposing provider response or exception details", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const apiKey = "SYNTHETIC-API-KEY-MARKER";
  const statement = "SYNTHETIC-STATEMENT-MARKER";
  const responseMarker = "SYNTHETIC-PROVIDER-RESPONSE-MARKER";
  const exceptionMarker = "SYNTHETIC-EXCEPTION-MARKER";
  const { client } = fakeClient(() => {
    throw Object.assign(new Error(exceptionMarker), {
      status: 500,
      response: responseMarker,
    });
  });

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey }).analyze(statement),
    (error) => {
      assertSafeError(error, "PROVIDER_UNAVAILABLE", [
        apiKey,
        statement,
        responseMarker,
        exceptionMarker,
      ]);
      return true;
    },
  );
});

test("retries a rate-limited request at most once", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client, requests } = fakeClient((_request, _options, attempt) => {
    if (attempt === 1) {
      throw Object.assign(new Error("SYNTHETIC-RATE-LIMIT-DETAIL"), {
        status: 429,
      });
    }
    return completedResponse();
  });

  await createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  }).analyze("Paid 20 rupees at Sample Cafe");

  assert.equal(requests.length, 2);
});

test("reports retry outcomes without classifying fake requests as live attempts", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client } = fakeClient((_request, _options, attempt) => {
    if (attempt === 1) {
      throw Object.assign(new Error("SYNTHETIC-RATE-LIMIT-DETAIL"), {
        status: 429,
      });
    }
    return completedResponse();
  });
  const adapter = createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  });

  await adapter.analyze("SYNTHETIC-STATEMENT-MARKER");

  assert.deepEqual(adapter.getAttemptMetrics(), {
    actual_api_attempt_count: 0,
    simulated_api_attempt_count: 2,
    retry_attempt_count: 1,
    transport_success_count: 1,
    transport_failure_count: 1,
    completed_response_count: 1,
    non_completed_response_count: 0,
    usable_response_count: 1,
    successful_extraction_count: 0,
    failed_outcome_count: 1,
    failed_transport_outcome_count: 1,
    failed_provider_outcome_count: 0,
    failed_parse_outcome_count: 0,
    failed_extraction_outcome_count: 0,
  });
  assert.equal(
    JSON.stringify(adapter.getAttemptMetrics()).includes("SYNTHETIC-"),
    false,
  );
});

test("accounts for failed timeout attempts after the retry is exhausted", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client } = fakeClient(() => {
    throw Object.assign(new Error("SYNTHETIC-TIMEOUT-DETAIL"), {
      name: "APIConnectionTimeoutError",
      code: "ETIMEDOUT",
    });
  });
  const adapter = createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  });

  await assert.rejects(
    adapter.analyze("SYNTHETIC-STATEMENT-MARKER"),
    (error) => error.code === "PROVIDER_TIMEOUT",
  );
  assert.deepEqual(adapter.getAttemptMetrics(), {
    actual_api_attempt_count: 0,
    simulated_api_attempt_count: 2,
    retry_attempt_count: 1,
    transport_success_count: 0,
    transport_failure_count: 2,
    completed_response_count: 0,
    non_completed_response_count: 0,
    usable_response_count: 0,
    successful_extraction_count: 0,
    failed_outcome_count: 2,
    failed_transport_outcome_count: 2,
    failed_provider_outcome_count: 0,
    failed_parse_outcome_count: 0,
    failed_extraction_outcome_count: 0,
  });
});

test("separates transport, completion, usable output, and extraction outcomes", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client: successClient } = fakeClient(completedResponse());
  const successfulAdapter = createOpenAIAdapter({ client: successClient });
  await createExtractionService({ provider: successfulAdapter }).extract(
    "Paid 20 rupees at Sample Cafe",
  );
  assert.deepEqual(successfulAdapter.getAttemptMetrics(), {
    actual_api_attempt_count: 0,
    simulated_api_attempt_count: 1,
    retry_attempt_count: 0,
    transport_success_count: 1,
    transport_failure_count: 0,
    completed_response_count: 1,
    non_completed_response_count: 0,
    usable_response_count: 1,
    successful_extraction_count: 1,
    failed_outcome_count: 0,
    failed_transport_outcome_count: 0,
    failed_provider_outcome_count: 0,
    failed_parse_outcome_count: 0,
    failed_extraction_outcome_count: 0,
  });

  const { client: invalidClient } = fakeClient(
    completedResponse(validResult({ description: "Paid 999 rupees" })),
  );
  const invalidAdapter = createOpenAIAdapter({ client: invalidClient });
  await assert.rejects(
    createExtractionService({ provider: invalidAdapter }).extract(
      "Paid 20 rupees at Sample Cafe",
    ),
    (error) => error.code === "INVALID_MODEL_RESPONSE",
  );
  const invalidMetrics = invalidAdapter.getAttemptMetrics();
  assert.equal(invalidMetrics.transport_success_count, 1);
  assert.equal(invalidMetrics.completed_response_count, 1);
  assert.equal(invalidMetrics.usable_response_count, 1);
  assert.equal(invalidMetrics.successful_extraction_count, 0);
  assert.equal(invalidMetrics.failed_extraction_outcome_count, 1);
  assert.equal(invalidMetrics.failed_outcome_count, 1);
});

test("non-completed and unparseable responses are not successful extractions", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const cases = [
    {
      response: { status: "incomplete", output_text: "{}" },
      expected: { completed: 0, usable: 0, providerFailures: 1, parseFailures: 0 },
    },
    {
      response: { status: "completed", output_text: "{ malformed" },
      expected: { completed: 1, usable: 0, providerFailures: 0, parseFailures: 1 },
    },
  ];

  for (const { response, expected } of cases) {
    const { client } = fakeClient(response);
    const adapter = createOpenAIAdapter({ client });
    await assert.rejects(adapter.analyze("SYNTHETIC-STATEMENT"));
    const metrics = adapter.getAttemptMetrics();
    assert.equal(metrics.transport_success_count, 1);
    assert.equal(
      metrics.completed_response_count,
      expected.completed,
    );
    assert.equal(metrics.usable_response_count, expected.usable);
    assert.equal(metrics.successful_extraction_count, 0);
    assert.equal(
      metrics.failed_provider_outcome_count,
      expected.providerFailures,
    );
    assert.equal(
      metrics.failed_parse_outcome_count,
      expected.parseFailures,
    );
    assert.equal(metrics.failed_outcome_count, 1);
  }
});

test("maps timeout failures to a safe provider-timeout error", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client } = fakeClient(() => {
    throw Object.assign(new Error("SYNTHETIC-TIMEOUT-DETAIL"), {
      name: "APIConnectionTimeoutError",
      code: "ETIMEDOUT",
    });
  });

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey: "synthetic-api-key" }).analyze(
      "SYNTHETIC-STATEMENT-MARKER",
    ),
    (error) => {
      assertSafeError(error, "PROVIDER_TIMEOUT", [
        "SYNTHETIC-TIMEOUT-DETAIL",
        "SYNTHETIC-STATEMENT-MARKER",
      ]);
      return true;
    },
  );
});

test("configures a ten-second per-attempt timeout and a maximum of one retry", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client, requests } = fakeClient(completedResponse());

  await createOpenAIAdapter({
    client,
    apiKey: "synthetic-api-key",
  }).analyze("Paid 20 rupees at Sample Cafe");

  assert.equal(requests[0].options.timeout, 10_000);
});

test("stops after one retry and returns a safe error when retries are exhausted", async () => {
  const { createOpenAIAdapter } = await loadAdapter();
  const { client, requests } = fakeClient(() => {
    throw Object.assign(new Error("SYNTHETIC-RETRY-DETAIL"), { status: 503 });
  });

  await assert.rejects(
    createOpenAIAdapter({ client, apiKey: "synthetic-api-key" }).analyze(
      "SYNTHETIC-STATEMENT-MARKER",
    ),
    (error) => {
      assertSafeError(error, "PROVIDER_UNAVAILABLE", [
        "SYNTHETIC-RETRY-DETAIL",
        "SYNTHETIC-STATEMENT-MARKER",
      ]);
      return true;
    },
  );

  assert.equal(requests.length, 2);
});
