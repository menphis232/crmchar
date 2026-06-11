USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS crm_quotes (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  items JSON,
  total DECIMAL(14,2) DEFAULT 0,
  valid_until DATETIME,
  status ENUM('draft', 'sent', 'accepted', 'rejected') DEFAULT 'draft',
  pdf_url VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_quotes_deal (deal_id)
);
