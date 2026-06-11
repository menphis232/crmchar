-- Add fields to users table for Stripe subscriptions
ALTER TABLE users ADD COLUMN status VARCHAR(50) DEFAULT 'active';
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255) NULL;

-- Super admin also needs to store the stripe_price_id
ALTER TABLE users ADD COLUMN stripe_price_id VARCHAR(255) NULL;
