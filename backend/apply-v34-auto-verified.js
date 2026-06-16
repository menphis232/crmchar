import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

try {
  await c.query('ALTER TABLE autos ADD COLUMN verified TINYINT(1) NOT NULL DEFAULT 0 AFTER special_price');
  console.log('✅ verified agregado a autos');
} catch (e) {
  console.log('verified:', e.message);
}

await c.end();
console.log('✅ Migración v34 (verificado en autos) completada');
