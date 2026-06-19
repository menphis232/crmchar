import mysql from 'mysql2/promise';

const EMAIL = 'charveelraffit@gmail.com';

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [users] = await c.query('SELECT id, role FROM users WHERE email = ?', [EMAIL]);
if (users.length) {
  const [gestorRows] = await c.query('SELECT id FROM gestores WHERE user_id = ?', [users[0].id]);
  if (gestorRows.length) {
    await c.query('DELETE FROM gestores WHERE user_id = ?', [users[0].id]);
    console.log(`Perfil gestor huérfano eliminado (${gestorRows.length})`);
  }
}

await c.end();
