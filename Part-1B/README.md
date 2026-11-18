# AI Spend Analyzer

## 1. Project overview

AI Spend Analyzer is a minimal, stateless application for extracting structured information
from one natural-language transaction statement. It was developed for the BITS Pilani M.Tech
AI-Augmented SDLC assignment, Part 1B.

## 2. Problem statement

Informal transaction statements do not consistently identify amount, currency, category,
direction, and merchant or person. The application returns a validated structured result
when the statement supports one, and asks for clarification instead of filling essential
gaps with guesses.

## 3. Project objectives

- Accept one transaction statement per request.
- Return only the approved nine-field output or a safe error.
- Keep each request independent and avoid transaction persistence or history.
- Validate model output with the canonical schema and deterministic rules.
- Evaluate the application with a fixed, synthetic 21-case dataset and independent checks.

## 4. Scope and limitations

This project does not provide accounts, transaction history, storage, totals, budgets,
dashboards, dates, bank/payment integrations, or multi-transaction extraction. It relies on
an external AI provider when used with a configured API credential. Its 21 synthetic cases
are limited coverage, not proof of broad real-world accuracy or security.

## 5. Key features

- One transaction statement input and an Analyze action.
- Loading, safe error, structured-result, and clarification states.
- A stateless `POST /api/analyze` endpoint.
- OpenAI Responses API integration using the official OpenAI Node.js SDK.
- Strict Structured Outputs followed by local schema and invariant validation.
- Metadata-only operational logs and synthetic evaluation evidence.

## 6. System architecture

The React/Vite frontend posts one statement to the Express API. The API validates the
request, calls the injected extraction service, and returns only a schema- and
invariant-validated result or a contract-defined safe error. The extraction service calls
the OpenAI adapter, which constructs trusted system instructions separately from the
untrusted statement. The adapter requests strict Structured Outputs, disables tools, and
normalizes the provider response. Ajv and deterministic transaction invariants validate
the candidate before it is returned.

The backend owns all provider credentials. Requests are not accumulated into conversation
history, and the application has no transaction database or persistence layer.

## 7. Technology stack

- Node.js 24 (validated here with v24.22.2) and npm.
- Express 5, Ajv, and the official `openai` Node.js SDK.
- React 19 and Vite.
- Node's built-in `node:test` runner, Vitest, and React Testing Library.

The exact dependency ranges are recorded in the root and frontend `package.json` files.

## 8. Project directory structure

```text
src/                         Express app, API route, AI adapter, service, validation
frontend/                    React/Vite application and Vite configuration
prompts/                     Trusted extraction instructions
feedforward/                 Generation contract
specs/001-ai-spend-analyzer/  Specification, plan, tasks, data model, API and output contracts
tests/                       Unit, integration, frontend, adversarial and harness tests
evals/dataset.json            Synthetic EC-001 through EC-021 dataset
.harness/                    Evaluators, runner, fixed configuration and log helpers
evidence/initial-generation/  Initial test-generation evidence
evidence/final-generation/    Final validation and test evidence
evidence/runs/<run_id>/       Immutable per-run results and harness log
evidence/eval-results.json    Historical model-evaluation result
evidence/harness-log.md       Historical content-free run record
```

## 9. Prerequisites

- Node.js `>=24 <25` and npm.
- An OpenAI API account/project with access to the configured model before making a live
  request. Model availability and account eligibility must be checked at use time.
- A modern browser for the frontend.

Automated tests use fake providers and do not require a live API key.

## 10. Installation

From the repository root:

```sh
npm ci
npm --prefix frontend ci
```

## 11. Environment configuration

The backend reads `OPENAI_API_KEY`; the evaluation model is authoritatively configured as
`gpt-6-luna` in `.harness/config.json`. If `OPENAI_MODEL` is set, it must exactly match that
model; an unexpected override is rejected before a provider request, with no silent model
fallback. Copy `.env.example` to a local `.env`, add the credential using a private editor,
and never print, share, or commit the credential. `.env` is ignored by Git.

Node does not automatically load `.env` for this project. To start the backend with the
local file, use Node's environment-file option:

```sh
node --env-file=.env src/server.js
```

Alternatively, provide the variables through a protected process/IDE environment and use
`npm start`. Do not define an API key in frontend code or a `VITE_` variable. No real
credential is included in this repository or this documentation.

## 12. Start the backend

With the required variables supplied in the process environment:

```sh
npm start
```

The server listens on port 3000 by default; `PORT` may be set for a different local port.
For local `.env` loading, use the command in section 11.

## 13. Start the frontend

In another terminal:

```sh
npm --prefix frontend run dev
```

Vite's development proxy forwards `/api` requests to `http://localhost:3000`.

## 14. Run automated tests

Run the complete root Node test suite:

```sh
npm test
```

Frontend tests live under repository-root `tests/frontend/`, outside Vitest's default
`frontend/` root. Use this command from the repository root so the test files are actually
discovered:

```sh
./frontend/node_modules/.bin/vitest run --root . --config frontend/vite.config.js tests/frontend
```

`npm --prefix frontend test` alone currently reports no test files; it is not the validated
command for this test layout.

## 15. Build the frontend

```sh
npm --prefix frontend run build
```

This produces the production bundle under `frontend/dist/`.

## 16. API endpoint and examples

`POST /api/analyze` accepts exactly one non-empty `statement` property:

```json
{"statement":"Paid 20rs at tea shop"}
```

A successful response uses the exact output shape described below. An illustrative
synthetic response is:

```json
{
  "amount": 20,
  "currency": "INR",
  "category": "FOOD",
  "transaction_type": "DEBIT",
  "merchant_or_person": "tea shop",
  "description": "Paid at tea shop",
  "confidence": 0.9,
  "requires_clarification": false,
  "clarification_question": null
}
```

This is a contract example, not a result of a live model evaluation. Safe request/provider
errors follow the statuses and error codes in
[the HTTP API contract](specs/001-ai-spend-analyzer/contracts/http-api.yaml).

## 17. Canonical nine-field output contract

The sole canonical schema is
[output-schema.json](specs/001-ai-spend-analyzer/contracts/output-schema.json). It requires,
and rejects additional properties beyond:

1. `amount`
2. `currency`
3. `category`
4. `transaction_type`
5. `merchant_or_person`
6. `description`
7. `confidence`
8. `requires_clarification`
9. `clarification_question`

The successful extraction and clarification responses both conform to this shape. Errors
use a separate safe-error contract.

## 18. Categories and transaction directions

Permitted categories: `FOOD`, `TRANSPORTATION`, `SHOPPING`, `GROCERIES`, `HEALTHCARE`,
`BILLS`, `ENTERTAINMENT`, `SALARY`, `TRANSFER`, `REFUND`, `OTHER`, and `UNKNOWN`.

Permitted directions: `CREDIT`, `DEBIT`, and `UNKNOWN`. A refund is `CREDIT` only where
supported by the statement. Unsupported values are not inferred merely to complete a
record.

## 19. Currency handling

The backend recognizes its pinned Node.js `Intl`/ICU-derived active currency snapshot and
uses `XXX` when currency cannot be established. INR is inferred only when context supports
it. `XXX` is a sentinel, not a claimed transaction currency.

**Registry qualification:** The project has not established that its Node.js v24.22.2 / ICU
78.3 snapshot is equivalent to a specific SIX ISO 4217 List One revision. The recorded SIX
List One XML revision (`Pblshd=2026-09-17`, verified 2026-11-11) does not exactly match the
156-code implementation set: the comparison notes SVC, XCG, and VED in List One but absent
from the implementation set, and ANG in the implementation set but absent from List One.
BGN, CUC, HRK, SLL, and ZWL are excluded from the implementation snapshot and absent from
that List One revision. The policy question—what active-code subset the assignment intends,
especially for fund/special-purpose codes—remains unresolved. No codes or expected labels
were changed for this documentation milestone. See `.harness/config.json` for the
recorded comparison.

## 20. Description constraints

Descriptions must use supported facts only, contain no more than 20 whitespace-delimited
words, and be no longer than 160 Unicode characters. Word counting trims the description
and splits on one or more Unicode whitespace characters; punctuation remains attached and
hyphenated compounds count as one word.

## 21. OpenAI Responses API integration

The only configured provider is OpenAI, through the official OpenAI Node.js SDK and the
Responses API. The adapter pins the approved `gpt-6-luna` model, uses a 10-second timeout
per attempt, allows at most one retry, and requests `store: false`. An unexpected
`OPENAI_MODEL` override is rejected before a request. It does not select a fallback
provider or model. Automated tests inject a fake provider/client; they do not call OpenAI.

## 22. Structured Outputs and schema projection

The OpenAI-compatible strict Structured Outputs schema is projected from the canonical
`output-schema.json`; it is not a second hand-maintained full schema. Provider output is
normalized to the nine canonical fields and then fully validated locally with Ajv,
currency validation, and deterministic transaction invariants. The local validation
remains authoritative.

## 23. Prompt-injection protections

Trusted system instructions are separate from the user's untrusted statement. The prompt
instructs the model to ignore embedded rule changes, secret-disclosure requests, tool
requests, and attempts to bypass validation. The Responses request sets `tools: []`, and
local validation still applies. These controls reduce risk but do not guarantee immunity
from all prompt-injection or model failures; adversarial coverage is limited to the
synthetic cases and tests in this repository.

## 24. Safe error handling

The backend maps malformed requests, oversized requests, multiple transactions, provider
unavailability, provider timeouts, unusable model output, and unexpected internal failures
to the contract-defined safe errors. Raw exception/provider details are not returned.
Clients receive a safe message and code, not internal diagnostics.

## 25. Privacy and metadata-only logging

The application has no database, transaction history, or application-level persistence
layer. Operational request logs allow only metadata such as method, status, duration, and
safe error code; harness logs and retained evidence use synthetic case/check identifiers
and outcome metadata. Tests check that statements, extracted details, provider responses,
and exception details are not retained in logs/evidence.

`store: false` is a Responses API request setting; it is not a guarantee of zero provider
retention. Provider abuse-monitoring, processing, training, deletion, regional, and
retention terms must be checked against current official documentation and the applicable
account configuration before using real transaction information. The project makes no
independent promise about provider-side retention.

## 26. Evaluation dataset and methodology

`evals/dataset.json` contains the 21 synthetic cases EC-001 through EC-021, including clear
transactions, clarifications, request/provider errors, multi-transaction input, prompt
injection, independence, and validator boundaries. Structural, behavioral, adversarial, and
semantic evaluations are reported separately; adversarial outcomes are not copied from the
behavioral layer. The dataset and its labels are synthetic acceptance fixtures, not results
or evidence of live model accuracy.

The harness can use deterministic fixtures/fake providers for automated tests. A mocked
run validates harness behavior only. An actual model evaluation requires a separately
authorized run against all unchanged cases and the configured model; it must not be
represented by mocked outcomes. The live CLI prints the effective model, case count,
expected logical calls, retry and repair limits, and maximum estimated API attempts, then
requires interactive confirmation before making requests. Token usage and monetary cost
are reported as `UNKNOWN`; no unverified pricing or token estimate is used. Current request
accounting distinguishes logical provider calls from API attempts, retries, successes, and
failures. The dataset expects 16 logical provider calls (including EC-020's two independent
requests); the maximum estimate is 96 attempts if all two repair cycles and one retry per
call are used. A repair uses only allowlisted failed-check identifiers and safe diagnostic
codes; the transaction remains untrusted input, previous model output is not included, and
an unchanged failure is not retried. From the repository root, start the harness with
`node .harness/harness-runner.js`; a non-interactive run or missing credential is recorded as
NOT RUN without making an API request.

## 27. Scoring formula and hard gates

The configured aggregate score is:

```text
0.40 × structural + 0.40 × behavioral + 0.20 × semantic
```

The thresholds are structural 100%, behavioral 100%, adversarial 100%, semantic at least
85%, and aggregate at least 97%. All thresholds are independent gates and are not lowered
to obtain a pass. At most two repair/re-evaluation cycles are configured, with the same
case set and thresholds.

## 28. Evidence and evaluation reports

- `evidence/initial-generation/` retains initial test outcomes, including red-test runs.
  Transaction-bearing failure diagnostics in two logs were redacted after capture and
  labeled; the test outcomes and failure reasons remain visible.
- `evidence/final-generation/` retains final test/build logs and milestone validation
  records.
- Each evaluation writes its result and content-free harness log to a new
  `evidence/runs/<run_id>/` directory. Existing run directories are never overwritten.
- The flat `evidence/eval-results.json` and `evidence/harness-log.md` files are historical
  records; live evaluations do not replace them.

Six live OpenAI evaluation runs against the unchanged 21-case dataset are preserved
for `gpt-6-luna`. Five recorded runs failed the fixed acceptance gates. The latest
successful recorded run, `4121428a-9a61-4cdb-9699-9c3b1184b522`, **PASS**ed with
structural 100%, behavioral 100%, adversarial 100%, semantic 85.7143%, and aggregate
97.1429%. These meet the unchanged thresholds of 100%, 100%, 100%, at least 85%,
and at least 97%, respectively. Earlier failed runs remain preserved and must not be
misrepresented as passing runs. This result applies to the recorded evaluation run and
does not establish broad real-world model accuracy or comprehensive security assurance.
Instrumentation limitations identified in earlier runs remain documented in the
supplemental T041 validation record.

## 29. SC-005 first-use usability protocol

Status: **NOT RUN**. The project has no genuine participant measurements.

1. Recruit 10 participants who have not previously used the application; provide no
   training beyond the visible interface.
2. Give each one synthetic first-use scenario from EC-001 through EC-011. The task is to
   submit the statement and correctly identify the extraction or requested clarification.
3. Start timing when the scenario is shown; stop when the participant identifies the result
   or clarification. Do not assist during the timed attempt.
4. A success requires correct completion without assistance within 60 seconds. The
   criterion passes only at 9 successes out of 10 or more.
5. Record a pseudonymous participant ID, synthetic case ID, start/end times, elapsed
   seconds, success/failure, assistance, and observed usability issue. Do not record
   participant names, raw transaction data, or unnecessary personal information.

No participant IDs, outcomes, times, or success counts are asserted in this repository.

## 30. SC-006 live latency protocol

Status: **PARTIAL MEASUREMENT — NOT ESTABLISHED**. A partial live browser measurement
was completed and is documented in
[`evidence/sc006/SC-006-Partial-Live-Measurement-Report.md`](evidence/sc006/SC-006-Partial-Live-Measurement-Report.md),
with machine-readable results in
[`evidence/sc006/live-firefox-results.json`](evidence/sc006/live-firefox-results.json).

1. Use the configured provider/model and declared region. Record provider, model/version,
   region, Node.js and browser versions, operating system, machine class, deployment mode,
   and network conditions in a run manifest.
2. Run all 21 unchanged synthetic cases three times each (63 measured requests) against the
   production-built application in the documented reference environment; confirm provider
   availability before measurement.
3. Start timing when the browser submits `POST /api/analyze`; stop when the structured
   result or safe failure is visible. Include browser-to-server, provider, validation,
   response, and rendering time.
4. A request succeeds for this metric if a result or safe failure is visible within 30
   seconds. SC-006 passes only if at least `ceil(0.95 × 63) = 60` requests succeed.
   Provider-unavailable periods invalidate the run and require a new documented run, not
   selective case removal.
5. Retain only case ID, repetition, elapsed time, pass/fail, and safe error code; never
   retain request text or generated transaction details.

The partial run measured 15 eligible scenarios three times each (45 measured requests).
All 45 displayed a structured result or safe failure within 30 seconds. Observed latency
was 1,390 ms minimum, 2,067 ms median, and 5,839 ms maximum. The provider preflight
passed. The original protocol requires all 21 cases repeated three times (63 measured
requests), with at least 60 successes. Six cases requiring controlled request-error,
provider-fixture, or validator-boundary testing were not included in the live UI run.
Therefore, the full protocol was not completed and SC-006 acceptance remains
**NOT ESTABLISHED**. The original acceptance requirement and threshold are unchanged.

## 31. Current acceptance, limitations, and residual risks

This status is evidence-based and distinguishes automated checks from empirical acceptance:

| Area | Current status |
|---|---|
| Core extraction, clarification, safe errors | Implemented; root automated tests pass |
| Root Node test suite | 173/173 passed (`npm test`; 14 November 2026) |
| Frontend tests | 25/25 passed using the explicit repository-root Vitest command |
| Frontend production build | Passed |
| Harness implementation | Covered by root evaluation, evidence, and adversarial tests; no standalone `.harness/` test files |
| Backend startup without provider credentials | Passed on local port 3100; no analysis request or provider call |
| Node.js syntax and JSON integrity | Passed |
| Source, bundle, logging, and retained-evidence privacy checks | Passed within the documented review scope |
| SC-001 exact nine-field live conformance | PASS; latest live structural score 100% |
| SC-002 fixed live evaluation thresholds | PASS; latest successful recorded run aggregate 97.1429%, structural 100%, behavioral 100%, adversarial 100%, semantic 85.7143% |
| SC-003 privacy | PASS for automated tests and reviewed artifacts; not a full penetration/provider-retention audit |
| SC-004 multiple-transaction rejection and request independence | PASS |
| SC-005 usability study | NOT RUN; 10 first-time participants required |
| SC-006 live latency study | PARTIAL MEASUREMENT; 45/45 visible within 30 seconds; formal acceptance NOT ESTABLISHED because 63 requests are required |
| SC-007 prompt-injection acceptance | Latest evaluation adversarial score 100%; retain the limitation that 21 cases do not establish comprehensive security assurance |
| Human acceptance decision | Not recorded |
| Currency-list equivalence | Unresolved; see section 19 |

Known limitations and residual risks: five of the six preserved live evaluation runs
failed the fixed gates, although the latest successful recorded run met all evaluation
thresholds; 21 synthetic cases do not establish comprehensive real-world robustness or
availability; prompt-injection defenses are not a guarantee; provider-side data controls
require current official verification; the currency registry policy mismatch remains
unresolved; SC-005 usability acceptance remains NOT RUN; and SC-006 latency acceptance
remains NOT ESTABLISHED because only a partial 45-request measurement was completed.

Official OpenAI references to check before deployment:

- [API pricing](https://developers.openai.com/api/docs/pricing)
- [Model documentation](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Data controls](https://developers.openai.com/api/docs/guides/your-data)

No numeric price, model availability guarantee, or provider-retention guarantee is made by
this README; check the cited sources and account terms at the time of use.

## 32. Future enhancements

Any future work must first be approved through the project specification and must preserve
the one-request/one-transaction, no-history scope unless that specification is formally
amended. Possible future work includes completing the required empirical acceptance
protocols and resolving the currency-registry policy question; no such work is claimed
complete here.

## 33. Standalone Sensor CLI

The standalone sensor evaluates an AI extraction result independently of the
full 21-case evaluation harness. It supports dataset-based and custom evaluation.

### 33.1 Dataset-based evaluation

Provide a dataset case ID and a JSON file containing the actual extraction result.

Example:

    npm run sensor -- --case EC-001 --input output.json

### 33.2 Custom statement evaluation

Provide the transaction statement, actual extraction output, and expected result.

    npm run sensor -- --statement "Paid 20rs at tea shop" --input output.json --expected expected.json

### 33.3 Input JSON format

The input file must contain the canonical nine-field transaction object.
For example:

    {
      "amount": 20,
      "currency": "INR",
      "category": "FOOD",
      "transaction_type": "DEBIT",
      "merchant_or_person": "tea shop",
      "description": "Paid 20 INR at a tea shop.",
      "confidence": 0.95,
      "requires_clarification": false,
      "clarification_question": null
    }

### 33.4 Generate actual AI output

To generate an extraction result using the configured OpenAI model, ensure
the project `.env` file contains the required API configuration.

Run the following command:

    node --env-file=.env --input-type=module <<'NODE'
    import fs from "node:fs";
    import { createOpenAIAdapter } from "./src/ai/openai-adapter.js";

    const provider = createOpenAIAdapter();
    const result = await provider.analyze("Paid 20rs at tea shop");

    fs.writeFileSync("output.json", JSON.stringify(result, null, 2) + "\n");
    console.log("AI output saved to output.json");
    NODE

Then evaluate the generated output:

    npm run sensor -- --case EC-001 --input output.json

Note: Live AI extraction makes an external API request. Evaluating an existing
JSON file with the standalone sensor does not require an API call.

### 33.5 Evaluation dimensions

The sensor reports the following dimensions:

- Structural: validates the output structure and schema.
- Behavioral: checks expected application behavior.
- Semantic: evaluates the meaning of the extracted transaction.
- Adversarial: evaluates adversarial requirements when applicable.
- Overall: displays the final evaluation result.

### 33.6 Exit codes

| Exit code | Meaning |
|---|---|
| 0 | Evaluation passed |
| 1 | Evaluation failed |
| 2 | Invalid CLI arguments or usage error |

