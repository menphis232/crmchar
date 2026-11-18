/**
 * Guarda el embed de SociableKIT (gratis, hasta 100) en gestores TVM.
 * Uso: node /tmp/set-sociablekit-embed.mjs
 */
import mysql from 'mysql2/promise';

const EMBED = `<div class="sk-ww-google-reviews" data-embed-id="25730629"></div>
<script src="https://widgets.sociablekit.com/google-reviews/widget.js" defer></script>`;

const PLACE_ID = 'ChIJsbBkGrH_0YUR0L_ilErdMKU';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'tramites_vehiculares',
});

const [result] = await conn.query(
  `UPDATE gestores
   SET google_reviews_embed = ?,
       google_place_id = COALESCE(NULLIF(google_place_id, ''), ?)
   WHERE google_place_id = ?
      OR name LIKE '%Trámites Vehiculares%'
      OR name LIKE '%Tramites Vehiculares%'`,
  [EMBED, PLACE_ID, PLACE_ID],
);
console.log('updated', result.affectedRows);

const [after] = await conn.query(
  `SELECT id, slug, name, google_place_id, LENGTH(google_reviews_embed) AS embed_len,
          LEFT(google_reviews_embed, 80) AS embed_start
   FROM gestores
   WHERE google_place_id = ? OR name LIKE '%Trámites Vehiculares%' OR name LIKE '%Tramites Vehiculares%'
   LIMIT 5`,
  [PLACE_ID],
);
console.log('after', JSON.stringify(after, null, 2));
await conn.end();
