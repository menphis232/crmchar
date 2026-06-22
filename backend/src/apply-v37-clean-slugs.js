/**
 * Limpia slugs viejos con sufijo -fdf786 (primeros 6 chars del id).
 * Ej: jlr-insurgente-fdf786 → jlr-insurgente
 */
import { get, run, query } from './db.js';
import { slugify, uniqueUserSlug, uniqueGestorSlug, stripIdSuffix } from './utils/slug.js';

async function main() {
  const dealers = await query(
    "SELECT id, slug FROM users WHERE role = 'concesionaria' AND slug IS NOT NULL AND slug != ''",
  );
  for (const u of dealers) {
    const base = stripIdSuffix(u.slug, u.id);
    if (base === u.slug) continue;
    const clean = slugify(base) || slugify('concesionaria');
    const slug = await uniqueUserSlug(get, clean, u.id);
    if (slug !== u.slug) {
      await run('UPDATE users SET slug = ? WHERE id = ?', [slug, u.id]);
      console.log(`Concesionaria ${u.id}: ${u.slug} → ${slug}`);
    }
  }

  const gestors = await query('SELECT id, user_id, slug FROM gestores WHERE slug IS NOT NULL AND slug != \'\'');
  for (const g of gestors) {
    const base = stripIdSuffix(g.slug, g.user_id);
    if (base === g.slug) continue;
    const clean = slugify(base) || slugify('gestor');
    const slug = await uniqueGestorSlug(get, clean, g.id);
    if (slug !== g.slug) {
      await run('UPDATE gestores SET slug = ? WHERE id = ?', [slug, g.id]);
      console.log(`Gestor ${g.id}: ${g.slug} → ${slug}`);
    }
  }

  console.log('v37 clean slugs OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
