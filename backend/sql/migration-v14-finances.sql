USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS fin_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  deal_id VARCHAR(36) NULL,
  type ENUM('income', 'expense') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE SET NULL,
  INDEX idx_fin_user_type (user_id, type),
  INDEX idx_fin_date (date)
);
