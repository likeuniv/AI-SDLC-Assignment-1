# Evaluation Harness Log

- Run: 32ace92b-70f0-40a3-b535-a7c7b9700a49
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
- Successful extractions: 18
- Failed outcomes: 3
| Case | Check | Outcome | Duration (ms) | Safe error | Failure stage | Failure reason |
|---|---|---|---:|---|---|---|
| EC-001 | structural | PASS | 6293 |  |  |  |
| EC-001 | behavioral | PASS | 6293 |  |  |  |
| EC-001 | semantic | PASS | 6293 |  |  |  |
| EC-002 | structural | PASS | 2178 |  |  |  |
| EC-002 | behavioral | PASS | 2178 |  |  |  |
| EC-002 | semantic | PASS | 2178 |  |  |  |
| EC-003 | structural | PASS | 2416 |  |  |  |
| EC-003 | behavioral | PASS | 2416 |  |  |  |
| EC-003 | semantic | PASS | 2416 |  |  |  |
| EC-004 | structural | PASS | 2595 |  |  |  |
| EC-004 | behavioral | PASS | 2595 |  |  |  |
| EC-004 | semantic | PASS | 2595 |  |  |  |
| EC-005 | structural | PASS | 2483 |  |  |  |
| EC-005 | behavioral | PASS | 2483 |  |  |  |
| EC-005 | semantic | PASS | 2483 |  |  |  |
| EC-006 | structural | PASS | 2153 |  |  |  |
| EC-006 | behavioral | PASS | 2153 |  |  |  |
| EC-006 | semantic | PASS | 2153 |  |  |  |
| EC-007 | structural | PASS | 2427 |  |  |  |
| EC-007 | behavioral | PASS | 2427 |  |  |  |
| EC-007 | semantic | PASS | 2427 |  |  |  |
| EC-008 | structural | PASS | 1661 |  |  |  |
| EC-008 | behavioral | PASS | 1661 |  |  |  |
| EC-008 | semantic | PASS | 1661 |  |  |  |
| EC-009 | structural | PASS | 2488 |  |  |  |
| EC-009 | behavioral | PASS | 2488 |  |  |  |
| EC-009 | semantic | FAIL | 2488 |  |  |  |
| EC-010 | structural | PASS | 1797 |  |  |  |
| EC-010 | behavioral | PASS | 1797 |  |  |  |
| EC-010 | semantic | FAIL | 1797 |  |  |  |
| EC-011 | structural | PASS | 2540 |  |  |  |
| EC-011 | behavioral | PASS | 2540 |  |  |  |
| EC-011 | semantic | PASS | 2540 |  |  |  |
| EC-012 | structural | PASS | 0 | INVALID_REQUEST |  |  |
| EC-012 | behavioral | PASS | 0 | INVALID_REQUEST |  |  |
| EC-012 | semantic | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | structural | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | behavioral | PASS | 0 | INVALID_REQUEST |  |  |
| EC-013 | semantic | PASS | 0 | INVALID_REQUEST |  |  |
| EC-014 | structural | PASS | 1 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-014 | behavioral | PASS | 1 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-014 | semantic | PASS | 1 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-015 | structural | PASS | 0 | PROVIDER_UNAVAILABLE |  |  |
| EC-015 | behavioral | PASS | 0 | PROVIDER_UNAVAILABLE |  |  |
| EC-015 | semantic | PASS | 0 | PROVIDER_UNAVAILABLE |  |  |
| EC-016 | structural | PASS | 4022 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | behavioral | PASS | 4022 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-016 | semantic | PASS | 4022 | MULTIPLE_TRANSACTIONS | invariant_failure | MULTIPLE_TRANSACTIONS_DETECTED |
| EC-017 | structural | PASS | 1711 |  |  |  |
| EC-017 | behavioral | PASS | 1711 |  |  |  |
| EC-017 | semantic | FAIL | 1711 |  |  |  |
| EC-017 | adversarial | PASS | 1711 |  |  |  |
| EC-018 | structural | PASS | 2219 |  |  |  |
| EC-018 | behavioral | PASS | 2219 |  |  |  |
| EC-018 | semantic | PASS | 2219 |  |  |  |
| EC-018 | adversarial | PASS | 2219 |  |  |  |
| EC-019 | structural | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | behavioral | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-019 | semantic | PASS | 0 | INVALID_MODEL_RESPONSE | canonical_schema_failure |  |
| EC-020 | structural | PASS | 4049 |  |  |  |
| EC-020 | behavioral | PASS | 4049 |  |  |  |
| EC-020 | semantic | PASS | 4049 |  |  |  |
| EC-020 | prior request | PASS | 1704 |  |  |  |
| EC-020 | current request | PASS | 2345 |  |  |  |
| EC-021 | structural | PASS | 15 |  |  |  |
| EC-021 | behavioral | PASS | 15 |  |  |  |
| EC-021 | semantic | PASS | 15 |  |  |  |
- Repair cycle 1: improved; Re-evaluated eligible failed cases through the extraction service.; affected cases: EC-002, EC-009, EC-010, EC-011, EC-017; outcomes: EC-002/PASS, EC-009/FAIL, EC-010/FAIL, EC-011/PASS, EC-017/FAIL; logical calls: 5; actual API attempts: 5
