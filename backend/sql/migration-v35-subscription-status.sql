-- Estado de suscripción: payment_failed_count, checkout session
ALTER TABLE users ADD COLUMN payment_failed_count INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN stripe_checkout_session_id VARCHAR(255) DEFAULT NULL;
