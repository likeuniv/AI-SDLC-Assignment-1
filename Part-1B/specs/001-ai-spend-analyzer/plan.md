# Implementation Plan: AI Spend Analyzer

**Branch**: `001-ai-spend-analyzer` (identifier; no branch hook configured) | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Approved AI Spend Analyzer specification and constitution; user-selected
implementation stack and evaluation requirements.

## Summary

Deliver a minimal, stateless transaction extraction web application. A React/Vite client
sends one statement to a Node.js 24/Express backend. OpenAI is the sole AI provider; the
initial model setting is `gpt-6-luna`, as successfully tested by the user and subject to
continued API availability. The backend uses the official `openai` Node.js SDK through one
isolated adapter, requests strict Structured Outputs against the canonical schema, normalizes
the response to the approved nine-field contract, then applies shared Ajv validation and
deterministic invariants. The evaluation harness runs the same 21 synthetic cases with this
provider under unchanged gates and thresholds.

## Technical Context

**Language/Version**: JavaScript ES modules; Node.js 24; React JSX

**Primary Dependencies**: React, Vite, Express, Ajv with a custom ISO 4217 format validator,
the official OpenAI `openai` Node.js SDK, Vitest, and React Testing Library

**Storage**: No runtime transaction storage. Retain only synthetic case IDs, check outcomes,
aggregate measurements, and safe error codes in evidence; do not retain raw inputs or
generated transaction details.

**Testing**: Node.js built-in `node:test` for `src/` and `.harness/`; Vitest and React Testing
Library for `frontend/`; unit, integration, frontend, adversarial, and evaluation tests under
`tests/`. Routes use a fake provider for deterministic tests; live-provider measurements are
explicit, recorded protocols and are not represented as automated unit tests.

**Target Platform**: Modern browser client and Node.js 24 server

**Project Type**: Small web application with a Node/Express service in root `src/`, React
frontend in `frontend/`, prompt assets in `prompts/`, evaluation dataset in `evals/`, and
evaluation harness modules in `.harness/`

**Performance Goals**: Meet SC-006: at least 95% of representative requests with the provider
available display a result or safe failure within 30 seconds. No throughput target is set.

**Constraints**: One transaction per request; exact nine-field success contract in
`contracts/output-schema.json`; ISO 4217 alpha currency or `XXX`; descriptions at most 20
whitespace-delimited words and 160 characters; no transaction persistence or content logging;
`OPENAI_API_KEY` and `OPENAI_MODEL` server-side only; OpenAI is the sole provider; initial
model `gpt-6-luna` requires an availability check before implementation; provider request
logic is isolated in one adapter; schema and invariants are provider-independent; 21 synthetic
cases; fixed thresholds; harness records are metadata-only; provider latency and retention
remain risks.

**Scale/Scope**: Individual working-professional assignment; one user action and one
transaction per request; no accounts, history, dashboards, financial calculations, or
integrations beyond the external AI provider

## Constitution Check

*GATE: Initial review before Phase 0 research; repeat after Phase 1 design.*

| Constitution requirement | Initial gate | Design gate |
| --- | --- | --- |
| Scope stays one statement and excludes persistence, history, calculations, accounts, integrations, dates, and dashboards | PASS: explicit scope and UI boundaries | PASS: one route and no history/state store in design |
| React/Vite, Node 24/Express, external AI, Ajv, separated responsibilities | PASS: user-selected | PASS: frontend, backend, shared contract, provider adapter, and evaluator are distinct |
| Untrusted input, no tools/actions, exact validation, deterministic invariants | PASS: specified | PASS: isolated prompt builder, provider least privilege, Ajv then invariant gate |
| No credentials or transaction details in logs; no runtime retention | PASS: required | PASS: stateless route; exact metadata-only harness log fields; evidence contains synthetic IDs/outcomes only |
| At least 15 evaluation cases, independent layers, fixed thresholds, genuine repair | PASS: spec defines 21 cases and thresholds | PASS: harness modules and repair cycle preserve gates and findings |
| Feedforward before generation and evidence preservation | PASS: planned as a prerequisite to code | PASS: `feedforward.md` and evidence manifest workflow defined |
| Maintainable assignment-scale architecture and documentation | PASS: bounded scope | PASS: no independently deployed microservices or unnecessary infrastructure |

**Initial gate result**: PASS. No unresolved technical-context clarification blocks Phase 0.

**Privacy/evidence contract**: Runtime user statements and generated transaction details are
never persisted or logged. The retained harness log and evaluation results contain only
synthetic case IDs, check IDs, pass/fail outcomes, durations, safe error codes, and necessary
repair-history metadata, plus prescribed pseudonymous identifiers/outcomes for the usability
study. Evidence contains no raw input, actual generated transaction details, API keys, or
secrets.

## Project Structure

```text
AI-SDLC-Part-1B/
├── .github/
├── .specify/
├── specs/
│   └── 001-ai-spend-analyzer/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       ├── research.md
│       ├── data-model.md
│       ├── quickstart.md
│       ├── feedforward.md
│       └── contracts/
│           ├── http-api.yaml
│           └── output-schema.json
├── src/
│   ├── server.js
│   ├── app.js
│   ├── routes/
│   │   └── analyze.js
│   ├── services/
│   │   └── extraction-service.js
│   ├── ai/
│   │   └── openai-adapter.js
│   ├── errors/
│   │   └── safe-errors.js
│   ├── iso4217-format.js
│   ├── prompt-builder.js
│   └── transaction-invariants.js
├── frontend/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── components/
│           ├── TransactionForm.jsx
│           └── ResultPanel.jsx
├── prompts/
│   └── transaction-extraction.md
├── feedforward/
│   └── generation-contract.md
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── frontend/
│   ├── adversarial/
│   └── evaluation/
├── evals/
│   └── dataset.json
├── .harness/
│   ├── config.json
│   ├── schema-validator.js
│   ├── invariant-checker.js
│   ├── semantic-evaluator.js
│   ├── sensor.js
│   └── harness-runner.js
├── evidence/
│   ├── initial-generation/
│   ├── final-generation/
│   ├── eval-results.json
│   └── harness-log.md
├── .env.example
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
└── README.md
```

**Structure Decision**: Preserve the approved root `src/`, `frontend/`, `prompts/`,
`feedforward/`, `tests/`, `evals/`, `.harness/`, and `evidence/` directories. Keep the 21-case
dataset at `evals/dataset.json`, evaluation tests under `tests/evaluation/`, and harness
modules under `.harness/`. The sole canonical transaction schema is
`specs/001-ai-spend-analyzer/contracts/output-schema.json`, referenced by
`contracts/http-api.yaml` and consumed by the service and evaluator. OpenAI is the sole
provider, isolated in `src/ai/openai-adapter.js` and invoked by the extraction service.
The adapter derives the provider's strict Structured Outputs schema from the canonical file;
it must not create a separately maintained schema. The full canonical schema remains the
local validation authority because its custom ISO format, length constraints, and conditional
rules require local checks beyond OpenAI's supported schema subset. Provider request logic
can be replaced there later if genuinely necessary without changing frontend, schema, or
evaluator contracts. Retain evaluation results in `evidence/eval-results.json` and execution
and repair history in `evidence/harness-log.md`; preserve generation artifacts under
`evidence/initial-generation/` and `evidence/final-generation/`. None may contain raw inputs,
actual generated transaction details, API keys, or secrets.

## Architecture and Data Flow

1. The frontend accepts one statement, disables duplicate submission while pending, and
  keeps only the current result in memory for display.
2. The frontend posts `{ "statement": "..." }` to `POST /api/analyze` through the local
  development proxy or same-origin deployment path.
3. Express validates request shape and non-empty content, then calls the extraction service.
  It does not write request/response bodies to logs or persistent storage.
4. `src/ai/openai-adapter.js` is the sole provider integration. It reads `OPENAI_API_KEY` and
  `OPENAI_MODEL` from the backend environment, uses the Responses API with strict Structured
  Outputs, and owns OpenAI-specific request/prompt formatting and response parsing. Derive a
  provider-compatible strict schema projection from `contracts/output-schema.json`; do not
  maintain another full schema. Preserve the required nine properties, supported types,
  enums, and `additionalProperties: false`; enforce unsupported keywords (including custom
  formats, length bounds, and conditional rules) with the unchanged local canonical schema
  and deterministic invariants. Configure a 10-second per-attempt timeout and at most one
  retry for retryable rate-limit, connection, timeout, and server errors. Map refusals,
  incomplete/invalid responses, and exhausted retries to safe errors. Do not enable tools or
  external actions. Confirm `gpt-6-luna` remains available to the account before live use; if
  unavailable, fail safely rather than switching models silently.
5. The adapter returns a candidate normalized to the approved nine-field contract. The shared
  extraction service applies full Ajv validation against
  `specs/001-ai-spend-analyzer/contracts/output-schema.json` with the active ISO 4217 format,
  then runs deterministic invariants including the 20-word description limit. Invalid output
  becomes a sanitized error, never a partial success.
6. Express returns either a schema-valid extraction/clarification response or a separate
  safe error envelope. The frontend renders the result, clarification question, or error.
7. The evaluation harness in `.harness/` runs all 21 unchanged synthetic cases from
  `evals/dataset.json` against OpenAI
  through structural, behavioral, and semantic checks and computes the aggregate and gates
  PASS/FAIL. `evidence/eval-results.json` records synthetic case IDs, check IDs, outcomes,
  durations, safe error codes, and aggregate results. `evidence/harness-log.md` records
  execution and repair history using those same content-free identifiers and outcomes.
  Initial and final generation artifacts remain under their respective evidence directories.
  A failed run can trigger at most two bounded coding-agent repair cycles; the same cases and
  thresholds are rerun unchanged.

The data model and state boundaries are detailed in [data-model.md](data-model.md); the
canonical output schema is [contracts/output-schema.json](contracts/output-schema.json) and
the API/error contract is [contracts/http-api.yaml](contracts/http-api.yaml).

## Implementation Work Packages and Traceability

The following work packages establish the implementation sequence. `/speckit-tasks` must
expand them into atomic tasks while preserving these requirement and acceptance links.

| Order | Work package | Depends on | Requirement and acceptance coverage |
| --- | --- | --- | --- |
| WP-0 | Finalize feedforward instructions, repository scripts, and test boundaries before code generation | None | FR-016; AC-010 |
| WP-1 | Canonical output schema, request/response contract, Ajv validation, and deterministic invariants | WP-0 | FR-002, FR-003, FR-004, FR-005, FR-009; AC-002, AC-003, AC-004; EC-001 through EC-011, EC-019, EC-021 |
| WP-2 | Stateless Express route, isolated OpenAI adapter, Structured Outputs, safe errors, bounded retries/timeouts, and adapter/route tests | WP-1 and verified OpenAI API availability for `gpt-6-luna` | FR-001, FR-006, FR-007, FR-008, FR-009, FR-010, FR-012, FR-013; AC-001, AC-004, AC-005, AC-006, AC-007, AC-008; EC-009 through EC-020 |
| WP-3 | Minimal React form, loading/result/clarification/error states, and UI tests | WP-1, WP-2 contract | FR-001, FR-011; AC-001, AC-011, AC-012 |
| WP-4 | 21-case dataset, sensor, independent evaluators, aggregate gates, bounded feedback and re-evaluation | WP-1, WP-2 | FR-014, FR-015; AC-006, AC-007, AC-008, AC-009; EC-001 through EC-021 |
| WP-5 | User/maintainer documentation, privacy review, full quickstart, human acceptance and residual-risk record | WP-2 to WP-4 | FR-013, FR-015, FR-016; AC-008, AC-009, AC-010, AC-011, AC-012; SC-001 to SC-007 |

## Measurement Protocols

SC-005 and SC-006 use the exact manual and live measurement protocols in `spec.md`. The
10-participant usability study and 63-request live latency run are planned but NOT RUN; no
result may be recorded as completed until measurements are actually performed. Evidence
records only participant pseudonymous ID or synthetic case ID, timings, outcomes, and
safe error codes, never transaction text or generated transaction details.

## Security, Privacy, and External Risks

| Risk | Mitigation / decision |
| --- | --- |
| Prompt injection or fabricated details | Separate trusted instructions and user content; no tools; schema plus invariant checks; adversarial synthetic cases; do not claim universal immunity |
| Provider retention or training | Select provider only after reviewing retention, training, deletion, region, and contract terms; disclose residual provider policy; never send credentials or unrelated data |
| Provider coupling or changing the approved provider | Isolate all OpenAI request logic in `src/ai/openai-adapter.js`; keep the frontend, canonical schema, deterministic invariants, and evaluator contracts independent of SDK details |
| Secret exposure in browser or repository | Load credentials only in the backend process; use an untracked backend `.env` and sanitized `.env.example`; never use a `VITE_` secret |
| Sensitive content in logs/errors | `evidence/eval-results.json` and `evidence/harness-log.md` allow only synthetic case IDs, check IDs, pass/fail outcomes, durations, safe error codes, and necessary repair-history metadata. Never retain inputs, actual generated transaction details, prompts, credentials, or raw provider exceptions |
| Malformed or schema-valid but inconsistent model output | Ajv validation followed by independent deterministic invariant checks; reject rather than coerce, strip, or silently default invalid output |
| Evidence requirement mistaken for transaction persistence | Runtime user data and generated details are never retained. Harness evidence contains only synthetic IDs, aggregate/check outcomes, safe errors, durations, and necessary repair-history metadata |
| External latency, cost, or availability | Enforce a bounded provider timeout and safe failure; test using a fake provider; evaluate SC-006 only with provider availability declared |
| Small fixed dataset overstates coverage | Report results only for the 21 synthetic cases and document residual risks; do not generalize measured resistance beyond evaluated inputs |

## Constitution Check After Design

| Gate | Result | Evidence |
| --- | --- | --- |
| Scope and simplicity | PASS | One screen and one request path; no account, history, storage, calculation, or unrelated integration |
| Separation and contract validation | PASS | Frontend, backend, AI adapter, shared schema/invariants, and evaluation harness have distinct responsibilities |
| AI trust and security | PASS | Prompt boundary, least privilege, schema validation, independent invariants, safe failure, and adversarial tests are specified |
| Privacy | PASS | Runtime data is ephemeral; no transaction-content logs; evidence includes synthetic cases only and is separate from application logs |
| Evaluation and bounded feedback | PASS | 21 cases; independent layers; fixed individual and aggregate thresholds; at most two repair cycles; unchanged re-evaluation |
| Documentation and workflow | PASS | Feedforward prerequisite, quickstart, provider privacy disclosure, human review, and limitations are planned |
| Canonical schema, ISO currency, description limits, measurement protocols | PASS | OpenAPI references `contracts/output-schema.json`; Ajv format checks ISO 4217/XXX; invariant checks 20 words; SC-005/006 protocols are specified and not marked performed |

**Post-design gate result**: PASS. No conflict with the approved constitution or specification
was found. OpenAI is the sole provider. Confirm the user-tested `gpt-6-luna` model remains
available to the account and recheck pricing and retention terms before integration or live
evaluation.

## Complexity Tracking

No constitution violations. The four named responsibility areas are required by the approved
architecture and remain one small repository, not independently deployed services.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
