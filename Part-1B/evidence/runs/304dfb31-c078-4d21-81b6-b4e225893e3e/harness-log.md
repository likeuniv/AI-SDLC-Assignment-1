# Evaluation Harness Log

- Run: 304dfb31-c078-4d21-81b6-b4e225893e3e
- Mode: openai
- Effective model: gpt-6-luna
- Status: FAIL
- Cases: 21
- Logical provider calls: 23
- API attempts: 23
- Retry attempts: 0
- Transport failures: 1
- Aggregate score: 0.914286
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

- Transport successes: 22
- Completed provider responses: 22
- Usable provider responses: 22
- Successful extractions: 15
- Failed outcomes: 8
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage | Failure reason |
|---|---|---|---:|---|---|---|
| EC-001 | structural | PASS | 3121 |  |  |  |
| EC-001 | behavioral | PASS | 3121 |  |  |  |
| EC-001 | semantic | PASS | 3121 |  |  |  |
| EC-002 | structural | PASS | 2637 |  |  |  |
| EC-002 | behavioral | PASS | 2637 |  |  |  |
| EC-002 | semantic | PASS | 2637 |  |  |  |
| EC-003 | structural | FAIL | 4120 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-003 | behavioral | FAIL | 4120 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-003 | semantic | FAIL | 4120 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-004 | structural | PASS | 5469 |  |  |  |
| EC-004 | behavioral | PASS | 5469 |  |  |  |
| EC-004 | semantic | PASS | 5469 |  |  |  |
| EC-005 | structural | PASS | 2147 |  |  |  |
| EC-005 | behavioral | PASS | 2147 |  |  |  |
| EC-005 | semantic | PASS | 2147 |  |  |  |
| EC-006 | structural | PASS | 2192 |  |  |  |
| EC-006 | behavioral | PASS | 2192 |  |  |  |
| EC-006 | semantic | PASS | 2192 |  |  |  |
| EC-007 | structural | PASS | 2702 |  |  |  |
| EC-007 | behavioral | PASS | 2702 |  |  |  |
| EC-007 | semantic | PASS | 2702 |  |  |  |
| EC-008 | structural | PASS | 2902 |  |  |  |
| EC-008 | behavioral | PASS | 2902 |  |  |  |
| EC-008 | semantic | FAIL | 2902 |  |  |  |
| EC-009 | structural | PASS | 2531 |  |  |  |
| EC-009 | behavioral | PASS | 2531 |  |  |  |
| EC-009 | semantic | PASS | 2531 |  |  |  |
| EC-010 | structural | PASS | 2119 |  |  |  |
| EC-010 | behavioral | PASS | 2119 |  |  |  |
| EC-010 | semantic | PASS | 2119 |  |  |  |
| EC-011 | structural | PASS | 2486 |  |  |  |
| EC-011 | behavioral | PASS | 2486 |  |  |  |
| EC-011 | semantic | PASS | 2486 |  |  |  |
| EC-012 | structural | PASS | 0 | INVALID_REQUEST |  |  |
| EC-012 | behavioral | PASS | 0 | INVALID_REQUEST |  |  |
| EC-012 | semantic | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | structural | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | behavioral | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | semantic | PASS | 0 | INVALID_REQUEST |  |  |
| EC-014 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-014 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-014 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-015 | structural | PASS | 0 | PROVIDER_UNAVAILABLE |  |  |
| EC-015 | behavioral | PASS | 0 | PROVIDER_UNAVAILABLE |  |  |
| EC-015 | semantic | PASS | 0 | PROVIDER_UNAVAILABLE |  |  |
| EC-016 | structural | PASS | 3474 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | behavioral | PASS | 3474 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | semantic | PASS | 3474 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-017 | structural | PASS | 3638 | INVALID_MODEL_RESPONSE | invariant_failure | UNKNOWN_INVARIANT_FAILURE |
| EC-017 | behavioral | FAIL | 3638 | INVALID_MODEL_RESPONSE | invariant_failure | UNKNOWN_INVARIANT_FAILURE |
| EC-017 | semantic | FAIL | 3638 | INVALID_MODEL_RESPONSE | invariant_failure | UNKNOWN_INVARIANT_FAILURE |
| EC-017 | adversarial | PASS | 3638 | INVALID_MODEL_RESPONSE | invariant_failure | UNKNOWN_INVARIANT_FAILURE |
| EC-018 | structural | PASS | 2489 |  |  |  |
| EC-018 | behavioral | PASS | 2489 |  |  |  |
| EC-018 | semantic | PASS | 2489 |  |  |  |
| EC-018 | adversarial | PASS | 2489 |  |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-020 | structural | PASS | 6323 |  |  |  |
| EC-020 | behavioral | PASS | 6323 |  |  |  |
| EC-020 | semantic | PASS | 6323 |  |  |  |
| EC-020 | prior request | PASS | 3998 |  |  |  |
| EC-020 | current request | PASS | 2324 |  |  |  |
| EC-021 | structural | PASS | 2 |  |  |  |
| EC-021 | behavioral | PASS | 2 |  |  |  |
| EC-021 | semantic | PASS | 2 |  |  |  |
- Repair cycle 1: improved; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-002, EC-003, EC-008, EC-010, EC-017, EC-020; outcomes: EC-002/PASS, EC-003/FAIL, EC-008/FAIL, EC-010/PASS, EC-017/FAIL, EC-020/PASS; logical calls: 7; actual API attempts: 7
- Repair unavailable for EC-003: no_progress
- Repair unavailable for EC-008: no_progress
- Repair unavailable for EC-017: no_progress
