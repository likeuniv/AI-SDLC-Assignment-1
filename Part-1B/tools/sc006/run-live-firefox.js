import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { firefox } from "playwright";
import { createApp } from "../../src/app.js";

const DATASET_PATH = path.resolve("evals/dataset.json");
const OUTPUT_PATH = path.resolve("tmp/sc006/live-firefox-results.json");
const TIMEOUT_MS = 30_000;
const REPETITIONS = 3;

function readDataset() {
  const parsed = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"));
  const cases = Array.isArray(parsed)
    ? parsed
    : parsed.cases ?? parsed.dataset;

  if (!Array.isArray(cases)) {
    throw new Error("Dataset format not recognized.");
  }
  return cases;
}

function safeCode(body) {
  return body?.error?.code ?? body?.code ?? null;
}

function isProviderUnavailable(code) {
  return ["PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT"].includes(code);
}

function waitForServer(server) {
  return new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

const cases = readDataset();
const statementCases = cases.filter(
  (item) =>
    item.input?.type === "statement" ||
    item.input?.type === "independent_statement",
);

if (statementCases.length !== 15) {
  throw new Error(
    `Expected 15 eligible statement scenarios; found ${statementCases.length}. No live requests sent.`,
  );
}

if (process.env.OPENAI_MODEL !== "gpt-6-luna") {
  throw new Error("OPENAI_MODEL must be gpt-6-luna. No live requests sent.");
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not configured. No live requests sent.");
}
if (process.env.DEBUG_MODEL_RESPONSE === "true") {
  throw new Error("Disable DEBUG_MODEL_RESPONSE before testing.");
}

const app = createApp({ logger: console });
app.use(express.static(path.resolve("frontend/dist")));

const server = app.listen(0, "127.0.0.1");
await waitForServer(server);

const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

let browser;
const records = [];
let runValid = true;
let invalidationReason = null;
let preflightPassed = false;

async function submitStatement(page, statement) {
  const input = page.locator("#transaction-statement");
  const button = page.getByRole("button", { name: "Analyze" });

  let requestStartedAt = null;

  const onRequest = (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/analyze"
    ) {
      requestStartedAt = Date.now();
    }
  };

  page.on("request", onRequest);

  try {
    await input.fill(statement);
    await button.click();

    const response = await page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        new URL(candidate.url()).pathname === "/api/analyze",
      { timeout: TIMEOUT_MS },
    );

    let code = null;
    if (!response.ok()) {
      try {
        code = safeCode(await response.json());
      } catch {
        code = "SAFE_ERROR_RESPONSE_UNREADABLE";
      }
    }

    const elapsedBeforeRender = Date.now() - (requestStartedAt ?? Date.now());
    const remaining = Math.max(1, TIMEOUT_MS - elapsedBeforeRender);

    await page.locator(".result-card, [role='alert']").first().waitFor({
      state: "visible",
      timeout: remaining,
    });

    return {
      visible: true,
      elapsed_ms: Date.now() - (requestStartedAt ?? Date.now()),
      safe_error_code: code,
      http_status: response.status(),
    };
  } catch {
    let visible = false;
    try {
      await page.locator(".result-card, [role='alert']").first().waitFor({
        state: "visible",
        timeout: 1_000,
      });
      visible = true;
    } catch {
      // No visible result or safe failure.
    }

    return {
      visible,
      elapsed_ms: requestStartedAt
        ? Date.now() - requestStartedAt
        : TIMEOUT_MS,
      safe_error_code: visible ? "CONNECTION_ERROR" : "TIMEOUT",
      http_status: null,
    };
  } finally {
    page.off("request", onRequest);
  }
}

function saveEvidence(browserVersion) {
  const elapsed = records.map((record) => record.elapsed_ms);
  const sorted = [...elapsed].sort((a, b) => a - b);
  const successes = records.filter((record) => record.pass).length;

  const evidence = {
    test_type: "partial-sc006-live-provider-browser-measurement",
    protocol_status: runValid ? "PARTIAL_MEASUREMENT" : "INVALIDATED",
    sc006_acceptance_status: "NOT ESTABLISHED",
    run_started_at: runStartedAt,
    run_completed_at: new Date().toISOString(),
    manifest: {
      provider: "OpenAI",
      model: process.env.OPENAI_MODEL,
      region: "Not declared in project configuration; provider-managed region unknown",
      node_version: process.version,
      browser: "Firefox",
      browser_version: browserVersion,
      operating_system: `${os.type()} ${os.release()} ${os.arch()}`,
      machine_class: "VirtualBox Ubuntu VM; 4 vCPUs; approximately 11 GiB RAM",
      deployment_mode: "Production Vite build served by Express",
      network_conditions: "Not independently instrumented; external provider latency included",
    },
    protocol_deviation: {
      reason: "Only real statement submissions can be measured through the live UI. Request-error, provider-fixture, and validator-boundary cases require separate controlled tests.",
      measured_scenarios: 15,
      repetitions_per_scenario: REPETITIONS,
      measured_request_target: 45,
      unmeasured_independence_setup_requests: 3,
      provider_preflight_requests: 1,
      excluded_cases: [
        "EC-012",
        "EC-013",
        "EC-014",
        "EC-015",
        "EC-019",
        "EC-021",
      ],
      full_63_request_protocol_completed: false,
    },
    preflight: {
      passed: preflightPassed,
      request_count: 1,
    },
    invalidation_reason: invalidationReason,
    summary: {
      measured_requests: records.length,
      successful_within_30_seconds: successes,
      failed_or_not_visible: records.length - successes,
      success_rate_percent: records.length
        ? Number(((successes / records.length) * 100).toFixed(2))
        : null,
      min_elapsed_ms: sorted.length ? sorted[0] : null,
      median_elapsed_ms: sorted.length
        ? sorted[Math.floor(sorted.length / 2)]
        : null,
      max_elapsed_ms: sorted.length ? sorted.at(-1) : null,
    },
    results: records,
    evidence_privacy: "Case IDs, repetition, elapsed time, pass/fail and safe error codes only. No statements or generated transaction details retained.",
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}

const runStartedAt = new Date().toISOString();

try {
  browser = await firefox.launch({ headless: true });
  const browserVersion = browser.version();
  const page = await browser.newPage();

  await page.goto(baseUrl, { waitUntil: "networkidle" });

  // Provider availability preflight: one synthetic request, not measured.
  const preflightCase = statementCases[0];
  const preflight = await submitStatement(
    page,
    preflightCase.input.statement,
  );

  if (
    !preflight.visible ||
    preflight.safe_error_code ||
    preflight.http_status !== 200
  ) {
    throw new Error(
      `Provider preflight did not produce a successful result (${preflight.safe_error_code ?? "NO_RESULT"}).`,
    );
  }

  preflightPassed = true;

  for (const item of statementCases) {
    for (let repetition = 1; repetition <= REPETITIONS; repetition += 1) {
      // EC-020 setup: submit the unrelated prior statement separately.
      // This setup request is deliberately not part of the measured count.
      if (item.input.type === "independent_statement") {
        const setup = await submitStatement(page, item.input.prior_statement);

        if (
          !setup.visible ||
          isProviderUnavailable(setup.safe_error_code)
        ) {
          runValid = false;
          invalidationReason =
            "Provider unavailable or setup result not visible during EC-020 independence setup.";
          throw new Error(invalidationReason);
        }
      }

      const result = await submitStatement(page, item.input.statement);
      const pass =
        result.visible &&
        result.elapsed_ms <= TIMEOUT_MS;

      records.push({
        case_id: item.case_id,
        repetition,
        elapsed_ms: result.elapsed_ms,
        pass,
        safe_error_code: result.safe_error_code,
      });

      if (isProviderUnavailable(result.safe_error_code)) {
        runValid = false;
        invalidationReason =
          "Provider unavailable during measured run; protocol requires a new documented run.";
        throw new Error(invalidationReason);
      }
    }
  }

  console.log("Live browser measurement completed.");
  console.log(`Measured requests: ${records.length}`);
  console.log(
    `Visible within 30 seconds: ${records.filter((r) => r.pass).length}`,
  );
  console.log(`Run validity: ${runValid ? "VALID PARTIAL RUN" : "INVALIDATED"}`);
  console.log(`Evidence: ${OUTPUT_PATH}`);
  console.log(`Firefox: ${browserVersion}`);
} catch (error) {
  runValid = false;
  invalidationReason ??= "Preflight or test execution did not complete.";
  console.log("Live measurement stopped.");
  console.log(`Reason: ${invalidationReason}`);
  console.log(`Measured requests retained: ${records.length}`);
  console.log(`Details: ${error.message}`);
} finally {
  const browserVersion = browser?.version() ?? "159.0";
  saveEvidence(browserVersion);
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
