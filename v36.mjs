import { query, run } from './src/db.js';
const rows = await query("SHOW COLUMNS FROM autos LIKE 'whatsapp'");
if (rows.length > 0) {
  console.log('[v36] whatsapp column already exists - OK');
} else {
  await run('ALTER TABLE autos ADD COLUMN whatsapp VARCHAR(30) DEFAULT NULL');
  console.log('[v36] whatsapp column ADDED');
}
process.exit(0);
