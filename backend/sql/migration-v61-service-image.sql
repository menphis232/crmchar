-- Foto de cada servicio en la ficha pública del gestor
ALTER TABLE gestor_services ADD COLUMN image_url VARCHAR(500) NULL AFTER bonus;
