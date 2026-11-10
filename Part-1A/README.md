# Hospital Management System (HMS) — Part 1A

## 1. Project Overview

The Hospital Management System (HMS) is a web-based application developed as an individual assignment for the AI-Augmented Software Development Life Cycle (AI-SDLC) course.

The project demonstrates **Specification-Driven Development (SDD)** using Spec Kit and an AI-assisted development workflow.

The application provides essential hospital management capabilities, including patient registration, beneficiary management, doctor discovery, doctor availability management, appointment booking and cancellation, and hospital staff operations.

The system is designed as a modular monolithic application with a React frontend, Express backend, and SQLite database.

## 2. Project Objectives

The primary objectives are:

- Apply a specification-driven approach to software development.
- Convert functional and non-functional requirements into an implementation plan.
- Use Spec Kit to organize specifications, design decisions, and implementation tasks.
- Develop a functional Hospital Management System.
- Implement authentication and role-based authorization.
- Validate application behavior through automated tests.
- Perform code quality and security checks.
- Use an independent validation harness to evaluate important application workflows.
- Maintain requirement-to-test traceability and validation evidence.

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, JavaScript, Vite 8 |
| Backend | Node.js 24, Express 5 |
| Database | SQLite, better-sqlite3 |
| Authentication | bcrypt, secure session cookies |
| API | REST APIs |
| Testing | Node.js built-in test runner |
| Code Quality | ESLint |
| Security Scanning | Semgrep Community Edition |
| Version Control | Git |
| Development Approach | Spec Kit, Specification-Driven Development |

## 4. Main Features

### 4.1 Patient Management

- Patient registration.
- Patient login and authentication.
- Patient profile management.
- Access to patient-specific information.

### 4.2 Beneficiary Management

- Manage beneficiaries associated with a patient.
- Support beneficiary authorization.
- Enforce access restrictions for beneficiary-related operations.

### 4.3 Doctor Management

- Discover available doctors.
- View doctor and department information.
- Manage doctor availability and schedules.

### 4.4 Appointment Management

- Book appointments with available doctors.
- View appointment information.
- Cancel appointments.
- Support appointment completion.
- Prevent conflicting appointment bookings.

### 4.5 Hospital Staff Operations

- Staff dashboard.
- Permission-controlled hospital operations.
- Role-based access to authorized functionality.

### 4.6 Authentication and Authorization

- Password hashing using bcrypt.
- Session-based authentication.
- Role-based access control.
- Protected API routes.
- Authorization checks for sensitive operations.

## 5. System Architecture

The application follows a **Modular Monolith Architecture**.

The frontend, backend, and database are organized into separate logical layers.

### 5.1 Frontend Layer

- Developed using React.
- Uses Vite for development and production builds.
- Provides user interfaces for patient, doctor, and staff workflows.
- Communicates with the backend through REST APIs.

### 5.2 Backend Layer

- Developed using Node.js and Express.
- Handles authentication and authorization.
- Implements application business logic.
- Exposes REST API endpoints.
- Organizes functionality into routes, controllers, services, and repositories.

### 5.3 Database Layer

- Uses SQLite with better-sqlite3.
- Maintains persistent application data.
- Supports relational data operations and integrity constraints.

### 5.4 High-Level Request Flow

```text
+--------------------------+
|      React Frontend      |
|     (Vite Application)   |
+------------+-------------+
             |
             | REST API Requests
             |
             v
+--------------------------+
|      Express Backend     |
|                          |
|  Routes                  |
|  Controllers             |
|  Services                |
|  Repositories            |
|  Authentication          |
|  Authorization           |
+------------+-------------+
             |
             | Database Operations
             |
             v
+--------------------------+
|       SQLite Database    |
|     (better-sqlite3)     |
+--------------------------+
```

## 6. Project Structure

```text
Part-1A/
│
├── .specify/
│   └── Spec Kit configuration, templates and scripts
│
├── specs/
│   └── 001-hms-v1/
│       └── Requirements, design and implementation tasks
│
├── backend/
│   ├── src/
│   │   └── Backend application source code
│   └── test/
│       └── Backend automated tests
│
├── frontend/
│   ├── src/
│   │   └── React application source code
│   └── test/
│       └── Frontend automated tests
│
├── tests/
│   ├── full-suite-tests.txt
│   └── coverage.txt
│
├── .harness/
│   ├── api.js
│   ├── benchmark.js
│   ├── benchmark.test.js
│   ├── cli.js
│   ├── fixtures/
│   ├── preflight.js
│   ├── preflight.test.js
│   └── runtime.js
│
├── evidence/
│   ├── initial-generation/
│   ├── final-generation/
│   ├── harness-results/
│   ├── validation-history/
│   ├── traceability.csv
│   ├── harness-log.md
│   └── README.md
│
├── package.json
└── README.md
```

## 7. Prerequisites

Install the following tools before running the application:

- Node.js version 24.
- npm.
- Git.
- Semgrep Community Edition (for security scanning).

The backend and frontend require Node.js version `>=24 <25`.

## 8. Installation

Clone the repository and navigate to the Part-1A directory.

Install backend dependencies:

```bash
npm --prefix backend install
```

Install frontend dependencies:

```bash
npm --prefix frontend install
```

## 9. Running the Application

The application uses the `Asia/Kolkata` timezone for hospital-related date and time operations.

Set the timezone before starting the application:

```bash
export HOSPITAL_TIME_ZONE=Asia/Kolkata
```

### 9.1 Start the Backend

Open a terminal in the Part-1A directory:

```bash
npm --prefix backend run dev
```

### 9.2 Start the Frontend

Open another terminal in the Part-1A directory:

```bash
npm --prefix frontend run dev
```

### 9.3 Default Ports

| Component | Port |
|---|---:|
| Backend | 3000 |
| Frontend | 5173 |

Open the frontend using the local Vite development URL displayed in the terminal.

## 10. Testing and Validation

The project uses automated testing and independent validation to verify application behavior.

### 10.1 Application Tests

Run the complete backend and frontend test suites:

```bash
npm test
```

### 10.2 Code Quality

Run ESLint for both frontend and backend:

```bash
npm run lint
```

### 10.3 Production Build

Build the frontend application:

```bash
npm run build
```

### 10.4 Security Scanning

Run Semgrep:

```bash
npm run security
```

The scan reported zero findings. Some rules reported timeouts, so this result should not be interpreted as proof that the entire codebase is free of security vulnerabilities.

### 10.5 Coverage

Run the coverage command:

```bash
npm run coverage
```

Coverage output is also retained in:

```text
tests/coverage.txt
```

### 10.6 Independent Harness

Run the independent harness preflight checks:

```bash
HOSPITAL_TIME_ZONE=Asia/Kolkata npm run harness:preflight
```

Run the independent performance benchmark:

```bash
HOSPITAL_TIME_ZONE=Asia/Kolkata npm run harness:benchmark
```

## 11. Latest Validation Results

The following results represent the latest recorded validation run.

| Validation | Result |
|---|---|
| Backend automated tests | 158 passed |
| Frontend automated tests | 18 passed |
| Total automated tests | 176 passed |
| Test failures | 0 |
| ESLint | Passed |
| Frontend production build | Passed |
| Semgrep | 0 findings; some rule timeouts reported |
| Backend npm audit | 0 vulnerabilities |
| Frontend npm audit | 0 vulnerabilities |
| Harness unit tests | 10 passed |
| Harness preflight | 49 passed, 0 failed |
| Harness benchmark | 5 operations passed |

### 11.1 Coverage Results

| Coverage Metric | Result |
|---|---:|
| Line Coverage | 90.41% |
| Branch Coverage | 82.08% |
| Function Coverage | 96.15% |
| Statement Coverage | Not separately reported |

The Node.js coverage output does not separately report statement coverage. Therefore, no statement coverage percentage is claimed.

### 11.2 Independent Benchmark Results

The latest recorded benchmark run used 10 warm-up iterations and 100 measured samples per operation.

| Operation | p95 Latency | Configured Limit |
|---|---:|---:|
| Doctor Search | 7.277 ms | 1,000 ms |
| Paginated Patient Reads | 4.911 ms | 1,000 ms |
| Paginated Appointment Reads | 12.203 ms | 1,000 ms |
| Appointment Booking | 5.381 ms | 2,000 ms |
| Appointment Cancellation | 4.977 ms | 2,000 ms |

All five benchmark operations passed their configured thresholds in the recorded run.

These measurements represent local test-environment results and should not be interpreted as production performance guarantees.

## 12. Independent Harness and Test Data

The independent validation harness is maintained separately from the application test suites under `.harness/`.

It provides:

- Preflight validation.
- Fixture generation.
- Database seeding.
- Runtime checks.
- API workflow validation.
- Performance benchmarking.

### 12.1 Fixture Dataset

The generated validation dataset contains:

| Entity | Count |
|---|---:|
| Patients | 200 |
| Beneficiaries | 100 |
| Doctors | 20 |
| Departments | 10 |
| Availability Slots | 300 |
| Appointments | 500 |

Appointment status distribution:

| Status | Count |
|---|---:|
| BOOKED | 100 |
| CANCELLED | 200 |
| COMPLETED | 200 |

Additional fixture validation results:

- Appointment overlap count: 0.
- Missing authorization audit count: 0.
- Sessions: 3.
- Database integrity check: Passed.
- Foreign key violations: 0.
- Timestamps: Anchored to the configured timezone.
- SQLite validation access: Read-only.

### 12.2 Harness Result Files

The latest harness outputs are stored under:

```text
evidence/harness-results/
```

Important files:

- `phase9-preflight-results.json`
- `phase9-fixture-manifest.json`
- `phase9-benchmark-results.json`

## 13. Requirements Traceability

The requirements traceability matrix is maintained in:

```text
evidence/traceability.csv
```

It maps functional requirements, user-story acceptance scenarios, non-functional requirements, and success criteria to implementation and validation evidence.

Latest recorded summary:

| Traceability Status | Count |
|---|---:|
| Total Entries | 147 |
| Covered | 134 |
| Partial | 13 |

Partial entries identify areas where the available implementation or validation evidence does not fully demonstrate the corresponding requirement.

These gaps are retained transparently rather than being marked as fully covered.

## 14. Evidence Organization

The `evidence/` directory contains the project validation and development evidence.

| Directory/File | Purpose |
|---|---|
| `initial-generation/` | Initial AI-assisted generation evidence |
| `final-generation/` | Final AI-assisted generation evidence |
| `harness-results/` | Independent harness JSON outputs |
| `validation-history/` | Historical validation records |
| `traceability.csv` | Requirements traceability matrix |
| `harness-log.md` | Independent harness execution summary |
| `README.md` | Evidence directory documentation |

The historical validation files are retained to preserve the development and verification history.

## 15. Security and Data Handling

The application includes security-related implementation and validation measures such as:

- Password hashing using bcrypt.
- Parameterized database operations.
- Protected API routes.
- Role-based authorization.
- Session-based authentication.
- Database integrity checks.
- Static security analysis using Semgrep.

Security scan results are limited to the rules and files successfully analyzed. Static analysis does not replace a comprehensive security assessment or penetration test.

Runtime database files and backups are excluded from version control through `.gitignore`.

## 16. Scope Limitations

The current version focuses on core hospital appointment and user management workflows.

The following capabilities are outside the scope of this version:

- Billing and payment processing.
- Pharmacy management.
- Laboratory management.
- Inpatient and bed management.
- Electronic medical records.
- Insurance processing.
- Video consultations.
- AI-based diagnosis.

These capabilities may be considered for future versions.

## 17. Future Enhancements

Potential future enhancements include:

- Billing and payment integration.
- Pharmacy and inventory management.
- Laboratory information management.
- Inpatient and bed allocation.
- Electronic medical records.
- Notification integration.
- Advanced reporting and analytics.
- Cloud deployment and production monitoring.

## 18. Assignment Context

This project demonstrates the application of AI-Augmented SDLC practices through specification-driven development, AI-assisted implementation, modular architecture, automated testing, independent validation, security scanning, and requirements traceability.

The implementation and supporting evidence are organized to make the development process and validation results reviewable.