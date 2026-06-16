import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares',
});

try {
  await c.query('ALTER TABLE autos ADD COLUMN video_url VARCHAR(1000) DEFAULT NULL AFTER images');
  console.log('✅ video_url agregado a autos');
} catch (e) {
  console.log('video_url:', e.message);
}

await c.end();
console.log('✅ Migración v31 (video en autos) completada');
