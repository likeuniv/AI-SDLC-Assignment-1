# AI Spend Analyzer Constitution

## Core Principles

### I. Specification-Driven Scope
The specification, plan, tasks, and acceptance criteria MUST agree before implementation begins.
Each request MUST accept one natural-language transaction and return one structured result.
The application MUST NOT add persistence, history, totals, multi-transaction processing,
accounts, bank or payment integrations, date/time extraction, dashboards, or other features
outside the approved specification. Scope changes require a specification amendment first.

### II. Contract-First Simplicity
The application MUST use React with Vite, Node.js 24 with Express, an external AI model API,
and JSON Schema validation with a suitable validator such as Ajv. Frontend, backend, AI
integration, validation, and evaluation MUST remain separated. Implementations MUST be
modular and independently testable, and MUST NOT add complexity or dependencies without a
demonstrated requirement.

### III. Trustworthy AI and Security
Transaction text MUST be treated as untrusted data and kept separate from trusted system
instructions. User text MUST NOT override extraction rules, schemas, categories, or policy;
requests to reveal prompts or secrets, execute commands, access resources, or bypass validation
MUST be ignored. The model MUST extract only supported facts, use UNKNOWN or null when
uncertain, and ask a relevant question when essential information is missing or ambiguous.
Each response MUST be independently schema-validated and checked against deterministic
invariants; syntactically valid model JSON is not sufficient. Suspicious text with a safe,
unambiguous transaction may yield only that transaction; otherwise the request MUST be
clarified or rejected. No input may trigger external actions or transactions.

### IV. Privacy by Design
The application MUST process requests independently and discard input and output after
processing. It MUST NOT persist transaction data, retain history, or write raw transaction
text or extracted transaction details to application, debug, or evaluation logs. Errors MUST
not expose transaction content unnecessarily. API credentials MUST be supplied through
environment variables and MUST never be hardcoded, committed, or exposed. Documentation MUST
disclose that external AI providers may apply their own data-retention policies.

### V. Evaluation and Evidence
Quality MUST be demonstrated by automated tests and a versioned evaluation dataset of at least
15 meaningful cases, including normal debit and credit, merchants and people, refunds,
transfers, currency variants, ambiguity, missing information, empty and malformed inputs,
unknown categories, multiple transactions, and prompt injection. Structural schema checks,
deterministic behavioral and guardrail checks, and semantic evaluation MUST be independent;
semantic scores MUST NOT override structural or behavioral failures. Criteria, scoring, and
acceptance thresholds MUST be fixed before final evaluation. Findings and repair feedback
MUST be genuine; failures or difficult cases MUST NOT be hidden, disabled, or weakened to
obtain a pass.

## Technical and Data Constraints

Every successful extraction, including a clarification response, MUST contain exactly these
fields: `amount`, `currency`, `category`, `transaction_type`, `merchant_or_person`,
`description`, `confidence`, `requires_clarification`, and `clarification_question`. The
schema MUST reject missing or unexpected fields. `amount` MUST be positive or null;
`currency` MUST be a three-letter code; `category` MUST be FOOD, TRANSPORTATION, SHOPPING,
GROCERIES, HEALTHCARE, BILLS, ENTERTAINMENT, SALARY, TRANSFER, REFUND, OTHER, or UNKNOWN;
`transaction_type` MUST be CREDIT, DEBIT, or UNKNOWN; `merchant_or_person` MUST be a string
or null; `description` MUST be short; `confidence` MUST be between 0 and 1;
`requires_clarification` MUST be boolean; and `clarification_question` MUST be a string when
clarification is required and null otherwise. Default to INR only when context supports it
and no other currency is specified. Missing or ambiguous details MUST NOT be fabricated.

The interface MUST remain minimal and present the structured result. The application MUST
handle one transaction statement per request; multiple transactions in one statement MUST
not be silently processed as multiple records. Missing, empty, or malformed requests MUST
be handled without leaking sensitive content. No database or persistent transaction storage
may be introduced.

## Development, Evaluation, and Evidence

Before code generation, feedforward instructions MUST define project contracts, coding
standards, harness rules, and bounded generation tasks. Implementation MUST proceed
incrementally; each milestone MUST run its relevant tests and verify its acceptance criteria.

The unified evaluation pipeline MUST include `sensor.js`, `schema-validator.js`,
`invariant-checker.js`, `semantic-evaluator.js`, and `harness-runner.js`. The sensor MUST
collect findings from independent checks. The harness MUST evaluate output, validate schema,
check invariants and guardrails, evaluate semantic quality, calculate the aggregate score,
report PASS or FAIL, provide genuine findings for bounded repair, and re-evaluate repaired
output. Evidence MUST preserve initial generation and failures, feedback, repair attempts,
final generation and evaluation, harness logs, human acceptance or rejection, and known
limitations and residual risks. Evidence MUST contain neither credentials nor actual
sensitive transaction data.

Documentation MUST cover architecture, installation and execution, environment configuration,
AI integration, the output schema, evaluation methodology, harness execution, and security
and privacy limitations. Code and documentation MUST be readable and proportionate to an
individual working-professional assignment.

## Governance

This constitution governs project specifications, plans, tasks, implementation, tests, and
reviews. Amendments MUST be documented and reviewed for effects on the specification,
architecture, tests, evaluation criteria, and existing evidence before adoption. Reviews
MUST verify compliance with each applicable principle and invariant; deviations require an
explicitly approved constitution amendment before implementation.

Version numbers use MAJOR.MINOR.PATCH: MAJOR for backward-incompatible governance changes,
MINOR for added principles or materially expanded requirements, and PATCH for clarifications
that do not change obligations. Every amendment MUST update the last-amended date and record
its impact. Automated tests, schema validation, behavioral checks, and evaluation thresholds
are required quality gates; human acceptance and residual risks MUST also be recorded.

**Version**: 1.0.0 | **Ratified**: 2026-11-10 | **Last Amended**: 2026-11-10
