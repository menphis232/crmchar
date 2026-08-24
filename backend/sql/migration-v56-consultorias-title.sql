-- Renombrar título público de /gestores
UPDATE site_settings
SET settings = JSON_SET(COALESCE(settings, '{}'), '$.pageTitle', 'CONSULTORIAS VEHICULARES')
WHERE page_key = 'gestores';
