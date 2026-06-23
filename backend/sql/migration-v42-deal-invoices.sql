USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS deal_invoices (
  id VARCHAR(36) PRIMARY KEY,
  deal_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  contact_email VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(32) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  pdf_url VARCHAR(512) NOT NULL,
  payment_method VARCHAR(32) NOT NULL DEFAULT 'mercadopago',
  mp_order_id VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_deal_invoice (deal_id),
  KEY idx_deal_invoices_contact (contact_email),
  KEY idx_deal_invoices_user (user_id)
);
