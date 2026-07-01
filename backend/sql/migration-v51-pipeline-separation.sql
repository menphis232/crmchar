USE tramites_vehiculares;

ALTER TABLE contacts
  ADD COLUMN pipeline ENUM('tramite', 'venta') NOT NULL DEFAULT 'tramite' AFTER user_id;

CREATE INDEX idx_contacts_pipeline ON contacts (user_id, pipeline);

-- Prospectos con solo ventas de autos
UPDATE contacts c
SET c.pipeline = 'venta'
WHERE EXISTS (
  SELECT 1 FROM crm_deals d
  WHERE d.contact_id = c.id AND d.user_id = c.user_id AND d.deal_type = 'venta_auto'
)
AND NOT EXISTS (
  SELECT 1 FROM crm_deals d
  WHERE d.contact_id = c.id AND d.user_id = c.user_id AND d.deal_type = 'tramite'
);

-- Prospectos con ambos tipos: asignar según el deal más reciente
UPDATE contacts c
JOIN (
  SELECT d.contact_id, d.user_id, d.deal_type,
         ROW_NUMBER() OVER (PARTITION BY d.contact_id ORDER BY d.updated_at DESC) AS rn
  FROM crm_deals d
) latest ON latest.contact_id = c.id AND latest.user_id = c.user_id AND latest.rn = 1
SET c.pipeline = IF(latest.deal_type = 'venta_auto', 'venta', 'tramite')
WHERE EXISTS (
  SELECT 1 FROM crm_deals d1
  WHERE d1.contact_id = c.id AND d1.user_id = c.user_id AND d1.deal_type = 'tramite'
)
AND EXISTS (
  SELECT 1 FROM crm_deals d2
  WHERE d2.contact_id = c.id AND d2.user_id = c.user_id AND d2.deal_type = 'venta_auto'
);
