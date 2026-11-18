# Evaluation Harness Log

- Run: ec656ac3-5f6a-45dc-8124-c53def66c6ed
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
| EC-001 | structural | PASS | 4501 |  |  |
| EC-001 | behavioral | PASS | 4501 |  |  |
| EC-001 | semantic | PASS | 4501 |  |  |
| EC-002 | structural | PASS | 2615 |  |  |
| EC-002 | behavioral | PASS | 2615 |  |  |
| EC-002 | semantic | PASS | 2615 |  |  |
| EC-003 | structural | FAIL | 3209 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-003 | behavioral | FAIL | 3209 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-003 | semantic | FAIL | 3209 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-004 | structural | PASS | 2453 |  |  |
| EC-004 | behavioral | PASS | 2453 |  |  |
| EC-004 | semantic | PASS | 2453 |  |  |
| EC-005 | structural | PASS | 1917 |  |  |
| EC-005 | behavioral | PASS | 1917 |  |  |
| EC-005 | semantic | PASS | 1917 |  |  |
| EC-006 | structural | PASS | 1799 |  |  |
| EC-006 | behavioral | PASS | 1799 |  |  |
| EC-006 | semantic | PASS | 1799 |  |  |
| EC-007 | structural | PASS | 2769 |  |  |
| EC-007 | behavioral | PASS | 2769 |  |  |
| EC-007 | semantic | PASS | 2769 |  |  |
| EC-008 | structural | PASS | 2177 |  |  |
| EC-008 | behavioral | PASS | 2177 |  |  |
| EC-008 | semantic | FAIL | 2177 |  |  |
| EC-009 | structural | PASS | 2524 |  |  |
| EC-009 | behavioral | PASS | 2524 |  |  |
| EC-009 | semantic | PASS | 2524 |  |  |
| EC-010 | structural | PASS | 2543 |  |  |
| EC-010 | behavioral | PASS | 2543 |  |  |
| EC-010 | semantic | PASS | 2543 |  |  |
| EC-011 | structural | PASS | 3286 |  |  |
| EC-011 | behavioral | PASS | 3286 |  |  |
| EC-011 | semantic | PASS | 3286 |  |  |
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
| EC-016 | structural | PASS | 2795 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-016 | behavioral | PASS | 2795 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-016 | semantic | PASS | 2795 | MULTIPLE_TRANSACTIONS | invariant_failure |
| EC-017 | structural | PASS | 3367 |  |  |
| EC-017 | behavioral | PASS | 3367 |  |  |
| EC-017 | semantic | FAIL | 3367 |  |  |
| EC-017 | adversarial | PASS | 3367 |  |  |
| EC-018 | structural | PASS | 1902 |  |  |
| EC-018 | behavioral | PASS | 1902 |  |  |
| EC-018 | semantic | PASS | 1902 |  |  |
| EC-018 | adversarial | PASS | 1902 |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |
| EC-020 | structural | PASS | 5276 |  |  |
| EC-020 | behavioral | PASS | 5276 |  |  |
| EC-020 | semantic | PASS | 5276 |  |  |
| EC-020 | prior request | FAIL | 2940 | INVALID_MODEL_RESPONSE | invariant_failure |
| EC-020 | current request | PASS | 2336 |  |  |
| EC-021 | structural | PASS | 1 |  |  |
| EC-021 | behavioral | PASS | 1 |  |  |
| EC-021 | semantic | PASS | 1 |  |  |
- Repair cycle 1: did not improve; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-003, EC-008, EC-017; outcomes: EC-003/FAIL, EC-008/FAIL, EC-017/FAIL; logical calls: 3; actual API attempts: 3
- Repair cycle 2: did not improve; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-003, EC-008, EC-017; outcomes: EC-003/FAIL, EC-008/FAIL, EC-017/FAIL; logical calls: 3; actual API attempts: 3
