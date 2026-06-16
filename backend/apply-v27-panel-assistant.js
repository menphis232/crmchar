import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const columns = [
  ['panel_assistant_enabled', 'TINYINT(1) DEFAULT 1'],
  ['panel_assistant_name', "VARCHAR(50) DEFAULT 'VEGA'"],
  ['panel_assistant_position', "VARCHAR(20) DEFAULT 'bottom-right'"],
  ['panel_assistant_bg_color', "VARCHAR(20) DEFAULT '#0f172a'"],
  ['panel_assistant_btn_color', "VARCHAR(20) DEFAULT '#4F46E5'"],
  ['panel_assistant_text_color', "VARCHAR(20) DEFAULT '#FFFFFF'"],
];

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares',
});

for (const [name, def] of columns) {
  try {
    await c.query(`ALTER TABLE users ADD COLUMN ${name} ${def}`);
    console.log(`✅ ${name} agregado`);
  } catch (e) {
    console.log(`${name}:`, e.message);
  }
}

await c.end();
console.log('✅ Migración v27 (panel assistant) completada');
