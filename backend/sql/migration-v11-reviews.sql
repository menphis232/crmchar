USE tramites_vehiculares;
ALTER TABLE gestor_reviews ADD COLUMN deal_id VARCHAR(36) UNIQUE DEFAULT NULL;
