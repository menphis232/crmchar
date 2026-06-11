USE tramites_vehiculares;

ALTER TABLE users ADD COLUMN IF NOT EXISTS pdf_settings JSON NULL;
