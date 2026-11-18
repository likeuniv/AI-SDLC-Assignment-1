---
description: "Task list for feature implementation"
---

# Tasks: AI Spend Analyzer

**Input**: Design documents from `specs/001-ai-spend-analyzer/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/output-schema.json`, `contracts/http-api.yaml`, `quickstart.md`, and `feedforward.md`

**Tests**: Included because the specification and request explicitly require unit,
integration, adversarial, and evaluation tests. Write each story's tests before its
implementation and confirm they fail for the intended missing behavior.

**Organization**: Tasks are grouped by the three P1 user stories from `spec.md` to support
independent implementation and verification.

## Phase 1: Setup

**Purpose**: Establish only the planned project structure and feedforward prerequisites.

- [x] T001 Establish only the approved directories from `plan.md`: `src/`, `frontend/`, `prompts/`, `feedforward/`, `tests/unit/`, `tests/integration/`, `tests/frontend/`, `tests/adversarial/`, `tests/evaluation/`, `evals/`, `.harness/`, `evidence/initial-generation/`, and `evidence/final-generation/`; leave files to their owning tasks and add no unapproved project-root directories (FR-016; AC-010).
- [x] T002 [P] Review the project contract and create `feedforward/generation-contract.md` from `specs/001-ai-spend-analyzer/feedforward.md`, preserving coding standards, harness rules, bounded file lists, and the requirement that it precede application source generation (FR-016; AC-010).
- [x] T003 [P] Initialize `frontend/package.json` with React, Vite, Vitest, React Testing Library, and minimal dev/test/build scripts; configure `frontend/vite.config.js` to proxy `/api` to the backend (FR-001, FR-011; AC-001, AC-011).
- [x] T004 [P] Review the existing root `package.json`, `package-lock.json`, `.nvmrc`, `.env.example`, and `.gitignore`; preserve Node.js 24, ES modules, and the installed official `openai` SDK, add only missing Express/Ajv dependencies and Node `--test` scripts, ensure `.env.example` has a blank `OPENAI_API_KEY=` and `OPENAI_MODEL=gpt-6-luna`, and keep credentials out of `frontend/` (FR-009, FR-010, FR-016; AC-002, AC-007, AC-010).
- [x] T005 Review the existing successful OpenAI connectivity test and confirm it verifies access to `gpt-6-luna`; repeat a targeted availability check only if that model was not tested. Document the official OpenAI model/pricing source and retention/training/deletion/region terms in root `README.md`; do not reinstall or duplicate SDK configuration (FR-016; AC-010).
- [x] T006 [P] Create `.harness/config.json` with the unchanged 40/40/20 score formula, existing per-layer thresholds, two-cycle repair cap, metadata-only log allowlist, and content-free evidence policy (FR-013 to FR-015; AC-008, AC-009).
- [x] T007 Review and record the setup milestone for root `package.json`, `.env.example`, `frontend/package.json`, `frontend/vite.config.js`, `.harness/config.json`, and `feedforward/generation-contract.md`; make no commit without explicit approval (FR-016; AC-010).

## Phase 2: Foundational

**Purpose**: Establish and test the shared output contract and deterministic rules before
any provider or user-story implementation can proceed.

- [x] T008 [P] Write failing schema and OpenAPI contract-conformance tests in `tests/unit/output-schema.test.js` for the exact nine fields, OpenAPI `$ref` resolution to `specs/001-ai-spend-analyzer/contracts/output-schema.json`, all types/enums, active ISO 4217/`XXX`, 160-character description limit, confidence bounds, and clarification consistency (FR-002 to FR-005, FR-009; AC-002, AC-003; EC-019, EC-021).
- [x] T009 [P] Write failing deterministic invariant tests in `tests/unit/transaction-invariants.test.js` for description word count (trim, split on one or more Unicode whitespace characters; punctuation attached; hyphenated compounds count as one), unsupported/fabricated values, one-transaction behavior, and clarification consistency (FR-005 to FR-009; AC-002, AC-004 to AC-006; EC-008 to EC-011, EC-016, EC-018, EC-020, EC-021).
- [x] T010 Implement the sole canonical JSON Schema in `specs/001-ai-spend-analyzer/contracts/output-schema.json` with exactly `amount`, `currency`, `category`, `transaction_type`, `merchant_or_person`, `description`, `confidence`, `requires_clarification`, and `clarification_question`; preserve these data-model constraints verbatim: `amount`: "Number must be greater than zero"; `currency`: "Active ISO 4217 alphabetic currency code; `XXX` when currency cannot be established; INR only when context supports it"; `category`: "FOOD, TRANSPORTATION, SHOPPING, GROCERIES, HEALTHCARE, BILLS, ENTERTAINMENT, SALARY, TRANSFER, REFUND, OTHER, UNKNOWN"; `transaction_type`: "CREDIT, DEBIT, UNKNOWN"; `merchant_or_person`: "Name only when supported by the statement"; `description`: "Clear, relevant explanation based only on supported facts; maximum 20 whitespace-delimited words and 160 Unicode characters"; `confidence`: "Inclusive range 0 through 1"; `requires_clarification`: "True when essential information is missing or ambiguous"; `clarification_question`: "Non-empty question iff clarification is required; otherwise null" (FR-002 to FR-005, FR-009; AC-002 to AC-004; EC-001 to EC-011, EC-019, EC-021).
- [x] T011 Implement non-mutating deterministic checks in `src/transaction-invariants.js` for clarification consistency, one-transaction safety, no fabrication, and the 20-word description limit using the exact tokenization rule in `specs/001-ai-spend-analyzer/spec.md` (FR-005 to FR-009; AC-002, AC-004 to AC-006; EC-008 to EC-011, EC-016, EC-018, EC-020, EC-021).
- [x] T012 Create Express application and server entry points in `src/app.js` and `src/server.js` with JSON-only parsing, conservative body limit, testable app construction, and operational logging that excludes request/response bodies and transaction content (FR-001, FR-010, FR-013; AC-001, AC-007, AC-008).
- [x] T013 Run the focused contract and invariant suites in `tests/unit/output-schema.test.js` and `tests/unit/transaction-invariants.test.js`, resolve failures without weakening the contract, then review and record the foundation validation milestone for the canonical schema, `src/transaction-invariants.js`, and `src/app.js`; make no commit without explicit approval (FR-002 to FR-009; AC-002 to AC-006; EC-001 to EC-011, EC-016, EC-018 to EC-021).

## Phase 3: User Story 1 - Analyze a Transaction (Priority: P1)

**Goal**: Accept one clear transaction statement and display its supported structured result.

**Independent Test**: With a fake provider, submit the clear debit, credit, refund, currency,
merchant, and person cases in EC-001 through EC-008; confirm the UI shows one validated
result and a loading state without retaining prior requests.

### Tests for User Story 1

- [x] T014 [P] [US1] Write failing route-level integration tests in `tests/integration/analyze-route.test.js` using an injected fake provider for `POST /api/analyze`, the exact request/response contract, and EC-001 through EC-008 (FR-001 to FR-005, FR-009; AC-001 to AC-003; EC-001 to EC-008).
- [x] T015 [P] [US1] Write failing frontend tests in `tests/frontend/App.test.jsx` for the AI Spend Analyzer title, one statement input, Analyze action, loading state, and structured result rendering (FR-001, FR-011; AC-001; EC-001).
- [x] T016 [P] [US1] Write failing OpenAI adapter unit tests in `tests/unit/openai-adapter.test.js` for `gpt-6-luna` configuration, strict Structured Outputs request formatting, canonical-schema projection, successful nine-field normalization, invalid JSON/schema candidate, refusal/incomplete response, API failure, rate limit, timeout, bounded retry exhaustion, and sanitized errors using synthetic statements only (FR-002, FR-008 to FR-010, FR-016; AC-002, AC-006, AC-007, AC-010; EC-014, EC-015, EC-017, EC-019).
- [x] T017 [P] [US1] Write failing extraction-service unit tests in `tests/unit/extraction-service.test.js` for valid extraction, malformed/invalid provider output, schema and invariant rejection, active ISO currency/`XXX`, and safe errors without raw input/output exposure (FR-002 to FR-006, FR-009, FR-010; AC-002 to AC-004, AC-007; EC-001 to EC-015, EC-019, EC-021).

### Implementation for User Story 1

- [x] T018 [P] [US1] After T005 confirms `gpt-6-luna` availability, use the existing official `openai` SDK dependency (add it only if absent) to implement `src/ai/openai-adapter.js` using backend `OPENAI_API_KEY` and `OPENAI_MODEL`. Use Responses API Structured Outputs in strict JSON Schema mode with a provider-compatible projection derived from `specs/001-ai-spend-analyzer/contracts/output-schema.json`; do not maintain a second handwritten schema. Preserve the canonical nine fields/types/enums, normalize candidates to that contract, configure a 10-second per-attempt timeout and at most one retry, and safely map refusals, incomplete outputs, API errors, rate limits, timeouts, and invalid responses. Do not add any other provider or switch models silently (FR-002, FR-003, FR-005, FR-008 to FR-010, FR-016; AC-002, AC-006, AC-007, AC-010; EC-014, EC-015, EC-017, EC-019, EC-021).
- [x] T019 [P] [US1] Create the shared trusted prompt asset in `prompts/transaction-extraction.md` and implement common prompt policy in `src/prompt-builder.js`; keep statement text separate, require supported facts, ISO 4217/`XXX` currency and the 20-word/160-character description limits, while `src/ai/openai-adapter.js` owns OpenAI-specific request formatting (FR-002 to FR-008; AC-002 to AC-006; EC-001 to EC-011, EC-017, EC-018, EC-021).
- [x] T020 [US1] Implement `src/iso4217-format.js` to accept active ISO 4217 alphabetic codes plus `XXX`, then implement `src/services/extraction-service.js` to register that format with Ajv, validate against `specs/001-ai-spend-analyzer/contracts/output-schema.json`, and apply `src/transaction-invariants.js` before returning a result; record the pinned registry source/revision in `.harness/config.json` and `README.md` (FR-002 to FR-006, FR-009, FR-010; AC-002 to AC-004, AC-007; EC-001 to EC-015, EC-019, EC-021).
- [x] T021 [US1] Implement `POST /api/analyze` in `src/routes/analyze.js` and register it in `src/app.js`; accept only one non-empty statement and return a validated extraction or clarification result with no transaction-content logging (FR-001 to FR-005, FR-009, FR-013; AC-001 to AC-003, AC-008; EC-001 to EC-008).
- [x] T022 [US1] Implement the minimal form and result UI in `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/components/TransactionForm.jsx`, and `frontend/src/components/ResultPanel.jsx`, keeping only the current result in memory (FR-001, FR-011, FR-012; AC-001; EC-001 to EC-008).
- [x] T023 [US1] Run `tests/unit/openai-adapter.test.js`, `tests/unit/extraction-service.test.js`, `tests/integration/analyze-route.test.js`, and `tests/frontend/App.test.jsx`; verify EC-001 through EC-008 and the independent-test criteria above, then review and record the US1 validation milestone; make no commit without explicit approval (FR-001 to FR-005, FR-009, FR-011, FR-016; AC-001 to AC-003, AC-010; EC-001 to EC-008).

## Phase 4: User Story 2 - Clarify Incomplete or Ambiguous Details (Priority: P1)

**Goal**: Ask relevant questions for missing or ambiguous essential information without
fabricating details; corrected statements are new independent requests.

**Independent Test**: Submit EC-009 through EC-011, then submit a corrected statement as a
new request; verify null/UNKNOWN values and a relevant question without prior-request context.

### Tests for User Story 2

- [x] T024 [P] [US2] Write failing clarification and request-independence tests in `tests/integration/clarification.test.js` for EC-009 through EC-011 and EC-020, including null amount, `XXX` currency when undetermined, UNKNOWN direction, missing purpose, and no previous-request dependency (FR-003, FR-005, FR-006, FR-007; AC-002, AC-004, AC-005; EC-009 to EC-011, EC-020).
- [x] T025 [P] [US2] Write failing clarification-display tests in `tests/frontend/ResultPanel.test.jsx` for consistent clarification state, non-empty question, and distinct clarification-versus-error presentation (FR-005, FR-006, FR-011; AC-001, AC-002, AC-004; EC-009 to EC-011).

### Implementation for User Story 2

- [x] T026 [US2] Extend `src/services/extraction-service.js` and `src/prompt-builder.js` to represent undetermined currency as `XXX`, use UNKNOWN/null where allowed, ask a focused question for essential omissions, and never fabricate missing details (FR-003 to FR-006; AC-002, AC-004; EC-008 to EC-011).
- [x] T027 [US2] Update `frontend/src/components/ResultPanel.jsx` and `frontend/src/App.jsx` to show clarification as a distinct result and submit corrections as fresh requests without prior text/result in model context (FR-006, FR-007, FR-011, FR-012; AC-001, AC-004, AC-005; EC-009 to EC-011, EC-020).
- [x] T028 [US2] Run `tests/integration/clarification.test.js` and `tests/frontend/ResultPanel.test.jsx`, confirm the independent-test criteria above and EC-009 through EC-011/EC-020, then review and record the US2 validation milestone; make no commit without explicit approval (FR-003, FR-005 to FR-007, FR-011, FR-012; AC-001, AC-002, AC-004, AC-005; EC-009 to EC-011, EC-020).

## Phase 5: User Story 3 - Safe Errors and Hostile Input (Priority: P1)

**Goal**: Reject malformed or multi-transaction input safely, resist prompt-injection attempts,
and demonstrate the independent evaluation gates with genuine evidence.

**Independent Test**: With a fake provider and all 21 synthetic cases, verify safe failures,
no secret disclosure, no input/output logging or persistence, independent layer findings,
fixed-threshold PASS/FAIL, bounded repair feedback, and reproducible evidence.

### Tests for User Story 3

- [x] T029 [P] [US3] Write failing safe-error tests in `tests/integration/errors.test.js` for empty/malformed requests, oversized input, multiple transactions, malformed model output, invalid schema output, provider unavailability, and timeout without echoing sensitive data (FR-007, FR-009, FR-010, FR-013; AC-005, AC-007, AC-008; EC-012 to EC-016, EC-019).
- [x] T030 [P] [US3] Write failing prompt-injection and privacy tests in `tests/adversarial/security.test.js` for injection-only EC-017, mixed legitimate/adversarial EC-018, no credential/prompt disclosure, no tools/actions, and zero transaction content in logs, evidence, or persistence (FR-008, FR-012, FR-013, FR-015; AC-006, AC-008, AC-009; EC-017, EC-018, EC-020).
- [x] T031 [P] [US3] Write failing evaluator and evidence tests in `tests/evaluation/harness.test.js` and `tests/evaluation/evidence.test.js` for all 21 cases against OpenAI `gpt-6-luna`, independent layer findings, fixed thresholds, aggregate gates, bounded repair, metadata-only evidence, and privacy protections (FR-013 to FR-015; AC-008, AC-009; EC-001 to EC-021).

### Implementation for User Story 3

- [x] T032 [US3] Implement safe error codes and user-facing messages in `src/errors/safe-errors.js` and map request, provider, timeout, parse, schema, invariant, and internal failures in `src/routes/analyze.js` without logging raw errors or transaction content (FR-010, FR-013; AC-007, AC-008; EC-012 to EC-015, EC-019).
- [x] T033 [US3] Harden `src/prompt-builder.js`, `prompts/transaction-extraction.md`, and `src/ai/openai-adapter.js` so input is untrusted, ISO 4217/`XXX` and description limits are stated, system rules cannot be overridden, tools/actions are disabled, and prompts/credentials/provider details are never returned (FR-003, FR-005, FR-008, FR-010; AC-002, AC-006, AC-007; EC-017, EC-018, EC-021).
- [x] T034 [US3] Create `evals/dataset.json` with the 21 synthetic cases EC-001 through EC-021, expected labels/error categories, tags, and FR/AC links matching `specs/001-ai-spend-analyzer/spec.md` exactly, including `XXX` and description boundaries (FR-003, FR-005, FR-014, FR-015; AC-003 to AC-009; EC-001 to EC-021).
- [x] T035 [US3] Implement structural evaluation in `.harness/schema-validator.js` using Ajv and the sole canonical `specs/001-ai-spend-analyzer/contracts/output-schema.json`; register active ISO 4217 validation and reject missing/extra fields, wrong types/enums, invalid amount/currency/description/confidence, and inconsistent clarification without mutating outputs (FR-002 to FR-005, FR-009, FR-014; AC-002, AC-009; EC-001 to EC-015, EC-019, EC-021).
- [x] T036 [US3] Implement deterministic behavioral and guardrail checks in `.harness/invariant-checker.js` by calling `src/transaction-invariants.js` and verifying one transaction, no fabrication, request independence, description word count, privacy, and safe failures (FR-005 to FR-010, FR-012 to FR-014; AC-002, AC-004 to AC-009; EC-008 to EC-021).
- [x] T037 [US3] Implement expected-label semantic scoring in `.harness/semantic-evaluator.js` for amount, currency, category, direction, merchant/person, clarification, and binary description relevance/clarity across `evals/dataset.json`; keep the semantic threshold at 85% and never override structural or behavioral failures (FR-005, FR-014; AC-002 to AC-004, AC-009; EC-001 to EC-011, EC-016, EC-018, EC-021).
- [x] T038 [US3] Implement `.harness/sensor.js` to collect separate structural, behavioral/adversarial, and semantic findings for every case without filtering difficult cases or changing expected labels (FR-014, FR-015; AC-006, AC-009; EC-001 to EC-021).
- [x] T039 [US3] Implement the single OpenAI evaluation pipeline in `.harness/harness-runner.js` to compute `0.40 × structural + 0.40 × behavioral + 0.20 × semantic`, retain existing 100% structural, 100% behavioral, 100% adversarial, at least 85% semantic, and at least 97% aggregate thresholds, report PASS/FAIL for the configured OpenAI model run, and provide genuine findings for at most two repair/re-evaluation cycles with unchanged cases and thresholds (FR-014, FR-015; AC-006, AC-009; EC-001 to EC-021).
- [x] T040 [US3] Write evaluation results to `evidence/eval-results.json` and harness execution/repair history to `evidence/harness-log.md`, configured by `.harness/config.json`; retain only synthetic case IDs, check IDs, pass/fail outcomes, durations, safe error codes, aggregate results, and necessary repair-history metadata, never raw inputs, actual generated transaction details, API keys, or secrets (FR-013 to FR-015; AC-008, AC-009; EC-001 to EC-021).
- [x] T041 [US3] Run `tests/integration/errors.test.js`, `tests/adversarial/security.test.js`, `tests/evaluation/harness.test.js`, and `tests/evaluation/evidence.test.js`, execute the same 21 cases through `.harness/harness-runner.js`, verify the independent-test criteria above, and review and record the US3 validation milestone without weakening thresholds; make no commit without explicit approval (FR-008 to FR-015; AC-006 to AC-009; EC-001 to EC-021).

## Phase 6: Polish and Cross-Cutting Concerns

**Purpose**: Complete documentation, verify the full acceptance surface, record human review,
and leave the repository at a reviewable milestone.

- [x] T042 Complete root `README.md` with architecture, install/run steps, OpenAI `openai` SDK configuration (`OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6-luna`), model availability/pricing and retention terms, ISO currency/`XXX`, description constraints, output schema, Structured Outputs schema projection, evaluation methodology and thresholds, metadata-only logs, and privacy/security limitations (FR-003, FR-005, FR-013, FR-016; AC-002, AC-008 to AC-010).
- [ ] T043 Perform—not automate as a unit test—the SC-005 manual study with 10 first-time participants and the SC-006 live latency run of 63 requests (21 synthetic cases × 3) using OpenAI `gpt-6-luna` and the exact protocols in `specs/001-ai-spend-analyzer/spec.md`; record only prescribed pseudonymous/synthetic IDs, timings, outcomes, and safe error codes in `evidence/eval-results.json` and `evidence/harness-log.md`, and leave status NOT RUN until actually measured (FR-011, FR-014, FR-015; AC-001, AC-009, AC-011, AC-012; EC-001 to EC-011, EC-012, EC-015).
- [ ] T044 Record human acceptance or rejection and known limitations/residual risks in `evidence/harness-log.md`, including provider retention and the limits of 21-case adversarial coverage; do not include transaction text, actual generated transaction details, API keys, or secrets (FR-015, FR-016; AC-009, AC-010; EC-001 to EC-021).
- [x] T045 Run complete suites under `tests/`, `frontend/`, and `.harness/`, production checks, and the quickstart at `specs/001-ai-spend-analyzer/quickstart.md`; verify SC-001 through SC-007 and perform a final scan for transaction content or secrets in `evidence/` (FR-001 to FR-016; AC-001 to AC-012; EC-001 to EC-021).
- [x] T046 Review and record the final validation milestone for root `README.md`, `evidence/initial-generation/`, `evidence/final-generation/`, `evidence/eval-results.json`, `evidence/harness-log.md`, and validated implementation files, retaining failing check outcomes without lowering thresholds; make no commit without explicit approval (FR-014 to FR-016; AC-009, AC-010; EC-001 to EC-021).

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 establishes the approved directory layout; T002-T007 reconcile
  the existing root package/environment setup, review OpenAI model availability, and establish
  the feedforward contract. T004 preserves the already installed OpenAI SDK and updates only
  missing dependencies/scripts; T005 reviews the existing connectivity test and repeats a
  model check only if needed. T018 depends on confirming `gpt-6-luna` availability in T005. No
  application source implementation starts before T002 is reviewed.
- **Foundational (Phase 2)**: T008-T013 establish the schema, invariants, and Express app
  shell. All user-story work depends on the foundation validation milestone T013.
- **User Story 1 (Phase 3)**: T014-T023 implement the primary extraction journey after
  Phase 2.
- **User Story 2 (Phase 4)**: T024-T028 build on the US1 request/service contract and add
  clarification behavior.
- **User Story 3 (Phase 5)**: T029-T041 build on the API/provider boundary from US1 and
  clarification behavior from US2 before the full 21-case harness is accepted.
- **Polish (Phase 6)**: T042-T046 depend on the implemented stories and the final evaluation
  evidence from T041.

### User Story Dependencies

- **US1 (P1)**: Depends on the foundational schema/invariant/API shell; no dependency on a
  later story.
- **US2 (P1)**: Depends on US1's extraction service and UI result contract; independently
  verifies clarification and a corrected statement as a fresh request.
- **US3 (P1)**: Depends on US1's provider/API boundary and US2's result semantics; its
  evaluation harness covers all stories' cases.

### Parallel Opportunities

- **Setup**: T001 establishes directories before T002 creates the feedforward contract.
  T003, T004, and T006 then touch separate planned directories. T005 reviews whether the existing connectivity test confirms
  `gpt-6-luna` availability and records OpenAI terms. T004 reconciles existing package setup;
  T018 uses the already-installed `openai` SDK after model availability is confirmed.
- **Foundation**: T008 and T009 are independent contract/invariant tests; after both, schema
  and invariant implementation tasks T010 and T011 touch different files.
- **US1**: T014-T017 are independent route, UI, OpenAI-adapter, and extraction-service tests.
  After T005 confirms model availability and tests are in place, T018 and T019 touch separate
  AI/prompt files; frontend implementation follows the agreed API response shape.
- **US2**: T024 and T025 are independent service/frontend tests; implementation tasks share
  service semantics and should be integrated before T028.
- **US3**: T029-T031 are independent error, adversarial, and harness test suites. Dataset,
  evaluator layers, and evidence remain sequenced by the harness dependencies; serialize edits
  to `.harness/harness-runner.js`.

## Parallel Examples

### User Story 1

```text
T014 route integration tests: tests/integration/analyze-route.test.js
T015 frontend loading/result tests: tests/frontend/App.test.jsx
T016 OpenAI adapter unit tests: tests/unit/openai-adapter.test.js
T017 extraction-service unit tests: tests/unit/extraction-service.test.js
After T005 confirms gpt-6-luna availability and these tests, T018 OpenAI adapter and T019 prompt builder may proceed in parallel.
```

### User Story 2

```text
T024 backend clarification tests: tests/integration/clarification.test.js
T025 frontend clarification tests: tests/frontend/ResultPanel.test.jsx
Implement shared clarification behavior after both test suites define expected states.
```

### User Story 3

```text
T029 safe-error tests: tests/integration/errors.test.js
T030 adversarial/privacy tests: tests/adversarial/security.test.js
T031 harness/evidence tests: tests/evaluation/harness.test.js and tests/evaluation/evidence.test.js
Keep harness implementation ordered and serialize changes to .harness/harness-runner.js.
```

## Implementation Strategy

### MVP First

1. Complete setup and feedforward review (T001-T007).
2. Complete the canonical schema, invariants, and API shell (T008-T013).
3. Complete US1 only (T014-T023), then run its independent tests and demonstrate clear debit
   and credit extraction through the minimal interface.
4. Do not claim full assignment acceptance until US2, US3, the complete harness, evidence,
   and polish criteria pass.

### Incremental Delivery

1. Deliver the clear-transaction extraction slice (US1) with contract and UI tests.
2. Add clarification and independent resubmission (US2) without adding conversation history.
3. Add safe failures, prompt-injection checks, and the complete fixed-threshold evaluation
   pipeline (US3).
4. Complete documentation, human review, residual risks, and final acceptance evidence.

## Notes and Planning Alignment

- Every task uses the required `- [ ] T### [P?] [US?] description with file path` format.
- `[P]` appears only where tasks touch independent files and have no dependency on an
  unfinished task. User-story tasks all carry their required story label.
- Unit, integration, adversarial, and evaluation tests are included because they are
  explicitly required. Test tasks precede implementation within each story.
- Validation milestones are T007, T013, T023, T028, T041, and T046. Do not create commits
  without explicit approval.
- The approved root structure is `src/`, `frontend/`, `prompts/`, `feedforward/`, `tests/`,
  `evals/dataset.json`, `.harness/`, and `evidence/`, with `README.md` at the repository
  root. Harness modules live in `.harness/`; harness tests live in `tests/evaluation/`.
- Do not add a database, transaction persistence, history, spending calculations, accounts,
  bank/payment integrations, date/time extraction, multi-transaction processing, dashboards,
  or additional screens.