USE tramites_vehiculares;

ALTER TABLE contact_vehicles
  ADD COLUMN make VARCHAR(80) NULL AFTER plate,
  ADD COLUMN model VARCHAR(80) NULL AFTER make,
  ADD COLUMN year SMALLINT NULL AFTER model;
