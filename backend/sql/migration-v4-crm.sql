USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS contacts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  whatsapp VARCHAR(50),
  source VARCHAR(100) DEFAULT 'directorio',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_contacts_user (user_id)
);

CREATE TABLE IF NOT EXISTS crm_deals (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  deal_type ENUM('tramite', 'venta_auto') NOT NULL,
  title VARCHAR(255) NOT NULL,
  stage VARCHAR(50) NOT NULL,
  estimated_value DECIMAL(14,2) DEFAULT 0,
  internal_notes TEXT,
  ref_type ENUM('solicitud', 'auto_inquiry') NULL,
  ref_id VARCHAR(36) NULL,
  auto_id VARCHAR(36) NULL,
  stage_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  INDEX idx_deals_user_stage (user_id, stage)
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  activity_type ENUM('note', 'stage_change', 'message') NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deal_id) REFERENCES crm_deals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS message_templates (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  template_category ENUM('tramite', 'venta') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
