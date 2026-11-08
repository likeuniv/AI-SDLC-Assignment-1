# Implementation Plan: Hospital Management System (HMS) Version 1.0

**Branch**: `001-hms-v1` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

**Input**: Approved HMS constitution and finalized Version 1.0 feature specification.

## Summary

Implement HMS as a single deployable modular monolith: a React JavaScript SPA and a Node.js/Express REST API backed by SQLite. Keep business rules in backend services, database access in repositories, and role/object authorization on the server. Make booking, cancellation, doctor completion and adult-beneficiary decisions atomic and auditable. Use one configured hospital IANA timezone for input/display and UTC instants for persistence. Validate through Node's built-in test runner, ESLint, Semgrep Community Edition, and an independently runnable local harness using the specification's deterministic fixture and measurable benchmark.

This plan does not include application source code, task sequencing, or any feature outside the approved Version 1.0 scope.

## Technical Context

**Language/Version**: JavaScript ES modules; target Node.js 24.x LTS on Ubuntu and pin the exact supported runtime range in the repository during implementation.

**Primary Dependencies**: React, Express, `better-sqlite3`, and bcrypt. Use Vite only as the React development/build tool if needed. Prefer Node built-ins for crypto, time-zone formatting, test execution and scripts. Avoid an ORM, distributed services, external identity provider, paid service, notification provider, and additional framework unless a demonstrated requirement justifies one.

### SQLite driver selection

| Option | Evaluation for the selected Node.js 24 LTS / Ubuntu target |
|---|---|
| `better-sqlite3` | Recommended. Maintained project documents prebuilt binaries for major platforms and requires a currently supported Node version; Node 24 is an LTS release and the target Ubuntu architecture must be confirmed during dependency installation. Its documented synchronous API provides prepared statements with bound parameters, `.transaction(...).immediate()` (`BEGIN IMMEDIATE`), `.pragma()` for WAL and foreign-key configuration, and a connection `timeout` for locked databases. A short synchronous SQLite transaction fits the local single-process workload and avoids crossing async event-loop ticks while locks are held. Sources: [project README](https://github.com/WiseLibs/better-sqlite3), [API documentation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md), [Node.js release schedule](https://nodejs.org/en/about/previous-releases). |
| `node:sqlite` | Excluded for now. It provides core prepared statements and works with SQLite pragmas, but Node's documentation marks the module experimental for the Node 22/24 LTS lines (release-candidate status begins at Node 25.7), which is a weaker stability basis for the required database boundary. Source: [Node.js SQLite documentation](https://nodejs.org/api/sqlite.html). |
| `sqlite3` (`node-sqlite3`) | Excluded. Its repository currently labels the project deprecated/unmaintained. Despite Node-API binaries and parameter binding, it is not an appropriate new dependency for this maintained-dependencies requirement. Source: [project repository](https://github.com/TryGhost/node-sqlite3). |

`better-sqlite3` supports all required SQLite controls: execute `BEGIN IMMEDIATE` through its immediate transaction wrapper; set `journal_mode = WAL` with the documented pragma API; configure a bounded lock wait through its `timeout` connection option (or SQLite `busy_timeout` pragma); explicitly enable and verify `foreign_keys`; and use prepared statements with bound positional or named parameters for every untrusted value. These are SQLite/driver capabilities, not substitutes for application validation. Pin a maintained driver release compatible with Node 24 and verify package installation, native binary loading on the target Ubuntu architecture, and these behaviors on Ubuntu before implementation proceeds. If a prebuilt binary is unavailable, verify the documented source-build toolchain rather than adding a second driver.

**Storage**: SQLite file on local Ubuntu through `better-sqlite3`. Enable foreign keys and WAL, configure a bounded busy timeout, and version schema changes through ordered SQL migrations or initialization scripts.

**Testing**: `node:test` and `node:assert`; test the backend services and real SQLite repositories. Use HTTP-level integration tests against an ephemeral local Express server. Keep UI tests limited to critical workflows and use the smallest maintained test tooling that the repository requires. Enforce at least 80% statement coverage for business logic. Run ESLint and Semgrep CE.

**Target Platform**: Local Ubuntu development and demonstration environment; no production-scale or high-availability claim.

**Project Type**: Full-stack web application, deployed as one application/API boundary over a single local database.

**Performance Goals**: Meet NFR-004: p95 <= 1,000 ms for doctor search and paginated reads; p95 <= 2,000 ms for booking and cancellation, using the fixed local fixture, 3 concurrent clients and prescribed sample procedure.

**Constraints**: Preserve all 11 user stories, FR-001–FR-049, API error semantics, beneficiary authorization, staff permissions and Version 1.0 scope. No billing, pharmacy, laboratory, EMR, insurance, video consultation, external messaging, multi-branch, or AI features. Use fictional test data only.

**Scale/Scope**: Local benchmark fixture: 200 patient accounts, 100 beneficiaries, 20 doctors, 10 departments, 300 future availability slots and 500 appointments; no claim beyond this benchmark.

## Constitution Check

| Gate | Plan decision | Result |
|---|---|---|
| Bounded Version 1.0 scope | Implement only the approved patient, beneficiary, doctor, department, availability, appointment and essential administrative workflows. | PASS |
| Modular monolith and separation | One frontend, one Express backend, explicit module boundaries, routes/controllers/services/repositories; no distributed services. | PASS |
| RBAC, least privilege and privacy | Authorize every protected operation on the server; verify ownership, doctor assignment and staff permission; conceal cross-account objects as specified. | PASS |
| Transactional integrity | SQLite constraints plus serialized transactions for writes, availability conflicts, appointments and authorization decisions. | PASS |
| Technology standards | React/JavaScript, Node/Express, SQLite, ES modules, REST, `node:test`, ESLint and Semgrep CE. | PASS |
| Quality gates | Critical integration/security tests, >=80% business-logic statement coverage, zero ESLint errors and Semgrep scan without unresolved critical/high findings. | PASS |
| Error safety and traceability | Central safe error mapping, structured privacy-conscious logs, requirement-to-test traceability and retained independent validation evidence. | PASS |

No constitutional exception or complexity waiver is proposed.

## Architecture

### Runtime boundaries

1. **React client**: reusable components and role-aware routes; holds no authority to grant access. It calls the REST API and renders only returned, authorized data.
2. **Express API**: the sole application boundary for identity, validation, business rules and authorization. Keep controllers thin; controllers map HTTP input/output and delegate to services.
3. **SQLite persistence**: one local database. Repositories own SQL and transactions; all SQL is parameterized. Migrations and deterministic fictional fixtures are version-controlled.

Serve the built SPA and `/api/v1` from the same origin where practical. In development, use a frontend dev-server proxy to Express rather than adding a broad CORS policy. This keeps local cookie/session behavior simple and avoids unnecessary cross-origin exposure.

### Backend module boundaries

Each domain module owns its routes, controller, service, repository, validation and tests:

- `auth`: patient registration, login/logout, session validation and account identity.
- `patients`: patient profile and staff-authorized patient directory reads.
- `beneficiaries`: beneficiary CRUD, adult authorization eligibility, review decisions and immutable decision audit records.
- `doctors`: staff provisioning, permitted doctor profile management and public discovery.
- `departments`: department CRUD and doctor association.
- `availability`: schedule creation/read/update and interval conflict rules.
- `appointments`: booking, list/history, cancellation, doctor completion and role-scoped reads.
- `admin`: permission-scoped dashboard and administrative list composition; it must call domain services rather than reach into their repositories.

Shared infrastructure is limited to configuration, database/migrations, authentication/authorization middleware, validation/error handling, logging and common API response helpers.

### Frontend structure

Use one React SPA with shared layout/forms and separate route areas for patient, doctor and staff journeys. Keep API clients and feature workflow hooks separate from visual components. Route guards improve UX but never substitute for backend checks.

## Project Structure

```text
Part-1A/
├── package.json                  # Workspace scripts and pinned tool/runtime metadata
├── eslint.config.js
├── semgrep.yml                   # Local Semgrep CE rules/configuration, if required
├── frontend/
│   ├── index.html
│   └── src/
│       ├── app/                  # Router, session context, shared layout
│       ├── components/           # Reusable UI and form components
│       ├── features/
│       │   ├── auth/
│       │   ├── patients/
│       │   ├── beneficiaries/
│       │   ├── doctors/
│       │   ├── departments/
│       │   ├── availability/
│       │   ├── appointments/
│       │   └── admin/
│       └── api/                  # HTTP client, response/error mapping
├── backend/
│   ├── src/
│   │   ├── app.js                # Express wiring
│   │   ├── server.js             # Runtime startup/shutdown
│   │   ├── config/
│   │   ├── middleware/           # Request ID, auth, permissions, validation, errors
│   │   ├── modules/<domain>/
│   │   │   ├── routes.js
│   │   │   ├── controller.js
│   │   │   ├── service.js
│   │   │   ├── repository.js
│   │   │   └── validation.js
│   │   ├── db/
│   │   │   ├── connection.js
│   │   │   └── migrations/
│   │   └── shared/               # Time, errors, logging, API envelopes
│   └── test/
│       ├── unit/
│       ├── integration/
│       ├── security/
│       └── fixtures/
├── tests/
│   ├── harness/                  # Independent benchmark and acceptance runner
│   └── evidence/                 # Run metadata/results; exclude sensitive data
└── specs/001-hms-v1/
    ├── spec.md
    └── plan.md
```

The precise package workspace arrangement may follow the repository's existing conventions; preserve the module boundaries and avoid a second deployable service. Do not create the tasks file as part of this plan.

## Data Model and SQLite Strategy

Use integer primary keys or another consistent opaque key strategy; never accept an ownership key as proof of authorization. Store normalized email in a unique indexed column. Use `CHECK` constraints for enumerated role/state values, `NOT NULL` and `UNIQUE` constraints where applicable, and foreign keys with carefully chosen delete behavior. Prefer restricted deletion for referenced accounts, departments, doctors and appointments; do not cascade away audit history.

| Entity | Core relationships and invariants |
|---|---|
| `accounts` | Unique normalized email, bcrypt hash, role (`PATIENT`, `DOCTOR`, `STAFF`), lifecycle fields. Role assigned by server provisioning/registration only. Never return hashes. |
| `patient_profiles` | One-to-one with patient account; optional date of birth, gender and contact fields. |
| `beneficiaries` | Owned by exactly one patient account; required identity/date-of-birth/relationship fields; state restricted to `PENDING_AUTHORIZATION`, `AUTHORIZED`, `REJECTED`. No login/account. |
| `beneficiary_authorization_audit` | Append-only decision rows linked to beneficiary and reviewing staff account, with verification method (`IN_PERSON`/`PHONE`), outcome (`AUTHORIZED`/`REJECTED`) and UTC timestamp. Insert audit row and change beneficiary state in one transaction. Terminal state blocks later decisions. Database triggers MUST reject every `UPDATE` and `DELETE` against audit rows; application services also expose no edit/delete operation. |
| `doctor_profiles` | One-to-one with doctor account; public professional name and approved description. |
| `departments` | Unique normalized name and description. |
| `specializations` / `doctor_specializations` | Normalized specialization values and many-to-many doctor association, enabling name/specialty discovery without free-form query construction. |
| `doctor_departments` | Many-to-many doctor/department association with unique pair. |
| `availability_slots` | Doctor FK, UTC start/end instants, positive interval, timestamps. Intervals use half-open semantics `[start,end)`: touching endpoints do not overlap. Reject duplicate/overlapping intervals per doctor. |
| `appointments` | Doctor, configured slot, exactly one recipient (patient profile XOR beneficiary), responsible patient account, initiating account, status (`BOOKED`, `CANCELLED`, `COMPLETED`) and timestamps. Enforce recipient XOR and slot/doctor consistency. For staff-created bookings, responsible account remains the patient account and actor is the authenticated staff account. |
| `sessions` | Opaque session identifier hash, account FK, expiry and invalidation metadata if the chosen session-cookie approach is approved. Stores no raw bearer token. |

### Integrity and indexes

- Enable and verify `PRAGMA foreign_keys = ON` on every connection. Use a migration transaction and deterministic migration order.
- Add indexes for normalized email; beneficiary owner/state; doctor name/specialization/departments; availability doctor/start/end; appointment slot/status; doctor/status/time; responsible account/status/time; and session lookup/expiry.
- Add a unique partial index on `appointments(slot_id)` for `BOOKED` rows as a final guard against duplicate bookings of one configured slot.
- SQLite has no exclusion constraint for arbitrary time ranges. Database-level prevention of overlapping availability slots for the same doctor is mandatory: create `BEFORE INSERT` and `BEFORE UPDATE` triggers on availability slots using the half-open overlap predicate `existing.start < NEW.end AND existing.end > NEW.start`, excluding the row being updated and matching the same doctor; abort conflicts with a stable database constraint failure. Retain the same transactional service-level overlap validation as an additional defense and map the conflict to `409 AVAILABILITY_CONFLICT`.
- Database triggers MUST unconditionally reject `UPDATE` and `DELETE` of `beneficiary_authorization_audit` rows. Use restrictive foreign-key deletion behavior so deleting a parent cannot erase audit history. Preserve the existing transaction that inserts the audit row and changes beneficiary state together.
- Test database-enforced behavior by issuing direct conflicting slot `INSERT` and `UPDATE` statements that bypass services and asserting rollback/no conflicting row; issue direct audit-row `UPDATE` and `DELETE` statements and assert both fail and the original row remains unchanged. Also test the service-level validation and domain error mapping separately.
- Enforce active appointment interval overlap in the booking transaction using `existing.start < requested.end AND existing.end > requested.start`, with database-level guards where supported by the schema. The same-doctor availability-slot overlap trigger requirement is mandatory regardless of any service-level or active-appointment guard.
- Ensure appointment slot and doctor match, and beneficiary recipient belongs to the responsible patient account. Enforce with repository/service checks in the same write transaction and, where practical, triggers/foreign-key design. Client-supplied values never override the authenticated actor.
- Status changes are limited to `BOOKED -> CANCELLED` or `BOOKED -> COMPLETED`. No rescheduling operation or update of an existing appointment's doctor/slot is provided.

## REST API and Middleware

Keep `/api/v1` resource-oriented. Exact route naming is an implementation choice under the spec's illustrative API contract; behavior, authorization and response codes are not.

| Resource | Planned operations |
|---|---|
| `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/session` | Patient self-registration; authenticate provisioned roles; invalidate current session. |
| `/patients/me`, `/patients` | Own profile and permission-scoped staff directory reads. |
| `/beneficiaries`, `/beneficiaries/:id`, `/beneficiaries/:id/authorization-status` | Owner management and allowed non-sensitive status read. |
| `/admin/beneficiaries/:id/authorization-decision` | Staff review of pending adult authorization only. No endpoint can transition terminal state. |
| `/doctors`, `/doctors/:id` | Discovery/search and staff provisioning/update; doctor self-profile only where allowed. |
| `/departments` and doctor associations | Discovery and staff management. |
| `/doctors/:id/availability` | Authorized schedule read/manage; patient-visible future unbooked slots. |
| `/appointments`, `/appointments/:id`, `/appointments/:id/cancellation`, `/appointments/:id/completion` | Patient/staff permitted booking, scoped reads/cancellation and assigned-doctor completion. Do not expose reschedule, arbitrary status update or staff completion. |
| `/admin/dashboard` and scoped lists | Permission-checked administrative views; no unrelated analytics. |

Middleware order: request ID and safe request metadata; security headers; bounded JSON parser; request structure validation; session authentication; role/permission and object authorization in the relevant service; controller; centralized success/error serializer. Apply configured rate limits to login and other sensitive operations. Error mapping must distinguish malformed structure (`400`), missing/invalid credentials (`401`), role/permission denial (`403`), privacy-concealed object access (`404`), duplicate/state/slot conflicts (`409`), field/business eligibility (`422`), rate limits (`429`), unexpected failures (`500`) and temporary unavailability (`503`).

All body-bearing responses follow the spec's success/error envelope. A `204` response has no body. Error messages are user-safe; details identify safe validation fields only. Logs include request ID and failure category but exclude credentials, token values, hashes, SQL errors and unnecessary patient/beneficiary data.

### Authentication, RBAC and object-level authorization

- Patient registration creates only `PATIENT`; doctor and staff accounts are provisioned by authorized administrative process, not self-registration.
- Hash passwords with bcrypt. Use a high-entropy opaque session cookie with `HttpOnly`, `SameSite` and `Secure` settings appropriate to the local transport; store only a hash of the token and expiry in SQLite. Logout invalidates the current session. Select and document the session-cookie implementation during initial implementation review; do not add an external identity provider.
- Derive account ID and role exclusively from the validated session. Ignore or reject client role/actor/owner substitutions.
- Central middleware performs authentication and role/permission checks; services also perform object-level checks using repository relationships. Do not depend solely on middleware for owner/appointment relationships.
- Patient beneficiary operations check owner account on every request. Pending/rejected adult beneficiary protected actions return `422 BENEFICIARY_NOT_AUTHORIZED`; cross-account resource access returns privacy-preserving `404 RESOURCE_NOT_FOUND`.
- Doctor appointment access checks assignment to the doctor; only assigned doctor can complete a booked appointment. Staff actions each require the specific configured permission. Staff cannot reschedule, change an existing appointment's doctor/slot, or mark it completed.
- Staff booking checks the responsible patient owns the selected beneficiary and that adult authorization is `AUTHORIZED`; it records recipient, responsible account and authenticated staff actor separately.
- For cookie-authenticated state-changing requests, enforce same-origin/Origin checks and `SameSite` protections; document and test the CSRF mitigation selected for local deployment.

## Appointment Transactions and Concurrency

All scheduling writes pass through one appointment/availability service and repository transaction boundary.

1. Use SQLite write transactions that acquire the write reservation before reading availability (for example `BEGIN IMMEDIATE`, subject to driver support). Configure a finite busy timeout; return a safe conflict or service-unavailable result rather than leaking `SQLITE_BUSY`.
2. In booking transaction, validate actor permission and recipient ownership/authorization, confirm slot exists and is future in instant time, confirm doctor-slot identity, check no other active appointment overlaps the proposed interval for that doctor, insert the appointment, and commit. Roll back on any failure.
3. Availability creation/update runs a transaction and checks intervals for the same doctor using half-open overlap comparison. Do not modify/delete an interval underlying a booked appointment.
4. Cancellation and doctor completion use a conditional transition from `BOOKED` inside a transaction. If no row transitions because another operation already won, return `409 APPOINTMENT_STATE_CONFLICT`. Cancellation releases only a slot that is still in the future; an elapsed slot is never made bookable again.
5. A booking racing cancellation is serialized. If booking is processed before cancellation commits, booking returns `409 APPOINTMENT_SLOT_UNAVAILABLE`; if cancellation commits first, a subsequent booking may succeed only if the slot remains future and available. Do not automatically retry a losing request.
6. Cancellation versus assigned-doctor completion on the same appointment allows exactly one transition; the loser receives `409 APPOINTMENT_STATE_CONFLICT`. Completed/cancelled appointments are terminal and do not occupy active slots.
7. SQLite permits one writer at a time. WAL and a busy timeout improve reader/writer behavior, not multi-writer throughput. Keep write transactions short, do not perform password hashing or network work while holding a transaction, and measure contention with the specified three-client benchmark.

Transactions and conditional updates ensure consistency within the local single-database deployment. A future multi-process or remote database architecture is not part of Version 1.0.

## Timezone and Timestamp Handling

- Require `HOSPITAL_TIME_ZONE` at startup as an IANA zone; fail startup on missing or invalid configuration. This is runtime configuration, not a new admin feature.
- Use ISO 8601 date-time API inputs with explicit UTC offsets. Validate that the supplied offset is valid for the local wall time in the configured IANA zone. Reject nonexistent daylight-saving local times; require an explicit offset to disambiguate repeated times.
- Convert once at the API boundary and persist epoch milliseconds or a consistently formatted UTC instant. Never persist local wall-time strings as the canonical instant.
- Return UTC instants with `Z`; the React client formats them in the configured hospital timezone for display. Do not use the browser's local zone as the scheduling authority.
- Compare “future” against current UTC instant. Compute calendar-day bounds and adult age using the hospital-local date through `Intl.DateTimeFormat` with the configured zone, not the host process timezone. Inject a clock into business services for deterministic tests.
- Test boundary dates and DST transitions for a zone observing DST, as well as a non-DST zone; use fake/injected time rather than changing host machine timezone.

## Adult-Beneficiary Authorization and Audit

The only states are `PENDING_AUTHORIZATION`, `AUTHORIZED`, and `REJECTED`; only pending may transition to authorized or rejected. Authorized and rejected are terminal. Beneficiaries have no login.

For staff review, require the assigned permission, pending state, direct confirmation with the adult in person or by phone, verification method, outcome and authenticated reviewer. In one transaction, insert the audit decision and conditionally transition the beneficiary state. Include a UTC decision timestamp and reviewer account FK. Any later decision attempt returns `409 BENEFICIARY_STATE_CONFLICT`; it cannot replace or delete history. The owner sees only permitted non-sensitive status while pending/rejected and gains the specified protected access only after authorization. Adult is calculated at age 18 using the hospital-local date.

Audit history is append-only at the database and application layers: database triggers reject updates/deletes, and repositories expose no edit/delete operation. Test both direct SQL attempts and application behavior. Do not add consent document uploads, recordings, external verification, messaging or new authorization states.

## Testing and Acceptance Validation

| Layer | Coverage |
|---|---|
| Unit | Validators, field rules, local-date/age logic, timezone/DST conversion, permission decisions, state transitions, half-open interval overlap, error-to-status mapping and safe user-facing messages. |
| Repository/database | Migrations, foreign keys, uniqueness/check constraints, owner relations, recipient XOR, append-only authorization history, availability overlap triggers, audit immutability triggers, partial unique active-slot constraint and rollback behavior against temporary SQLite databases. Bypass services to prove overlapping availability `INSERT`/`UPDATE` and audit `UPDATE`/`DELETE` are rejected by SQLite itself. |
| Integration | Express HTTP workflows for all roles; registration/login/logout; patient/beneficiary ownership; authorization review; doctor/department management; availability; booking/list/history/cancel/complete; staff booking attribution; envelopes/status codes; privacy-concealed 404; malformed/validation/conflict/error cases. |
| Concurrency/reliability | Real concurrent requests for same slot and overlapping slots; booking/cancellation ordering; cancellation/completion race; rollback injection; only one valid transition/booking wins and all loser codes match the spec. |
| Frontend | Critical patient registration, beneficiary status, search, booking, appointment view/cancel; loading, confirmation, success, validation, conflict, network and unexpected error states; no success before server confirmation. |
| Security | Tests for role spoofing, owner-ID substitution, cross-account IDs, staff permission boundaries, doctor assignment boundaries, session invalidation, login error equivalence, input validation, SQL injection resistance through parameterization, CSRF mitigation and safe error/log output. Run Semgrep CE and retain findings/disposition. |
| Quality | Node built-in test runner; >=80% business-logic statement coverage; ESLint zero errors; Semgrep run with no unresolved critical/high finding at acceptance. |

### Independent harness validation and evidence

Keep the harness separate from application internals: it must seed through a version-controlled deterministic fixture generator and exercise the public REST API, then inspect the resulting SQLite database read-only for invariants. It may use only fictional data and must not rely on an application-provided “pass” flag.

For NFR-004, use seed `20261107`; assert all specified entity counts, state cohorts, ownership links and write-target availability; record fixture generator revision and manifest hash. Use a fresh database for each endpoint, run 10 warm-ups, reset after mutating-operation warm-ups, then use distinct slots/appointments for at least 100 successful measured samples. Use page size 20, stable sort, the same fixture-defined doctor search query/result count and actors, deterministic batches of at most three clients, and no retries. Measure client-observed duration excluding server startup/seed/reset; calculate nearest-rank p95 at `ceil(0.95*n)`. All measured requests must succeed. Report failure count and fail the operation if any measured sample fails.

Each evidence bundle records: UTC run timestamp; git commit/revision; command and exit status; Node/OS/SQLite/runtime versions; configured hospital timezone; seed, generator revision, fixture manifest hash and counts; benchmark parameters; every sample duration or a stable raw-results attachment; p50/p95/p99 and min/max; failures; test/coverage/lint/Semgrep results; findings and corrective reruns. Do not include real personal data, credentials, session tokens or sensitive request bodies. Preserve initial and final harness outputs as required by the constitution.

## Requirement Traceability

| Requirement range / outcome | Design modules | Verification evidence |
|---|---|---|
| FR-001–FR-008; US-001 | Auth, patients, frontend auth/profile | Registration/auth/profile integration; duplicate, validation, ownership, logout tests. |
| FR-009–FR-016; US-002 | Beneficiaries, authorization audit, staff review | Owner isolation; three-state transition tests; terminal-state conflict; audit retention; adult threshold; error-code tests. |
| FR-017–FR-020; US-003/US-004 | Doctors, departments, association repositories | Provisioning, uniqueness, association integrity, role/validation integration tests. |
| FR-021–FR-025; US-005 | Doctor discovery, departments, availability read | Search/filter/pagination/empty result and privacy tests. |
| FR-026–FR-030; US-006 | Availability service/repository | Slot validation/overlap, booked-slot immutability and booking-time revalidation tests. |
| FR-031–FR-034; FR-040; US-007 | Appointment service, auth/eligibility services | Self/beneficiary/staff booking attribution; overlap and concurrent race tests. |
| FR-035–FR-040; US-008/US-009 | Appointment state service and role-scoped reads | Appointment status, cancellation reuse, completion, object privacy and race tests. |
| FR-041–FR-043; US-010 | Admin module plus domain services | Dashboard permission, data minimization, staff-only operation tests. |
| FR-044–FR-049; US-011 | Middleware, response/error helpers, frontend API layer | Per-route auth tests; response contract/status/error envelope tests; UI failure-state tests. |
| NFR-001–NFR-002, NFR-005, NFR-009 | Auth, repositories, middleware, logs | Password/parameterization checks, privacy tests, safe errors and structured-log inspection. |
| NFR-003, NFR-007 | Services, repositories, transactions | Transaction/race/rollback suite; module boundary and business-logic unit tests. |
| NFR-004, SC-010 | Fixture generator and independent harness | Reproducible benchmark report with required seed, samples, p95 and environment. |
| NFR-006, FR-047–FR-049 | React feature modules | Frontend workflow and error-state acceptance checks. |
| NFR-008, SC-009 | Test/lint/security toolchain | Coverage report, ESLint report, Semgrep output and finding disposition. |
| SC-001–SC-011 | Cross-cutting acceptance suite | Traceability matrix linking each scenario to test IDs and retained run evidence. |

Every FR-001–FR-049 must have at least one test identifier mapped before implementation completion; the implementation task plan should expand this mapping without changing approved requirements.

## Risks and Technical Dependencies

| Risk/dependency | Impact | Mitigation / decision needed before implementation |
|---|---|---|
| SQLite driver and supported Node version | Native package compatibility/builds on target Ubuntu; transaction semantics and concurrency behavior vary by driver. | Plan selects `better-sqlite3` for Node 24 LTS; verify dependency installation/native loading, `BEGIN IMMEDIATE`, busy timeout, WAL, foreign keys, parameter binding, migrations and concurrent tests early. Pin runtime and dependency lockfile. |
| SQLite interval-overlap enforcement | Standard unique indexes cannot prevent arbitrary interval overlaps. | Mandatory SQLite insert/update triggers plus service-level overlap validation for availability slots; test direct writes that bypass services and concurrent HTTP requests. |
| Session implementation | Security and dependency choice are not fixed by spec. | Prefer opaque random HttpOnly cookie and hashed SQLite session record; review cookie, expiry, logout, CSRF, local HTTP and deployment assumptions before coding. No external identity service. |
| IANA timezone correctness | DST parsing and local-date boundaries can produce incorrect bookings/age eligibility. | Use Node Intl with validated IANA zone, explicit-offset input contract, injected clock and transition-boundary tests. Do not rely on host timezone. |
| Benchmark determinism and target hardware | Results can differ with OS, SQLite settings, CPU and fixture drift. | Version fixture generator, assert counts/manifest, record environment and request inputs; interpret only as local acceptance, not production capacity. |
| Appointment domain overlaps | Distinct availability slots or races could still create simultaneous active appointments. | Check interval overlap, keep a database-level guard where feasible, serialize write transactions and assert one winner in races. |
| Audit preservation | Mutable/replaced authorization history would violate privacy/governance decisions. | Mandatory database triggers reject audit-row updates/deletes, no update/delete repository method, transactional decision+state update, direct-write rejection tests and restrictive foreign-key deletion. |
| Scope drift | Admin convenience or future workflows can accidentally introduce rescheduling, EMR, messaging or other excluded features. | Review every route, migration and UI journey against the spec and role matrix; no reschedule or additional state implementation. |
| Independent harness environment | Harness could accidentally depend on app internals or leak sensitive data. | Use public HTTP API plus read-only SQLite checks; fictional fixture only; store sanitized metadata and preserve command/output evidence. |

## Decisions and Trade-offs

- **One deployable modular monolith** keeps local setup and transactional data simple; separate services would add unnecessary network and operational complexity.
- **SQLite with serialized writes** is appropriate for the specified local scope and fixture. It limits simultaneous writes; accept that trade-off rather than claiming production-scale throughput.
- **UTC instants plus one IANA zone** avoid ambiguous persisted time while preserving hospital-local scheduling semantics. Require explicit offset for repeated DST times and reject nonexistent local times.
- **Explicit repositories and services instead of an ORM** keep SQL visible, parameterized and aligned with SQLite constraints; the trade-off is that migrations, mapping and tests must be maintained directly.
- **Opaque database-backed sessions** permit logout invalidation and avoid an external identity service; the implementation must settle secure cookie/CSRF details before exposing protected workflows.
- **Database constraints plus service checks** provide defense in depth. SQLite cannot express every cross-row/time-range rule as a simple constraint, so transaction-level checks and tested triggers are required.
- **No rescheduling workflow**: cancellation releases a still-future slot; a new booking is a distinct appointment and must pass all ordinary eligibility and availability checks.

## Complexity Tracking

No constitution violations. No extra project, service or framework is justified. The data-backed session table and independent harness are supporting implementation mechanisms for specified authentication, logout and acceptance requirements, not additional user-facing features.
