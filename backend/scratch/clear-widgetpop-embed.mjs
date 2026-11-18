/**
 * Quita el embed de WidgetPop (free = máx. 3) para usar listado nativo de 10 en 10.
 * Uso en contenedor: node /tmp/clear-widgetpop-embed.mjs
 */
import mysql from 'mysql2/promise';

const PLACE_ID = 'ChIJsbBkGrH_0YUR0L_ilErdMKU';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [result] = await conn.query(
  `UPDATE gestores
   SET google_reviews_embed = NULL
   WHERE google_place_id = ?
      OR name LIKE '%Trámites Vehiculares%'
      OR name LIKE '%Tramites Vehiculares%'`,
  [PLACE_ID],
);
console.log('cleared_embed_rows', result.affectedRows);

const [after] = await conn.query(
  `SELECT id, slug, name, google_place_id,
          CASE WHEN google_reviews_embed IS NULL OR google_reviews_embed = '' THEN 0 ELSE 1 END AS has_embed,
          google_review_count,
          CASE WHEN google_reviews_json IS NULL THEN 0 ELSE JSON_LENGTH(google_reviews_json) END AS cached_reviews
   FROM gestores
   WHERE google_place_id = ? OR name LIKE '%Trámites Vehiculares%' OR name LIKE '%Tramites Vehiculares%'
   LIMIT 20`,
  [PLACE_ID],
);
console.log('after', JSON.stringify(after, null, 2));
await conn.end();
