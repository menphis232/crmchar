-- Ejecutar en phpMyAdmin o: npm run db:migrate

USE tramites_vehiculares;

ALTER TABLE users MODIFY role ENUM('gestor', 'concesionaria', 'cliente', 'admin') NOT NULL;

ALTER TABLE autos ADD COLUMN IF NOT EXISTS status ENUM('draft', 'published', 'baja') DEFAULT 'published' AFTER dealer_name;

UPDATE autos SET status = 'published' WHERE status IS NULL AND active = 1;
UPDATE autos SET status = 'baja' WHERE active = 0;

CREATE TABLE IF NOT EXISTS auto_inquiries (
  id VARCHAR(36) PRIMARY KEY,
  auto_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  client_phone VARCHAR(50),
  message TEXT NOT NULL,
  status ENUM('nuevo', 'respondido') DEFAULT 'nuevo',
  reply TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auto_id) REFERENCES autos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS concesionaria_reviews (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  author VARCHAR(255) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_settings (
  page_key VARCHAR(50) PRIMARY KEY,
  settings JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO site_settings (page_key, settings) VALUES
('autos', JSON_OBJECT(
  'pageTitle', 'VEHÍCULOS PREMIUM EN VENTA',
  'pageSubtitle', 'Directorio nacional de autos verificados por concesionarias afiliadas.',
  'primaryColor', '#c8a94a',
  'accentColor', '#006847',
  'backgroundColor', '#060b14',
  'fontFamily', 'Inter, sans-serif',
  'displayFont', 'Montserrat, sans-serif',
  'titleSize', '48',
  'subtitleSize', '16',
  'cardRadius', '12'
)),
('gestores', JSON_OBJECT(
  'pageTitle', 'DIRECTORIO DE GESTORES',
  'pageSubtitle', 'Encuentra expertos certificados para realizar tus trámites vehiculares.',
  'primaryColor', '#006847',
  'accentColor', '#c8a94a',
  'backgroundColor', '#060b14',
  'fontFamily', 'Inter, sans-serif',
  'displayFont', 'Montserrat, sans-serif',
  'titleSize', '48',
  'subtitleSize', '16',
  'cardRadius', '12'
));
