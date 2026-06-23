-- v37: Galería de imágenes en perfil público del gestor
USE tramites_vehiculares;

ALTER TABLE gestores ADD COLUMN gallery_images JSON DEFAULT NULL;
