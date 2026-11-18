ALTER TABLE users
  ADD COLUMN profile_type VARCHAR(20) NULL
  COMMENT 'fisica | moral' AFTER phone;
