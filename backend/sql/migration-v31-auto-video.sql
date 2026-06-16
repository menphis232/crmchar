USE tramites_vehiculares;

ALTER TABLE autos ADD COLUMN video_url VARCHAR(1000) DEFAULT NULL AFTER images;
