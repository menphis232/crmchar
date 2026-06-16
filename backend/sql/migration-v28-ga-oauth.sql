USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS analytics_settings (
  id TINYINT PRIMARY KEY DEFAULT 1,
  measurement_id VARCHAR(50) DEFAULT NULL,
  property_id VARCHAR(32) DEFAULT NULL,
  access_token TEXT DEFAULT NULL,
  refresh_token TEXT DEFAULT NULL,
  token_expiry BIGINT DEFAULT NULL,
  connected_email VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO analytics_settings (id) VALUES (1);
