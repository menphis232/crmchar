CREATE TABLE IF NOT EXISTS push_campaigns (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  url VARCHAR(500) NULL,
  audience_type VARCHAR(32) NOT NULL,
  audience_value VARCHAR(255) NULL,
  recipients INT NOT NULL DEFAULT 0,
  onesignal_id VARCHAR(64) NULL,
  created_by VARCHAR(36) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_push_campaigns_created (created_at DESC)
);
