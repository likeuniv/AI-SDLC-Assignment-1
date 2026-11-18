# Research: AI Spend Analyzer

**Date**: 2026-11-10  
**Scope**: Resolve planning choices for the approved stack and identify operational risks.
No application source code was generated as part of this research.

## Frontend and Backend Boundary

**Decision**: The React/Vite frontend owns only the current form, pending state, and current
result. It sends one `POST /api/analyze` request to the Express service in root `src/`. The service owns
input validation, provider interaction, result validation, and safe error mapping. Use a Vite
development proxy and same-origin routing where possible.

**Rationale**: Provider credentials and validation must remain server-side. The frontend
needs no history or persistent browser state.

**Alternatives considered**: Calling the model from the browser exposes credentials and
bypasses server-side validation. A separate public API origin adds CORS configuration without
benefit for this assignment.

## Express Request Handling and Privacy

**Decision**: Accept JSON requests with a non-empty statement string, reject malformed
requests before provider calls, impose a conservative request-body limit, and centralize
sanitized error mapping. The retained harness record in `evidence/harness-log.md` MUST contain
only synthetic case IDs, check IDs, pass/fail outcomes, durations, safe error codes, and
necessary repair-history metadata. `evidence/eval-results.json` retains independent check
outcomes and aggregate results. Never record request bodies, actual generated transaction
details, provider response text, prompts, credentials, or raw provider errors. Add a provider
timeout and abort path.

**Rationale**: Safe, consistent error handling is easier to test in one middleware boundary.
Harness diagnostics do not require transaction content.

**Alternatives considered**: Recording full request and exception objects is easier during
debugging but violates the privacy contract. Extra rate-limit or logging services are
unnecessary for a local individual assignment unless deployment exposure later requires them.

## Ajv and Deterministic Invariants

**Decision**: Keep the sole canonical JSON Schema at
`specs/001-ai-spend-analyzer/contracts/output-schema.json`; make OpenAPI reference it rather
than duplicating it. Compile it with Ajv strict mode, a custom `iso-4217-currency` format, and
no additional properties. Require all nine fields, an active ISO 4217 alphabetic currency or
`XXX`, positive-or-null amount, confidence in `[0, 1]`, and description maxLength 160.
Disable type coercion, default insertion, and property removal. After schema validation, run
deterministic invariants for cross-field clarification consistency and the 20-word description
limit. Back the custom format with an active ISO 4217 registry source; pin and record its
source/revision in `README.md` and `.harness/config.json` so test and evaluation runs use the
same code set.

**Rationale**: Non-mutating validation preserves evidence of the provider's actual output.
Schema checks cover structure; invariants cover relationships and business rules.

**Alternatives considered**: Stripping unexpected fields or coercing values would hide model
failures. A permissive schema conflicts with the exact output contract.

## OpenAI Provider Integration

**Decision**: OpenAI is the sole provider. Implement one isolated adapter in
`src/ai/openai-adapter.js` using the official OpenAI Node.js SDK package `openai` and the
Responses API. Read `OPENAI_API_KEY` and `OPENAI_MODEL` only in the backend process. The
initial model is `gpt-6-luna`, which the user reports successfully tested; before integration,
verify that the API account still has access. If unavailable, stop and request a replacement
model decision rather than silently switching.

OpenAI's official model catalog describes GPT-6 Luna as an efficient model for focused,
high-volume work. The official pricing page lists $0.10 per million input tokens and $0.50
per million output tokens at the time checked; recheck current pricing and model availability
before implementation and live evaluation. These values are not acceptance thresholds.

**Structured Outputs and canonical schema**: Use Responses API Structured Outputs with
`text.format.type="json_schema"` and `strict: true`, derived from the existing
`contracts/output-schema.json`. OpenAI's strict JSON Schema supports a subset of JSON Schema;
the existing canonical schema includes constructs not accepted directly by strict mode,
including `allOf`/conditional keywords, custom `format`, `minLength`/`maxLength`, and `oneOf`.
Therefore, the adapter must derive a provider-compatible schema projection from the canonical
schema at request time, retaining all nine field names, required fields, types, enums, nullable
fields, and `additionalProperties: false`, while omitting only unsupported generation-time
keywords. Do not maintain a second handwritten schema or change the canonical schema. After
generation, parse the result and validate it against the full canonical schema with Ajv and
the independent deterministic invariants.

**Configuration**: Backend `.env` uses `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-6-luna`.
Credentials MUST never be sent to the frontend, included in prompts, logged, or committed.
The OpenAI SDK documents automatic retries and a long default timeout; override these with a
bounded 10-second per-attempt timeout and at most one retry for retryable connection,
timeout, rate-limit, and server errors. Map refusals, incomplete responses, invalid JSON,
provider errors, exhausted retries, and timeouts to safe errors without returning raw SDK
messages. Do not enable tools or external actions.

**Prompt construction**: Keep trusted extraction rules in
`prompts/transaction-extraction.md` and shared prompt policy in `src/prompt-builder.js`.
The OpenAI adapter formats the Responses API messages, keeps the transaction as separate
untrusted user content, and sends no history, tools, credentials in prompt content, or
unrelated secrets. Prompt delimiters are advisory; least privilege and independent local
validation are the enforceable controls.

**Provider evaluation**: Run all 21 unchanged synthetic cases against the OpenAI adapter
using the existing structural, behavioral, semantic, scoring, and privacy rules. Record the
model identifier and synthetic case/check outcomes without raw inputs or generated
transaction details. Do not compare or report other providers under this sole-provider plan.

## Independent Evaluation and Bounded Repair

**Decision**: Implement separate structural, behavioral, and semantic evaluators under
`.harness/` over the frozen 21-case synthetic dataset at `evals/dataset.json`.
`.harness/sensor.js` gathers findings; `.harness/harness-runner.js` computes a 40/40/20
aggregate and reports PASS/FAIL only when the aggregate and each hard gate pass. Evaluation
tests belong under `tests/evaluation/`. Permit at most two coding-agent repair cycles per run.
Each repair receives genuine findings; rerun the unchanged dataset and thresholds after each
cycle, then stop with FAIL if gates remain unmet.

**Rationale**: Separate gates prevent semantic scores from masking invalid structure or
unsafe behavior. The semantic rubric also scores description relevance and clarity. A repair
cap prevents unbounded retries, hides no difficult cases, and keeps evidence auditable.

**Alternatives considered**: Repeated open-ended retries can inflate cost and conceal
instability. A single aggregate score can mask a failed safety gate. An LLM judge is
unnecessary for a small fixed dataset; deterministic expected-label comparison is clearer.

**Evaluator limitation**: Deterministic checks cannot prove resistance to arbitrary
prompt-injection text or universal absence of fabrication. Report measured results only for
the fixed synthetic cases and record residual risks.

## Development and Test Workflow

**Decision**: Use Node 24 `node:test` for `src/`, schema, invariant, OpenAI adapter, and
`.harness/` checks. Use Vitest with React Testing Library for UI states and accessibility
behavior. Keep unit, integration, frontend, adversarial, and evaluation tests under root
`tests/`. Test
the OpenAI adapter with a fake client for structured success, refusal/incomplete output,
invalid response, rate limit, timeout, retry exhaustion, and sanitized errors. Run live
latency measurements only with the explicit SC-006 protocol. Develop the service and frontend
in separate terminals with Vite proxying API requests.

**Rationale**: The native backend runner avoids a second backend test framework, while
Vitest fits the Vite frontend. Separate terminals avoid a process-concurrency dependency.

**Alternatives considered**: Browser end-to-end automation offers broader coverage but adds
setup disproportionate to the assignment. A one-command concurrent development launcher
adds process-management complexity without a demonstrated need.

## Compatibility and Conflict Review

- The constitution requires at least 15 cases; the specification's 21 cases satisfy that
  floor and remain unchanged.
- The specification prohibits runtime transaction retention and transaction-content logs.
  Operational harness logs contain only case ID, check ID, outcome, duration, and safe error
  code. Separate retained evidence contains synthetic IDs and aggregate/check outcomes only.
- OpenAI is the only provider. The user-tested `gpt-6-luna` model remains subject to API
  availability and must be checked before implementation. Provider retention remains a
  residual risk to review.
- No conflict with the constitution or specification was found. The request-size bound is a
  transport safeguard only and must be generous enough for a single natural-language
  statement; it does not change extraction behavior.

## References

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI model catalog](https://developers.openai.com/api/docs/models)
- [GPT-6 Luna model details](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [OpenAI API pricing](https://openai.com/api/pricing/)
- [Official OpenAI Node.js SDK](https://github.com/openai/openai-node)
- [Express error handling](https://expressjs.com/en/guide/error-handling.html)
- [Express security best practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Ajv strict mode](https://ajv.js.org/strict-mode.html)
- [Ajv options](https://ajv.js.org/options.html)
- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Vite environment variables and modes](https://vite.dev/guide/env-and-mode)
- [Node.js 24 test runner](https://nodejs.org/docs/latest-v24.x/api/test.html)