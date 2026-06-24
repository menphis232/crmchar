USE tramites_vehiculares;

ALTER TABLE crm_quotes ADD COLUMN includes_list JSON NULL;
ALTER TABLE crm_quotes ADD COLUMN requirements_list JSON NULL;
ALTER TABLE crm_quotes ADD COLUMN bonus_list JSON NULL;

ALTER TABLE users ADD COLUMN quote_includes_templates JSON NULL;
ALTER TABLE users ADD COLUMN quote_requirements_templates JSON NULL;
ALTER TABLE users ADD COLUMN quote_bonus_templates JSON NULL;

ALTER TABLE gestor_services ADD COLUMN includes JSON NULL;
ALTER TABLE gestor_services ADD COLUMN bonus JSON NULL;
