USE tramites_vehiculares;

ALTER TABLE crm_deals
  ADD COLUMN assigned_to VARCHAR(36) NULL AFTER user_id,
  ADD COLUMN assigned_at DATETIME NULL AFTER assigned_to,
  ADD COLUMN closed_by VARCHAR(36) NULL AFTER assigned_at;

CREATE INDEX idx_deals_assigned ON crm_deals (user_id, assigned_to);
CREATE INDEX idx_deals_closed_by ON crm_deals (user_id, closed_by, stage);
