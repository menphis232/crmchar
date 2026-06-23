USE tramites_vehiculares;

-- MP credentials on the user (gestor)
ALTER TABLE users
  ADD COLUMN mp_access_token VARCHAR(512) DEFAULT NULL,
  ADD COLUMN mp_public_key   VARCHAR(512) DEFAULT NULL;

-- Payment tracking on CRM deals
ALTER TABLE crm_deals
  ADD COLUMN mp_payment_token VARCHAR(64)  DEFAULT NULL,
  ADD COLUMN mp_order_id      VARCHAR(100) DEFAULT NULL;
