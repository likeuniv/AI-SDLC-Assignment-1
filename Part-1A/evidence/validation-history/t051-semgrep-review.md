# T051 — Semgrep Security Review

## Standard implementation scan
- Configuration: p/default
- Targets scanned: 126
- Rules executed: 254
- Findings: 0; blocking findings: 0
- Parsed lines: approximately 99.9%
- Evidence: t051-semgrep.txt, t051-semgrep-verbose.txt

## Supplementary test and harness scan
- Targets scanned: 29; rules executed: 203
- Findings: 0; blocking findings: 0
- Parsed lines: approximately 100%
- Evidence: t051-semgrep-tests-harness.txt

## Extended-timeout rerun
- Timeout: 30 seconds per rule per file
- Targets scanned: 29; rules executed: 203
- Findings: 0; blocking findings: 0
- Two rule timeouts remain: Express SSRF in backend/test/integration/appointments.test.js and Express insecure-template-usage in frontend/test/app.test.js
- Evidence: t051-semgrep-tests-harness-rerun.txt

## Limitations and disposition
- The standard scan uses Semgrep default ignore behavior; tests and harness were scanned separately using the internal --x-ignore-semgrepignore-files option.
- The extended scan still has two rule timeouts. These are analysis limitations, not confirmed vulnerabilities.
- The standard scan reported a parser limitation in a Spec Kit shell script.
- No confirmed critical or high Semgrep findings were reported.
- A zero-finding scan does not prove the application is vulnerability-free.
