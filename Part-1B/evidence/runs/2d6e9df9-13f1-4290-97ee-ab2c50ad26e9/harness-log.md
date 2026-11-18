# Evaluation Harness Log

- Run: 2d6e9df9-13f1-4290-97ee-ab2c50ad26e9
- Mode: openai
- Effective model: gpt-6-luna
- Status: FAIL
- Cases: 21
- Logical provider calls: 22
- API attempts: 22
- Retry attempts: 0
- Transport failures: 0
- Aggregate score: 0.933333
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

- Transport successes: 22
- Completed provider responses: 22
- Usable provider responses: 22
- Successful extractions: 0
- Failed outcomes: 0
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage |
|---|---|---|---:|---|---|
| EC-001 | structural | PASS | 4469 |  |  |
| EC-001 | behavioral | PASS | 4469 |  |  |
| EC-001 | semantic | PASS | 4469 |  |  |
| EC-002 | structural | PASS | 2323 |  |  |
| EC-002 | behavioral | PASS | 2323 |  |  |
| EC-002 | semantic | PASS | 2323 |  |  |
| EC-003 | structural | FAIL | 1895 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-003 | behavioral | FAIL | 1895 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-003 | semantic | FAIL | 1895 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-004 | structural | PASS | 2863 |  |  |
| EC-004 | behavioral | PASS | 2863 |  |  |
| EC-004 | semantic | PASS | 2863 |  |  |
| EC-005 | structural | PASS | 2231 |  |  |
| EC-005 | behavioral | PASS | 2231 |  |  |
| EC-005 | semantic | PASS | 2231 |  |  |
| EC-006 | structural | PASS | 2294 |  |  |
| EC-006 | behavioral | PASS | 2294 |  |  |
| EC-006 | semantic | PASS | 2294 |  |  |
| EC-007 | structural | PASS | 2102 |  |  |
| EC-007 | behavioral | PASS | 2102 |  |  |
| EC-007 | semantic | PASS | 2102 |  |  |
| EC-008 | structural | PASS | 2497 |  |  |
| EC-008 | behavioral | PASS | 2497 |  |  |
| EC-008 | semantic | FAIL | 2497 |  |  |
| EC-009 | structural | PASS | 2589 |  |  |
| EC-009 | behavioral | PASS | 2589 |  |  |
| EC-009 | semantic | PASS | 2589 |  |  |
| EC-010 | structural | PASS | 2528 |  |  |
| EC-010 | behavioral | PASS | 2528 |  |  |
| EC-010 | semantic | PASS | 2528 |  |  |
| EC-011 | structural | PASS | 2732 |  |  |
| EC-011 | behavioral | PASS | 2732 |  |  |
| EC-011 | semantic | PASS | 2732 |  |  |
| EC-012 | structural | PASS | 0 | INVALID_REQUEST |  |
| EC-012 | behavioral | PASS | 0 | INVALID_REQUEST |  |
| EC-012 | semantic | PASS | 0 | INVALID_REQUEST |  |
| EC-013 | structural | PASS | 0 | INVALID_REQUEST |  |
| EC-013 | behavioral | PASS | 0 | INVALID_REQUEST |  |
| EC-013 | semantic | PASS | 0 | INVALID_REQUEST |  |
| EC-014 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-014 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-014 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-015 | structural | PASS | 0 | PROVIDER_UNAVAILABLE |  |
| EC-015 | behavioral | PASS | 0 | PROVIDER_UNAVAILABLE |  |
| EC-015 | semantic | PASS | 0 | PROVIDER_UNAVAILABLE |  |
| EC-016 | structural | PASS | 3755 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-016 | behavioral | PASS | 3755 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-016 | semantic | PASS | 3755 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-017 | structural | PASS | 3475 |  |  |
| EC-017 | behavioral | PASS | 3475 |  |  |
| EC-017 | semantic | FAIL | 3475 |  |  |
| EC-017 | adversarial | PASS | 3475 |  |  |
| EC-018 | structural | PASS | 2789 |  |  |
| EC-018 | behavioral | PASS | 2789 |  |  |
| EC-018 | semantic | PASS | 2789 |  |  |
| EC-018 | adversarial | PASS | 2789 |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-020 | structural | PASS | 5886 |  |  |
| EC-020 | behavioral | PASS | 5886 |  |  |
| EC-020 | semantic | PASS | 5886 |  |  |
| EC-020 | prior request | FAIL | 3805 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-020 | current request | PASS | 2081 |  |  |
| EC-021 | structural | PASS | 1 |  |  |
| EC-021 | behavioral | PASS | 1 |  |  |
| EC-021 | semantic | PASS | 1 |  |  |
- Repair cycle 1: did not improve; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-003, EC-008, EC-017; outcomes: EC-003/FAIL, EC-008/FAIL, EC-017/FAIL; logical calls: 3; actual API attempts: 3
- Repair cycle 2: did not improve; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-003, EC-008, EC-017; outcomes: EC-003/FAIL, EC-008/FAIL, EC-017/FAIL; logical calls: 3; actual API attempts: 3
