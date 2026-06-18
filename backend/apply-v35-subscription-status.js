import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const statements = [
  'ALTER TABLE users ADD COLUMN payment_failed_count INT NOT NULL DEFAULT 0',
  'ALTER TABLE users ADD COLUMN stripe_checkout_session_id VARCHAR(255) DEFAULT NULL',
];

for (const stmt of statements) {
  try {
    await c.query(stmt);
    console.log('OK:', stmt.split('\n')[0]);
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Skip (exists):', stmt.split('\n')[0]);
    } else {
      console.error('Error:', e.message);
    }
  }
}

await c.end();
console.log('✅ Migración v35 (subscription status) completada');
