# Evaluation Harness Log

- Run: bcb14750-f40c-4c1e-8d2f-55bf2bb9034b
- Mode: openai
- Effective model: gpt-6-luna
- Status: FAIL
- Cases: 21
- Logical provider calls: 20
- API attempts: 20
- Retry attempts: 0
- Transport failures: 0
- Aggregate score: 0.933333
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

- Transport successes: 20
- Completed provider responses: 20
- Usable provider responses: 20
- Successful extractions: 16
- Failed outcomes: 4
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage |
|---|---|---|---:|---|---|
| EC-001 | structural | PASS | 4884 |  |  |
| EC-001 | behavioral | PASS | 4884 |  |  |
| EC-001 | semantic | PASS | 4884 |  |  |
| EC-002 | structural | PASS | 2349 |  |  |
| EC-002 | behavioral | PASS | 2349 |  |  |
| EC-002 | semantic | PASS | 2349 |  |  |
| EC-003 | structural | FAIL | 2284 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-003 | behavioral | FAIL | 2284 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-003 | semantic | FAIL | 2284 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-004 | structural | PASS | 2589 |  |  |
| EC-004 | behavioral | PASS | 2589 |  |  |
| EC-004 | semantic | PASS | 2589 |  |  |
| EC-005 | structural | PASS | 3657 |  |  |
| EC-005 | behavioral | PASS | 3657 |  |  |
| EC-005 | semantic | PASS | 3657 |  |  |
| EC-006 | structural | PASS | 7663 |  |  |
| EC-006 | behavioral | PASS | 7663 |  |  |
| EC-006 | semantic | PASS | 7663 |  |  |
| EC-007 | structural | PASS | 2235 |  |  |
| EC-007 | behavioral | PASS | 2235 |  |  |
| EC-007 | semantic | PASS | 2235 |  |  |
| EC-008 | structural | PASS | 2978 |  |  |
| EC-008 | behavioral | PASS | 2978 |  |  |
| EC-008 | semantic | FAIL | 2978 |  |  |
| EC-009 | structural | PASS | 2595 |  |  |
| EC-009 | behavioral | PASS | 2595 |  |  |
| EC-009 | semantic | PASS | 2595 |  |  |
| EC-010 | structural | PASS | 2058 |  |  |
| EC-010 | behavioral | PASS | 2058 |  |  |
| EC-010 | semantic | PASS | 2058 |  |  |
| EC-011 | structural | PASS | 2670 |  |  |
| EC-011 | behavioral | PASS | 2670 |  |  |
| EC-011 | semantic | PASS | 2670 |  |  |
| EC-012 | structural | PASS | 1 | INVALID_REQUEST |  |
| EC-012 | behavioral | PASS | 1 | INVALID_REQUEST |  |
| EC-012 | semantic | PASS | 1 | INVALID_REQUEST |  |
| EC-013 | structural | PASS | 0 | INVALID_REQUEST |  |
| EC-013 | behavioral | PASS | 0 | INVALID_REQUEST |  |
| EC-013 | semantic | PASS | 0 | INVALID_REQUEST |  |
| EC-014 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-014 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-014 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-015 | structural | PASS | 0 | PROVIDER_UNAVAILABLE |  |
| EC-015 | behavioral | PASS | 0 | PROVIDER_UNAVAILABLE |  |
| EC-015 | semantic | PASS | 0 | PROVIDER_UNAVAILABLE |  |
| EC-016 | structural | PASS | 3122 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-016 | behavioral | PASS | 3122 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-016 | semantic | PASS | 3122 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-017 | structural | PASS | 3074 |  |  |
| EC-017 | behavioral | PASS | 3074 |  |  |
| EC-017 | semantic | FAIL | 3074 |  |  |
| EC-017 | adversarial | PASS | 3074 |  |  |
| EC-018 | structural | PASS | 2498 |  |  |
| EC-018 | behavioral | PASS | 2498 |  |  |
| EC-018 | semantic | PASS | 2498 |  |  |
| EC-018 | adversarial | PASS | 2498 |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-020 | structural | PASS | 5203 |  |  |
| EC-020 | behavioral | PASS | 5203 |  |  |
| EC-020 | semantic | PASS | 5203 |  |  |
| EC-020 | prior request | FAIL | 3192 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-020 | current request | PASS | 2011 |  |  |
| EC-021 | structural | PASS | 2 |  |  |
| EC-021 | behavioral | PASS | 2 |  |  |
| EC-021 | semantic | PASS | 2 |  |  |
- Repair cycle 1: improved; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-003, EC-007, EC-008, EC-017; outcomes: EC-003/FAIL, EC-007/PASS, EC-008/FAIL, EC-017/FAIL; logical calls: 4; actual API attempts: 4
- Repair unavailable for EC-003: no_progress
- Repair unavailable for EC-008: no_progress
- Repair unavailable for EC-017: no_progress
