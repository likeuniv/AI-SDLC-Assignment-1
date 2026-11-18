# Evaluation Harness Log

- Run: 4121428a-9a61-4cdb-9699-9c3b1184b522
- Mode: openai
- Effective model: gpt-6-luna
- Status: PASS
- Cases: 21
- Logical provider calls: 21
- API attempts: 21
- Retry attempts: 0
- Transport failures: 0
- Aggregate score: 0.971429
- Pre-run maximum API attempts: 96
- Token usage estimate: UNKNOWN
- Estimated monetary cost: UNKNOWN

- Transport successes: 21
- Completed provider responses: 21
- Usable provider responses: 21
- Successful extractions: 19
- Failed outcomes: 2
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage | Failure reason |
|---|---|---|---:|---|---|---|
| EC-001 | structural | PASS | 3321 |  |  |  |
| EC-001 | behavioral | PASS | 3321 |  |  |  |
| EC-001 | semantic | PASS | 3321 |  |  |  |
| EC-002 | structural | PASS | 1588 |  |  |  |
| EC-002 | behavioral | PASS | 1588 |  |  |  |
| EC-002 | semantic | PASS | 1588 |  |  |  |
| EC-003 | structural | PASS | 1654 |  |  |  |
| EC-003 | behavioral | PASS | 1654 |  |  |  |
| EC-003 | semantic | PASS | 1654 |  |  |  |
| EC-004 | structural | PASS | 2595 |  |  |  |
| EC-004 | behavioral | PASS | 2595 |  |  |  |
| EC-004 | semantic | PASS | 2595 |  |  |  |
| EC-005 | structural | PASS | 1627 |  |  |  |
| EC-005 | behavioral | PASS | 1627 |  |  |  |
| EC-005 | semantic | PASS | 1627 |  |  |  |
| EC-006 | structural | PASS | 1704 |  |  |  |
| EC-006 | behavioral | PASS | 1704 |  |  |  |
| EC-006 | semantic | PASS | 1704 |  |  |  |
| EC-007 | structural | PASS | 2694 |  |  |  |
| EC-007 | behavioral | PASS | 2694 |  |  |  |
| EC-007 | semantic | FAIL | 2694 |  |  |  |
| EC-008 | structural | PASS | 1316 |  |  |  |
| EC-008 | behavioral | PASS | 1316 |  |  |  |
| EC-008 | semantic | PASS | 1316 |  |  |  |
| EC-009 | structural | PASS | 2647 |  |  |  |
| EC-009 | behavioral | PASS | 2647 |  |  |  |
| EC-009 | semantic | PASS | 2647 |  |  |  |
| EC-010 | structural | PASS | 3012 |  |  |  |
| EC-010 | behavioral | PASS | 3012 |  |  |  |
| EC-010 | semantic | FAIL | 3012 |  |  |  |
| EC-011 | structural | PASS | 1860 |  |  |  |
| EC-011 | behavioral | PASS | 1860 |  |  |  |
| EC-011 | semantic | PASS | 1860 |  |  |  |
| EC-012 | structural | PASS | 1 | INVALID_REQUEST |  |  |
| EC-012 | behavioral | PASS | 1 | INVALID_REQUEST |  |  |
| EC-012 | semantic | PASS | 1 | INVALID_REQUEST |  |  |
| EC-013 | structural | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | behavioral | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | semantic | PASS | 0 | INVALID_REQUEST |  |  |
| EC-014 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-014 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-014 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-015 | structural | PASS | 1 | PROVIDER_UNAVAILABLE |  |  |
| EC-015 | behavioral | PASS | 1 | PROVIDER_UNAVAILABLE |  |  |
| EC-015 | semantic | PASS | 1 | PROVIDER_UNAVAILABLE |  |  |
| EC-016 | structural | PASS | 2787 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | behavioral | PASS | 2787 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | semantic | PASS | 2787 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-017 | structural | PASS | 1933 |  |  |  |
| EC-017 | behavioral | PASS | 1933 |  |  |  |
| EC-017 | semantic | FAIL | 1933 |  |  |  |
| EC-017 | adversarial | PASS | 1933 |  |  |  |
| EC-018 | structural | PASS | 2552 |  |  |  |
| EC-018 | behavioral | PASS | 2552 |  |  |  |
| EC-018 | semantic | PASS | 2552 |  |  |  |
| EC-018 | adversarial | PASS | 2552 |  |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-020 | structural | PASS | 3356 |  |  |  |
| EC-020 | behavioral | PASS | 3356 |  |  |  |
| EC-020 | semantic | PASS | 3356 |  |  |  |
| EC-020 | prior request | PASS | 2025 |  |  |  |
| EC-020 | current request | PASS | 1330 |  |  |  |
| EC-021 | structural | PASS | 1 |  |  |  |
| EC-021 | behavioral | PASS | 1 |  |  |  |
| EC-021 | semantic | PASS | 1 |  |  |  |
- Repair cycle 1: improved; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-007, EC-009, EC-010, EC-017, EC-018; outcomes: EC-007/FAIL, EC-009/PASS, EC-010/FAIL, EC-017/FAIL, EC-018/PASS; logical calls: 5; actual API attempts: 5
