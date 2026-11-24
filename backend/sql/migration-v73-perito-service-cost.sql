-- v73: costo de servicio al perito + estatus de pago
ALTER TABLE crm_deals
  ADD COLUMN perito_service_cost DECIMAL(14,2) NULL AFTER perito_poliza_status,
  ADD COLUMN perito_service_paid ENUM('pendiente', 'pagado') NOT NULL DEFAULT 'pendiente' AFTER perito_service_cost;
