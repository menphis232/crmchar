-- Migration V18: AI Config and Client Portal

-- Add AI settings to users table
ALTER TABLE users ADD COLUMN ai_provider VARCHAR(50) DEFAULT NULL;
ALTER TABLE users ADD COLUMN ai_api_key VARCHAR(255) DEFAULT NULL;

-- Add flag to force password change for auto-generated clients
ALTER TABLE users ADD COLUMN password_changed_at DATETIME DEFAULT NULL;

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  message TEXT,
  file_url VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
