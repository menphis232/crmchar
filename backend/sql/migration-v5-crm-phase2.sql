USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS crm_tasks (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  due_at DATETIME NOT NULL,
  completed TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tasks_user_due (user_id, due_at, completed)
);
