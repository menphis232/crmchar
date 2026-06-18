import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const SPARTAN = "'Spartan', sans-serif";

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares',
});

const [rows] = await c.query('SELECT page_key, settings FROM site_settings');

for (const row of rows) {
  const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  const prevBody = settings.fontFamily;
  const prevDisplay = settings.displayFont;

  settings.fontFamily = SPARTAN;
  settings.displayFont = SPARTAN;

  await c.query('UPDATE site_settings SET settings = ? WHERE page_key = ?', [
    JSON.stringify(settings),
    row.page_key,
  ]);
  console.log(`✅ ${row.page_key}: ${prevBody || '(vacío)'} → Spartan`);
}

await c.end();
console.log('✅ Migración v32 (fuente Spartan global) completada');
