USE tramites_vehiculares;

ALTER TABLE users ADD COLUMN google_analytics_id VARCHAR(50) DEFAULT NULL AFTER permissions;
