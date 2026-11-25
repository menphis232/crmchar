-- Nombre en la tarjeta de circulación del vehículo
ALTER TABLE contact_vehicles
  ADD COLUMN circulation_card_name VARCHAR(255) NULL AFTER plate;
