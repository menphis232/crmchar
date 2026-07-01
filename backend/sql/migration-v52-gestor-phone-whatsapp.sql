USE tramites_vehiculares;

-- Sincronizar WhatsApp con el teléfono del perfil cuando el gestor ya lo actualizó en el panel.
UPDATE gestores
SET whatsapp = phone
WHERE phone IS NOT NULL AND TRIM(phone) != '';
