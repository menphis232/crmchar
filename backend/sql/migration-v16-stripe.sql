USE tramites_vehiculares;

ALTER TABLE users 
ADD COLUMN stripe_secret_key VARCHAR(255) DEFAULT NULL AFTER google_analytics_id,
ADD COLUMN stripe_public_key VARCHAR(255) DEFAULT NULL AFTER stripe_secret_key;

ALTER TABLE crm_deals 
ADD COLUMN payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid' AFTER stage,
ADD COLUMN payment_session_id VARCHAR(255) DEFAULT NULL AFTER payment_status;
