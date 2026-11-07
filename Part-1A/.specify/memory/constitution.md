# Hospital Management System (HMS) Constitution

## Core Principles

### I. Patient-Centered, Bounded Product
HMS Version 1.0 shall provide a secure, reliable and usable platform for patient onboarding, doctor and department management, appointment scheduling and essential hospital administration. Requirements and acceptance criteria shall preserve the patient, doctor and authorized hospital staff workflows defined here. No implementation, specification or plan may silently expand or alter this scope. Features listed as out of scope below shall not be introduced in Version 1.0.

### II. Modular Monolith and Separation of Concerns
The application shall be a modular monolith, not a distributed-services architecture. Functional modules shall have clear ownership and boundaries. The backend shall separate REST routes, controllers, business services and data repositories; business rules shall reside in services and remain independent of HTTP and React presentation concerns. The frontend shall use reusable React components and keep presentation separate from API and workflow logic. Modules shall interact through explicit interfaces and shall not bypass another module's business rules or repository. Design and dependencies shall remain as simple as possible while meeting the requirements.

### III. Secure Identity, Least Privilege and Privacy
All protected operations shall authenticate the caller and authorize the requested action on the server. Role-based access control (RBAC) shall enforce least privilege for patients, doctors and hospital administrative staff; frontend route guards are supplementary and never replace backend enforcement. Patients shall not access doctor-only or administrative operations, doctors shall be restricted to authorized doctor operations and appointment-related information, and administrative actions shall require an authorized staff account. A patient's access to beneficiary records and appointments shall be checked against the account-beneficiary relationship on every request. Beneficiaries have no separate login in Version 1.0. Access to another adult's information shall respect applicable authorization and privacy requirements; the implementation shall not assume that family relationship alone grants access.

### IV. Transactional, Correct Data
Relational integrity shall be enforced between accounts, patients, beneficiaries, doctors, departments, availability and appointments using SQLite primary keys, foreign keys, appropriate unique constraints, checks and indexes. Every appointment shall identify both the actual patient receiving care and the account that booked it. Booking shall verify the requested slot is configured as available and prevent conflicting active bookings for a doctor and time slot, including under concurrent requests. Booking and cancellation shall use database transactions; successful cancellation shall release the slot. Appointment statuses shall be `BOOKED`, `CANCELLED` and `COMPLETED`, with valid transitions enforced in business logic and, where appropriate, database constraints. Tests shall demonstrate transaction consistency, slot reuse after cancellation and rejection of duplicate or conflicting bookings.

### V. Testable Requirements and Quality Gates
Specifications shall translate approved requirements into acceptance criteria and tests. Business logic shall have unit tests; critical REST workflows shall have integration tests, including authentication, role authorization, validation, beneficiary access, booking, cancellation, status transitions and database integrity. The Node.js built-in test runner shall be used. Application business logic shall achieve at least 80% statement coverage. Critical functional and security tests must pass. ESLint shall complete without errors, and Semgrep security scans shall be run. Quality checks or assertions shall not be disabled, removed or weakened to obtain a passing result.

### VI. Consistent, Maintainable Interfaces
The API shall follow REST conventions, use appropriate HTTP methods and status codes, validate all incoming requests, and return consistent request, success and error structures. Errors shall be handled centrally and meaningfully; production responses shall not expose stack traces, credentials, SQL details or other internal implementation information. Code shall use consistent JavaScript ES module conventions and naming, maintain high cohesion and low coupling, and keep deterministic business logic out of presentation code. Important architectural and API decisions shall be documented.

## Technology and Architecture Standards

- Frontend: React with JavaScript. Backend: Node.js with Express.js. Database: SQLite. Application code shall use JavaScript ES modules.
- The API shall be RESTful. Tests shall use the Node.js built-in test runner; linting shall use ESLint; security scanning shall use Semgrep.
- Dependencies shall be stable, maintained and limited to those needed. New frameworks, services or architectural complexity require a demonstrated Version 1.0 need and must not undermine the modular-monolith boundary.
- Backend modules shall follow the routes → controllers → services → repositories separation. Data access shall be centralized in repositories and use parameterized SQL exclusively.
- Database schema changes shall be reproducible from version-controlled initialization scripts or migrations. Foreign-key enforcement shall be enabled, and frequently queried fields shall be indexed where justified.
- Authentication and session/token mechanisms shall be implemented using secure defaults. Passwords shall be hashed with bcrypt; plaintext passwords shall never be stored or logged. Secrets and credentials shall be provided through appropriate runtime configuration, never hardcoded.
- Logs shall be structured and useful for diagnosing operational failures, while excluding passwords, authentication secrets and unnecessary patient or beneficiary information. Errors shall be observable to maintainers without leaking internals to users.

## Version 1.0 Functional Boundaries

### In-Scope Capabilities
1. **Patient management:** patient self-registration, authentication, profile creation and management; account holder creation and management of multiple beneficiary profiles; relationship recording; and access only to authorized beneficiary information. Beneficiaries do not need login accounts.
2. **Doctor management:** doctor accounts provisioned by authorized administrative staff; doctor profile management within authorization; specialization and department association; and doctor availability management.
3. **Department management:** create, view and update departments; assign doctors; and display department and specialization information.
4. **Authentication and authorization:** secure login and logout, RBAC, protected frontend routes and protected backend APIs, with server-side authorization and access validation on every protected operation.
5. **Doctor discovery:** view available doctors; search by name or specialization; view doctor profiles and departments; and view availability.
6. **Availability:** doctors define and manage appointment slots; patients can see available slots; booking is limited to configured availability; and a slot with an active appointment cannot be booked again.
7. **Appointments:** book for oneself or an authorized beneficiary; view appointments for oneself and authorized beneficiaries; cancel appointments the account is authorized to manage; view appointment history and doctor schedules; allow authorized staff to manage appointments; and allow doctors to view upcoming appointments, relevant associated patient details, and update appointment status where authorized.
8. **Administrative operations:** authorized staff can log in, register and manage doctors, create and manage departments, view registered patients, view and manage appointments, manage doctor availability and access administrative dashboards.

An appointment shall distinguish the person receiving the consultation from the authenticated account responsible for booking. Appointment and patient information shall only be exposed or changed by an authenticated actor whose role and relationship authorize the specific action.

### Explicitly Out of Scope for Version 1.0
Billing and payment processing; pharmacy or medicine inventory; laboratory management; inpatient or bed management; electronic medical records (EMR); insurance management; video consultations; external SMS, email or WhatsApp notifications; multi-branch hospital management; and AI-based diagnosis or medical recommendations. These capabilities shall not be added through implementation assumptions or indirect scope expansion. Future extensibility shall be achieved through clear boundaries, not by implementing these modules now.

## Security, Privacy and Data Integrity Requirements

- Validate and sanitize input at trust boundaries, enforce server-side authorization for every protected operation, and use parameterized SQL for every database query.
- Enforce account ownership and beneficiary authorization in the backend for beneficiary profile and appointment reads, writes and cancellations. Do not rely on client-supplied role, owner or relationship identifiers without validating them against authenticated server-side identity and persisted relationships.
- Use fictional patient and medical data in development, tests, demonstrations and fixtures. Do not expose sensitive information beyond what the authorized workflow requires.
- Use appropriate database transactions for booking and cancellation; enforce foreign keys and relational constraints; and reject invalid appointment status transitions and attempts to book outside availability.
- Handle authentication, validation, authorization, not-found, conflict and unexpected errors consistently. Never return stack traces or internal details to end users in production.
- Security and privacy controls apply equally to patient, doctor and administrative APIs, regardless of whether a frontend currently exposes the operation.

## Verification and Acceptance

Every release and final acceptance shall verify:

- At least 80% statement coverage of application business logic, measured by the configured test run.
- All critical functional and security tests pass, including authentication, RBAC, beneficiary authorization, input validation, appointment conflict prevention, booking/cancellation consistency and database constraints.
- Every protected API enforces the appropriate server-side role and object-level authorization.
- No duplicate active appointment exists for the same doctor and time slot, and only configured available slots can be booked.
- Cancellation releases a slot and all critical booking/cancellation operations preserve data consistency.
- ESLint reports no errors and a Semgrep security scan has been run; no unresolved critical or high-severity security finding remains at final acceptance.
- Validation evidence records the commands or checks run, results, failures, corrective actions and subsequent validation. Failures shall not be concealed as successful checks.

## Engineering Governance

- This constitution is the engineering foundation for HMS. All subsequent specifications, clarifications, plans, tasks, implementation and validation shall comply with it.
- Approved specifications and acceptance criteria are authoritative implementation requirements. Maintain traceability from each requirement through design, tasks, implementation and tests.
- Conflicts between a request and this constitution shall be identified and resolved through the appropriate upstream specification and governance process before implementation; do not silently change approved requirements or this constitution.
- Scope changes shall be documented in the relevant specification and planning artifacts and approved before work begins. Out-of-scope capabilities require an explicit approved version/scope change.
- Preserve initial implementation and harness validation evidence. Do not remove tests, weaken assertions or disable mandatory quality checks. Document failed validation, corrective action and the result of rerunning it.
- Independent validation shall cover functional correctness, code quality and security. Human review is required before final acceptance; passing automation alone is not approval.
- Amendments require an explicit documented change, review of affected requirements and tests, and an updated version and amendment date. If an amendment changes scope or established standards, all dependent specifications and plans shall be reconciled.

**Version**: 1.0.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
