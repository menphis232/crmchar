USE tramites_vehiculares;

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_analytics_id VARCHAR(50) DEFAULT NULL AFTER permissions;
