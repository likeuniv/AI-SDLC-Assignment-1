# Data Model: AI Spend Analyzer

This model separates ephemeral runtime data from retained synthetic evaluation artifacts.
Runtime transaction statements and extraction results are never persisted or logged.

## Transaction Statement

One user-submitted natural-language statement.

| Field | Type | Constraints | Lifecycle |
| --- | --- | --- | --- |
| `statement` | string | Required, non-empty after whitespace check; one transaction only | Held in request memory, discarded after response |

The server rejects malformed request shapes and empty statements before calling the AI
provider. A statement that appears to contain multiple transactions is clarified or rejected;
it is never split into multiple records.

## Extraction Result

The provider candidate after parsing, schema validation, and deterministic invariant checks.
It is returned to the current client and then discarded by the server.

| Field | Type | Constraints |
| --- | --- | --- |
| `amount` | number or null | Number must be greater than zero |
| `currency` | string | Active ISO 4217 alphabetic currency code; `XXX` when currency cannot be established; INR only when context supports it |
| `category` | string | FOOD, TRANSPORTATION, SHOPPING, GROCERIES, HEALTHCARE, BILLS, ENTERTAINMENT, SALARY, TRANSFER, REFUND, OTHER, UNKNOWN |
| `transaction_type` | string | CREDIT, DEBIT, UNKNOWN |
| `merchant_or_person` | string or null | Name only when supported by the statement |
| `description` | string | Clear, relevant explanation based only on supported facts; maximum 20 whitespace-delimited words and 160 Unicode characters |
| `confidence` | number | Inclusive range 0 through 1 |
| `requires_clarification` | boolean | True when essential information is missing or ambiguous |
| `clarification_question` | string or null | Non-empty question iff clarification is required; otherwise null |

Exactly these nine properties are required; additional properties are invalid. Currency
codes use active ISO 4217 alphabetic codes; `XXX` is the explicit unknown/no-currency-
determined sentinel. INR is inferred only when context supports it. Description words are
counted by trimming the string and splitting on one or more Unicode whitespace characters;
punctuation remains attached, and hyphenated compounds count as one word. The sole canonical
schema is [contracts/output-schema.json](contracts/output-schema.json), referenced by the
wire contract in [contracts/http-api.yaml](contracts/http-api.yaml).

## Request Processing State

```text
received
  -> request-valid
  -> provider-pending
  -> candidate-parsed
  -> schema-valid
  -> invariant-valid
  -> extraction-returned | clarification-returned

Any invalid request, provider failure, parse/schema/invariant failure
  -> safe-error-returned
```

No state is restored on a later request. Failure states discard transaction content after
response handling and emit only allowlisted operational metadata.

## Provider Configuration

Provider configuration is read only by the Node service; it is not transaction data and must
never be sent to the frontend or written to logs.

| Variable | Initial value/use | Secret |
| --- | --- | --- |
| `OPENAI_API_KEY` | Credential for the sole OpenAI Responses API adapter | Yes |
| `OPENAI_MODEL` | `gpt-6-luna`, subject to continued availability to the account | No |

OpenAI is the only provider. The key and model ID are read by the backend only; they MUST NOT
be sent to the frontend, included in prompts, written to logs, or committed. If `gpt-6-luna`
is unavailable, the request fails safely and requires a deliberate model configuration
change; no fallback provider or model is selected silently. The isolated OpenAI adapter
normalizes its response to the nine-field candidate, and the extraction service applies the
canonical schema and deterministic invariants before returning any result.

## Evaluation Case

A synthetic fixture in `evals/dataset.json`.

| Field | Purpose |
| --- | --- |
| `case_id` | Stable EC-001 through EC-021 identifier |
| `input` | Synthetic transaction statement or controlled invalid-input condition; not copied into retained evaluation evidence |
| `expected` | Expected field labels, clarification outcome, or safe error category |
| `requirement_ids` | Linked FR identifiers |
| `acceptance_ids` | Linked AC identifiers |
| `tags` | Coverage labels such as debit, currency, ambiguity, malformed, or injection |

The fixtures are synthetic and version-controlled. They are separate from real runtime user
data and may be used for repeatable scoring; runtime code does not copy their raw text into
logs or retained evaluation evidence.

## Evaluation Run and Evidence

One run evaluates the unchanged dataset and threshold version. Each case produces independent
structural, behavioral, and semantic findings; the sensor aggregates findings without
rewriting or suppressing them.

| Evidence artifact | Required content |
| --- | --- |
| `evidence/initial-generation/` | Initial application-generation artifacts and provenance; no raw transaction statements, actual generated transaction details, API keys, or secrets |
| `evidence/final-generation/` | Final application-generation artifacts and provenance; no raw transaction statements, actual generated transaction details, API keys, or secrets |
| `evidence/eval-results.json` | Synthetic case IDs, check IDs, independent layer outcomes, durations, safe error codes, aggregate scores, PASS/FAIL, and prescribed pseudonymous usability-study identifiers/outcomes; no raw output |
| `evidence/harness-log.md` | Harness execution and repair history, including cycle identifiers, linked case/check IDs, outcomes, durations, safe error codes, changed file paths, and content-free human-review/limitations notes; no transaction content or secrets |

The evaluation-results file and harness log MUST NOT contain raw transaction statements,
actual generated transaction details, prompts, credentials, environment values, or raw
provider exceptions. Retain only synthetic case IDs, check IDs, pass/fail outcomes, durations,
safe error codes, aggregate results, prescribed pseudonymous usability-study identifiers and
outcomes, and necessary repair-history metadata. Evidence is not a runtime transaction store.

## Relationships

- One request contains one Transaction Statement and produces at most one Extraction Result
  or one safe error.
- One Evaluation Run contains all 21 Evaluation Cases, each with independent layer findings.
- Repair cycles reference failed case IDs and findings, then rerun the same cases and
  thresholds; thresholds and fixtures are immutable within a run.