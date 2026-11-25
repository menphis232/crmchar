-- Origen de alta de la cuenta (cliente self-service vs creado por gestoría)
ALTER TABLE users
  ADD COLUMN registration_source VARCHAR(32) NULL AFTER status;

-- Backfill aproximado: cuentas cliente con email interno o sin terms → gestor/lead
UPDATE users
SET registration_source = 'gestor'
WHERE role = 'cliente'
  AND registration_source IS NULL
  AND (email LIKE 'cliente+%@tvm.local' OR terms_accepted_at IS NULL);

UPDATE users
SET registration_source = 'self'
WHERE role = 'cliente'
  AND registration_source IS NULL
  AND terms_accepted_at IS NOT NULL;
