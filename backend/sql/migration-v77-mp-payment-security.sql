-- v77: expiración de links de pago MP (anti-abuso / anti-clonación)
ALTER TABLE crm_deals
  ADD COLUMN mp_payment_expires_at DATETIME NULL;

CREATE INDEX idx_crm_deals_mp_payment_token ON crm_deals (mp_payment_token);