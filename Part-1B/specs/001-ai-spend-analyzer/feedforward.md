# Feedforward Instructions: AI Spend Analyzer

**Status**: Required before any application source generation.

## Project Contract

- Treat [spec.md](spec.md) and [plan.md](plan.md) as the approved functional and architectural
  constraints; report conflicts before coding.
- Accept exactly one natural-language transaction per request. Do not add accounts, history,
  storage, calculations, integrations, date extraction, or extra screens.
- A successful extraction or clarification contains exactly the nine fields in
  [contracts/output-schema.json](contracts/output-schema.json); the OpenAPI contract MUST
  reference this schema rather than maintain a second full schema. Error envelopes are
  separate and must not expose input, output, credentials, prompts, or raw provider errors.
- Use React/Vite, Node.js 24/Express in root `src/`, OpenAI as the sole provider through the
  official `openai` Node.js SDK, provider instructions in `prompts/`, and Ajv. Keep the 21
  synthetic cases in `evals/dataset.json`, evaluation modules under `.harness/`, and tests in
  `tests/unit/`, `tests/integration/`, `tests/frontend/`, `tests/adversarial/`, and
  `tests/evaluation/`. Implement exactly one provider adapter in
  `src/ai/openai-adapter.js`; keep it isolated so a future change is possible without
  introducing a second provider now.
- Read `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-6-luna` from the backend `.env` only. The model
  was successfully tested by the user, but its API availability MUST be confirmed before
  live integration. Never expose the key to frontend code or commit it.
- `currency` MUST be an active ISO 4217 alphabetic code or `XXX` when currency cannot be
  established; infer INR only when context supports it. Descriptions MUST be no more than
  20 words under the specification's Unicode-whitespace token rule and no more than 160
  characters.
- Keep each runtime request stateless. Never persist or log raw statements or generated
  transaction details. Retain evaluation results in `evidence/eval-results.json` and harness
  execution/repair history in `evidence/harness-log.md`; these may contain only synthetic case
  IDs, check IDs, pass/fail outcomes, durations, safe error codes, aggregate results, and
  necessary repair-history metadata, plus prescribed pseudonymous usability-study identifiers
  and outcomes. Preserve generation artifacts under `evidence/initial-generation/` and
  `evidence/final-generation/`; no evidence may contain raw transaction statements, actual
  generated transaction details, API keys, or secrets.

## Coding Standards

- Use JavaScript ES modules, focused modules, descriptive identifiers, and the existing
  project structure. Avoid speculative abstractions and unnecessary dependencies.
- Keep prompt construction separate from extraction/application logic. Keep provider SDK
  details inside one adapter.
- Keep the sole canonical output schema in `contracts/output-schema.json`. Validate ISO
  currency with the registered `iso-4217-currency` format and apply the 160-character schema
  limit. Do not coerce values, add defaults, strip unexpected properties, or mutate invalid
  model output before evaluation.
- Use OpenAI Responses API Structured Outputs in strict JSON Schema mode. Derive a
  provider-compatible projection from `contracts/output-schema.json`; do not maintain a
  second handwritten schema or edit the canonical schema. Apply full canonical Ajv validation
  and deterministic invariants to every response.
- Validate every OpenAI adapter result with Ajv and then with deterministic invariants before
  returning it. The invariant checker MUST enforce the 20-word description limit using the
  specified trimmed Unicode-whitespace tokenization rule.
- The OpenAI adapter MUST normalize its response to the nine-field candidate; the shared
  extraction service MUST run the canonical schema and deterministic invariants before any
  result is returned. OpenAI prompt serialization, errors, timeouts, rate limits, and response
  parsing belong inside `src/ai/openai-adapter.js`.
- Load credentials only in the backend process from `.env`. `.env.example` contains names
  and blank placeholders for `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-6-luna`; never place
  secrets in frontend config or commit real keys.
- Keep OpenAI-specific Responses API formatting and prompt serialization in
  `src/ai/openai-adapter.js`. Configure a 10-second per-attempt timeout and at most one retry
  for retryable errors; safely map refusals, incomplete outputs, API failures, rate limits,
  exhausted retries, and invalid responses. Do not enable tools or external actions.
- Use fake providers for deterministic tests. Real-provider checks are opt-in and must use
  synthetic statements.
- Add focused tests with each slice. Keep errors generic and harness/evaluation evidence
  allowlisted;
  do not log bodies, provider responses, extracted values, or raw exceptions.

## Harness Rules

- Keep the 21 case IDs, expected labels, and scoring thresholds fixed during an evaluation
  run. Do not delete difficult cases, disable checks, or lower thresholds to obtain PASS.
- Evaluate the OpenAI adapter with all 21 unchanged cases and scoring gates. Do not claim
  results until the harness has actually run.
- Run structural, behavioral/guardrail, and semantic checks independently. The semantic
  score cannot override a structural, behavioral, or adversarial failure.
- Aggregate score is `0.40 × structural + 0.40 × behavioral + 0.20 × semantic`; PASS also
  requires 100% structural, 100% behavioral, 100% adversarial, at least 85% semantic, and at
  least 97% aggregate.
- The sensor reports all independent findings. Repair feedback names the synthetic case ID
  and failed check ID without raw input or generated transaction details. The
  `evidence/eval-results.json` and `evidence/harness-log.md` record only synthetic case IDs,
  check IDs, pass/fail outcomes, durations, safe error codes, aggregate results, necessary
  repair-history metadata, and prescribed pseudonymous usability-study identifiers/outcomes.
  Preserve initial and final generation artifacts in their respective evidence directories.
  Permit at most two coding-agent repair cycles per run; rerun
  unchanged cases and thresholds after each cycle and stop with FAIL if any gate remains unmet.
- Preserve initial and final generation artifacts in their respective evidence directories;
  retain findings and results in `evidence/eval-results.json`, and feedback, repair attempts,
  human acceptance/rejection, and limitations in `evidence/harness-log.md`, as defined in
  [data-model.md](data-model.md). Do not put transaction content in these records.

## Bounded Generation Tasks

Generate and review one slice at a time in this order; do not start a later slice while its
dependency or focused tests are failing:

1. Repository scripts, environment example, canonical schema contract, request/response
  reference, ISO currency validator, Ajv validation, and deterministic invariant checks.
2. Stateless Express route in `src/`, safe error mapping, isolated OpenAI adapter using
  `openai`, prompt builder using `prompts/`, bounded timeout/retry behavior, fake-client unit
  tests, route integration tests, and privacy checks. Verify `gpt-6-luna` availability first.
3. Minimal React input, loading, result, clarification, and error states with UI tests.
4. Twenty-one-case dataset in `evals/dataset.json` and single pipeline under `.harness/`:
  sensor, independent evaluators, aggregate gates, feedback package, bounded repair
  orchestration, evaluation tests under `tests/evaluation/`, and content-free results and
  execution/repair history under `evidence/`.
5. Documentation, quickstart validation, full tests/build, human review, and residual-risk
   record.

Manual SC-005 and live SC-006 protocols are measurement procedures, not automated tests.
Keep their status NOT RUN until actual participants/requests have been measured; never
fabricate results.

For each generation task, state its permitted files, linked FR/AC IDs, expected behavior,
tests to run, and out-of-scope changes. Review the diff and focused test result before
proceeding. This file is the feedforward contract; implementation tasks will be enumerated
separately by `/speckit-tasks`.