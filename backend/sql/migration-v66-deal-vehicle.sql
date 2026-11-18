-- Asociar un vehículo del cliente a cada trámite (para distinguir en embudo/panel)
ALTER TABLE crm_deals
  ADD COLUMN vehicle_id VARCHAR(36) NULL AFTER contact_id;

CREATE INDEX idx_deals_vehicle ON crm_deals (vehicle_id);
