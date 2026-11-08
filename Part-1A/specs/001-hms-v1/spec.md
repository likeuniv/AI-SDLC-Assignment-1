# Feature Specification: Hospital Management System (HMS) Version 1.0

**Feature Branch**: `001-hms-v1`

**Created**: 2026-11-07

**Status**: Draft

**Input**: User description: "Specify the Version 1.0 Hospital Management System in accordance with the approved HMS constitution."

## Product Overview

HMS is a centralized platform for patient onboarding, doctor and department management, doctor availability, appointment scheduling and essential hospital administration. It serves patients, doctors and authorized hospital administrative staff. A patient account may manage appointments for its account holder and authorized family members or relatives. Beneficiaries have no separate login in Version 1.0.

The product shall provide understandable user feedback, consistent REST API behavior, and server-side protection of patient and beneficiary information. The implementation shall follow the approved constitution's modular-monolith architecture and specified technology standards. This specification describes product behavior and observable contracts, not application code, database scripts or an implementation plan.

## User Scenarios & Testing *(mandatory)*

Priorities represent the relative importance of independent Version 1.0 user journeys. Each story can be independently exercised through its stated acceptance scenarios, subject to the explicitly identified account and data prerequisites.

### User Story US-001 - Patient account registration and access (Priority: P1)

As a patient,  
I want to register, log in, log out and manage my own profile,  
So that I can securely access appointment and beneficiary services.

**Why this priority**: Patient identity and access are prerequisites for self-service and booking.

**Independent Test**: Register a patient with valid details, authenticate, retrieve and update that patient's profile, and end the authenticated session; verify invalid or unauthorized requests do not expose profile data.

**Acceptance Scenarios**:

1. **Given** a visitor provides a valid name, unique email address and password, **When** they submit registration, **Then** the system creates one patient account, stores no plaintext password, returns `201 Created`, and does not create a doctor or staff account.
2. **Given** the email address is already registered, **When** a visitor submits registration using that address, **Then** no duplicate account is created and the API returns `409 Conflict` with `DUPLICATE_RESOURCE`.
3. **Given** a patient submits malformed JSON or omits required request structure, **When** registration is attempted, **Then** the system returns `400 Bad Request` with `INVALID_REQUEST`; given a structurally valid request with invalid field values, **Then** it returns `422 Unprocessable Content` with `VALIDATION_FAILED`. Both responses identify invalid fields without echoing secrets and create no account.
4. **Given** a registered patient provides the correct email and password, **When** they log in, **Then** the system establishes an authenticated patient context and returns `200 OK`.
5. **Given** an unknown email or incorrect password, **When** login is attempted, **Then** the system returns `401 Unauthorized` with `INVALID_CREDENTIALS` and the same generic message for both cases, revealing no account-existence information.
6. **Given** a patient is authenticated, **When** they update permitted fields on their own profile, **Then** only those fields change and the response contains the updated permitted profile data.
7. **Given** a patient attempts to read or update another patient's profile by changing an identifier, **When** the request reaches the API, **Then** it returns privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND` and the other profile remains unchanged.
8. **Given** a patient is authenticated, **When** they log out, **Then** their authentication context is invalidated and subsequent protected requests using it return `401 Unauthorized` with `AUTHENTICATION_REQUIRED`.

### User Story US-002 - Beneficiary enrollment, management and adult authorization (Priority: P1)

As a patient account holder,  
I want to register and manage family members or relatives as beneficiaries,  
So that I can arrange care for people I am authorized to help.

**Why this priority**: Managing appointments for authorized dependants and relatives is a defining HMS capability.

**Independent Test**: Create a minor beneficiary and an adult beneficiary, verify the adult record is inaccessible for management and booking before staff approval, approve the adult authorization as authorized staff, and verify patient-account access is limited to the owning account.

**Acceptance Scenarios**:

1. **Given** an authenticated patient submits a valid beneficiary profile with name, date of birth and relationship, plus optional gender and any applicable contact details, **When** the beneficiary is a minor, **Then** the beneficiary is linked to that account, has no login account, and the owner can view and update the beneficiary profile.
2. **Given** an authenticated patient submits a beneficiary who is an adult, **When** the request is received, **Then** the beneficiary is created in `PENDING_AUTHORIZATION` state with `201 Created`; subsequent protected profile or appointment operations by that owner return `422 Unprocessable Content` with `BENEFICIARY_NOT_AUTHORIZED` until authorized hospital staff verify and approve authorization.
3. **Given** an adult beneficiary authorization request is `PENDING_AUTHORIZATION`, **When** authorized staff directly confirm the adult's authorization in person or by phone and approve or reject it, **Then** the only permitted transitions are to `AUTHORIZED` or `REJECTED`, respectively, and each decision is recorded in the preserved authorization audit history with verification method, outcome, reviewing staff identity and timestamp. An authenticated staff actor without review permission receives `403 Forbidden` with `FORBIDDEN`.
4. **Given** an adult beneficiary is already `AUTHORIZED` or `REJECTED`, **When** staff attempt another authorization decision, **Then** the API returns `409 Conflict` with `BENEFICIARY_STATE_CONFLICT`, leaves the state unchanged and does not replace or erase the existing audit history.
5. **Given** an adult beneficiary is `AUTHORIZED`, **When** the owning patient views, updates or selects the beneficiary, **Then** access is permitted only for that authenticated owner account and permitted fields.
6. **Given** an authenticated owning patient attempts a permitted profile or booking operation for an adult beneficiary whose authorization is pending or rejected, **When** the request is processed, **Then** the API returns `422 Unprocessable Content` with `BENEFICIARY_NOT_AUTHORIZED`, does not disclose protected details beyond the owner's non-sensitive authorization status, and makes no change.
7. **Given** a patient attempts to read or modify a beneficiary or appointment owned by another account by supplying its identifier, **When** the request is processed, **Then** the API returns privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND` and makes no changes.
8. **Given** an account submits malformed beneficiary request structure, **When** the request is processed, **Then** the API returns `400 Bad Request` with `INVALID_REQUEST`; given a structurally valid request with invalid fields, unsupported relationship or invalid/future date of birth, **Then** it returns `422 Unprocessable Content` with `VALIDATION_FAILED` and safe field-level details, and persists no invalid change.
9. **Given** a beneficiary record is updated, **When** the update is saved, **Then** its owning account and authorization state cannot be reassigned by client-supplied identifiers; a patient attempting a staff-only authorization change receives `403 Forbidden` with `FORBIDDEN`, and no change is made.
10. **Given** an unauthenticated caller attempts a protected beneficiary operation, **When** the API receives the request, **Then** it returns `401 Unauthorized` with `AUTHENTICATION_REQUIRED`; given an authenticated role without permission for the operation, **Then** it returns `403 Forbidden` with `FORBIDDEN`, unless the request is cross-account object access that must be concealed with `404 RESOURCE_NOT_FOUND`.

### User Story US-003 - Doctor registration and professional profile (Priority: P1)

As authorized hospital staff,  
I want to register doctors and maintain their professional information,  
So that patients can discover doctors and appointments can be assigned correctly.

**Why this priority**: Doctor accounts and profiles are necessary for discovery, availability and appointment scheduling.

**Independent Test**: Have authorized staff create a doctor, associate the doctor with a department and specialization, and verify public discovery fields; attempt the same operation as a patient and as a doctor.

**Acceptance Scenarios**:

1. **Given** an authenticated staff user with doctor-management permission submits valid required doctor details, **When** they create a doctor, **Then** the system creates a provisioned doctor account and professional profile and returns `201 Created`.
2. **Given** a patient or doctor attempts an operation requiring staff role, **When** the request is made, **Then** it returns `403 Forbidden` with `FORBIDDEN`; given an unauthenticated caller, **Then** it returns `401 Unauthorized` with `AUTHENTICATION_REQUIRED`. No record changes.
3. **Given** a doctor is authenticated, **When** they update fields they are authorized to manage on their own professional profile, **Then** only those fields are updated; an attempt to change account role, department assignment or staff-controlled fields returns `403 Forbidden` with `FORBIDDEN` and makes no change.
4. **Given** required doctor details reference a nonexistent department, **When** staff submit the profile, **Then** the API returns `404 Not Found` with `RESOURCE_NOT_FOUND`; given a structurally valid profile with invalid field values, **Then** it returns `422 Unprocessable Content` with `VALIDATION_FAILED`. Neither case creates a partial doctor record.
5. **Given** a doctor profile is returned in patient discovery, **When** a patient views it, **Then** only approved professional information, specialization, department and availability are disclosed; staff credentials and unrelated private information are omitted.

### User Story US-004 - Department and specialization management (Priority: P1)

As authorized hospital staff,  
I want to create and maintain departments and doctor associations,  
So that hospital services are organized and patients can find relevant doctors.

**Why this priority**: Department associations support both doctor discovery and administrative operations.

**Independent Test**: Create a department, associate a doctor, retrieve it through the patient-facing directory, update its details, and verify unauthorized callers cannot administer it.

**Acceptance Scenarios**:

1. **Given** authorized staff submits a valid department name and description, **When** they create a department, **Then** the system returns `201 Created` with the new department.
2. **Given** an authorized staff user updates a department or assigns an existing doctor, **When** the change is valid, **Then** the directory reflects the update and the doctor-department relationship is preserved.
3. **Given** an attempted duplicate department name, **When** staff submit the operation, **Then** the API returns `409 Conflict` with `DUPLICATE_RESOURCE`; given an association to a nonexistent doctor or department, **Then** it returns `404 Not Found` with `RESOURCE_NOT_FOUND`. Existing relationships remain unchanged.
4. **Given** an authenticated patient or doctor attempts to create, update or assign departments, **When** the request is made, **Then** the API returns `403 Forbidden` with `FORBIDDEN` and makes no change; an unauthenticated caller receives `401 Unauthorized` with `AUTHENTICATION_REQUIRED`.
5. **Given** a department has associated doctors, **When** staff attempt to remove or invalidate an association that is required by existing data, **Then** the system returns `409 Conflict` with `RESOURCE_IN_USE` and preserves referential integrity.

### User Story US-005 - Doctor discovery (Priority: P1)

As a patient,  
I want to browse and search doctors by name or specialization,  
So that I can choose an appropriate doctor and review available appointment times.

**Why this priority**: Patients need to identify an appropriate doctor before booking.

**Independent Test**: Seed fictional doctor profiles across departments and specializations; browse and search by name, specialization and their combination; verify results contain only discovery-safe fields.

**Acceptance Scenarios**:

1. **Given** doctors have active, discoverable profiles, **When** a patient browses the doctor directory, **Then** the system returns doctor profiles with their department and specialization and does not expose private account data.
2. **Given** a patient searches by a partial doctor name or specialization, **When** the search is submitted, **Then** matching results are returned without case sensitivity and match all supplied search terms.
3. **Given** a search has no matches, **When** the request completes, **Then** the API returns `200 OK` with an empty result collection and the frontend displays a clear no-results message, not an error.
4. **Given** a valid doctor is selected, **When** a patient requests the profile or availability, **Then** only that doctor's discovery-safe profile, associated departments and configured unbooked future slots are returned.
5. **Given** a caller supplies malformed query structure or pagination parameters, **When** the request is made, **Then** the API returns `400 Bad Request` with `INVALID_REQUEST`; given validly structured parameters outside allowed bounds, **Then** it returns `422 Unprocessable Content` with `VALIDATION_FAILED` and does not return an unbounded result set.

### User Story US-006 - Doctor availability management (Priority: P1)

As a doctor,  
I want to define and manage my available appointment slots,  
So that patients can book only times when I am available.

As authorized hospital staff,  
I want to manage doctor availability when required,  
So that schedules can be maintained administratively.

**Why this priority**: Accurate availability is required to make appointment booking safe and useful.

**Independent Test**: Create a future slot as its doctor, view it as a patient, book it, then verify it is unavailable; try unauthorized slot management and modification of a booked slot.

**Acceptance Scenarios**:

1. **Given** an authenticated doctor or staff user with schedule-management permission manages that doctor's schedule, **When** they create a valid future slot with a positive duration, **Then** it is associated with exactly one doctor and becomes discoverable while unbooked; a staff user lacking this permission receives `403 Forbidden` with `FORBIDDEN`.
2. **Given** a caller attempts to create a past slot or a slot with an invalid interval, **When** the request is submitted, **Then** the API returns `422 Unprocessable Content` with `VALIDATION_FAILED`; given a duplicate or overlapping slot, **Then** it returns `409 Conflict` with `AVAILABILITY_CONFLICT`. The schedule remains unchanged.
3. **Given** a patient requests availability, **When** the selected doctor has configured slots, **Then** only future slots with no active appointment are displayed.
4. **Given** a slot has an active `BOOKED` appointment, **When** a doctor or staff user tries to remove or change its doctor/time interval, **Then** the system returns `409 Conflict` with `APPOINTMENT_SLOT_UNAVAILABLE`; the appointment and slot remain consistent.
5. **Given** an authenticated patient or a doctor attempts to manage another doctor's availability, **When** the API receives the request, **Then** it returns `403 Forbidden` with `FORBIDDEN` and the schedule is unchanged; an unauthenticated caller receives `401 Unauthorized` with `AUTHENTICATION_REQUIRED`.
6. **Given** a slot is occupied by a `BOOKED` appointment, **When** availability is listed or booking is attempted, **Then** the slot is not offered as available and cannot be booked again.

### User Story US-007 - Appointment booking for self or beneficiary (Priority: P1)

As a patient,  
I want to choose myself or an authorized beneficiary, a doctor and an available slot,  
So that I can book an appointment for the person who needs care.

**Why this priority**: Self and authorized-beneficiary booking is the primary patient outcome and a defining product requirement.

**Independent Test**: Book a slot for the account holder, book a different slot for an authorized beneficiary, then attempt duplicate, unavailable and unauthorized bookings, including simultaneous requests for one slot.

**Acceptance Scenarios**:

1. **Given** an authenticated patient selects self, a discoverable doctor and a configured future unbooked slot, **When** they submit a valid booking, **Then** exactly one `BOOKED` appointment is created, it identifies the account holder as the recipient and the authenticated patient account as both the responsible booking account and initiating actor, and the API returns `201 Created`.
2. **Given** an authenticated patient selects an active minor beneficiary or staff-authorized adult beneficiary they own, **When** they book an available slot, **Then** the appointment identifies that beneficiary as the actual recipient and the patient account as both the responsible booking account and initiating actor.
3. **Given** the selected beneficiary belongs to another account, **When** the caller attempts to book for that beneficiary, **Then** the API returns privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND` and creates no appointment; given an authenticated owner selects an adult beneficiary whose authorization is pending or rejected, **Then** it returns `422 Unprocessable Content` with `BENEFICIARY_NOT_AUTHORIZED` and creates no appointment.
4. **Given** a slot is unavailable, overlapping or not configured as available at commit time, **When** a patient or staff member attempts booking, **Then** the API returns `409 Conflict` with `APPOINTMENT_SLOT_UNAVAILABLE` and creates no appointment; given a structurally valid request violates another eligibility rule, **Then** it returns `422 Unprocessable Content` with the applicable stable business-rule code.
5. **Given** two booking requests reach the system concurrently for the same doctor slot or for overlapping intervals for the same doctor, **When** both requests attempt to commit, **Then** at most one returns success and creates a `BOOKED` appointment; every losing request receives `409 Conflict` with `APPOINTMENT_SLOT_UNAVAILABLE`, and no duplicate or overlapping active booking is stored.
6. **Given** booking races with cancellation of the appointment occupying that slot, **When** each transaction is serialized, **Then** booking returns `409 Conflict` if it is processed before cancellation commits; if cancellation commits first, a subsequent booking may succeed only if the slot interval is still future and available. A losing booking request is not automatically retried.
7. **Given** a booking request contains both a patient and beneficiary recipient or neither recipient, **When** it is structurally valid but violates the exactly-one-recipient rule, **Then** the API returns `422 Unprocessable Content` with `INVALID_APPOINTMENT_RECIPIENT`; given malformed request structure or a client-supplied role, **Then** it returns `400 Bad Request` with `INVALID_REQUEST`. A patient caller attempting to substitute another account as responsible account receives privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND`. The system derives the initiating actor and role from authenticated server identity.
8. **Given** an unauthenticated caller attempts to book, **When** the request is processed, **Then** the API returns `401 Unauthorized` with `AUTHENTICATION_REQUIRED`; given an authenticated role without booking permission, **Then** it returns `403 Forbidden` with `FORBIDDEN`. No appointment is created.
9. **Given** the database operation fails before booking commits, **When** the request is processed, **Then** no partial appointment is persisted and the slot remains available; the error response reveals no database internals.

### User Story US-008 - Appointment viewing, history and cancellation (Priority: P1)

As a patient,  
I want to view and cancel appointments I am authorized to manage,  
So that I can keep track of care for myself and my beneficiaries.

**Why this priority**: Patients need trustworthy appointment records and the ability to release a booking they no longer need.

**Independent Test**: Book appointments for self and an authorized beneficiary, retrieve upcoming and historical appointments, cancel a booked appointment, and verify an unrelated patient cannot view or cancel either.

**Acceptance Scenarios**:

1. **Given** an authenticated patient has appointments for self and authorized beneficiaries, **When** they view upcoming appointments or history, **Then** only appointments for self and beneficiaries they currently own and are authorized to access are returned.
2. **Given** an appointment is `BOOKED` and belongs to self or an authorized beneficiary of the caller, **When** the caller cancels it, **Then** it transitions to `CANCELLED`, the slot is released for a future booking, and the API returns `200 OK` with the updated appointment.
3. **Given** an appointment is already `CANCELLED` or `COMPLETED`, **When** a patient attempts to cancel it again, **Then** the API returns `409 Conflict` with `APPOINTMENT_STATE_CONFLICT` without changing status or slot data.
4. **Given** cancellation and assigned-doctor completion race for the same `BOOKED` appointment, **When** each operation is serialized, **Then** exactly one transition commits and the competing operation returns `409 Conflict` with `APPOINTMENT_STATE_CONFLICT`; the appointment and slot state remain consistent.
5. **Given** a patient attempts to view or cancel another account's appointment, including one for an unrelated beneficiary, **When** the request is made, **Then** the API returns privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND` and makes no change.
6. **Given** a cancellation transaction fails, **When** the request is processed, **Then** both appointment status and slot availability remain in their pre-request state.
7. **Given** the patient initiates cancellation in the frontend, **When** they confirm the action, **Then** the appointment is cancelled only after server success; on conflict or network failure, the UI retains the last confirmed state and displays an understandable error.

### User Story US-009 - Doctor appointment worklist and completion (Priority: P1)

As a doctor,  
I want to view my upcoming appointments and relevant patient details and complete appointments I conduct,  
So that I can manage my schedule and maintain appointment status.

**Why this priority**: Doctor access to their own schedule and relevant appointment information is required for the care workflow.

**Independent Test**: As a doctor, retrieve only that doctor's appointments, verify the returned patient details are limited to what is needed for the appointment, mark a booked appointment complete and attempt access to another doctor's appointment.

**Acceptance Scenarios**:

1. **Given** a doctor is authenticated, **When** they request their upcoming appointments, **Then** only appointments assigned to that doctor's schedule are returned, with relevant patient details and no unrelated patient records.
2. **Given** a doctor is assigned to a `BOOKED` appointment, **When** they mark it `COMPLETED`, **Then** the status transition succeeds with `200 OK` and the slot is no longer treated as an active booking.
3. **Given** a doctor is not assigned to an appointment or attempts to access unrelated patient information, **When** the request is made, **Then** the API returns privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND` and no data is modified.
4. **Given** an appointment is `CANCELLED` or `COMPLETED`, **When** a doctor attempts an invalid status transition, **Then** the API returns `409 Conflict` with `APPOINTMENT_STATE_CONFLICT` and preserves the status.
5. **Given** a doctor attempts to modify account role, beneficiary authorization, patient profile or staff-only appointment fields, **When** the API receives the request, **Then** it returns `403 Forbidden` and makes no change.

### User Story US-010 - Administrative management and dashboard (Priority: P1)

As authorized hospital administrative staff,  
I want to view and manage patients, doctors, departments, availability and appointments,  
So that essential hospital operations can be administered from one platform.

**Why this priority**: Authorized staff provision doctors and maintain the operational records required by all other journeys.

**Independent Test**: Authenticate an administrative account, access each permitted directory and management operation, book on behalf of an authorized patient, verify adult-beneficiary authorization review, and repeat requests as a patient or doctor to verify denial.

**Acceptance Scenarios**:

1. **Given** a staff user is authenticated and authorized, **When** they open the administrative dashboard, **Then** it presents access to registered patients, doctors, departments, appointments, doctor availability and pending adult-beneficiary authorization reviews, without adding unrelated analytics or modules.
2. **Given** authorized staff view patient or appointment records, **When** results are returned, **Then** only the information required for their administrative duties is included and every protected operation is authorized server-side.
3. **Given** an authorized staff user with appointment-cancellation permission views or manages appointments, **When** they cancel a `BOOKED` appointment for an operational reason, **Then** the appointment becomes `CANCELLED`, its slot is released and the API returns `200 OK`; staff cannot directly reschedule/change an existing appointment's doctor or time slot or mark an appointment `COMPLETED` on behalf of a doctor.
4. **Given** staff receive a patient's request through the existing administrative interaction, **When** they book for the patient's account holder or an eligible beneficiary, **Then** the patient account is recorded as responsible for the booking and the staff account as the initiating actor; the system enforces the same recipient ownership, adult authorization and slot-conflict rules as patient booking.
5. **Given** staff attempt to book for a patient account that does not exist or a beneficiary belonging to another patient account, **When** they submit the booking, **Then** the API returns privacy-preserving `404 Not Found` with `RESOURCE_NOT_FOUND` and creates no appointment; given the selected adult beneficiary is pending or rejected, **Then** it returns `422 Unprocessable Content` with `BENEFICIARY_NOT_AUTHORIZED` and creates no appointment.
6. **Given** staff review a `PENDING_AUTHORIZATION` adult-beneficiary request, **When** they directly confirm with the adult in person or by phone and approve or reject it, **Then** the decision is attributed to the authenticated reviewer, the verification method, outcome and timestamp are recorded in the preserved authorization audit history, and only approval enables owner access and booking; staff cannot change a decision after the beneficiary reaches `AUTHORIZED` or `REJECTED`.
7. **Given** a patient or doctor attempts an administrative operation, **When** the request is made, **Then** an authenticated role lacking permission receives `403 Forbidden` with `FORBIDDEN`, while an unauthenticated caller receives `401 Unauthorized` with `AUTHENTICATION_REQUIRED`. No administrative data changes.
8. **Given** an administrative list has no records, **When** staff retrieve it, **Then** the API returns `200 OK` and an empty collection, and the frontend displays an appropriate empty state.
9. **Given** a staff user with schedule-view permission retrieves a doctor's schedule, **When** the request succeeds, **Then** the system returns that doctor's schedule and availability without exposing unrelated patient information; a staff user without that permission receives `403 Forbidden` with `FORBIDDEN`.
10. **Given** an authenticated staff user lacks the assigned appointment-view, booking or cancellation permission, **When** they attempt that operation, **Then** the API returns `403 Forbidden` with `FORBIDDEN`; no appointment data is changed or disclosed beyond their other authorized permissions.

### User Story US-011 - Consistent errors and understandable feedback (Priority: P1)

As a patient, doctor or hospital staff user,  
I want clear feedback for successful and unsuccessful actions,  
So that I can understand what happened and what action I may take next.

**Why this priority**: Clear feedback prevents errors and makes essential workflows usable without exposing technical internals.

**Independent Test**: Exercise success, validation, authorization, conflict, unavailable-service and unexpected-error responses on representative endpoints; verify API shape, HTTP status, safe content and frontend message.

**Acceptance Scenarios**:

1. **Given** an API operation succeeds and returns a body, **When** the response is received, **Then** it follows the success envelope and includes a meaningful message and appropriate data.
2. **Given** an API operation fails, **When** the response is received, **Then** it follows the error envelope with a stable machine-readable code and safe message; field errors are included for validation failures.
3. **Given** an input-validation, authentication, authorization, not-found, conflict or unexpected-server error occurs, **When** the frontend presents it, **Then** it shows a nontechnical, actionable message and never displays stack traces, SQL, credentials or raw internal errors.
4. **Given** a request is loading, the user submits a form or search, **When** the request is pending, **Then** the frontend indicates loading and prevents duplicate submission for that in-flight operation.
5. **Given** doctor search returns no matches, **When** the response is displayed, **Then** the frontend presents an empty-search state distinct from a network or server error.
6. **Given** a user selects appointment cancellation, **When** they initiate the action, **Then** the frontend asks for confirmation before submitting the cancellation.
7. **Given** a network failure or service-unavailable response occurs, **When** the frontend cannot complete the operation, **Then** it clearly indicates that the operation was not confirmed and provides a retry path without implying success.

## Edge Cases

- Two users attempt to book the same slot concurrently; only one booking may commit.
- Two different configured slots overlap for one doctor; creation or booking must not permit conflicting active appointments.
- A slot becomes booked or is removed after appearing in a patient's search results; booking must revalidate availability at commit time.
- A patient account attempts to use a beneficiary identifier from another account, or an adult beneficiary is pending, rejected or no longer authorized.
- Adult-beneficiary authorization is rejected after a request is submitted; access and new booking must remain blocked.
- A booked slot is edited or deleted; the system must preserve appointment integrity and return a conflict rather than orphaning the appointment.
- A patient repeats registration with an existing email, submits malformed data, or retries a request after a network timeout.
- A client submits a forged role, booking-account identifier, patient identifier or beneficiary relationship.
- A request targets a nonexistent record versus an existing but inaccessible patient, beneficiary or appointment; the API must follow the privacy-preserving response rule.
- A database or service failure occurs partway through booking, cancellation, doctor provisioning or adult-authorization review; no partial state may be committed.
- An appointment is already cancelled or completed when a user retries cancellation or status update.
- A department or doctor relationship is referenced by other records when staff attempt to change it; constraints must prevent orphaned records.
- Search terms are blank, contain unsupported values or return no matches; empty results are not server errors.
- Authentication expires or is invalidated while a user is viewing or submitting a protected action; protected data must not be changed without reauthentication.

## Requirements *(mandatory)*

### Functional Requirements

#### Role access boundaries

| Role | Permitted Version 1.0 access | Explicitly prohibited |
|---|---|---|
| Patient | Own account/profile; own beneficiary records and appointments subject to beneficiary authorization; doctor and department discovery; availability; booking for self or an authorized beneficiary; cancellation of appointments they are authorized to manage. | Doctor-only profile/schedule operations and all administrative operations; another patient's or account's records. |
| Doctor | Own permitted professional profile fields and availability; upcoming appointments assigned to that doctor; relevant patient details for those appointments; mark assigned `BOOKED` appointments `COMPLETED`. | Another doctor's schedule or appointments; patient-account administration; beneficiary authorization decisions; staff-only doctor/department/administrative operations. |
| Hospital Admin / Staff | Within assigned administrative permissions: view appointments; book on behalf of a patient; cancel `BOOKED` appointments; view doctor schedules and availability; manage availability; provision/manage doctors and departments; view patient records; review adult-beneficiary authorization requests. | Directly rescheduling or changing the doctor/time slot of an existing appointment; marking appointments `COMPLETED`; bypassing patient ownership or beneficiary authorization; actions outside assigned permission; unrelated or unnecessary patient/beneficiary information. |

Unauthenticated users MUST NOT access protected patient, beneficiary, doctor-management, availability-management, appointment or administrative operations. Frontend route protection is supplementary; each protected API MUST enforce the same role and object-level boundaries independently.

#### Patient registration, authentication and profile

- **FR-001**: The system MUST allow a visitor to register a patient account using a person's full name, unique email address and password and MUST create the associated patient profile. Patient accounts MUST be self-registered; doctor and staff accounts MUST NOT be self-registered.
- **FR-002**: The system MUST trim names, reject empty names and enforce a maximum of 120 characters. It MUST normalize email addresses consistently before uniqueness checks and reject malformed email addresses.
- **FR-003**: The system MUST require a password of at least 12 characters and no more than 72 UTF-8 bytes, hash it using bcrypt before persistence, and never store or log the plaintext password.
- **FR-004**: Patient profiles MAY include date of birth, gender and contact information. Date of birth MUST be a valid calendar date and not in the future; optional gender MUST allow a self-described value up to 80 characters and MUST NOT determine access or appointment eligibility; contact fields MUST be validated when provided.
- **FR-005**: The system MUST authenticate patients, provisioned doctors and authorized staff and MUST derive identity and role from authenticated server-side credentials, never from untrusted client fields.
- **FR-006**: The system MUST provide login and logout. Successful logout MUST invalidate the current authentication context; unauthenticated access to protected operations MUST return `401 Unauthorized`.
- **FR-007**: Login failure MUST use a generic message that does not distinguish an unknown account from an incorrect password.
- **FR-008**: An authenticated patient MUST be able to view and update only permitted fields on their own profile. The API MUST reject updates to role, account identity or other protected ownership fields.

#### Beneficiary management and authorization

- **FR-009**: An authenticated patient MUST be able to create and manage multiple beneficiary profiles with required full name, date of birth and relationship; gender and contact information MAY be captured and MUST be validated when provided. Optional gender MUST allow a self-described value up to 80 characters and MUST NOT determine access or appointment eligibility.
- **FR-010**: Each beneficiary MUST be linked to exactly one managing patient account and MUST NOT have a login account in Version 1.0.
- **FR-011**: The system MUST support the relationships spouse, parent, child, sibling, other relative, legal guardian and other; when `other` is selected, a nonempty relationship description MUST be supplied.
- **FR-012**: Among patient accounts, only the owning account may view and manage a beneficiary's profile and appointments. Doctors MAY access only relevant beneficiary details for appointments assigned to them; staff MAY access only data needed for an authorized administrative duty. For an adult beneficiary, the owning account MUST NOT manage protected details or book/view appointments until authorized hospital staff verify and approve authorization.
- **FR-013**: Adult beneficiary creation MUST enter `PENDING_AUTHORIZATION`. The only authorization states in Version 1.0 are `PENDING_AUTHORIZATION`, `AUTHORIZED` and `REJECTED`; the only permitted transitions are `PENDING_AUTHORIZATION` to `AUTHORIZED` or `PENDING_AUTHORIZATION` to `REJECTED`. Authorized staff MUST directly confirm authorization with the adult in person or by phone before deciding and record every decision's verification method, outcome, reviewing staff identity and timestamp in preserved authorization audit history. `AUTHORIZED` and `REJECTED` are terminal states in Version 1.0; an attempted further decision MUST return `409 Conflict` with `BENEFICIARY_STATE_CONFLICT` and MUST NOT alter the state or erase/replace history.
- **FR-014**: An adult beneficiary in `PENDING_AUTHORIZATION` or `REJECTED` state MUST NOT be selectable for booking, and protected profile/appointment operations by the authenticated owning account MUST return `422 Unprocessable Content` with `BENEFICIARY_NOT_AUTHORIZED`. The owner MAY read only the non-sensitive authorization status; this status read MUST NOT expose protected profile or appointment details.
- **FR-015**: Every beneficiary read, update and appointment operation MUST enforce server-side role and object-level authorization. Patient operations MUST verify account ownership and adult authorization; doctor operations MUST verify assignment to the relevant appointment; staff operations MUST verify administrative permission. Client-supplied owner or relationship identifiers MUST NOT grant access.
- **FR-016**: Staff authorization review MUST be restricted to staff with the assigned review permission; authenticated staff lacking that permission MUST receive `403 Forbidden` with `FORBIDDEN`. Each decision MUST be attributable to the authenticated staff account, recorded in preserved authorization audit history, and MUST NOT be editable by the patient who submitted the request or changed after the beneficiary reaches a terminal authorization state.

#### Doctor and department management

- **FR-017**: Authorized staff MUST be able to provision doctor accounts with a unique work email and create doctor profiles with a full professional name, at least one specialization and one or more department associations. An approved professional description or qualification summary MAY be maintained for patient discovery.
- **FR-018**: Doctors MUST be able to view and update only the fields of their own professional profile explicitly permitted to doctor self-management. Staff-only assignments, account role and another doctor's profile MUST be protected.
- **FR-019**: Authorized staff MUST be able to create, view and update department records and associate existing doctors with departments.
- **FR-020**: The system MUST reject invalid doctor/department association fields with `422 VALIDATION_FAILED`, duplicate associations with `409 DUPLICATE_RESOURCE`, and references to nonexistent doctors/departments with `404 RESOURCE_NOT_FOUND`, without partially persisting the operation.
- **FR-021**: Patient-facing doctor discovery MUST return only approved professional information, associated departments, specializations and availability; it MUST NOT return credentials, password hashes, authentication data or unrelated private information.

#### Doctor discovery

- **FR-022**: Patients MUST be able to browse doctors and search by name or specialization; searches MUST support case-insensitive partial matching.
- **FR-023**: When both a name and specialization criterion are supplied, returned doctors MUST match both criteria. Search results MUST support bounded pagination and a stable ordering.
- **FR-024**: A search with no matches MUST return `200 OK` and an empty collection; the frontend MUST show an empty-results state distinct from request failure.
- **FR-025**: Patients MUST be able to view a selected doctor's associated department and available future slots without access to other patients' data.

#### Availability

- **FR-026**: A doctor MUST be able to create, view and manage their own future availability slots; authorized staff MUST be able to manage availability for doctors.
- **FR-027**: Every availability slot MUST identify one doctor and have a valid start and end time with positive duration. The hospital MUST use one configured IANA timezone; timestamp values at API boundaries MUST be ISO 8601 date-time values with an explicit UTC offset and persisted instants MUST use UTC. Local scheduling inputs MUST be interpreted in the configured hospital timezone, and a supplied offset MUST be valid for that local date and time in that zone; nonexistent local times during a daylight-saving transition MUST be rejected, and repeated local times MUST require an explicit offset to disambiguate. “Future” is determined by comparing the slot instant with the current instant; calendar-date boundaries and adult-beneficiary age MUST use the hospital-local date. Invalid or past intervals MUST return `422 VALIDATION_FAILED`; duplicate or overlapping slots for the same doctor MUST return `409 AVAILABILITY_CONFLICT`.
- **FR-028**: Patient availability results MUST include only configured future slots without an active `BOOKED` appointment.
- **FR-029**: A slot associated with a `BOOKED` appointment MUST NOT be removed or changed in a way that changes its doctor or time range; such an operation MUST return `409 APPOINTMENT_SLOT_UNAVAILABLE` and preserve the appointment.
- **FR-030**: Availability MUST be revalidated as part of the booking transaction; a previously displayed slot MUST NOT be considered available solely because it appeared in an earlier response.

#### Appointments

- **FR-031**: A patient MUST be able to book an appointment for self or an authorized beneficiary they manage by selecting a doctor and configured available slot. Authorized staff with appointment-booking permission MUST be able to book on behalf of a patient through the existing administrative interaction.
- **FR-032**: Each appointment MUST identify exactly one actual recipient, the patient account responsible for the booking, and the authenticated account that initiated the operation. For patient-initiated booking, the responsible account and initiating actor are the same; for staff booking on behalf, the patient account is responsible and the authenticated staff account is recorded as actor.
- **FR-033**: A patient MUST NOT be able to book for another patient account, an unowned beneficiary or an adult beneficiary not in `AUTHORIZED` state. Staff MUST book only for a valid patient account and that account's self profile or eligible beneficiary; staff MUST NOT bypass ownership or adult-authorization rules. Cross-account resource access MUST return privacy-preserving `404 Not Found`; an authenticated owner or staff actor selecting a pending/rejected adult beneficiary MUST receive `422 Unprocessable Content` with `BENEFICIARY_NOT_AUTHORIZED`. The API MUST derive initiating actor and role from authenticated identity.
- **FR-034**: The system MUST prevent a doctor from having overlapping active `BOOKED` appointments, including bookings against distinct but overlapping availability slots. Patient- and staff-initiated booking MUST atomically recheck interval availability and commit no more than one active appointment for overlapping time for a doctor, including under concurrent requests. A booking racing with cancellation MUST be serialized: if booking is processed before cancellation commits, it returns `409 APPOINTMENT_SLOT_UNAVAILABLE`; if cancellation commits first, a subsequent booking MAY succeed only if the slot interval is still future and available. Losing booking requests MUST NOT be retried automatically.
- **FR-035**: Appointment statuses MUST be `BOOKED`, `CANCELLED` or `COMPLETED`. A `BOOKED` appointment MAY transition to `CANCELLED` or `COMPLETED`; `CANCELLED` and `COMPLETED` are terminal in Version 1.0.
- **FR-036**: A patient MAY cancel a `BOOKED` appointment for self or an authorized beneficiary they manage. Authorized staff with appointment-cancellation permission MAY cancel a `BOOKED` appointment. Only the assigned doctor MAY mark it `COMPLETED`; no other role may perform these transitions. Staff MUST NOT directly reschedule an existing appointment, change its doctor or time slot as an update to that appointment, or mark it `COMPLETED`. An invalid transition MUST return `409 Conflict` with `APPOINTMENT_STATE_CONFLICT`.
- **FR-037**: Cancellation MUST be transactional, set status to `CANCELLED` and release the corresponding slot for future booking only if its interval is still future and available. Completed or cancelled appointments MUST NOT occupy an active slot; completion does not make an elapsed slot bookable again. Concurrent cancellation and assigned-doctor completion of the same `BOOKED` appointment MUST be serialized so exactly one transition commits and the losing request returns `409 APPOINTMENT_STATE_CONFLICT`.
- **FR-038**: Patients MUST be able to view upcoming and historical appointments for self and authorized beneficiaries. Doctors MUST be able to view upcoming appointments assigned to them and relevant associated patient details. Authorized staff with appointment-view permission MUST be able to view appointments and doctor schedules/availability within their administrative permissions.
- **FR-039**: Every appointment read, creation, status update and cancellation MUST enforce role and object-level authorization on the backend. Patient access MUST verify account ownership and, for adult beneficiaries, authorization; doctor access MUST verify assignment to the appointment; staff access MUST verify the permission for the operation, and staff booking on behalf MUST verify the responsible patient account owns the selected recipient and has adult-beneficiary authorization. Unauthenticated requests MUST return `401`; authenticated callers lacking a required role/permission MUST return `403`; cross-account or unassigned object access MUST return privacy-preserving `404`. An authenticated owning patient or staff member with booking permission who attempts booking for a pending/rejected adult beneficiary MUST receive `422` with `BENEFICIARY_NOT_AUTHORIZED`. Unauthorized access MUST NOT reveal protected patient details.
- **FR-040**: Patient- or staff-initiated booking, cancellation and permitted doctor status changes MUST use database transactions or equivalent atomic operations so failures cannot leave appointment status and slot availability inconsistent or permit duplicate/overlapping active bookings. Staff-created appointments MUST record the actual recipient, responsible patient account and authenticated staff actor.

#### Administrative dashboard

- **FR-041**: The administrative dashboard MUST be available only to authenticated staff with appropriate permissions and MUST provide access to registered patients, doctors, departments, appointments, doctor availability and pending adult-beneficiary authorization reviews.
- **FR-042**: Staff MUST be able to view registered patients, but patient and beneficiary fields returned MUST be limited to information necessary for the authorized administrative operation.
- **FR-043**: Version 1.0 administrative views MUST NOT introduce unrelated analytics or reporting capabilities.

#### API behavior and user feedback

- **FR-044**: Every protected API MUST authenticate and authorize each operation independently of frontend route protection.
- **FR-045**: Body-bearing API responses MUST follow the success or error envelope, status semantics and stable error codes defined in API Contract. `204 No Content` MUST have no response body.
- **FR-046**: Malformed request structure MUST return `400 INVALID_REQUEST`; validly structured field/domain validation failures MUST return `422 VALIDATION_FAILED`; missing/invalid authentication MUST return `401`; missing role/permission MUST return `403 FORBIDDEN`; privacy-sensitive cross-account access MUST return `404 RESOURCE_NOT_FOUND`; pending/rejected adult-beneficiary eligibility MUST return `422 BENEFICIARY_NOT_AUTHORIZED`; and slot/state conflicts MUST return `409` with the applicable stable code. Validation errors MUST return field-level details where applicable. Error responses MUST NOT expose stack traces, SQL, database errors, credentials or internal implementation details.
- **FR-047**: The frontend MUST display clear success, validation, authentication, authorization, not-found, conflict, empty-result, network and unexpected-error feedback using the User Feedback requirements.
- **FR-048**: The frontend MUST show loading feedback for pending requests and ask for confirmation before appointment cancellation. It MUST NOT display a booking or cancellation as successful before the server confirms the operation.
- **FR-049**: When an operation fails due to a network, conflict or server error, the frontend MUST preserve the last server-confirmed state and clearly state that the action was not confirmed.

### API Contract

All path names below are illustrative REST resource families; route naming may be finalized during technical planning without changing the required behavior, authorization, methods or response semantics.

#### Response envelopes

Every response with a body MUST use one of these shapes:

```json
{
  "success": true,
  "message": "Appointment booked successfully.",
  "data": {
    "appointmentId": 101,
    "status": "BOOKED"
  }
}
```

```json
{
  "success": false,
  "message": "This appointment slot is no longer available.",
  "error": {
    "code": "APPOINTMENT_SLOT_UNAVAILABLE",
    "details": []
  }
}
```

`error.details` MUST be an array. For validation errors, it MUST contain safe field-level entries identifying the field and the validation issue. It MUST NOT echo password values or other sensitive input. `204 No Content` is the sole specified successful response without a body.

#### HTTP status code rules

| Status | Required use |
|---|---|
| `200 OK` | Successful retrieval, login, update, cancellation/status operation returning a body, or an empty search/list result. |
| `201 Created` | Successful creation of a patient account, beneficiary request/profile, doctor, department, availability slot or appointment. |
| `204 No Content` | Successful operation intentionally returning no representation; response body MUST be empty. |
| `400 Bad Request` | Malformed JSON, missing/malformed required request structure, or invalid query/path parameter syntax. Use stable code `INVALID_REQUEST`. |
| `401 Unauthorized` | Missing, expired or invalid authentication credentials, including invalid login credentials. Use `AUTHENTICATION_REQUIRED` for protected requests without valid authentication and generic `INVALID_CREDENTIALS` for login failure. |
| `403 Forbidden` | Authenticated caller lacks the required role or operation-specific permission. Use stable code `FORBIDDEN`; do not use this for cross-account object access where existence must be concealed. |
| `404 Not Found` | Resource does not exist, or object-level access must be concealed to protect privacy. Use stable code `RESOURCE_NOT_FOUND` for both cases so existence is not disclosed. |
| `409 Conflict` | Duplicate resources, unavailable slots, overlapping availability/active appointments, invalid appointment state transitions, or attempts to alter a slot occupied by a `BOOKED` appointment. Use the specific codes in the error-code table below. |
| `422 Unprocessable Content` | Structurally valid request failing field validation or a business eligibility rule. An authenticated owner/staff actor attempting an otherwise permitted beneficiary operation while adult authorization is pending or rejected MUST receive `BENEFICIARY_NOT_AUTHORIZED`; do not return `403` for this eligibility failure. |
| `429 Too Many Requests` | A configured rate limit is exceeded. Use stable code `RATE_LIMIT_EXCEEDED` and include a safe retry indication if available. |
| `500 Internal Server Error` | Unexpected application failure. Use stable code `INTERNAL_ERROR`; return a generic message and safe correlation identifier only, never internals. |
| `503 Service Unavailable` | Temporary service unavailability. Use stable code `SERVICE_UNAVAILABLE`, return a safe retry message and do not imply that a non-confirmed operation succeeded. |

#### Stable error codes

| Code | HTTP status | Meaning and safe message guidance |
|---|---:|---|
| `INVALID_REQUEST` | 400 | Request body, path or query structure is malformed or incomplete. |
| `AUTHENTICATION_REQUIRED` | 401 | Authentication is missing, expired or invalid; prompt the user to sign in again. |
| `INVALID_CREDENTIALS` | 401 | Login credentials are invalid; use the same message for unknown accounts and incorrect passwords. |
| `FORBIDDEN` | 403 | The authenticated role or assigned permission does not allow this operation. |
| `RESOURCE_NOT_FOUND` | 404 | Resource is absent or access is concealed to protect privacy. Do not distinguish those cases. |
| `DUPLICATE_RESOURCE` | 409 | A unique account, department or other resource already exists. |
| `RESOURCE_IN_USE` | 409 | A resource is referenced by existing data and cannot be removed or changed without violating integrity. |
| `AVAILABILITY_CONFLICT` | 409 | A duplicate or overlapping doctor availability slot conflicts with the schedule. |
| `APPOINTMENT_SLOT_UNAVAILABLE` | 409 | The selected slot is absent from current availability, already booked or conflicts with an active appointment. |
| `APPOINTMENT_STATE_CONFLICT` | 409 | The requested appointment status transition is invalid, or the operation conflicts with the current appointment state. |
| `BENEFICIARY_STATE_CONFLICT` | 409 | A beneficiary authorization decision conflicts with the beneficiary's current authorization state. |
| `VALIDATION_FAILED` | 422 | One or more field values fail domain validation; provide safe field-level details. |
| `BENEFICIARY_NOT_AUTHORIZED` | 422 | The beneficiary is an adult whose authorization is pending or rejected; do not allow the protected operation. |
| `INVALID_APPOINTMENT_RECIPIENT` | 422 | The structurally valid appointment request does not identify exactly one eligible recipient. |
| `RATE_LIMIT_EXCEEDED` | 429 | A configured rate limit was exceeded. |
| `INTERNAL_ERROR` | 500 | Unexpected failure; provide no technical details. |
| `SERVICE_UNAVAILABLE` | 503 | The service is temporarily unavailable; the operation was not confirmed. |

#### Endpoint behavior expectations

| Resource family | Example operation | Success | Important failures |
|---|---|---|---|
| `/api/v1/auth` and patient registration | Register, login, logout | `201` registration; `200` login; `204` logout | `400 INVALID_REQUEST`; `422 VALIDATION_FAILED`; `401 INVALID_CREDENTIALS`; `409 DUPLICATE_RESOURCE` |
| `/api/v1/patients` | Read/update own profile | `200` | `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN` for role/permission; `404 RESOURCE_NOT_FOUND` for absent or concealed profile; `422 VALIDATION_FAILED` |
| `/api/v1/beneficiaries` | Create/list/update own beneficiary; view authorization status | `201` create; `200` read/update | `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN`; `404 RESOURCE_NOT_FOUND` for absent/cross-account resource; `409 BENEFICIARY_STATE_CONFLICT` for conflicting review state; `422 VALIDATION_FAILED` or `BENEFICIARY_NOT_AUTHORIZED` |
| `/api/v1/doctors` | Browse, search, view profile; staff provision/update | `200` retrieval; `201` provision | `400 INVALID_REQUEST`; `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN`; `404 RESOURCE_NOT_FOUND`; `409 DUPLICATE_RESOURCE`; `422 VALIDATION_FAILED` |
| `/api/v1/departments` | Browse; staff create/update/assign | `200` retrieval/update; `201` create | `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN`; `404 RESOURCE_NOT_FOUND`; `409 DUPLICATE_RESOURCE` or `RESOURCE_IN_USE`; `422 VALIDATION_FAILED` |
| `/api/v1/doctors/{doctorId}/availability` | View schedules/slots; doctor/staff create/update availability | `200` read/update; `201` create | `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN`; `404 RESOURCE_NOT_FOUND`; `409 AVAILABILITY_CONFLICT` or `APPOINTMENT_SLOT_UNAVAILABLE`; `422 VALIDATION_FAILED` |
| `/api/v1/appointments` | Patient book/list/cancel; staff view/book on behalf/cancel within assigned permission; assigned doctor view/complete | `200` reads and permitted status changes; `201` booking; `204` only for an explicitly bodyless action | `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN`; `404 RESOURCE_NOT_FOUND` for absent/cross-account/unassigned objects; `409 APPOINTMENT_SLOT_UNAVAILABLE` or `APPOINTMENT_STATE_CONFLICT`; `422 BENEFICIARY_NOT_AUTHORIZED`, `INVALID_APPOINTMENT_RECIPIENT` or `VALIDATION_FAILED` |
| `/api/v1/admin` | Dashboard and permitted administrative lists/reviews | `200` retrieval/update; `201` created resources | `401 AUTHENTICATION_REQUIRED`; `403 FORBIDDEN`; `404 RESOURCE_NOT_FOUND`; `409` applicable conflict code; `422 VALIDATION_FAILED` |

Specific operations MUST use the same status semantics and error codes consistently across endpoints. Missing/invalid authentication MUST be `401`; authenticated role/permission failures MUST be `403`; cross-account or unassigned object access MUST be `404` when revealing existence would violate privacy; pending/rejected adult-beneficiary eligibility MUST be `422 BENEFICIARY_NOT_AUTHORIZED`; invalid transitions and slot conflicts MUST be `409`. Invalid resources MUST NOT be reported as successful no-ops.

The appointment API MUST support patient/staff booking, permitted patient/staff cancellation, authorized appointment reads and assigned-doctor completion only. It MUST NOT expose an operation that directly reschedules an existing appointment or changes that appointment's doctor or time slot; staff MUST NOT mark appointments `COMPLETED`.

### User Feedback

The frontend MUST present human-readable messages and must not expose raw API internals.

| Scenario | Expected user-facing message or behavior |
|---|---|
| Registration successful | "Your account has been created successfully." |
| Login successful | "Welcome back!" |
| Invalid credentials | "Invalid email or password. Please try again." |
| Appointment booked | "Your appointment has been booked successfully." |
| Slot unavailable | "This slot is no longer available. Please select another time." |
| Appointment cancelled | "Your appointment has been cancelled successfully." |
| Unauthorized operation | "You don't have permission to perform this action." |
| Validation failure | "Please correct the highlighted fields." Field-specific safe messages appear beside invalid fields. |
| Adult beneficiary not authorized for this operation | "This beneficiary is not yet authorized for this action." For pending or rejected authorization, show only the non-sensitive status the owner is permitted to see. |
| Resource unavailable or not found | "This information is unavailable." Do not reveal whether a privacy-concealed patient, beneficiary or appointment exists. |
| Adult-beneficiary review pending | "Authorization is awaiting hospital staff review." |
| Adult-beneficiary rejected | "This beneficiary is not authorized for management. Contact hospital staff for assistance." |
| Empty doctor search | "No doctors match your search. Try another name or specialization." |
| Loading | Show a visible loading state and prevent duplicate submission for the pending action. |
| Network failure | "Unable to connect to the server. Please check your connection." State that the operation was not confirmed. |
| Unexpected error | "Something went wrong. Please try again later." Include no technical details. |
| Cancellation | Ask for confirmation before submitting; show success only after server confirmation. |

### Non-Functional Requirements

- **NFR-001 Security**: Passwords MUST be bcrypt-hashed, secrets MUST NOT be hardcoded, all SQL MUST be parameterized, and all protected APIs MUST enforce server-side authentication and authorization.
- **NFR-002 Privacy**: Patient and beneficiary data MUST be returned only to an authorized actor and limited to the fields needed for the requested workflow. Development, demonstration and test datasets MUST be fictional.
- **NFR-003 Reliability and integrity**: Booking, cancellation and status change operations MUST be atomic and serialized for conflicting slots/appointments. Integration tests MUST prove that failed operations leave no partial appointment/slot state, overlapping active appointments cannot occur, same-slot booking races have one winner, booking/cancellation races follow FR-034, and cancellation/completion races on one appointment have one valid transition winner.
- **NFR-004 Local performance benchmark**: Run the benchmark against a local HMS instance and a fresh SQLite test database populated with fictional data by a deterministic, version-controlled fixture generator using the fixed seed `20261107`. The fixture MUST contain 200 patient accounts, 100 beneficiaries (including minors and adults in pending, authorized and rejected states), 20 doctors, 10 departments, 300 future availability slots and 500 appointments across all three statuses, with relationships and conflicts valid under this specification. It MUST include at least 100 unbooked future slots for booking samples and at least 100 distinct future `BOOKED` appointments for cancellation samples. Use 3 concurrent local clients and exclude application startup and fixture generation/reset from measurements. For each endpoint, create a fresh database from the same fixture; run 10 warm-up requests, then for mutating endpoints discard that database and restore the same fixture before collecting at least 100 successful measured samples. Use distinct preconditioned slots/appointments for each write sample. Paginated reads MUST use page size 20 and stable sorting; doctor search MUST use the same fixture-defined query with a fixed non-empty result set for warm-ups and measured samples. Use the same authenticated actors and request parameters throughout a run. Run requests in deterministic batches of at most 3 concurrent clients; do not automatically retry failed requests. Measure client-observed request duration, excluding reset/seed time. Compute p95 using the nearest-rank method (sort the measured durations and select the value at rank `ceil(0.95 * n)`, with ranks starting at 1). The p95 MUST be at most 1,000 ms for search and paginated reads and at most 2,000 ms for booking and cancellation; all measured samples MUST succeed or the operation fails acceptance. Record the fixture seed, generator revision and fixture-manifest hash, counts by entity and relevant state/workflow cohort, endpoint and operation, search query and expected result count, page size and sort order, hardware/OS/runtime versions, database setup, concurrency, batch order, warm-up and sample counts, elapsed-time distribution including p95, failures and pass/fail for each operation. This is a reproducible local Version 1.0 acceptance benchmark only; it is not a production capacity or scalability claim.
- **NFR-005 API consistency**: All body-bearing endpoints MUST comply with the response envelope, status semantics and stable error codes in this specification; automated API integration tests MUST cover success, malformed requests, field validation, authentication, role/permission authorization, privacy-concealed not-found, beneficiary eligibility, duplicate/conflict and unexpected-error cases.
- **NFR-006 Usability**: Each primary patient task (registration/login, profile update, beneficiary selection, doctor search, booking, appointment viewing and cancellation) MUST provide visible loading, success and failure states appropriate to the action. Forms MUST identify invalid fields in plain language.
- **NFR-007 Maintainability**: Business rules MUST be independently testable and separated from presentation and HTTP handling in accordance with the constitution. Important architectural and API decisions MUST be documented.
- **NFR-008 Quality**: Business logic MUST achieve at least 80% statement coverage using the Node.js built-in test runner. Critical authentication, authorization, beneficiary and appointment tests MUST pass. ESLint MUST report no errors; a Semgrep scan MUST be run; no unresolved critical or high-severity finding may remain at final acceptance.
- **NFR-009 Error safety**: Production errors MUST NOT reveal stack traces, SQL, database errors, credentials, password hashes or internal paths. Unexpected failures MUST be recorded in structured logs without passwords or unnecessary patient/beneficiary information.
- **NFR-010 Compatibility and boundaries**: The product MUST use the approved React/JavaScript, Node.js/Express, SQLite, JavaScript ES modules, REST, Node.js test runner, ESLint and Semgrep standards and MUST NOT implement out-of-scope functional modules.

### Data Requirements

The following describes logical product data and relationships, not physical schema or database scripts.

- **User account**: Unique account identity, normalized unique email, password hash, role (`PATIENT`, `DOCTOR` or `STAFF`), and account lifecycle/authentication metadata. Role is assigned by registration/provisioning rules and is never trusted from a client request.
- **Patient profile**: The account holder's person profile, including name and optional date of birth, gender and contact fields. It is associated with exactly one patient account.
- **Beneficiary profile**: A person profile managed by one patient account, including name, date of birth, optional gender/contact information, relationship and adult authorization state (`PENDING_AUTHORIZATION`, `AUTHORIZED` or `REJECTED` only). A beneficiary has no account/login in Version 1.0. Authorization can transition only from pending to authorized or rejected; authorized and rejected are terminal. Preserve an audit history of every decision, including reviewing staff identity, verification method, outcome and timestamp; do not overwrite or erase prior decision records.
- **Doctor profile**: A staff-provisioned doctor identity and professional profile, including a unique work email for account access, full professional name, at least one specialization, one or more department associations and optional approved professional description or qualification summary. It is associated with a doctor account.
- **Department**: A hospital department with a unique identifying name and descriptive information. A department may have multiple associated doctors; a doctor may have one or more department associations.
- **Availability slot**: A configured doctor schedule interval with one doctor, start/end instants stored in UTC and availability state. Local input and display use the configured hospital IANA timezone. A slot cannot overlap another slot for the same doctor and cannot be altered to invalidate an active appointment.
- **Appointment**: One doctor, one configured slot, one actual recipient (patient account holder's patient profile or beneficiary profile), the patient account responsible for the booking, the authenticated account that initiated booking, status, and creation/update timestamps. For patient-initiated booking, the responsible account and initiating actor are the same; for staff booking on behalf, both the patient account and staff actor are recorded. A beneficiary recipient must belong to the responsible patient account and, if an adult, be authorized at booking time. Staff may create a new appointment on behalf of a patient or cancel an existing `BOOKED` appointment, but may not reschedule or change the doctor/time slot of an existing appointment; only the assigned doctor may mark it `COMPLETED`.

The relational model MUST preserve references between accounts, patient and beneficiary profiles, doctors, departments, slots and appointments; prevent orphaned or multiply-owned records; enforce appropriate uniqueness and valid statuses; and support efficient lookup by account ownership, doctor, department, slot time and appointment status. Appointment recipient representation MUST ensure exactly one person receives care and cannot allow both a patient and beneficiary recipient to be set for one appointment.

### Traceability

| User story | Primary functional requirements |
|---|---|
| US-001 Patient account registration and access | FR-001–FR-008 |
| US-002 Beneficiary enrollment, management and adult authorization | FR-009–FR-016 |
| US-003 Doctor registration and professional profile | FR-017–FR-018, FR-020–FR-021 |
| US-004 Department and specialization management | FR-019–FR-020 |
| US-005 Doctor discovery | FR-021–FR-025 |
| US-006 Doctor availability management | FR-026–FR-030 |
| US-007 Appointment booking for self or beneficiary, including staff booking on behalf | FR-031–FR-034, FR-040 |
| US-008 Appointment viewing, history and cancellation | FR-035–FR-040 |
| US-009 Doctor appointment worklist and completion | FR-035–FR-040 |
| US-010 Administrative management and dashboard | FR-013, FR-016–FR-020, FR-026, FR-031–FR-043 |
| US-011 Consistent errors and understandable feedback | FR-045–FR-049 |

Cross-cutting authorization requirement **FR-044** applies to every protected story and API, not only to the workflows where it is repeated above.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All functional requirements FR-001 through FR-049 are traceable to at least one user story, acceptance scenario or API contract check.
- **SC-002**: Patient registration, login, profile retrieval/update and logout integration scenarios pass, including duplicate email, invalid credentials and unauthorized profile access.
- **SC-003**: Beneficiary tests prove owner isolation, no beneficiary login, minor owner access, adult pending/rejected blocking with `422 BENEFICIARY_NOT_AUTHORIZED`, staff approval and denial only from `PENDING_AUTHORIZATION`, rejection of any subsequent decision from `AUTHORIZED` or `REJECTED` with `409 BENEFICIARY_STATE_CONFLICT`, preservation of each recorded decision's reviewer, verification method, outcome and timestamp in audit history, staff permission enforcement (`403 FORBIDDEN`), adult owner access after approval and cross-account concealment (`404 RESOURCE_NOT_FOUND`).
- **SC-004**: Appointment integration tests prove patient self-booking, patient beneficiary booking and staff booking on behalf each record recipient, responsible patient account and initiating actor correctly.
- **SC-005**: Concurrent same-slot and overlapping-interval tests demonstrate exactly one successful booking and zero duplicate/overlapping active bookings; each losing request returns `409 APPOINTMENT_SLOT_UNAVAILABLE`. Booking/cancellation race tests verify the serialized ordering and future-only slot reuse in FR-034, and cancellation/completion races verify exactly one state transition commits while the loser receives `409 APPOINTMENT_STATE_CONFLICT`.
- **SC-006**: Appointment cancellation tests demonstrate status transition, slot release and successful subsequent booking; failed cancellation tests demonstrate unchanged consistent state.
- **SC-007**: Every protected API has a test for allowed and denied roles/object access, including beneficiary ownership where relevant; unauthenticated calls return `401`, missing role/permission returns `403`, privacy-sensitive cross-account access returns `404`, and pending/rejected adult-beneficiary eligibility returns `422 BENEFICIARY_NOT_AUTHORIZED`.
- **SC-008**: API contract tests verify all required status classes and response envelopes; no production error response includes stack traces or internal details.
- **SC-009**: Application business logic achieves at least 80% statement coverage; all critical functional/security tests pass; ESLint reports zero errors; and Semgrep results contain no unresolved critical or high-severity finding at final acceptance.
- **SC-010**: The local performance benchmark meets the NFR-004 p95 targets using the fictional deterministic fixture with seed `20261107`, fresh fixtures per endpoint and after mutating-operation warm-ups, page size 20 with stable sorting, the fixture-defined doctor search query, 3 concurrent clients, and at least 100 successful measured samples per endpoint; it records the required environment, dataset, seed, generator revision, fixture manifest, request parameters/order, concurrency, latency distribution and result details.
- **SC-011**: Staff appointment permission tests prove authorized staff can view appointments, book on behalf of an eligible patient while recording the patient account and staff actor separately, view doctor schedules/availability and cancel `BOOKED` appointments, while staff cannot reschedule/change an existing appointment's doctor or time slot or mark an appointment `COMPLETED`.

## Assumptions

- Patient registration uses email and password because the constitution requires secure password hashing and self-registration; additional authentication factors are not specified for Version 1.0.
- Doctor and staff accounts are provisioned by authorized staff or through the hospital's approved account-provisioning process; Version 1.0 does not add staff-account administration or self-registration for these roles.
- Staff booking on behalf of a patient requires a patient request through the hospital's existing administrative interaction. The patient's account remains responsible for the appointment, while the authenticated staff account is recorded as the initiating actor; this adds no new communication module.
- Patient account registration requires full name, email and password. Date of birth, gender and contact details are profile fields; beneficiary name, date of birth and relationship are required. Gender and contact details are optional unless needed for direct adult authorization confirmation.
- When supplied, gender is self-described rather than restricted to a fixed list and is not used as a scheduling or authorization rule.
- Email addresses are treated case-insensitively for uniqueness. Names are trimmed. Product validation uses calendar-valid dates and rejects future dates of birth.
- Relationship options are spouse, parent, child, sibling, other relative, legal guardian and other. Selecting other requires a relationship description.
- A beneficiary is treated as an adult on or after their 18th birthday; age is calculated from date of birth using the hospital-local date.
- As clarified for this specification, adult-beneficiary access is staff-verified: the account holder may submit a request, but protected profile management and appointment access remain blocked until authorized staff directly confirm authorization with the adult in person or by phone and record approval. This does not add a separate beneficiary login, external messaging integration or document-management module.
- A pending adult request may expose only its non-sensitive status to the submitting account. Staff may access the data needed to directly confirm authorization with the adult. HMS records the confirmation method and outcome, not consent documents or recordings.
- Appointment availability consists of explicitly configured future start/end intervals. One hospital IANA timezone is supplied through runtime configuration, not as a new Version 1.0 administration feature. Appointment instants are stored in UTC and API timestamp values include an explicit UTC offset; local scheduling inputs and calendar-date boundaries use the configured hospital timezone. Reject nonexistent local times and require an explicit offset for repeated local times during daylight-saving transitions. Determine future slots by instant and adult age by the hospital-local date.
- No Version 1.0 appointment cancellation notice period or rescheduling workflow is included; in particular, staff cannot reschedule/change an existing appointment's doctor or time slot. Staff booking on behalf creates a new appointment and is not a rescheduling operation. Recurring schedule engines, medical-record content and beneficiary login are also out of scope.
- Transport/session details, precise endpoint names, exact reference hardware, and implementation-level database schema are planning decisions, provided they satisfy the constitutional and measurable requirements here.

## Scope Restrictions

Version 1.0 includes patient management, beneficiary management and authorization, doctor management, department management, authentication and authorization, doctor discovery, doctor availability, appointments and essential staff administrative views only.

The system MUST NOT include billing or payment processing, pharmacy or medicine inventory management, laboratory management, inpatient or bed management, electronic medical records, insurance management, video consultations, external SMS/email/WhatsApp notifications, multi-branch hospital management, AI diagnosis or medical recommendations, or unrelated analytics/reporting modules.

## Clarifications

- **Resolved during specification**: Adult beneficiary authorization requires direct confirmation by authorized staff with the adult, in person or by phone. Staff record the method and outcome; HMS does not store consent documents or recordings. The owning account cannot access protected details or book/view appointments until approval. This adds no beneficiary login or external messaging/verification service.
- **Resolved during specification**: The adult-beneficiary threshold is 18 years. A beneficiary is treated as an adult on or after their 18th birthday, calculated using the hospital-local date.
- **Resolved during specification**: Staff may book for a patient after receiving a request through the existing administrative interaction. The patient's account is recorded as responsible for the booking and the authenticated staff account as the initiating actor; ownership and beneficiary authorization checks remain mandatory.
- **Resolved during specification**: Adult-beneficiary authorization uses only `PENDING_AUTHORIZATION`, `AUTHORIZED` and `REJECTED`. Staff may decide only a pending request, with transitions to authorized or rejected; both resulting states are terminal in Version 1.0. Each decision is retained in authorization audit history with reviewer identity, verification method, outcome and timestamp.
- **Resolved during specification**: The hospital uses one runtime-configured IANA timezone. Appointment instants are stored in UTC and API timestamps carry explicit offsets; local date boundaries and adult age use the hospital-local date. Nonexistent daylight-saving local times are rejected; repeated local times require an explicit offset.
- **Resolved during specification**: Conflicting appointment operations are serialized atomically. A booking racing cancellation returns a slot conflict if booking is processed first; if cancellation commits first, a subsequent booking may use the slot only if it remains in the future and available. Losing bookings are not retried automatically. Concurrent cancellation and doctor completion of one booked appointment permit exactly one transition; the loser receives `409 APPOINTMENT_STATE_CONFLICT`. Completion does not make an elapsed slot bookable again.
- **Resolved during specification**: The performance benchmark uses a fresh database from the same deterministic, version-controlled fixture for each endpoint; mutating endpoints run warm-ups on a disposable fixture and reset before measured samples. Booking and cancellation use distinct preconditioned records, requests run in fixed batches of at most three concurrent clients without retries, and p95 is the nearest-rank value over client-observed request durations. Results include the fixture generator revision and manifest hash.
- **Resolved during specification**: Benchmark paginated reads use page size 20 and stable sorting; doctor search uses the same fixture-defined query and fixed non-empty result set for warm-ups and measured samples. The query, expected result count and sort order are recorded with benchmark results.
