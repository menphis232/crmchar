ALTER TABLE users
  ADD COLUMN terms_accepted_at DATETIME NULL,
  ADD COLUMN privacy_accepted_at DATETIME NULL,
  ADD COLUMN last_seen_at DATETIME NULL;
