CREATE UNIQUE INDEX idx_beneficiaries_id_owner
  ON beneficiaries (id, owner_account_id);

CREATE TABLE availability_slots (
  id INTEGER PRIMARY KEY,
  doctor_account_id INTEGER NOT NULL
    REFERENCES doctor_profiles (account_id) ON DELETE RESTRICT,
  start_at TEXT NOT NULL
    CHECK (
      length(start_at) = 24
      AND strftime('%Y-%m-%dT%H:%M:%fZ', start_at) = start_at
    ),
  end_at TEXT NOT NULL
    CHECK (
      length(end_at) = 24
      AND strftime('%Y-%m-%dT%H:%M:%fZ', end_at) = end_at
    ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z'),
  CHECK (end_at > start_at),
  UNIQUE (id, doctor_account_id)
);

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY,
  availability_slot_id INTEGER NOT NULL,
  doctor_account_id INTEGER NOT NULL
    REFERENCES doctor_profiles (account_id) ON DELETE RESTRICT,
  patient_recipient_account_id INTEGER
    REFERENCES patient_profiles (account_id) ON DELETE RESTRICT,
  beneficiary_recipient_id INTEGER,
  responsible_account_id INTEGER NOT NULL,
  responsible_account_role TEXT NOT NULL DEFAULT 'PATIENT'
    CHECK (responsible_account_role = 'PATIENT'),
  initiated_by_account_id INTEGER NOT NULL,
  initiated_by_role TEXT NOT NULL
    CHECK (initiated_by_role IN ('PATIENT', 'STAFF')),
  status TEXT NOT NULL DEFAULT 'BOOKED'
    CHECK (status IN ('BOOKED', 'CANCELLED', 'COMPLETED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (
      length(created_at) = 24
      AND strftime('%Y-%m-%dT%H:%M:%fZ', created_at) = created_at
    ),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (
      length(updated_at) = 24
      AND strftime('%Y-%m-%dT%H:%M:%fZ', updated_at) = updated_at
    ),
  CHECK (
    (patient_recipient_account_id IS NOT NULL AND beneficiary_recipient_id IS NULL)
    OR (patient_recipient_account_id IS NULL AND beneficiary_recipient_id IS NOT NULL)
  ),
  CHECK (
    patient_recipient_account_id IS NULL
    OR patient_recipient_account_id = responsible_account_id
  ),
  CHECK (
    initiated_by_role <> 'PATIENT'
    OR initiated_by_account_id = responsible_account_id
  ),
  FOREIGN KEY (availability_slot_id, doctor_account_id)
    REFERENCES availability_slots (id, doctor_account_id) ON DELETE RESTRICT,
  FOREIGN KEY (responsible_account_id, responsible_account_role)
    REFERENCES accounts (id, role) ON DELETE RESTRICT,
  FOREIGN KEY (beneficiary_recipient_id, responsible_account_id)
    REFERENCES beneficiaries (id, owner_account_id) ON DELETE RESTRICT,
  FOREIGN KEY (initiated_by_account_id, initiated_by_role)
    REFERENCES accounts (id, role) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX idx_appointments_one_booked_per_slot
  ON appointments (availability_slot_id)
  WHERE status = 'BOOKED';
CREATE INDEX idx_availability_slots_doctor_interval
  ON availability_slots (doctor_account_id, start_at, end_at);
CREATE INDEX idx_appointments_slot_status
  ON appointments (availability_slot_id, status);
CREATE INDEX idx_appointments_doctor_status_created
  ON appointments (doctor_account_id, status, created_at);
CREATE INDEX idx_appointments_responsible_status_created
  ON appointments (responsible_account_id, status, created_at);
CREATE INDEX idx_appointments_actor_created
  ON appointments (initiated_by_account_id, created_at);

CREATE TABLE beneficiary_authorization_audit (
  id INTEGER PRIMARY KEY,
  beneficiary_id INTEGER NOT NULL
    REFERENCES beneficiaries (id) ON DELETE RESTRICT,
  reviewer_account_id INTEGER NOT NULL,
  reviewer_role TEXT NOT NULL DEFAULT 'STAFF'
    CHECK (reviewer_role = 'STAFF'),
  verification_method TEXT NOT NULL
    CHECK (verification_method IN ('IN_PERSON', 'PHONE')),
  outcome TEXT NOT NULL
    CHECK (outcome IN ('AUTHORIZED', 'REJECTED')),
  reviewed_at TEXT NOT NULL
    CHECK (
      length(reviewed_at) = 24
      AND strftime('%Y-%m-%dT%H:%M:%fZ', reviewed_at) = reviewed_at
    ),
  FOREIGN KEY (reviewer_account_id, reviewer_role)
    REFERENCES accounts (id, role) ON DELETE RESTRICT
);

CREATE INDEX idx_authorization_audit_beneficiary_time
  ON beneficiary_authorization_audit (beneficiary_id, reviewed_at);
