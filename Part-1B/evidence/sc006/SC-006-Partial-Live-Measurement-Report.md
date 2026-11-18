# SC-006 — Partial Live Measurement and Protocol Deviation

## 1. Status

| Item | Result |
|---|---|
| Test type | Partial live provider/browser measurement |
| Measurement date | 14 November 2026 |
| Protocol status | PARTIAL_MEASUREMENT |
| SC-006 acceptance status | NOT ESTABLISHED |
| Provider preflight | PASSED |
| Measured requests | 45 |
| Successful visible outcomes within 30 seconds | 45 |
| Failed or not visible within 30 seconds | 0 |
| Observed success rate | 100% |

**Important:** This is a partial measurement, not a formal SC-006 acceptance result. The original 63-request protocol was not completed. The observed 100% result must not be represented as proof that SC-006 has passed.

## 2. Objective

Measure the elapsed time from browser submission of a transaction statement to the point at which the production-built application displays either a structured result or a safe failure.

The measurement includes browser-to-server processing, provider interaction, validation, response handling, and UI rendering.

A request is counted as successful for this latency measurement when a structured result or safe failure becomes visible within 30 seconds.

## 3. Environment

| Parameter | Recorded environment |
|---|---|
| Provider | OpenAI |
| Model | gpt-6-luna |
| Region | Not declared in project configuration; provider-managed region unknown |
| Node.js | v24.22.2 |
| Browser | Firefox 159.0 |
| Operating system | Linux 7.0.0-43-generic x64 |
| Machine class | VirtualBox Ubuntu VM; 4 vCPUs; approximately 11 GiB RAM |
| Deployment mode | Production Vite build served by Express |
| Network conditions | Not independently instrumented; external provider latency included |

## 4. Measurement Procedure

1. A provider preflight request was performed before the measured run.
2. The production-built frontend was served by the Express application.
3. The live browser runner submitted eligible synthetic statement scenarios through the application UI.
4. Each selected scenario was measured three times.
5. Timing started when the browser submitted the analysis request.
6. Timing stopped when the UI displayed a structured result or safe failure.
7. The 30-second visibility threshold was applied to each measured request.
8. For the independent-statement scenario EC-020, a prior statement was submitted before each measured repetition. These setup requests were not included in the measured request count.
9. Only case IDs, repetition numbers, elapsed times, pass/fail outcomes, and safe error codes were retained.

## 5. Results

### 5.1 Aggregate results

| Metric | Observed result |
|---|---:|
| Measured requests | 45 |
| Visible within 30 seconds | 45 |
| Failed or not visible | 0 |
| Observed success rate | 100% |
| Minimum latency | 1,390 ms |
| Median latency | 2,067 ms |
| Maximum latency | 5,839 ms |
| Latency threshold | 30,000 ms |

### 5.2 Scenario coverage

Each of the following scenarios was measured three times:

- EC-001
- EC-002
- EC-003
- EC-004
- EC-005
- EC-006
- EC-007
- EC-008
- EC-009
- EC-010
- EC-011
- EC-016
- EC-017
- EC-018
- EC-020

Total: 15 scenarios × 3 repetitions = 45 measured requests.

### 5.3 Safe failure outcomes

The safe error code observed was:

- MULTIPLE_TRANSACTIONS

These responses were visible application-level rejections. They count as successful outcomes for the latency criterion because the application displayed a safe failure within the threshold. They do not count as successful transaction extractions.

## 6. Protocol Deviation and Limitations

The original SC-006 protocol requires all 21 synthetic cases to be measured three times, producing 63 measured requests.

This run measured only the 15 scenarios that could be submitted meaningfully through the live statement-entry UI.

The following cases were excluded from this live UI measurement:

| Case | Reason |
|---|---|
| EC-012 | Empty request/error-path test |
| EC-013 | Null request/error-path test |
| EC-014 | Malformed provider-output fixture |
| EC-015 | Controlled provider-error fixture |
| EC-019 | Invalid provider-output schema fixture |
| EC-021 | Validator-boundary test without a live statement submission |

These cases require separate controlled tests rather than ordinary live statement submissions through the UI.

Additional requests not included in the 45 measured requests:

- 3 unmeasured independence setup requests for EC-020.
- 1 provider preflight request.

The provider preflight passed. No provider-unavailability invalidation was recorded.

The network conditions were not independently instrumented. The observed latency includes external provider latency, but this run does not establish performance across different network conditions, regions, or machine classes.

## 7. Acceptance Assessment

The original SC-006 acceptance protocol remains unchanged:

- 21 synthetic cases.
- 3 repetitions per case.
- 63 measured requests.
- At least 95% of measured requests, rounded up to 60 of 63, must display a result or safe failure within 30 seconds.
- Provider-unavailability periods invalidate the run.

This measurement does not satisfy the required 63-request coverage.

**Final assessment: SC-006 acceptance is NOT ESTABLISHED.**

The observed 45/45 result is evidence of latency behavior for the measured subset only. It must not be substituted for the full acceptance protocol or used to change the acceptance threshold.

## 8. Evidence and Reproducibility

Machine-readable measurement evidence:

`evidence/sc006/live-firefox-results.json`

The JSON evidence retains:

- Test type and protocol status.
- Environment manifest.
- Protocol deviation details.
- Provider preflight status.
- Aggregate latency statistics.
- Case IDs, repetition numbers, elapsed times, pass/fail outcomes, and safe error codes.

No transaction statements, generated transaction details, raw provider responses, or API credentials are retained in the evidence.

## 9. Conclusion

The partial live browser measurement completed successfully. All 45 measured requests displayed either a structured result or a safe failure within 30 seconds. The median observed latency was 2,067 ms.

However, only 15 of the 21 required scenarios were measured. Therefore, the original SC-006 acceptance criteria have not been fully evaluated.

SC-006 remains **NOT ESTABLISHED** pending completion of the full documented acceptance protocol.
