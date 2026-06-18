import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const SPARTAN = "'Spartan', sans-serif";
const LEGACY = [
  "'League Spartan', sans-serif",
  'League Spartan, sans-serif',
  'League Spartan',
  'League Spartan, sans-serif',
];

const c = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'tramites_vehiculares',
});

const [rows] = await c.query('SELECT page_key, settings FROM site_settings');

for (const row of rows) {
  const settings = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  let changed = false;

  for (const key of ['fontFamily', 'displayFont']) {
    const val = settings[key];
    if (!val || LEGACY.some((l) => val.includes('League Spartan') || val === l)) {
      settings[key] = SPARTAN;
      changed = true;
    }
  }

  if (changed) {
    await c.query('UPDATE site_settings SET settings = ? WHERE page_key = ?', [
      JSON.stringify(settings),
      row.page_key,
    ]);
    console.log(`✅ site_settings.${row.page_key} → Spartan`);
  }
}

await c.query(
  `UPDATE users SET panel_assistant_font = 'Spartan'
   WHERE panel_assistant_font IS NULL OR panel_assistant_font = '' OR panel_assistant_font LIKE '%League Spartan%'`
);
console.log('✅ users.panel_assistant_font → Spartan');

await c.end();
console.log('✅ Migración Spartan nativa completada');
