USE tramites_vehiculares;

ALTER TABLE users MODIFY role ENUM('gestor', 'concesionaria', 'cliente', 'admin', 'perito') NOT NULL;

ALTER TABLE crm_deals ADD COLUMN perito_id VARCHAR(36) NULL;
ALTER TABLE crm_deals ADD COLUMN perito_assigned_at DATETIME NULL;
ALTER TABLE crm_deals ADD COLUMN perito_stage VARCHAR(50) NULL;
ALTER TABLE crm_deals ADD COLUMN perito_poliza_status ENUM('pendiente', 'pagado') DEFAULT 'pendiente';
ALTER TABLE crm_deals ADD COLUMN perito_completed_at DATETIME NULL;

CREATE INDEX idx_deals_perito ON crm_deals (user_id, perito_id);

CREATE TABLE IF NOT EXISTS perito_deal_uploads (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  perito_id VARCHAR(36) NOT NULL,
  doc_type ENUM('poliza_pago', 'tramite_listo', 'guia_paqueteria') NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_perito_upload_deal (deal_id),
  INDEX idx_perito_upload_user (perito_id)
);

CREATE TABLE IF NOT EXISTS perito_deal_notes (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  perito_id VARCHAR(36) NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_perito_note_deal (deal_id)
);
