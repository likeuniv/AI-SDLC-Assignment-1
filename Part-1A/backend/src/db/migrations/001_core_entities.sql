CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL
    CHECK (length(trim(full_name)) BETWEEN 1 AND 120),
  email_normalized TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (
      length(email_normalized) BETWEEN 3 AND 254
      AND email_normalized = trim(email_normalized)
      AND email_normalized = lower(email_normalized)
    ),
  password_hash TEXT NOT NULL
      CHECK (
        length(password_hash) = 60
        AND password_hash GLOB '$2[aby]$[0-9][0-9]$*'
      ),
  role TEXT NOT NULL
    CHECK (role IN ('PATIENT', 'DOCTOR', 'STAFF')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z'),
  UNIQUE (id, role)
);

CREATE TABLE patient_profiles (
  account_id INTEGER PRIMARY KEY,
  account_role TEXT NOT NULL DEFAULT 'PATIENT'
    CHECK (account_role = 'PATIENT'),
  date_of_birth TEXT
    CHECK (
      date_of_birth IS NULL
      OR (
        length(date_of_birth) = 10
        AND date_of_birth GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
        AND date(date_of_birth, '+0 days') = date_of_birth
      )
    ),
  gender TEXT
    CHECK (gender IS NULL OR length(trim(gender)) BETWEEN 1 AND 80),
  contact_email TEXT
    CHECK (contact_email IS NULL OR length(trim(contact_email)) BETWEEN 1 AND 254),
  contact_phone TEXT
    CHECK (contact_phone IS NULL OR length(trim(contact_phone)) BETWEEN 1 AND 32),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z'),
  FOREIGN KEY (account_id, account_role)
    REFERENCES accounts (id, role) ON DELETE RESTRICT
);

CREATE TABLE beneficiaries (
  id INTEGER PRIMARY KEY,
  owner_account_id INTEGER NOT NULL,
  owner_account_role TEXT NOT NULL DEFAULT 'PATIENT'
    CHECK (owner_account_role = 'PATIENT'),
  full_name TEXT NOT NULL
    CHECK (length(trim(full_name)) BETWEEN 1 AND 120),
  date_of_birth TEXT NOT NULL
    CHECK (
      length(date_of_birth) = 10
      AND date_of_birth GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      AND date(date_of_birth, '+0 days') = date_of_birth
    ),
  relationship TEXT NOT NULL
    CHECK (
      relationship IN (
        'spouse',
        'parent',
        'child',
        'sibling',
        'other relative',
        'legal guardian',
        'other'
      )
    ),
  relationship_description TEXT,
  gender TEXT
    CHECK (gender IS NULL OR length(trim(gender)) BETWEEN 1 AND 80),
  contact_email TEXT
    CHECK (contact_email IS NULL OR length(trim(contact_email)) BETWEEN 1 AND 254),
  contact_phone TEXT
    CHECK (contact_phone IS NULL OR length(trim(contact_phone)) BETWEEN 1 AND 32),
  authorization_status TEXT
    CHECK (
      authorization_status IS NULL
      OR authorization_status IN (
        'PENDING_AUTHORIZATION',
        'AUTHORIZED',
        'REJECTED'
      )
    ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z'),
  CHECK (
    (relationship = 'other' AND length(trim(COALESCE(relationship_description, ''))) > 0)
    OR relationship <> 'other'
  ),
  CHECK (
    relationship_description IS NULL
    OR length(relationship_description) <= 120
  ),
  FOREIGN KEY (owner_account_id, owner_account_role)
    REFERENCES accounts (id, role) ON DELETE RESTRICT
);

CREATE TABLE doctor_profiles (
  account_id INTEGER PRIMARY KEY,
  account_role TEXT NOT NULL DEFAULT 'DOCTOR'
    CHECK (account_role = 'DOCTOR'),
  professional_name TEXT NOT NULL
    CHECK (length(trim(professional_name)) BETWEEN 1 AND 120),
  professional_summary TEXT
    CHECK (
      professional_summary IS NULL
      OR length(trim(professional_summary)) BETWEEN 1 AND 2000
    ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z'),
  FOREIGN KEY (account_id, account_role)
    REFERENCES accounts (id, role) ON DELETE RESTRICT
);

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT
    CHECK (description IS NULL OR length(trim(description)) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z')
);

CREATE TABLE specializations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(trim(name)) BETWEEN 1 AND 120),
  description TEXT
    CHECK (description IS NULL OR length(trim(description)) BETWEEN 1 AND 1000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(updated_at, -1) = 'Z')
);

CREATE TABLE doctor_departments (
  doctor_account_id INTEGER NOT NULL
    REFERENCES doctor_profiles (account_id) ON DELETE RESTRICT,
  department_id INTEGER NOT NULL
    REFERENCES departments (id) ON DELETE RESTRICT,
  PRIMARY KEY (doctor_account_id, department_id)
);

CREATE TABLE doctor_specializations (
  doctor_account_id INTEGER NOT NULL
    REFERENCES doctor_profiles (account_id) ON DELETE RESTRICT,
  specialization_id INTEGER NOT NULL
    REFERENCES specializations (id) ON DELETE RESTRICT,
  PRIMARY KEY (doctor_account_id, specialization_id)
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts (id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE
    CHECK (length(trim(token_hash)) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    CHECK (substr(created_at, -1) = 'Z'),
  expires_at TEXT NOT NULL
    CHECK (substr(expires_at, -1) = 'Z'),
  invalidated_at TEXT
    CHECK (invalidated_at IS NULL OR substr(invalidated_at, -1) = 'Z'),
  CHECK (expires_at > created_at),
  CHECK (invalidated_at IS NULL OR invalidated_at >= created_at)
);

CREATE INDEX idx_beneficiaries_owner_status
  ON beneficiaries (owner_account_id, authorization_status);
CREATE INDEX idx_doctor_profiles_name
  ON doctor_profiles (professional_name COLLATE NOCASE, account_id);
CREATE INDEX idx_doctor_departments_department
  ON doctor_departments (department_id, doctor_account_id);
CREATE INDEX idx_doctor_specializations_specialization
  ON doctor_specializations (specialization_id, doctor_account_id);
CREATE INDEX idx_sessions_account_expiry
  ON sessions (account_id, expires_at);
