-- v72: perito asignado al cliente (contacto)
ALTER TABLE contacts
  ADD COLUMN perito_id VARCHAR(36) NULL AFTER notes,
  ADD COLUMN perito_assigned_at DATETIME NULL AFTER perito_id;

CREATE INDEX idx_contacts_perito ON contacts (user_id, perito_id);
