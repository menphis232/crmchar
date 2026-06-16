import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares',
  multipleStatements: true,
});

try {
  await c.query(`
    CREATE TABLE IF NOT EXISTS analytics_settings (
      id TINYINT PRIMARY KEY DEFAULT 1,
      measurement_id VARCHAR(50) DEFAULT NULL,
      property_id VARCHAR(32) DEFAULT NULL,
      access_token TEXT DEFAULT NULL,
      refresh_token TEXT DEFAULT NULL,
      token_expiry BIGINT DEFAULT NULL,
      connected_email VARCHAR(255) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✅ analytics_settings creada');
} catch (e) {
  console.log('analytics_settings:', e.message);
}

try {
  await c.query('INSERT IGNORE INTO analytics_settings (id) VALUES (1)');
  console.log('✅ fila default analytics_settings');
} catch (e) {
  console.log('insert analytics_settings:', e.message);
}

try {
  await c.query(`
    ALTER TABLE analytics_settings
      ADD COLUMN google_client_id VARCHAR(255) DEFAULT NULL AFTER connected_email,
      ADD COLUMN google_client_secret VARCHAR(512) DEFAULT NULL AFTER google_client_id
  `);
  console.log('✅ columnas OAuth agregadas');
} catch (e) {
  console.log('oauth columns:', e.message);
}

await c.end();
console.log('✅ Migración v28/v29 Analytics completada');
