import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";

const outputFields = [
  "amount",
  "currency",
  "category",
  "transaction_type",
  "merchant_or_person",
  "description",
  "confidence",
  "requires_clarification",
  "clarification_question",
];

const evaluationCases = [
  {
    id: "EC-001",
    statement: "Paid 20rs at tea shop",
    result: {
      amount: 20,
      currency: "INR",
      category: "FOOD",
      transaction_type: "DEBIT",
      merchant_or_person: "Tea shop",
      description: "Paid at tea shop",
      confidence: 0.94,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-002",
    statement: "20rs paid at Radha Cafe",
    result: {
      amount: 20,
      currency: "INR",
      category: "FOOD",
      transaction_type: "DEBIT",
      merchant_or_person: "Radha Cafe",
      description: "Payment at Radha Cafe",
      confidence: 0.93,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-003",
    statement: "Received 5000 from Rahul",
    result: {
      amount: 5000,
      currency: "XXX",
      category: "UNKNOWN",
      transaction_type: "CREDIT",
      merchant_or_person: "Rahul",
      description: "Received money from Rahul",
      confidence: 0.9,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-004",
    statement: "Paid 250 for Uber",
    result: {
      amount: 250,
      currency: "XXX",
      category: "TRANSPORTATION",
      transaction_type: "DEBIT",
      merchant_or_person: "Uber",
      description: "Paid for Uber",
      confidence: 0.91,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-005",
    statement: "Amazon refunded 1200 rupees",
    result: {
      amount: 1200,
      currency: "INR",
      category: "REFUND",
      transaction_type: "CREDIT",
      merchant_or_person: "Amazon",
      description: "Amazon refund",
      confidence: 0.95,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-006",
    statement: "Salary credited 50000 rupees",
    result: {
      amount: 50000,
      currency: "INR",
      category: "SALARY",
      transaction_type: "CREDIT",
      merchant_or_person: null,
      description: "Salary credited",
      confidence: 0.96,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-007",
    statement: "Paid USD 12 at a cafe",
    result: {
      amount: 12,
      currency: "USD",
      category: "FOOD",
      transaction_type: "DEBIT",
      merchant_or_person: null,
      description: "Cafe payment in USD",
      confidence: 0.92,
      requires_clarification: false,
      clarification_question: null,
    },
  },
  {
    id: "EC-008",
    statement: "Paid 73 for a specialty service",
    result: {
      amount: 73,
      currency: "XXX",
      category: "UNKNOWN",
      transaction_type: "DEBIT",
      merchant_or_person: null,
      description: "Payment for a specialty service",
      confidence: 0.78,
      requires_clarification: false,
      clarification_question: null,
    },
  },
];

function createRecordingLogger() {
  const entries = [];
  return {
    entries,
    info(entry) {
      entries.push(entry);
    },
  };
}

function createFakeProvider(resultsByStatement, { error } = {}) {
  const calls = [];
  return {
    calls,
    provider: {
      async analyze(statement) {
        calls.push(statement);
        if (error) {
          throw error;
        }
        return resultsByStatement.get(statement);
      },
    },
  };
}

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    await run(server.address().port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function postJson(port, body, rawBody) {
  const serializedBody = rawBody ?? JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: "/api/analyze",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(serializedBody),
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            contentType: response.headers["content-type"],
            body: responseBody,
          }),
        );
      },
    );

    request.once("error", reject);
    request.end(serializedBody);
  });
}

function expectSafeError(response, { status, code, secretMarkers = [] }) {
  assert.equal(response.status, status);
  assert.match(response.contentType ?? "", /^application\/json\b/u);

  const payload = JSON.parse(response.body);
  assert.deepEqual(Object.keys(payload), ["error"]);
  assert.deepEqual(Object.keys(payload.error).sort(), ["code", "message"]);
  assert.equal(payload.error.code, code);
  assert.equal(typeof payload.error.message, "string");
  assert.ok(payload.error.message.trim().length > 0);

  for (const marker of secretMarkers) {
    assert.equal(response.body.includes(marker), false);
  }
}

test("POST /api/analyze returns the exact nine-field response for EC-001 through EC-008", async (t) => {
  const resultsByStatement = new Map(
    evaluationCases.map(({ statement, result }) => [statement, result]),
  );
  const { calls, provider } = createFakeProvider(resultsByStatement);
  const logger = createRecordingLogger();
  const app = createApp({ provider, logger });

  await withServer(app, async (port) => {
    for (const { id, statement, result } of evaluationCases) {
      await t.test(id, async () => {
        const response = await postJson(port, { statement });

        assert.equal(response.status, 200);
        assert.match(response.contentType ?? "", /^application\/json\b/u);

        const payload = JSON.parse(response.body);
        assert.deepEqual(Object.keys(payload).sort(), [...outputFields].sort());
        assert.deepEqual(payload, result);
        assert.deepEqual(calls, evaluationCases.slice(0, calls.length).map((item) => item.statement));
      });
    }
  });

  assert.deepEqual(
    calls,
    evaluationCases.map(({ statement }) => statement),
  );
  assert.equal(
    logger.entries.some((entry) =>
      evaluationCases.some(({ statement }) => entry.includes(statement)),
    ),
    false,
  );
  const parsedLogEntries = logger.entries.map((entry) => JSON.parse(entry));
  const allowedLogFields = new Set([
    "event",
    "method",
    "status",
    "duration_ms",
    "error_code",
  ]);
  assert.equal(
    parsedLogEntries.some((entry) =>
      Object.keys(entry).some((field) => !allowedLogFields.has(field)),
    ),
    false,
  );
  assert.equal(
    parsedLogEntries.some((entry) =>
      evaluationCases.some(({ result }) =>
        Object.values(result)
          .filter((value) => typeof value === "string")
          .some((value) => Object.values(entry).includes(value)),
      ),
    ),
    false,
  );
});

test("valid request has the exact one-property request contract and is analyzed once", async () => {
  const sample = evaluationCases[0];
  const { calls, provider } = createFakeProvider(
    new Map([[sample.statement, sample.result]]),
  );
  const app = createApp({ provider, logger: createRecordingLogger() });

  await withServer(app, async (port) => {
    const response = await postJson(port, { statement: sample.statement });
    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), sample.result);
  });

  assert.deepEqual(calls, [sample.statement]);
});

test("missing, empty, whitespace-only, and non-string statements are rejected safely", async () => {
  const { calls, provider } = createFakeProvider(new Map());
  const app = createApp({ provider, logger: createRecordingLogger() });

  await withServer(app, async (port) => {
    for (const body of [
      {},
      { statement: "" },
      { statement: " \t\n " },
      { statement: 20 },
      { statement: null },
    ]) {
      const response = await postJson(port, body);
      expectSafeError(response, {
        status: 400,
        code: "INVALID_REQUEST",
      });
    }

    const extraProperty = await postJson(port, {
      statement: "Paid 20rs at tea shop",
      extra: "unexpected",
    });
    expectSafeError(extraProperty, {
      status: 400,
      code: "INVALID_REQUEST",
    });
  });

  assert.deepEqual(calls, []);
});

test("malformed JSON receives a safe error and never calls the provider", async () => {
  const { calls, provider } = createFakeProvider(new Map());
  const logger = createRecordingLogger();
  const app = createApp({ provider, logger });
  const marker = "SYNTHETIC-MALFORMED-BODY-MARKER";

  await withServer(app, async (port) => {
    const response = await postJson(port, undefined, `{"statement":"${marker}"`);
    expectSafeError(response, {
      status: 400,
      code: "INVALID_REQUEST",
      secretMarkers: [marker],
    });
  });

  assert.deepEqual(calls, []);
  assert.equal(logger.entries.join("\n").includes(marker), false);
});

test("identified provider unavailability returns a safe 503 without leaking provider or transaction content", async () => {
  const statementMarker = "SYNTHETIC-PRIVATE-STATEMENT-MARKER";
  const responseMarker = "SYNTHETIC-RAW-PROVIDER-RESPONSE-MARKER";
  const exceptionMarker = "SYNTHETIC-RAW-PROVIDER-EXCEPTION-MARKER";
  const { calls, provider } = createFakeProvider(new Map(), {
    error: Object.assign(
      new Error(`${exceptionMarker}: ${responseMarker}`),
      { code: "PROVIDER_UNAVAILABLE" },
    ),
  });
  const logger = createRecordingLogger();
  const app = createApp({ provider, logger });

  await withServer(app, async (port) => {
    const response = await postJson(port, {
      statement: statementMarker,
    });

    expectSafeError(response, {
      status: 503,
      code: "PROVIDER_UNAVAILABLE",
      secretMarkers: [statementMarker, responseMarker, exceptionMarker],
    });
  });

  assert.deepEqual(calls, [statementMarker]);
  const logText = logger.entries.join("\n");
  for (const marker of [statementMarker, responseMarker, exceptionMarker]) {
    assert.equal(logText.includes(marker), false);
  }
});

test("unexpected provider errors return a safe 500 without leaking exception or transaction content", async () => {
  const statementMarker = "SYNTHETIC-INTERNAL-STATEMENT-MARKER";
  const exceptionMarker = "SYNTHETIC-RAW-INTERNAL-EXCEPTION-MARKER";
  const { calls, provider } = createFakeProvider(new Map(), {
    error: new Error(exceptionMarker),
  });
  const logger = createRecordingLogger();
  const app = createApp({ provider, logger });

  await withServer(app, async (port) => {
    const response = await postJson(port, {
      statement: statementMarker,
    });

    expectSafeError(response, {
      status: 500,
      code: "INTERNAL_ERROR",
      secretMarkers: [statementMarker, exceptionMarker],
    });
  });

  assert.deepEqual(calls, [statementMarker]);
  const logText = logger.entries.join("\n");
  assert.equal(logText.includes(statementMarker), false);
  assert.equal(logText.includes(exceptionMarker), false);
});
