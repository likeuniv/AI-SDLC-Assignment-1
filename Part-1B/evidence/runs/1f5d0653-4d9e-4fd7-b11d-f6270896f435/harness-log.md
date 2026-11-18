# Evaluation Harness Log

- Run: 1f5d0653-4d9e-4fd7-b11d-f6270896f435
- Mode: openai
- Effective model: gpt-6-luna
- Status: FAIL
- Cases: 21
- Logical provider calls: 19
- API attempts: 19
- Retry attempts: 0
- Transport failures: 0
- Aggregate score: 0.933333
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

- Transport successes: 19
- Completed provider responses: 19
- Usable provider responses: 19
- Successful extractions: 15
- Failed outcomes: 4
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage | Failure reason |
|---|---|---|---:|---|---|---|
| EC-001 | structural | PASS | 3754 |  |  |  |
| EC-001 | behavioral | PASS | 3754 |  |  |  |
| EC-001 | semantic | PASS | 3754 |  |  |  |
| EC-002 | structural | PASS | 3458 |  |  |  |
| EC-002 | behavioral | PASS | 3458 |  |  |  |
| EC-002 | semantic | PASS | 3458 |  |  |  |
| EC-003 | structural | FAIL | 2662 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-003 | behavioral | FAIL | 2662 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-003 | semantic | FAIL | 2662 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-004 | structural | PASS | 4645 |  |  |  |
| EC-004 | behavioral | PASS | 4645 |  |  |  |
| EC-004 | semantic | PASS | 4645 |  |  |  |
| EC-005 | structural | PASS | 2355 |  |  |  |
| EC-005 | behavioral | PASS | 2355 |  |  |  |
| EC-005 | semantic | PASS | 2355 |  |  |  |
| EC-006 | structural | PASS | 2508 |  |  |  |
| EC-006 | behavioral | PASS | 2508 |  |  |  |
| EC-006 | semantic | PASS | 2508 |  |  |  |
| EC-007 | structural | PASS | 2634 |  |  |  |
| EC-007 | behavioral | PASS | 2634 |  |  |  |
| EC-007 | semantic | PASS | 2634 |  |  |  |
| EC-008 | structural | PASS | 5061 |  |  |  |
| EC-008 | behavioral | PASS | 5061 |  |  |  |
| EC-008 | semantic | FAIL | 5061 |  |  |  |
| EC-009 | structural | PASS | 2400 |  |  |  |
| EC-009 | behavioral | PASS | 2400 |  |  |  |
| EC-009 | semantic | PASS | 2400 |  |  |  |
| EC-010 | structural | PASS | 2301 |  |  |  |
| EC-010 | behavioral | PASS | 2301 |  |  |  |
| EC-010 | semantic | PASS | 2301 |  |  |  |
| EC-011 | structural | PASS | 3199 |  |  |  |
| EC-011 | behavioral | PASS | 3199 |  |  |  |
| EC-011 | semantic | PASS | 3199 |  |  |  |
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
| EC-016 | structural | PASS | 3003 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | behavioral | PASS | 3003 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | semantic | PASS | 3003 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-017 | structural | PASS | 3360 |  |  |  |
| EC-017 | behavioral | PASS | 3360 |  |  |  |
| EC-017 | semantic | FAIL | 3360 |  |  |  |
| EC-017 | adversarial | PASS | 3360 |  |  |  |
| EC-018 | structural | PASS | 2570 |  |  |  |
| EC-018 | behavioral | PASS | 2570 |  |  |  |
| EC-018 | semantic | PASS | 2570 |  |  |  |
| EC-018 | adversarial | PASS | 2570 |  |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-020 | structural | PASS | 5025 |  |  |  |
| EC-020 | behavioral | PASS | 5025 |  |  |  |
| EC-020 | semantic | PASS | 5025 |  |  |  |
| EC-020 | prior request | FAIL | 1940 | INVALID_MODEL_RESPONSE | invariant_failure | UNSUPPORTED_CATEGORY |
| EC-020 | current request | PASS | 3085 |  |  |  |
| EC-021 | structural | PASS | 1 |  |  |  |
| EC-021 | behavioral | PASS | 1 |  |  |  |
| EC-021 | semantic | PASS | 1 |  |  |  |
- Repair cycle 1: did not improve; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-003, EC-008, EC-017; outcomes: EC-003/FAIL, EC-008/FAIL, EC-017/FAIL; logical calls: 3; actual API attempts: 3
- Repair unavailable for EC-003: no_progress
- Repair unavailable for EC-008: no_progress
- Repair unavailable for EC-017: no_progress
