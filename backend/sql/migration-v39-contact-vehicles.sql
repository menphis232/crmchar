USE tramites_vehiculares;

ALTER TABLE contacts
  ADD COLUMN residence_state VARCHAR(80) NULL AFTER notes;

CREATE TABLE IF NOT EXISTS contact_vehicles (
  id VARCHAR(36) PRIMARY KEY,
  contact_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  plate VARCHAR(20) NOT NULL,
  state VARCHAR(80) NULL,
  engomado_color VARCHAR(30) NULL,
  vehicle_notes VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_cv_contact (contact_id),
  INDEX idx_cv_user (user_id),
  INDEX idx_cv_plate (plate)
);
