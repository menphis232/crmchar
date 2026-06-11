-- v22: Custom CRM Stages for Users
-- Adds a JSON column to store customized CRM stages per user

USE tramites_vehiculares;

ALTER TABLE users ADD COLUMN crm_stages JSON DEFAULT NULL;
