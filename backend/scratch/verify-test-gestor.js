import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const EMAIL = 'gestor.prueba@tramitesvehicularesdemexico.com';
const PASSWORD = '123456';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [users] = await c.query('SELECT id, email, role, name, status, password_hash FROM users WHERE email = ?', [EMAIL]);
if (!users.length) {
  console.log('NOT FOUND');
  process.exit(1);
}
const u = users[0];
const ok = bcrypt.compareSync(PASSWORD, u.password_hash);
console.log('User:', { email: u.email, role: u.role, name: u.name, status: u.status, passwordOk: ok });

const [g] = await c.query('SELECT slug, name FROM gestores WHERE user_id = ?', [u.id]);
console.log('Gestor:', g[0] || 'MISSING');

await c.end();
