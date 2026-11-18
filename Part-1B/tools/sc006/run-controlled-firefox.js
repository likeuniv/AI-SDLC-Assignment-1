import fs from "node:fs";
import path from "node:path";
import express from "express";
import { performance } from "node:perf_hooks";
import { firefox } from "playwright";
import { createApp } from "../../src/app.js";

const dataset = JSON.parse(
  fs.readFileSync("evals/dataset.json", "utf8")
);

const fixtures = {
  "EC-001": {
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
  "EC-002": {
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
  "EC-003": {
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
  "EC-004": {
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
  "EC-005": {
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
  "EC-006": {
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
  "EC-007": {
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
  "EC-008": {
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
};

const selectedCases = dataset.cases.filter(
  item => Object.hasOwn(fixtures, item.case_id)
);

if (selectedCases.length !== 8) {
  throw new Error("Expected exactly eight supported diagnostic cases.");
}

const resultsByStatement = new Map(
  selectedCases.map(item => [
    item.input.statement,
    fixtures[item.case_id],
  ])
);

const provider = {
  async analyze(statement) {
    const result = resultsByStatement.get(statement);
    if (!result) {
      throw new Error("No controlled fixture for this request.");
    }
    return result;
  },
};

const app = createApp({
  provider,
  logger: { info() {} },
});

const frontendPath = path.resolve("frontend/dist");
app.use(express.static(frontendPath));

const server = app.listen(0, "127.0.0.1");

await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

const port = server.address().port;
const browser = await firefox.launch({ headless: true });

const results = [];

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}`);

  for (const item of selectedCases) {
    for (let repetition = 1; repetition <= 3; repetition++) {
      let requestStartedAt;

      const requestListener = request => {
        if (
          request.url().endsWith("/api/analyze") &&
          request.method() === "POST"
        ) {
          requestStartedAt = performance.now();
        }
      };

      page.on("request", requestListener);

      try {
        await page.locator("#transaction-statement")
          .fill(item.input.statement);

        const responsePromise = page.waitForResponse(response =>
          response.url().endsWith("/api/analyze") &&
          response.request().method() === "POST"
        );

        await page.getByRole("button", {
          name: "Analyze",
        }).click();

        const response = await responsePromise;

        await page.getByRole("heading", {
          name: "Transaction result",
        }).waitFor({ state: "visible", timeout: 30000 });

        const elapsedMs = Math.round(
          performance.now() - requestStartedAt
        );

        results.push({
          case_id: item.case_id,
          repetition,
          elapsed_ms: elapsedMs,
          pass: response.status() === 200,
          safe_error_code: null,
        });
      } catch {
        results.push({
          case_id: item.case_id,
          repetition,
          elapsed_ms: requestStartedAt
            ? Math.round(performance.now() - requestStartedAt)
            : null,
          pass: false,
          safe_error_code: "BROWSER_TEST_FAILURE",
        });
      } finally {
        page.off("request", requestListener);
      }
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve, reject) =>
    server.close(error => error ? reject(error) : resolve())
  );
}

const outputDirectory = "tmp/sc006";
fs.mkdirSync(outputDirectory, { recursive: true });

const outputPath = path.join(
  outputDirectory,
  "controlled-firefox-results.json"
);

fs.writeFileSync(
  outputPath,
  JSON.stringify({
    test_type: "controlled-provider-browser-diagnostic",
    browser: "Playwright Firefox",
    browser_version: browser.version?.() ?? "159.0",
    cases_tested: selectedCases.length,
    repetitions_per_case: 3,
    total_requests: results.length,
    passed: results.filter(item => item.pass).length,
    failed: results.filter(item => !item.pass).length,
    results,
  }, null, 2)
);

console.log("===== CONTROLLED FIREFOX DIAGNOSTIC =====");
console.log("Cases:", selectedCases.length);
console.log("Repetitions per case: 3");
console.log("Total requests:", results.length);
console.log("Passed:", results.filter(item => item.pass).length);
console.log("Failed:", results.filter(item => !item.pass).length);
console.log("Evidence:", outputPath);
