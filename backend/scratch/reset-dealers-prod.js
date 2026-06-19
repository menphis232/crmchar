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

const [dealers] = await c.query(
  "SELECT id, email, name, status FROM users WHERE role = 'concesionaria' ORDER BY name"
);

console.log(`Concesionarias actuales (${dealers.length}):`);
for (const d of dealers) {
  console.log(`  - ${d.email} | ${d.name} | ${d.status}`);
}

const dealerIds = dealers.map((d) => d.id);

if (dealerIds.length) {
  const placeholders = dealerIds.map(() => '?').join(',');

  const [team] = await c.query(
    `SELECT id, email, name FROM users WHERE parent_id IN (${placeholders})`,
    dealerIds
  );
  if (team.length) {
    console.log(`\nEliminando ${team.length} empleados de concesionarias...`);
    await c.query(`DELETE FROM users WHERE parent_id IN (${placeholders})`, dealerIds);
  }

  console.log(`\nEliminando ${dealerIds.length} concesionarias de prueba...`);
  await c.query(`DELETE FROM users WHERE id IN (${placeholders})`, dealerIds);
}

const [existing] = await c.query('SELECT id FROM users WHERE email = ?', [NEW_EMAIL.toLowerCase()]);
if (existing.length) {
  console.error(`\nEl email ${NEW_EMAIL} ya existe (otro rol). Abortando.`);
  process.exit(1);
}

const userId = uuid();
const hash = bcrypt.hashSync(NEW_PASSWORD, 10);
const baseSlug = NEW_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'concesionaria';
const slug = `${baseSlug}-${userId.slice(0, 6)}`;

await c.query(
  'INSERT INTO users (id, email, password_hash, role, name, status, slug) VALUES (?, ?, ?, ?, ?, ?, ?)',
  [userId, NEW_EMAIL.toLowerCase(), hash, 'concesionaria', NEW_NAME, 'active', slug]
);

console.log('\n✅ Concesionaria real creada:');
console.log(`   Nombre:  ${NEW_NAME}`);
console.log(`   Email:   ${NEW_EMAIL}`);
console.log(`   Clave:   ${NEW_PASSWORD}`);
console.log(`   Slug:    ${slug}`);
console.log(`   Status:  active`);

const [remaining] = await c.query(
  "SELECT email, name, status FROM users WHERE role = 'concesionaria' ORDER BY name"
);
console.log(`\nConcesionarias en servidor (${remaining.length}):`);
for (const r of remaining) {
  console.log(`  - ${r.email} | ${r.name} | ${r.status}`);
}

await c.end();
