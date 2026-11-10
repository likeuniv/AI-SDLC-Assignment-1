# Hospital Management System (HMS) — Version 1.0

## 1. Project Overview

This project is developed as part of the BITS WILP AI-Augmented SDLC assignment using Specification-Driven Development (SDD) and Spec Kit.

HMS is a modular-monolith web application consisting of a React frontend, Node.js/Express REST API and SQLite database.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19, JavaScript, Vite 8 |
| Backend | Node.js 24, Express 5 |
| Database | SQLite, better-sqlite3 |
| Password hashing | bcrypt |
| Testing | Node.js built-in test runner |
| Code quality | ESLint |
| Security scanning | Semgrep Community Edition |
| Development approach | Spec Kit / SDD |

## 3. Functional Scope

The application supports:
- Patient registration, authentication and profile management.
- Beneficiary management and adult-beneficiary authorization.
- Doctor discovery and profile management.
- Department management.
- Doctor availability and schedule management.
- Appointment booking, viewing, cancellation and completion.
- Role- and permission-based administrative operations.

### User Roles
- Patient
- Doctor
- Hospital Admin / Staff

### Out of Scope
Billing, pharmacy, laboratory management, inpatient/bed management, electronic medical records, insurance, video consultations, external notifications, multi-branch management and AI diagnosis.

## 4. Project Structure

```text
Part-1A/
├── .specify/                 # Spec Kit configuration
├── specs/001-hms-v1/         # Specification, plan and tasks
├── frontend/                 # React application and tests
├── backend/                  # Express API, database and tests
├── .harness/                 # Independent validation harness
├── tests/                    # Latest application test reports
├── evidence/
│   ├── initial-generation/
│   ├── final-generation/
│   ├── harness-results/
│   ├── validation-history/
│   ├── traceability.csv
│   ├── harness-log.md
│   └── README.md
└── README.md