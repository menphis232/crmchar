USE tramites_vehiculares;
ALTER TABLE crm_deals ADD COLUMN tracking_code VARCHAR(20) UNIQUE DEFAULT NULL;
