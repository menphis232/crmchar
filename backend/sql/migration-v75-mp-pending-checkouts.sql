-- v75: checkouts MP previos a crear el trámite (pago → luego deal)
CREATE TABLE IF NOT EXISTS mp_pending_checkouts (
  id VARCHAR(36) PRIMARY KEY,
  token VARCHAR(36) NOT NULL,
  gestor_id VARCHAR(36) NOT NULL,
  gestor_user_id VARCHAR(36) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NULL,
  client_phone VARCHAR(50) NULL,
  location VARCHAR(255) NULL,
  service_name VARCHAR(255) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  custom_data JSON NULL,
  status ENUM('pending', 'paid', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  mp_order_id VARCHAR(100) NULL,
  deal_id VARCHAR(36) NULL,
  solicitud_id VARCHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  UNIQUE KEY uq_mp_pending_token (token),
  INDEX idx_mp_pending_order (mp_order_id),
  INDEX idx_mp_pending_gestor (gestor_user_id, status)
);
