-- migration-v13-multiuser.sql
-- Add parent_id and permissions to users table for multi-user support (Gestoría team)

ALTER TABLE users 
ADD COLUMN parent_id VARCHAR(36) NULL DEFAULT NULL AFTER id,
ADD COLUMN permissions JSON NULL DEFAULT NULL AFTER role;

-- Create an index to quickly find employees of a parent
CREATE INDEX idx_users_parent_id ON users(parent_id);
