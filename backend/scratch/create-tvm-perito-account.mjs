import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import { randomUUID as uuid } from 'crypto';

const PHONE = '5599012345';
const NEW_PASSWORD = 'Perito-TVM-2026';
const NEW_NAME = 'Perito Asignado TVM';
const INTERNAL_EMAIL = `perito.${PHONE}@peritos.tramitesmx.local`;
const TVM_EMAIL = 'direccion@tramitesvehicularesdemexico.com';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [tvm] = await c.query(
  `SELECT u.id, u.email, u.name, g.slug
   FROM users u
   LEFT JOIN gestores g ON g.user_id = u.id
   WHERE u.email = ? AND u.role = 'gestor'
   LIMIT 1`,
  [TVM_EMAIL],
);

if (!tvm.length) {
  console.error('TVM principal no encontrado');
  process.exit(1);
}

const parentId = tvm[0].id;
console.log('TVM parent:', JSON.stringify(tvm[0]));

const [byPhone] = await c.query(
  "SELECT id, email, name, parent_id, status FROM users WHERE role = 'perito' AND phone = ?",
  [PHONE],
);

const hash = bcrypt.hashSync(NEW_PASSWORD, 10);
let userId;

if (byPhone.length) {
  userId = byPhone[0].id;
  await c.query(
    `UPDATE users SET password_hash = ?, name = ?, parent_id = ?, status = 'active', email = ?, phone = ?
     WHERE id = ?`,
    [hash, NEW_NAME, parentId, INTERNAL_EMAIL, PHONE, userId],
  );
  console.log('Perito existente actualizado');
} else {
  userId = uuid();
  await c.query(
    `INSERT INTO users (id, email, phone, password_hash, role, name, parent_id, status)
     VALUES (?, ?, ?, ?, 'perito', ?, ?, 'active')`,
    [userId, INTERNAL_EMAIL, PHONE, hash, NEW_NAME, parentId],
  );
  console.log('Perito creado');
}

const [check] = await c.query(
  `SELECT u.id, u.email, u.phone, u.role, u.name, u.status, u.parent_id, p.email AS parent_email, p.name AS parent_name
   FROM users u
   LEFT JOIN users p ON p.id = u.parent_id
   WHERE u.id = ?`,
  [userId],
);

console.log('OK');
console.log(JSON.stringify({
  login: {
    url: '/login/gestor',
    phone: PHONE,
    password: NEW_PASSWORD,
    panel: '/panel/perito',
  },
  user: check[0],
}, null, 2));

await c.end();
