USE tramites_vehiculares;

CREATE TABLE IF NOT EXISTS contact_vehicle_documents (
  id VARCHAR(36) PRIMARY KEY,
  vehicle_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  label VARCHAR(120) NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES contact_vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cvd_vehicle (vehicle_id),
  INDEX idx_cvd_user (user_id)
);
