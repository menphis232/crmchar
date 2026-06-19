import { query, run } from './db.js';

async function migrate() {
  const rows = await query("SHOW COLUMNS FROM autos LIKE 'whatsapp'");
  if (rows.length > 0) {
    console.log('[v36] whatsapp column already exists, skipping.');
    process.exit(0);
  }
  await run("ALTER TABLE autos ADD COLUMN whatsapp VARCHAR(30) DEFAULT NULL");
  console.log('[v36] Added whatsapp column to autos table.');
  process.exit(0);
}

migrate().catch(e => { console.error(e); process.exit(1); });
