USE tramites_vehiculares;

ALTER TABLE contact_vehicles
  ADD COLUMN insurance_expiry DATE NULL AFTER vehicle_notes,
  ADD COLUMN tenencia_2026 VARCHAR(20) NULL AFTER insurance_expiry;
