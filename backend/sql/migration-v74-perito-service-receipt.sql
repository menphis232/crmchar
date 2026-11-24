-- v74: comprobante de pago del servicio al perito
ALTER TABLE crm_deals
  ADD COLUMN perito_service_receipt_url VARCHAR(500) NULL AFTER perito_service_paid,
  ADD COLUMN perito_service_receipt_name VARCHAR(255) NULL AFTER perito_service_receipt_url;
