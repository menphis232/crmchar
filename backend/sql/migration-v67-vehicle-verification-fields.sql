-- Holograma de verificación y fecha de próxima verificación por vehículo
ALTER TABLE contact_vehicles
  ADD COLUMN verification_hologram VARCHAR(16) NULL AFTER tenencia_year,
  ADD COLUMN next_verification_date DATE NULL AFTER verification_hologram;
