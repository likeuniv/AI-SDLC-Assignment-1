# Evaluation Harness Log

- Run: d9fcf0c9-0d15-4a9b-bf2b-3bc94381791f
- Mode: openai
- Effective model: gpt-6-luna
- Status: PASS
- Cases: 21
- Logical provider calls: 16
- API attempts: 16
- Retry attempts: 0
- Transport failures: 0
- Aggregate score: 0.971429
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

- Transport successes: 16
- Completed provider responses: 16
- Usable provider responses: 16
- Successful extractions: 15
- Failed outcomes: 1
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage | Failure reason |
|---|---|---|---:|---|---|---|
| EC-001 | structural | PASS | 4012 |  |  |  |
| EC-001 | behavioral | PASS | 4012 |  |  |  |
| EC-001 | semantic | PASS | 4012 |  |  |  |
| EC-002 | structural | PASS | 3345 |  |  |  |
| EC-002 | behavioral | PASS | 3345 |  |  |  |
| EC-002 | semantic | PASS | 3345 |  |  |  |
| EC-003 | structural | PASS | 1911 |  |  |  |
| EC-003 | behavioral | PASS | 1911 |  |  |  |
| EC-003 | semantic | PASS | 1911 |  |  |  |
| EC-004 | structural | PASS | 2304 |  |  |  |
| EC-004 | behavioral | PASS | 2304 |  |  |  |
| EC-004 | semantic | PASS | 2304 |  |  |  |
| EC-005 | structural | PASS | 1716 |  |  |  |
| EC-005 | behavioral | PASS | 1716 |  |  |  |
| EC-005 | semantic | PASS | 1716 |  |  |  |
| EC-006 | structural | PASS | 1745 |  |  |  |
| EC-006 | behavioral | PASS | 1745 |  |  |  |
| EC-006 | semantic | PASS | 1745 |  |  |  |
| EC-007 | structural | PASS | 1697 |  |  |  |
| EC-007 | behavioral | PASS | 1697 |  |  |  |
| EC-007 | semantic | FAIL | 1697 |  |  |  |
| EC-008 | structural | PASS | 1200 |  |  |  |
| EC-008 | behavioral | PASS | 1200 |  |  |  |
| EC-008 | semantic | PASS | 1200 |  |  |  |
| EC-009 | structural | PASS | 2406 |  |  |  |
| EC-009 | behavioral | PASS | 2406 |  |  |  |
| EC-009 | semantic | FAIL | 2406 |  |  |  |
| EC-010 | structural | PASS | 1985 |  |  |  |
| EC-010 | behavioral | PASS | 1985 |  |  |  |
| EC-010 | semantic | PASS | 1985 |  |  |  |
| EC-011 | structural | PASS | 2752 |  |  |  |
| EC-011 | behavioral | PASS | 2752 |  |  |  |
| EC-011 | semantic | PASS | 2752 |  |  |  |
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
| EC-016 | structural | PASS | 3153 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | behavioral | PASS | 3153 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | semantic | PASS | 3153 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-017 | structural | PASS | 1900 |  |  |  |
| EC-017 | behavioral | PASS | 1900 |  |  |  |
| EC-017 | semantic | FAIL | 1900 |  |  |  |
| EC-017 | adversarial | PASS | 1900 |  |  |  |
| EC-018 | structural | PASS | 1899 |  |  |  |
| EC-018 | behavioral | PASS | 1899 |  |  |  |
| EC-018 | semantic | PASS | 1899 |  |  |  |
| EC-018 | adversarial | PASS | 1899 |  |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-020 | structural | PASS | 2993 |  |  |  |
| EC-020 | behavioral | PASS | 2993 |  |  |  |
| EC-020 | semantic | PASS | 2993 |  |  |  |
| EC-020 | prior request | PASS | 1176 |  |  |  |
| EC-020 | current request | PASS | 1817 |  |  |  |
| EC-021 | structural | PASS | 1 |  |  |  |
| EC-021 | behavioral | PASS | 1 |  |  |  |
| EC-021 | semantic | PASS | 1 |  |  |  |
