/** Normaliza un nombre a slug URL-friendly */
export function slugify(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'usuario';
}

/** Slug único en users.slug (concesionarias) */
export async function uniqueUserSlug(get, base, excludeUserId = null) {
  let slug = base;
  let n = 2;
  for (;;) {
    const row = await get('SELECT id FROM users WHERE slug = ?', [slug]);
    if (!row || (excludeUserId && row.id === excludeUserId)) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

/** Slug único en gestores.slug */
export async function uniqueGestorSlug(get, base, excludeGestorId = null) {
  let slug = base;
  let n = 2;
  for (;;) {
    const row = await get('SELECT id FROM gestores WHERE slug = ?', [slug]);
    if (!row || (excludeGestorId && row.id === excludeGestorId)) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

/** Quita sufijo -XXXXXX si coincide con los primeros 6 chars del id */
export function stripIdSuffix(slug, userId) {
  if (!slug || !userId) return slug;
  const suffix = `-${userId.slice(0, 6)}`;
  return slug.endsWith(suffix) ? slug.slice(0, -suffix.length) : slug;
}
