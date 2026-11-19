-- v71: visibilidad pública de cada servicio del catálogo
ALTER TABLE gestor_services
  ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1 AFTER image_url;
