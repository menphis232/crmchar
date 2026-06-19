import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const EMAIL = 'capital.select@demo.com';
const NEW_PASSWORD = '123';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [rows] = await c.query(
  "SELECT id, email, name, status FROM users WHERE role = 'concesionaria' ORDER BY name"
);
console.log('Concesionarias en servidor:');
for (const r of rows) {
  console.log(`  - ${r.email} | ${r.name} | ${r.status}`);
}

const [users] = await c.query('SELECT id, email, name FROM users WHERE email = ?', [EMAIL]);
const user = users[0];
if (!user) {
  console.error(`No se encontró ${EMAIL}`);
  process.exit(1);
}

const hash = bcrypt.hashSync(NEW_PASSWORD, 10);
await c.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
console.log('');
console.log(`✅ Clave actualizada para: ${user.name}`);
console.log(`   Email: ${user.email}`);
console.log(`   Contraseña: ${NEW_PASSWORD}`);

await c.end();
