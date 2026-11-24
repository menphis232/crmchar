-- v76: link mágico de acceso al panel cliente (un solo uso)
ALTER TABLE users
  ADD COLUMN magic_login_token VARCHAR(64) NULL,
  ADD COLUMN magic_login_expires_at DATETIME NULL;

CREATE INDEX idx_users_magic_login_token ON users (magic_login_token);
