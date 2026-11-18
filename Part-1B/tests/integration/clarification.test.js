import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { buildPrompt } from "../../src/prompt-builder.js";

function clarificationResult(overrides = {}) {
  return {
    amount: null,
    currency: "XXX",
    category: "UNKNOWN",
    transaction_type: "UNKNOWN",
    merchant_or_person: null,
    description: "Transaction details are incomplete",
    confidence: 0.55,
    requires_clarification: true,
    clarification_question: "Could you provide more detail?",
    ...overrides,
  };
}

function recordingProvider(resultsByStatement) {
  const calls = [];
  return {
    calls,
    provider: {
      async analyze(statement) {
        calls.push(statement);
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

function postStatement(port, statement) {
  const body = JSON.stringify({ statement });
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: "/api/analyze",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
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
            body: JSON.parse(responseBody),
          }),
        );
      },
    );
    request.once("error", reject);
    request.end(body);
  });
}

const clarificationCases = [
  {
    id: "EC-009",
    statement: "Paid at tea shop",
    result: clarificationResult({
      amount: null,
      currency: "XXX",
      category: "FOOD",
      transaction_type: "DEBIT",
      merchant_or_person: "tea shop",
      description: "Payment at tea shop",
      clarification_question: "What amount did you pay?",
    }),
  },
  {
    id: "EC-010",
    statement: "Paid 500",
    result: clarificationResult({
      amount: 500,
      currency: "XXX",
      category: "UNKNOWN",
      transaction_type: "DEBIT",
      description: "Payment purpose is unclear",
      clarification_question: "What was the payment for?",
    }),
  },
  {
    id: "EC-011",
    statement: "500 with Maya",
    result: clarificationResult({
      amount: 500,
      currency: "XXX",
      category: "UNKNOWN",
      transaction_type: "UNKNOWN",
      merchant_or_person: "Maya",
      description: "Transaction with Maya",
      clarification_question: "Was 500 paid to Maya or received from Maya?",
    }),
  },
];

test("clarification prompt rules stay trusted and separate from the current statement", () => {
  const statement = "SYNTHETIC-CURRENT-STATEMENT";
  const prompt = buildPrompt(statement);

  assert.equal(prompt.user, statement);
  assert.equal(prompt.system.includes(statement), false);
  assert.match(prompt.system, /when the amount is missing, use null/i);
  assert.match(prompt.system, /set category to UNKNOWN/i);
  assert.match(prompt.system, /when direction is unclear, use UNKNOWN/i);
  assert.match(prompt.system, /directly address the missing essential information/i);
  assert.match(prompt.system, /never use information from any previous request/i);
});

test("EC-009 through EC-011 return contract-valid, non-fabricated clarification results", async (t) => {
  const resultsByStatement = new Map(
    clarificationCases.map(({ statement, result }) => [statement, result]),
  );
  const { calls, provider } = recordingProvider(resultsByStatement);
  const app = createApp({ provider, logger: { info() {} } });

  await withServer(app, async (port) => {
    for (const { id, statement, result } of clarificationCases) {
      await t.test(id, async () => {
        const response = await postStatement(port, statement);

        assert.equal(response.status, 200);
        assert.deepEqual(response.body, result);
        assert.equal(response.body.requires_clarification, true);
        assert.equal(typeof response.body.clarification_question, "string");
        assert.notEqual(response.body.clarification_question.trim(), "");
        assert.equal(response.body.currency, "XXX");
        assert.deepEqual(Object.keys(response.body).sort(), [
          "amount",
          "category",
          "clarification_question",
          "confidence",
          "currency",
          "description",
          "merchant_or_person",
          "requires_clarification",
          "transaction_type",
        ]);
      });
    }
  });

  assert.deepEqual(
    calls,
    clarificationCases.map(({ statement }) => statement),
  );
});

test("rejects a clarification question unrelated to the missing essential information", async () => {
  const statement = "Paid at tea shop";
  const result = clarificationCases[0].result;
  const { provider } = recordingProvider(
    new Map([
      [
        statement,
        {
          ...result,
          clarification_question: "What is your favorite color?",
        },
      ],
    ]),
  );
  const app = createApp({ provider, logger: { info() {} } });

  await withServer(app, async (port) => {
    const response = await postStatement(port, statement);

    assert.equal(response.status, 502);
    assert.equal(response.body.error.code, "INVALID_MODEL_RESPONSE");
  });
});

test("EC-020 treats a corrected statement as an independent request", async () => {
  const earlierStatement = "Paid 500";
  const correctedStatement = "Paid 20 rupees at Sample Cafe";
  const firstResult = clarificationCases[1].result;
  const correctedResult = {
    amount: 20,
    currency: "INR",
    category: "FOOD",
    transaction_type: "DEBIT",
    merchant_or_person: "Sample Cafe",
    description: "Payment at Sample Cafe",
    confidence: 0.92,
    requires_clarification: false,
    clarification_question: null,
  };
  const { calls, provider } = recordingProvider(
    new Map([
      [earlierStatement, firstResult],
      [correctedStatement, correctedResult],
    ]),
  );
  const app = createApp({ provider, logger: { info() {} } });

  await withServer(app, async (port) => {
    const firstResponse = await postStatement(port, earlierStatement);
    const correctedResponse = await postStatement(port, correctedStatement);

    assert.equal(firstResponse.status, 200);
    assert.equal(correctedResponse.status, 200);
    assert.deepEqual(correctedResponse.body, correctedResult);
    assert.deepEqual(calls, [earlierStatement, correctedStatement]);
    assert.equal(
      JSON.stringify(calls[1]).includes(JSON.stringify(firstResult)),
      false,
    );
    assert.equal(calls[1].includes(earlierStatement), false);
  });
});

test("prompt distinguishes unknown categories from missing transaction details", () => {
  const prompt = buildPrompt("Paid 73 for a specialty service");

  assert.match(prompt.system, /do not request clarification solely because a category is UNKNOWN/i);
  assert.match(prompt.system, /covering both the missing amount and whether money was paid or received/i);
});
