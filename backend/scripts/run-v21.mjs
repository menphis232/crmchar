import { query } from '../src/db.js';

const migrations = [
  "ALTER TABLE users ADD COLUMN slug VARCHAR(120) DEFAULT NULL",
  "ALTER TABLE users ADD COLUMN description TEXT DEFAULT NULL",
  "ALTER TABLE users ADD COLUMN phone VARCHAR(40) DEFAULT NULL",
  "ALTER TABLE users ADD COLUMN address VARCHAR(255) DEFAULT NULL",
  "ALTER TABLE users ADD COLUMN map_embed_url TEXT DEFAULT NULL",
  "ALTER TABLE gestores ADD COLUMN phone VARCHAR(40) DEFAULT NULL",
  "ALTER TABLE gestores ADD COLUMN address VARCHAR(255) DEFAULT NULL",
  "ALTER TABLE gestores ADD COLUMN map_embed_url TEXT DEFAULT NULL",
];

for (const sql of migrations) {
  try {
    await query(sql);
    console.log('✅ OK:', sql.slice(0, 60));
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Ya existe:', sql.slice(0, 60));
    } else {
      console.error('❌ ERROR:', e.message);
    }
  }
}

console.log('Migración v21 completada.');
process.exit(0);
