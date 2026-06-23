import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { randomUUID as uuid } from 'crypto';

const NEW_EMAIL = 'gestor.prueba@tramitesvehicularesdemexico.com';
const NEW_PASSWORD = '123456';
const NEW_NAME = 'Gestor de Prueba';
const SLUG = 'gestor-prueba';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const hash = bcrypt.hashSync(NEW_PASSWORD, 10);

const [existing] = await c.query('SELECT id, email, role, name, status FROM users WHERE email = ?', [
  NEW_EMAIL.toLowerCase(),
]);

let userId;

if (existing.length) {
  userId = existing[0].id;
  await c.query(
    'UPDATE users SET password_hash = ?, role = ?, name = ?, status = ? WHERE id = ?',
    [hash, 'gestor', NEW_NAME, 'active', userId],
  );
  console.log('✅ Usuario existente actualizado a gestor activo');
} else {
  userId = uuid();
  await c.query(
    'INSERT INTO users (id, email, password_hash, role, name, status) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, NEW_EMAIL.toLowerCase(), hash, 'gestor', NEW_NAME, 'active'],
  );
  console.log('✅ Gestor creado');
}

const [gestorRow] = await c.query('SELECT id, slug FROM gestores WHERE user_id = ?', [userId]);

if (gestorRow.length) {
  await c.query(
    'UPDATE gestores SET slug = ?, name = ?, location = ?, state = ?, bio = ?, whatsapp = ?, schedule = ? WHERE user_id = ?',
    [SLUG, NEW_NAME, 'Ciudad de México', 'CDMX', 'Gestor de prueba para demostración.', '525511223344', 'Lunes a Viernes 9am–6pm', userId],
  );
} else {
  await c.query(
    `INSERT INTO gestores (id, user_id, slug, name, location, state, banner_url, photo_url, rating, review_count, tramites_count, experience_years, bio, whatsapp, schedule)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(), userId, SLUG, NEW_NAME, 'Ciudad de México', 'CDMX',
      'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=600',
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200',
      5.0, 0, 0, 1,
      'Gestor de prueba para demostración.',
      '525511223344', 'Lunes a Viernes 9am–6pm',
    ],
  );
}

console.log(`   Nombre:  ${NEW_NAME}`);
console.log(`   Email:   ${NEW_EMAIL}`);
console.log(`   Clave:   ${NEW_PASSWORD}`);
console.log(`   Slug:    ${SLUG}`);
console.log(`   Status:  active`);
console.log(`   Panel:   /panel/gestor`);
console.log(`   Público: /gestores/${SLUG}`);

await c.end();
