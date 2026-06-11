import mysql from 'mysql2/promise';

const c = await mysql.createConnection({host:'localhost',user:'root',password:'',multipleStatements:true});
await c.query('USE tramites_vehiculares');

const userCols = {
  slug: 'VARCHAR(120)',
  description: 'TEXT',
  phone: 'VARCHAR(40)',
  address: 'VARCHAR(255)',
  map_embed_url: 'TEXT',
};

for (const [col, type] of Object.entries(userCols)) {
  try {
    await c.query(`ALTER TABLE users ADD COLUMN ${col} ${type} DEFAULT NULL`);
    console.log(`users.${col} ✓`);
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log(`users.${col} ya existe`);
    else throw e;
  }
}

const gestorCols = { phone: 'VARCHAR(40)', address: 'VARCHAR(255)', map_embed_url: 'TEXT' };
for (const [col, type] of Object.entries(gestorCols)) {
  try {
    await c.query(`ALTER TABLE gestores ADD COLUMN ${col} ${type} DEFAULT NULL`);
    console.log(`gestores.${col} ✓`);
  } catch(e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log(`gestores.${col} ya existe`);
    else throw e;
  }
}

// Generate slugs for concesionarias
const [rows] = await c.query("SELECT id, name FROM users WHERE role='concesionaria' AND (slug IS NULL OR slug='')");
for (const row of rows) {
  const base = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = `${base}-${row.id.slice(0,6)}`;
  await c.query('UPDATE users SET slug=? WHERE id=?', [slug, row.id]);
  console.log(`Slug generado: ${slug}`);
}

await c.end();
console.log('\n✅ Migración v21 aplicada exitosamente');
