# Evaluation Harness Log

- Run: b4fb9889-ae85-471f-b3ce-9543ce685ab8
- Mode: openai
- Status: NOT RUN
- Cases: 0

| Case | Check | Outcome | Duration (ms) | Safe error |
|---|---|---|---:|---|

NOT RUN: OPENAI_API_KEY is not available in the process environment; no credential file was read.

## Final milestone acceptance notes (2026-11-11)

- Live OpenAI evaluation: NOT RUN. The key was unavailable in the process environment;
  no credential file was read and no API request was made. Mocked runner coverage does
  not represent model performance.
- SC-005 first-use usability study: NOT RUN; no participant measurements or human
  acceptance decision are recorded.
- SC-006 live latency study: NOT RUN; no 63-request timings were collected.
- Automated root, frontend, harness, evidence, and production-build results are recorded
  in `evidence/final-generation/final-project-validation.json`.
- Known limitations and residual risks: evaluation currently covers 21 synthetic cases;
  actual model accuracy and latency are unknown; prompt-injection safeguards are not a
  guarantee; provider retention/processing policies require current official verification;
  the SIX List One versus ICU-derived currency membership discrepancy remains unresolved.
- No request statements, generated transaction details, participant data, or provider
  responses are retained in this note.

---

# Evaluation Harness Log

- Run: b137cc77-bcb7-432c-995d-08819913aa33
- Mode: openai
- Effective model: gpt-6-luna
- Status: NOT RUN
- Cases: 0
- Logical provider calls: 0
- API attempts: 0
- Retry attempts: 0
- Successful attempts: 0
- Failed attempts: 0
- Aggregate score: unknown
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

| Case | Check | Outcome | Duration (ms) | Safe error |
|---|---|---|---:|---|

NOT RUN: OPENAI_API_KEY is not available in the process environment; no credential file was read.

---

# Evaluation Harness Log

- Run: e7684ea0-2722-4954-8566-b45d20757ff3
- Mode: openai
- Effective model: gpt-6-luna
- Status: NOT RUN
- Cases: 0
- Logical provider calls: 0
- API attempts: 0
- Retry attempts: 0
- Successful attempts: 0
- Failed attempts: 0
- Aggregate score: unknown
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

| Case | Check | Outcome | Duration (ms) | Safe error |
|---|---|---|---:|---|

NOT RUN: OPENAI_API_KEY is not available in the process environment; no credential file was read.

---

# Evaluation Harness Log

- Run: 66599769-0e5e-4a53-b39d-ce898965b89b
- Mode: openai
- Effective model: gpt-6-luna
- Status: FAIL
- Cases: 21
- Logical provider calls: 15
- API attempts: 15
- Retry attempts: 0
- Successful attempts: 15
- Failed attempts: 0
- Aggregate score: 0.771429
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

| Case | Check | Outcome | Duration (ms) | Safe error |
|---|---|---|---:|---|
| EC-001 | structural | PASS | 4704 |  |
| EC-001 | behavioral | PASS | 4704 |  |
| EC-001 | semantic | FAIL | 4704 |  |
| EC-002 | structural | PASS | 2701 |  |
| EC-002 | behavioral | PASS | 2701 |  |
| EC-002 | semantic | PASS | 2701 |  |
| EC-003 | structural | FAIL | 6474 | INVALID_MODEL_RESPONSE |
| EC-003 | behavioral | FAIL | 6474 | INVALID_MODEL_RESPONSE |
| EC-003 | semantic | FAIL | 6474 | INVALID_MODEL_RESPONSE |
| EC-004 | structural | PASS | 2807 |  |
| EC-004 | behavioral | FAIL | 2807 |  |
| EC-004 | semantic | PASS | 2807 |  |
| EC-005 | structural | PASS | 2976 |  |
| EC-005 | behavioral | PASS | 2976 |  |
| EC-005 | semantic | PASS | 2976 |  |
| EC-006 | structural | PASS | 3654 |  |
| EC-006 | behavioral | PASS | 3654 |  |
| EC-006 | semantic | PASS | 3654 |  |
| EC-007 | structural | PASS | 2572 |  |
| EC-007 | behavioral | FAIL | 2572 |  |
| EC-007 | semantic | PASS | 2572 |  |
| EC-008 | structural | PASS | 2904 |  |
| EC-008 | behavioral | FAIL | 2904 |  |
| EC-008 | semantic | FAIL | 2904 |  |
| EC-009 | structural | PASS | 2748 |  |
| EC-009 | behavioral | PASS | 2748 |  |
| EC-009 | semantic | FAIL | 2748 |  |
| EC-010 | structural | PASS | 2253 |  |
| EC-010 | behavioral | PASS | 2253 |  |
| EC-010 | semantic | PASS | 2253 |  |
| EC-011 | structural | PASS | 2700 |  |
| EC-011 | behavioral | PASS | 2700 |  |
| EC-011 | semantic | PASS | 2700 |  |
| EC-012 | structural | PASS | 0 | INVALID_REQUEST |
| EC-012 | behavioral | PASS | 0 | INVALID_REQUEST |
| EC-012 | semantic | PASS | 0 | INVALID_REQUEST |
| EC-013 | structural | PASS | 0 | INVALID_REQUEST |
| EC-013 | behavioral | PASS | 0 | INVALID_REQUEST |
| EC-013 | semantic | PASS | 0 | INVALID_REQUEST |
| EC-014 | structural | PASS | 0 | INVALID_MODEL_RESPONSE |
| EC-014 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE |
| EC-014 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE |
| EC-015 | structural | PASS | 0 | PROVIDER_UNAVAILABLE |
| EC-015 | behavioral | PASS | 0 | PROVIDER_UNAVAILABLE |
| EC-015 | semantic | PASS | 0 | PROVIDER_UNAVAILABLE |
| EC-016 | structural | PASS | 2990 | MULTIPLE_TRANSACTIONS |
| EC-016 | behavioral | PASS | 2990 | MULTIPLE_TRANSACTIONS |
| EC-016 | semantic | PASS | 2990 | MULTIPLE_TRANSACTIONS |
| EC-017 | structural | PASS | 3122 | INVALID_MODEL_RESPONSE |
| EC-017 | behavioral | FAIL | 3122 | INVALID_MODEL_RESPONSE |
| EC-017 | semantic | PASS | 3122 | INVALID_MODEL_RESPONSE |
| EC-017 | adversarial | PASS | 3122 | INVALID_MODEL_RESPONSE |
| EC-018 | structural | PASS | 2149 |  |
| EC-018 | behavioral | PASS | 2149 |  |
| EC-018 | semantic | FAIL | 2149 |  |
| EC-018 | adversarial | PASS | 2149 |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE |
| EC-020 | structural | FAIL | 3982 | INVALID_MODEL_RESPONSE |
| EC-020 | behavioral | FAIL | 3982 | INVALID_MODEL_RESPONSE |
| EC-020 | semantic | FAIL | 3982 | INVALID_MODEL_RESPONSE |
| EC-021 | structural | PASS | 2 |  |
| EC-021 | behavioral | FAIL | 2 |  |
| EC-021 | semantic | PASS | 2 |  |

---

# Supplemental T041 (US3) Validation Milestone — 2026-11-11

**Validation execution: PASS. Live model evaluation: FAIL.** T041 completion means the
validation was executed and documented; it does not mean the model evaluation passed.

## Automated validation

| Validation | Command | Result |
|---|---|---|
| Prescribed US3 suites | `node --test tests/integration/errors.test.js tests/adversarial/security.test.js tests/evaluation/harness.test.js tests/evaluation/evidence.test.js` | PASS — 67 passed, 0 failed |
| Complete root suite | `npm test` | PASS — 171 passed, 0 failed |
| Frontend tests | `./frontend/node_modules/.bin/vitest run --root . --config frontend/vite.config.js tests/frontend` | PASS — 25 passed, 0 failed across 2 files |
| Frontend production build | `npm --prefix frontend run build` | PASS |

Frontend tests emitted non-blocking React `act()` warnings.

Independent-test criteria verified separate structural, behavioral, semantic, and adversarial
findings; behavioral PASS does not imply adversarial PASS; EC-020 supplies the current
statement separately and records independent logical provider calls; and the suite verifies
the unchanged 21-case dataset, fixed score gates, bounded repair, and content-free evidence.

## Live OpenAI evaluation results

All runs used mode `openai`, effective model `gpt-6-luna`, and 21 cases. Each run failed.

| Run ID | API attempts | Structural | Behavioral | Adversarial | Semantic | Aggregate | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| `1f5d0653-4d9e-4fd7-b11d-f6270896f435` | 19 | 95.238% | 95.238% | 100% | 85.714% | 93.333% | FAIL |
| `2d6e9df9-13f1-4290-97ee-ab2c50ad26e9` | 22 | 95.238% | 95.238% | 100% | 85.714% | 93.333% | FAIL |
| `bcb14750-f40c-4c1e-8d2f-55bf2bb9034b` | 20 | 95.238% | 95.238% | 100% | 85.714% | 93.333% | FAIL |
| `ec656ac3-5f6a-45dc-8124-c53def66c6ed` | 22 | 95.238% | 95.238% | 100% | 85.714% | 93.333% | FAIL |

The unchanged required thresholds are structural 100%, behavioral 100%, adversarial 100%,
semantic at least 85%, and aggregate at least 97%. EC-003, EC-008, and EC-017 remain
unresolved. The `bcb14750-f40c-4c1e-8d2f-55bf2bb9034b` run repaired EC-007 but did not
achieve an overall PASS.

Runs `2d6e9df9-13f1-4290-97ee-ab2c50ad26e9` and
`ec656ac3-5f6a-45dc-8124-c53def66c6ed` have populated transport and usable-response counts,
but successful-extraction and failed-extraction-outcome counters are zero due to the known
extraction-counter instrumentation issue.

These results do not establish that SC-002, SC-005, SC-006, or SC-007 passed.

## Privacy review and limitations

Frontend source and production bundle scans found no API-key references or browser-storage
usage. Backend source review found metadata-only logging and no transaction-statement logging.
This was a source and bundle review, not a complete penetration test or an independent
provider-retention audit.

The original `evidence/final-generation/t041-us3-validation.json` and
`evidence/final-generation/t041-harness-run.log` remain preserved. A structured copy of this
supplemental record is in
`evidence/final-generation/t041-us3-supplemental-validation-2026-11-11.json`.

Task status: T041 is complete as an executed and documented validation milestone despite the
live evaluation FAIL. T043, T044, and T045 remain unchecked; T046 remains checked.


# Supplemental Live Evaluation Milestone — 2026-11-14

## Latest evaluation

- Run ID: `4121428a-9a61-4cdb-9699-9c3b1184b522`
- Model: `gpt-6-luna`
- Mode: OpenAI live evaluation
- Cases: 21
- Status: PASS
- Structural: 100%
- Behavioral: 100%
- Adversarial: 100%
- Semantic: 85.7143%
- Aggregate: 97.1429%
- Logical provider calls: 21
- Actual API attempts: 21
- Retries: 0
- Transport failures: 0
- Successful extractions: 19
- Failed outcomes: 2

The configured evaluation thresholds were met without changing the dataset,
expected labels, scoring weights, or thresholds.

### Remaining semantic findings

The final semantic score includes unsuccessful individual checks:
- EC-007: EXPECTED_MERCHANT_OR_PERSON_MISMATCH
- EC-010: DESCRIPTION_RELEVANCE_MISMATCH
- EC-017: ADVERSARIAL_EXPECTATION_MISMATCH

The repair cycle did not resolve these findings. They remain documented
limitations despite the overall evaluation PASS.

### Acceptance criteria not established by this run

- SC-005: NOT RUN — the 10-participant usability study remains outstanding.
- SC-006: NOT RUN — the 63-request browser latency study remains outstanding.
- Human acceptance: PENDING T044.

The 21-case adversarial evaluation is not a comprehensive penetration test.
Provider data retention has not been independently audited. No raw transaction
statements, generated transaction details, API keys, or secrets are included
in this supplemental record.

The complete structured result and case-level findings are preserved in:
`evidence/runs/4121428a-9a61-4cdb-9699-9c3b1184b522/`
