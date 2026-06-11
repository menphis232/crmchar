-- v21: Dealer Profile & Google Maps
-- Adds public profile fields to users (concesionarias) and gestores

USE tramites_vehiculares;

-- Users: slug + public profile fields for concesionarias
ALTER TABLE users ADD COLUMN slug VARCHAR(120) DEFAULT NULL;
ALTER TABLE users ADD COLUMN description TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN phone VARCHAR(40) DEFAULT NULL;
ALTER TABLE users ADD COLUMN address VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN map_embed_url TEXT DEFAULT NULL;

-- Gestores: phone, address, map embed
ALTER TABLE gestores ADD COLUMN phone VARCHAR(40) DEFAULT NULL;
ALTER TABLE gestores ADD COLUMN address VARCHAR(255) DEFAULT NULL;
ALTER TABLE gestores ADD COLUMN map_embed_url TEXT DEFAULT NULL;
