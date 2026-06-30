USE tramites_vehiculares;

ALTER TABLE users
  ADD COLUMN avatar_url VARCHAR(500) NULL AFTER name;
