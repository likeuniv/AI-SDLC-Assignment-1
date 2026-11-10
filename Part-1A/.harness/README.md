## Independent Validation Harness (`.harness/`)

### 1. Overview

The `.harness/` directory contains the independent validation harness developed for the Hospital Management System (HMS).

The harness provides an additional layer of quality assurance beyond the application's backend and frontend test suites. It executes predefined validation and performance checks against the application and captures the results as evidence.

The purpose of the harness is to evaluate the generated application against defined engineering constraints rather than relying only on the coding agent's implementation or its own claims of correctness.

### 2. Directory Structure

```text
.harness/
├── api.js
├── benchmark.js
├── benchmark.test.js
├── cli.js
├── fixtures/
│   ├── generator.js
│   ├── generator.test.js
│   ├── seed.js
│   └── time.js
├── package.json
├── preflight.js
├── preflight.test.js
└── runtime.js
```

### 3. Component Responsibilities

| File | Responsibility |
|---|---|
| `api.js` | Provides API interaction functionality used by harness operations. |
| `benchmark.js` | Executes performance benchmarking and evaluates measured response times against configured limits. |
| `benchmark.test.js` | Contains tests for the benchmark implementation. |
| `cli.js` | Main command-line entry point. Selects and executes the requested harness operation and saves execution evidence. |
| `preflight.js` | Implements preflight validation checks before application acceptance. |
| `preflight.test.js` | Contains tests for the preflight validation implementation. |
| `runtime.js` | Provides shared runtime functionality used by the harness. |
| `package.json` | Configures the harness as a JavaScript ES module package. |

**Fixtures**

The `fixtures/` directory contains supporting utilities for controlled and repeatable harness execution.

| File | Responsibility |
|---|---|
| `generator.js` | Generates deterministic fixture data and its manifest. |
| `generator.test.js` | Tests the fixture-generation implementation. |
| `seed.js` | Provides seed data for harness scenarios. |
| `time.js` | Provides time-related utilities for predictable test execution. |

### 4. Harness Execution Flow

The `cli.js` file acts as the main entry point and supports two primary operations:

**Preflight validation**

```bash
npm run harness:preflight
```

This command executes the preflight validation implemented in `preflight.js`. It uses the configured hospital time zone and supporting harness utilities to perform the defined checks.

**Performance benchmarking**

```bash
npm run harness:benchmark
```

This command executes the benchmarking implementation in `benchmark.js`. It measures application operation response times and evaluates the results against configured performance limits, including p95 latency.

Both commands use shared API and runtime utilities where required. Fixture-generation utilities provide controlled data for repeatable execution.

### 5. Application Quality Gates

In addition to independent preflight validation and performance benchmarking, the project uses application-level quality gates.

| Quality Gate | Execution Command | Purpose |
|---|---|---|
| Application tests | `npm test` | Executes backend and frontend automated tests. |
| Lint | `npm run lint` | Checks frontend and backend code for linting issues. |
| Security scan | `npm run security` | Executes Semgrep static application security analysis. |
| Production build | `npm run build` | Verifies that the frontend production build completes successfully. |
| Harness unit tests | `node --test .harness/*.test.js .harness/fixtures/*.test.js` | Tests the independent harness implementation. |
| Harness preflight | `npm run harness:preflight` | Executes independent application preflight checks. |
| Harness benchmark | `npm run harness:benchmark` | Evaluates application operation performance against configured limits. |

These quality gates complement the independent harness. Application tests, linting, security analysis and build validation check implementation quality, while the independent harness performs additional application-level validation.

### 6. Execution Evidence

Harness execution results are stored separately from application test outputs:

```text
evidence/
└── harness-results/
    ├── phase9-fixture-manifest.json
    ├── phase9-preflight-results.json
    └── phase9-benchmark-results.json
```

The generated evidence includes execution details such as the command, exit status, execution timestamp, fixture manifest information, and operation-specific validation or benchmark results.

### 7. Harness Tests vs Application Tests

The harness contains its own tests, which should not be confused with the HMS application tests.

- `backend/test/` contains backend application tests.
- `frontend/test/` contains frontend application tests.
- `.harness/` contains the independent validation and benchmarking implementation, along with tests for that implementation.
- `tests/` is reserved for application test execution outputs.
- `evidence/harness-results/` stores the results generated by harness execution.

### 8. Role in the AI-Augmented SDLC Workflow

The harness supports the validation stage of the Spec-Driven Development workflow:

1. Requirements and acceptance criteria are defined through Spec Kit.
2. The coding agent generates the HMS implementation based on the approved specifications.
3. Application tests are executed.
4. The independent harness performs preflight validation and performance benchmarking.
5. Execution results are captured as evidence.
6. Where genuine failures occur, the results can be reviewed and provided to the coding agent for corrective changes.
7. The harness is executed again to validate the changes.
8. Final acceptance remains a human decision.


## Master Harness Runner

Run the complete Part-1A validation suite from the project root:

```bash
npm run harness:all
```

The master runner executes the following checks sequentially:

1. Application tests
2. ESLint
3. Semgrep security scan
4. Frontend production build
5. Harness unit tests
6. Harness preflight
7. Performance benchmark

**Execution behaviour:**
- Continues executing checks even if an individual check fails.
- Captures command output and individual PASS/FAIL results.
- Generates a timestamped report under `evidence/harness-results/`.
- Exits with status `0` when all checks pass.
- Exits with status `1` when one or more checks fail.

The harness therefore provides an independent mechanism to validate AI-generated implementation results and maintain traceability between engineering expectations, implementation, and validation evidence.