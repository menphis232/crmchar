import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares'
});

try {
  await c.query("ALTER TABLE fin_transactions ADD COLUMN payment_method VARCHAR(50) DEFAULT 'general'");
  console.log('✅ payment_method agregado a fin_transactions');
} catch(e) {
  console.log('payment_method:', e.message);
}

try {
  await c.query('ALTER TABLE users ADD COLUMN fin_payment_methods JSON NULL');
  console.log('✅ fin_payment_methods agregado a users');
} catch(e) {
  console.log('fin_payment_methods:', e.message);
}

const [cols] = await c.query('SHOW COLUMNS FROM fin_transactions');
console.log('Columnas fin_transactions:', cols.map(c => c.Field).join(', '));

await c.end();
console.log('✅ Migración v23 completada');
