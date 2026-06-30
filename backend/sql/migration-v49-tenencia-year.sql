USE tramites_vehiculares;

ALTER TABLE contact_vehicles
  ADD COLUMN tenencia_year SMALLINT NULL AFTER tenencia_2026;

UPDATE contact_vehicles
  SET tenencia_year = 2026
  WHERE tenencia_2026 IS NOT NULL AND tenencia_year IS NULL;
