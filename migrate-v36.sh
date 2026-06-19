#!/bin/sh
docker exec tramites-backend node --input-type=module << 'JSEOF'
import { query, run } from './src/db.js';
const rows = await query('PRAGMA table_info(autos)');
const exists = rows.some(r => r.name === 'whatsapp');
if (exists) {
  console.log('[v36] whatsapp column already exists');
} else {
  await run('ALTER TABLE autos ADD COLUMN whatsapp TEXT DEFAULT NULL');
  console.log('[v36] whatsapp column ADDED successfully');
}
process.exit(0);
JSEOF
