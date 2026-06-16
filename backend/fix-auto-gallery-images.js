/**
 * Repara galerías de autos demo con URLs verificadas.
 * Ejecutar: node fix-auto-gallery-images.js
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { buildGallery } from './demo-car-images.js';

dotenv.config();

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [autos] = await c.query(`
  SELECT a.id, a.make, a.model, u.email
  FROM autos a
  JOIN users u ON u.id = a.user_id
  WHERE u.role = 'concesionaria'
  ORDER BY a.created_at
`);

let updated = 0;
for (const auto of autos) {
  const gallery = buildGallery(`${auto.id}-${auto.make}-${auto.model}`, 4);
  await c.query(
    'UPDATE autos SET image_url = ?, images = ? WHERE id = ?',
    [gallery[0], JSON.stringify(gallery), auto.id],
  );
  updated++;
  console.log(`✅ ${auto.make} ${auto.model} (${auto.email}) → ${gallery.length} fotos`);
}

await c.end();
console.log(`\n✅ ${updated} vehículos actualizados con galerías válidas`);
