USE tramites_vehiculares;

-- Agregar método de pago a transacciones
ALTER TABLE fin_transactions ADD COLUMN payment_method VARCHAR(50) DEFAULT 'general';

-- Agregar configuración de métodos de pago habilitados por usuario
ALTER TABLE users ADD COLUMN fin_payment_methods JSON NULL;
