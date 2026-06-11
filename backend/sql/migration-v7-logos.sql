USE tramites_vehiculares;

ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url VARCHAR(255) NULL;
