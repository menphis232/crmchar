import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { randomUUID as uuid } from 'crypto';

const NEW_EMAIL = 'charveelraffit@gmail.com';
const NEW_PASSWORD = '123456';
const NEW_NAME = 'JLR INSURGENTE';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [existing] = await c.query('SELECT id, email, role, name, status, slug FROM users WHERE email = ?', [
  NEW_EMAIL.toLowerCase(),
]);

const hash = bcrypt.hashSync(NEW_PASSWORD, 10);

if (existing.length) {
  const user = existing[0];
  const baseSlug = NEW_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'concesionaria';
  const slug = user.slug || `${baseSlug}-${user.id.slice(0, 6)}`;

  await c.query(
    'UPDATE users SET password_hash = ?, role = ?, name = ?, status = ?, slug = ? WHERE id = ?',
    [hash, 'concesionaria', NEW_NAME, 'active', slug, user.id]
  );

  console.log('✅ Usuario existente convertido a concesionaria:');
  console.log(`   Rol anterior: ${user.role}`);
  console.log(`   Nombre:  ${NEW_NAME}`);
  console.log(`   Email:   ${NEW_EMAIL}`);
  console.log(`   Clave:   ${NEW_PASSWORD}`);
  console.log(`   Slug:    ${slug}`);
} else {
  const userId = uuid();
  const baseSlug = NEW_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'concesionaria';
  const slug = `${baseSlug}-${userId.slice(0, 6)}`;

  await c.query(
    'INSERT INTO users (id, email, password_hash, role, name, status, slug) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, NEW_EMAIL.toLowerCase(), hash, 'concesionaria', NEW_NAME, 'active', slug]
  );

  console.log('✅ Concesionaria creada:');
  console.log(`   Nombre:  ${NEW_NAME}`);
  console.log(`   Email:   ${NEW_EMAIL}`);
  console.log(`   Clave:   ${NEW_PASSWORD}`);
  console.log(`   Slug:    ${slug}`);
}

const [remaining] = await c.query(
  "SELECT email, name, status, slug FROM users WHERE role = 'concesionaria' ORDER BY name"
);
console.log(`\nConcesionarias en servidor (${remaining.length}):`);
for (const r of remaining) {
  console.log(`  - ${r.email} | ${r.name} | ${r.status} | ${r.slug}`);
}

await c.end();
