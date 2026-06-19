import mysql from 'mysql2/promise';

const EMAIL = 'charveelraffit@gmail.com';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [before] = await c.query(
  'SELECT id, name, page_builder_config IS NOT NULL AS has_config FROM users WHERE email = ?',
  [EMAIL]
);
console.log('Antes:', before[0]);

await c.query('UPDATE users SET page_builder_config = NULL WHERE email = ?', [EMAIL]);

const [after] = await c.query(
  'SELECT id, name, page_builder_config FROM users WHERE email = ?',
  [EMAIL]
);
console.log('Después: page_builder_config =', after[0].page_builder_config);

await c.end();
console.log('✅ Config de gestor eliminada de JLR INSURGENTE');
