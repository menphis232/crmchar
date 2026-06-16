-- Panel themes + admin user management (ejecutar con npm run db:migrate)

USE tramites_vehiculares;

INSERT IGNORE INTO site_settings (page_key, settings) VALUES
('panel-gestor', JSON_OBJECT(
  'panelTitle', 'Portal del Gestor',
  'welcomeMessage', 'Administra tu gestoría, servicios y solicitudes de clientes.',
  'primaryColor', '#c8a94a',
  'accentColor', '#006847',
  'backgroundColor', '#060b14',
  'sidebarBg', 'rgba(255,255,255,0.04)',
  'cardBg', 'rgba(255,255,255,0.04)',
  'fontFamily', 'League Spartan, sans-serif',
  'displayFont', 'League Spartan, sans-serif',
  'titleSize', '24',
  'cardRadius', '12',
  'customBlocks', JSON_ARRAY(
    JSON_OBJECT('type', 'notice', 'text', 'Recuerda compartir tu enlace público con tus clientes.', 'visible', true)
  )
)),
('panel-concesionaria', JSON_OBJECT(
  'panelTitle', 'Portal de Concesionaria',
  'welcomeMessage', 'Gestiona tu inventario, preguntas de clientes y reputación.',
  'primaryColor', '#c8a94a',
  'accentColor', '#006847',
  'backgroundColor', '#060b14',
  'sidebarBg', 'rgba(255,255,255,0.04)',
  'cardBg', 'rgba(255,255,255,0.04)',
  'fontFamily', 'League Spartan, sans-serif',
  'displayFont', 'League Spartan, sans-serif',
  'titleSize', '24',
  'cardRadius', '12',
  'customBlocks', JSON_ARRAY(
    JSON_OBJECT('type', 'banner', 'text', 'Publica tus vehículos para aparecer en el catálogo nacional.', 'visible', true)
  )
));
