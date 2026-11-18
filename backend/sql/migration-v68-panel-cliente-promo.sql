-- Configuración del panel cliente (banner promocional arriba del perfil)
INSERT INTO site_settings (page_key, settings)
VALUES (
  'panel-cliente',
  JSON_OBJECT(
    'panelTitle', 'Portal del Cliente',
    'welcomeMessage', 'Administra tus vehículos, documentos y trámites.',
    'promoBannerEnabled', true,
    'promoBannerTitle', '¿Necesitas un trámite vehicular?',
    'promoBannerAlt', 'Promoción para clientes',
    'promoBannerImage', '',
    'promoBannerLink', '/gestores'
  )
)
ON DUPLICATE KEY UPDATE page_key = page_key;
