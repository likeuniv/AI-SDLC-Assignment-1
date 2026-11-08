CREATE TRIGGER availability_slots_prevent_overlap_insert
BEFORE INSERT ON availability_slots
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM availability_slots AS existing
  WHERE existing.doctor_account_id = NEW.doctor_account_id
    AND existing.start_at < NEW.end_at
    AND existing.end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'Availability slot overlaps an existing slot for this doctor.');
END;

CREATE TRIGGER availability_slots_prevent_overlap_update
BEFORE UPDATE ON availability_slots
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM availability_slots AS existing
  WHERE existing.id <> OLD.id
    AND existing.doctor_account_id = NEW.doctor_account_id
    AND existing.start_at < NEW.end_at
    AND existing.end_at > NEW.start_at
)
BEGIN
  SELECT RAISE(ABORT, 'Availability slot overlaps an existing slot for this doctor.');
END;

CREATE TRIGGER beneficiary_authorization_audit_prevent_update
BEFORE UPDATE ON beneficiary_authorization_audit
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Beneficiary authorization audit records are immutable.');
END;

CREATE TRIGGER beneficiary_authorization_audit_prevent_delete
BEFORE DELETE ON beneficiary_authorization_audit
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'Beneficiary authorization audit records cannot be deleted.');
END;
