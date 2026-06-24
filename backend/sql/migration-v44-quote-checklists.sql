USE tramites_vehiculares;

ALTER TABLE crm_quotes
  ADD COLUMN IF NOT EXISTS includes_list JSON NULL,
  ADD COLUMN IF NOT EXISTS requirements_list JSON NULL,
  ADD COLUMN IF NOT EXISTS bonus_list JSON NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quote_includes_templates JSON NULL,
  ADD COLUMN IF NOT EXISTS quote_requirements_templates JSON NULL,
  ADD COLUMN IF NOT EXISTS quote_bonus_templates JSON NULL;

ALTER TABLE gestor_services
  ADD COLUMN IF NOT EXISTS includes JSON NULL,
  ADD COLUMN IF NOT EXISTS bonus JSON NULL;
