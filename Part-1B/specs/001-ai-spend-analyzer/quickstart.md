# Quickstart: AI Spend Analyzer

This guide is the end-to-end validation plan for the implementation. It does not claim that
the application or evaluation has already been run.

## Prerequisites

- Node.js 24 and npm.
- An OpenAI API credential and account access to the user-tested `gpt-6-luna` model, after
   reviewing OpenAI's retention, training, deletion, and availability terms.
- OpenAI Responses API Structured Outputs support for strict JSON Schema. Confirm
   `gpt-6-luna` remains available to the account before enabling live provider calls.

Do not use a real transaction in test or evaluation runs. Use the synthetic statements in the
feature specification.

## Configure and Start

1. Install root and frontend dependencies and create a local environment file from the
   sanitized root `.env.example`. Set the provider credential and model identifier in the
   Node service environment only; never use a frontend-prefixed environment variable for a
   secret.
   OpenAI backend configuration:

   ```dotenv
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-6-luna
   ```

   If `gpt-6-luna` is unavailable, stop and request a model decision; do not silently select a
   different provider or model.
2. Start the Node/Express service from the project root. If using the local `.env`,
   run `node --env-file=.env src/server.js`; otherwise provide the protected environment
   variables and run `npm start`.
3. In a second terminal, run `npm --prefix frontend run dev` from the project root.
4. Open the local Vite URL. The development proxy routes `/api` requests to
   `http://localhost:3000` by default.

Exact package scripts and provider-specific variable names are implementation outputs; they
must be documented in the project-root `README.md` and `.env.example` without real
credentials.

## Validate the User Flow

1. Submit `Paid 20rs at tea shop`. Expect a structured result with amount 20, INR, FOOD,
   DEBIT, Tea shop, confidence within `[0, 1]`, and no clarification.
2. Submit `Paid 500`. Expect a contract-valid clarification asking what the payment was for.
3. Submit an injection-only statement requesting secret disclosure. Expect no disclosure,
   no provider action, and a safe rejection or clarification.
4. Simulate an unavailable provider and malformed model output using the fake provider.
   Expect a safe error, no model response shown as a successful result, and no content in
   logs.
5. Submit the multi-transaction fixture. Expect rejection or clarification, never multiple
   extracted records.

For request and response schemas, error codes, and status classes, see
[contracts/http-api.yaml](contracts/http-api.yaml). The sole canonical result schema is
[contracts/output-schema.json](contracts/output-schema.json). For entity lifetimes and
processing states, see [data-model.md](data-model.md).

## Run Automated Checks

- From the project root, run `npm test` for the Node `node:test` suites under `tests/`.
- Frontend tests live in repository-root `tests/frontend/`. Run
  `./frontend/node_modules/.bin/vitest run --root . --config frontend/vite.config.js tests/frontend`.
  The default `npm --prefix frontend test` command does not discover these repository-root tests.
- From the repository root, run `.harness/harness-runner.js` against all 21 synthetic cases
  in `evals/dataset.json`.
- Run all 21 cases against OpenAI `gpt-6-luna` with the unchanged thresholds. Do not report
   results until the evaluation has actually run.
- Run a production build of the frontend and Node service checks before human acceptance.

Expected evaluation: structural, behavioral, and adversarial gates meet their 100% targets;
semantic exact-match accuracy is at least 85%; aggregate is at least 97%; each independent
gate must pass. These are targets, not results. The harness must exit with a failure status
if any gate is unmet.

## Review Evidence and Privacy

Inspect initial and final generation artifacts under `evidence/initial-generation/` and
`evidence/final-generation/`. Each evaluation writes immutable results and execution/repair
history to its own `evidence/runs/<run_id>/` directory. The flat files
`evidence/eval-results.json` and `evidence/harness-log.md` are historical records and are
not replaced by later runs. Retained
evaluation evidence may contain synthetic case IDs, check IDs, pass/fail outcomes, durations,
safe error codes, aggregate results, prescribed pseudonymous usability-study identifiers and
outcomes, and necessary repair-history metadata; it must not contain raw inputs, actual
generated transaction details, API keys, or secrets. Confirm that no runtime database,
history, browser persistence, transaction-content logging, prompt logging, or credential
logging exists before accepting the feature.

## Manual and Live Measurement

The measurement protocols for SC-005 and SC-006 are defined in the feature specification.
They are planned procedures, not completed tests. The usability protocol requires 10
first-time participants; the latency protocol uses 21 synthetic cases repeated three times
each (63 requests) with OpenAI `gpt-6-luna` in a recorded reference environment.
Do not mark either protocol complete or report results until the measurements have actually
been performed. Retain only the prescribed IDs, timings, outcomes, and safe error codes.