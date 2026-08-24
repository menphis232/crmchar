CREATE TABLE IF NOT EXISTS support_messages (
  id VARCHAR(36) PRIMARY KEY,
  client_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  message TEXT,
  file_url VARCHAR(255) DEFAULT NULL,
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_support_client (client_id, created_at),
  INDEX idx_support_unread (client_id, is_read, sender_id),
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
