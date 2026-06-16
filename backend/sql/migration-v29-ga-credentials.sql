USE tramites_vehiculares;

ALTER TABLE analytics_settings
  ADD COLUMN google_client_id VARCHAR(255) DEFAULT NULL AFTER connected_email,
  ADD COLUMN google_client_secret VARCHAR(512) DEFAULT NULL AFTER google_client_id;
