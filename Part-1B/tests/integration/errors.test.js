import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";

const secretMarkers = [
  "SYNTHETIC-PRIVATE-STATEMENT",
  "SYNTHETIC-RAW-EXCEPTION",
  "SYNTHETIC-PROVIDER-RESPONSE",
];

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

function setupProvider(analyze) {
  const entries = [];
  const app = createApp({
    provider: { analyze },
    logger: { info: (entry) => entries.push(entry) },
  });
  return { app, entries };
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

function request(port, body, rawBody = JSON.stringify(body)) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        method: "POST",
        path: "/api/analyze",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(rawBody),
        },
      },
      (res) => {
        let response = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (response += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: response }),
        );
      },
    );
    req.once("error", reject);
    req.end(rawBody);
  });
}

async function assertSafeFailure(port, { body, rawBody, status, code }) {
  const response = await request(port, body, rawBody);
  assert.equal(response.status, status);
  const parsed = JSON.parse(response.body);
  assert.deepEqual(Object.keys(parsed), ["error"]);
  assert.deepEqual(Object.keys(parsed.error).sort(), ["code", "message"]);
  assert.equal(parsed.error.code, code);
  assert.ok(parsed.error.message.trim());
  for (const marker of secretMarkers) {
    assert.equal(response.body.includes(marker), false);
  }
}

test("returns contract-safe errors for request parsing and size failures", async () => {
  const { app, entries } = setupProvider(async () => validResult());
  await withServer(app, async (port) => {
    await assertSafeFailure(port, {
      body: { statement: " " },
      status: 400,
      code: "INVALID_REQUEST",
    });
    await assertSafeFailure(port, {
      rawBody: `{"statement":"${secretMarkers[0]}"`,
      status: 400,
      code: "INVALID_REQUEST",
    });
    await assertSafeFailure(port, {
      rawBody: JSON.stringify({ statement: "x".repeat(17_000) }),
      status: 413,
      code: "REQUEST_TOO_LARGE",
    });
  });
  assert.equal(entries.join("\n").includes(secretMarkers[0]), false);
});

test("rejects multiple transactions without returning a transaction result", async () => {
  const statement = "Paid 20 at a cafe and received 50 from a person";
  const { app, entries } = setupProvider(async () => validResult());

  await withServer(app, async (port) => {
    await assertSafeFailure(port, {
      body: { statement },
      status: 422,
      code: "MULTIPLE_TRANSACTIONS",
    });
  });
  assert.equal(entries.join("\n").includes(statement), false);
});

test("preflights the coordinated Swiggy and Uber statement without calling the provider", async () => {
  const statement =
    "Paid ₹250 for lunch at Swiggy and ₹150 for an Uber ride.";
  let providerCalls = 0;
  const { app, entries } = setupProvider(async () => {
    providerCalls += 1;
    return validResult();
  });

  await withServer(app, async (port) => {
    await assertSafeFailure(port, {
      body: { statement },
      status: 422,
      code: "MULTIPLE_TRANSACTIONS",
    });
  });

  assert.equal(providerCalls, 0);
  assert.equal(entries.join("\n").includes(statement), false);
});

test("rejects malformed and schema-invalid provider outputs safely", async () => {
  for (const analyze of [
    async () => "SYNTHETIC-PROVIDER-RESPONSE",
    async () => validResult({ category: "NOT_APPROVED" }),
  ]) {
    const { app, entries } = setupProvider(analyze);
    await withServer(app, async (port) => {
      await assertSafeFailure(port, {
        body: { statement: secretMarkers[0] },
        status: 502,
        code: "INVALID_MODEL_RESPONSE",
      });
    });
    assert.equal(entries.join("\n").includes(secretMarkers[0]), false);
    assert.equal(entries.join("\n").includes(secretMarkers[2]), false);
  }
});

test("invariant diagnostics do not change the public safe error shape", async () => {
  const { app, entries } = setupProvider(async () =>
    validResult({ amount: 999 }),
  );
  await withServer(app, async (port) => {
    await assertSafeFailure(port, {
      body: { statement: "Paid 20 rupees at Sample Cafe" },
      status: 502,
      code: "INVALID_MODEL_RESPONSE",
    });
  });
  assert.equal(entries.join("\n").includes("UNSUPPORTED_TRANSACTION_AMOUNT"), false);
});

test("maps provider outages and timeouts without exposing raw exceptions", async () => {
  for (const [code, status] of [
    ["PROVIDER_UNAVAILABLE", 503],
    ["PROVIDER_TIMEOUT", 504],
  ]) {
    const error = new Error(
      `${secretMarkers[1]} ${secretMarkers[2]} ${secretMarkers[0]}`,
    );
    error.code = code;
    const { app, entries } = setupProvider(async () => {
      throw error;
    });

    await withServer(app, async (port) => {
      await assertSafeFailure(port, {
        body: { statement: secretMarkers[0] },
        status,
        code,
      });
    });
    assert.equal(entries.join("\n").includes(secretMarkers.join(" ")), false);
    for (const marker of secretMarkers) {
      assert.equal(entries.join("\n").includes(marker), false);
    }
  }
});
