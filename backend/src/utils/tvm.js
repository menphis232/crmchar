/** Slug(s) de la consultoría TVM (misma allowlist que el banner del panel cliente). */
export function tvmGestorSlugs() {
  return String(process.env.CLIENT_PROMO_BANNER_GESTOR_SLUG || 'tramites-vehiculares-de-mexico')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isTvmGestorSlug(slug) {
  return !!(slug && tvmGestorSlugs().includes(String(slug)));
}
