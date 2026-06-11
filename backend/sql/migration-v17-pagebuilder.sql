-- migration-v17-pagebuilder.sql
-- Add page_builder_config to users and custom_data to solicitudes

USE tramites_vehiculares;

ALTER TABLE users 
ADD COLUMN page_builder_config JSON NULL DEFAULT NULL AFTER google_analytics_id;

ALTER TABLE solicitudes
ADD COLUMN custom_data JSON NULL DEFAULT NULL AFTER client_phone;
