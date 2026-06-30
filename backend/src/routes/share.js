import { Router } from 'express';
import { get } from '../db.js';

const router = Router();

const AUTO_TAGLINE   = 'EL INVENTARIO DE SEMINUEVOS MÁS GRANDE DE MÉXICO';
const GESTOR_TAGLINE = 'LAS MEJORES CONSULTORÍAS Y GESTORÍAS VEHICULARES DE MÉXICO';
const SITE_BASE = (
  process.env.FRONTEND_URL ||
  process.env.API_PUBLIC_URL ||
  'https://central.tramitesvehicularesdemexico.com'
).replace(/\/$/, '');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseImages(val) {
  if (!val) return [];
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return val;
}

function buildHtml({ tagline, subtitle, shareUrl, pageUrl, imgMeta = '' }) {
  // La URL canónica siempre es la página real (/gestores/:slug, /autos/:id, etc.),
  // así los buscadores consolidan el SEO en el enlace bonito y no en el corto.
  const canonicalUrl = pageUrl || shareUrl;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subtitle)}</title>
  <meta name="description" content="${escapeHtml(subtitle)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Tr\u00e1mites Vehiculares de M\u00e9xico">
  <meta property="og:title" content="${escapeHtml(tagline)}">
  <meta property="og:description" content="${escapeHtml(subtitle)}">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  ${imgMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(tagline)}">
  <meta name="twitter:description" content="${escapeHtml(subtitle)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}">
  <script>window.location.replace("${escapeHtml(pageUrl)}");</script>
</head>
<body>
  <p>Redirigiendo... <a href="${escapeHtml(pageUrl)}">${escapeHtml(subtitle)}</a></p>
</body>
</html>`;
}

function absoluteUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

function buildImageMeta(imageUrl, subtitle) {
  if (!imageUrl) return '';
  return `
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(subtitle)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">`;
}

async function buildAutoHtml(id) {
  const row = await get(
    "SELECT id, make, model, year, image_url, images FROM autos WHERE id = ? AND status = 'published'",
    [id],
  );
  if (!row) return null;

  const images = parseImages(row.images);
  const imageUrl = absoluteUrl(row.image_url || images[0] || null);
  const pageUrl  = `${SITE_BASE}/autos/${row.id}`;
  const shareUrl = `${SITE_BASE}/s/${row.id}`;
  const subtitle = `${row.make} ${row.model} ${row.year}`;

  return buildHtml({
    tagline: AUTO_TAGLINE,
    subtitle,
    shareUrl,
    pageUrl,
    imgMeta: buildImageMeta(imageUrl, subtitle),
  });
}

// Ruta montada en /api/share: GET /api/share/autos/:id
router.get('/autos/:id', async (req, res) => {
  try {
    const html = await buildAutoHtml(req.params.id);
    if (!html) return res.status(404).type('text/plain').send('Vehículo no encontrado');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar vista previa');
  }
});

// Ruta corta montada en /s: GET /s/:id → autos
router.get('/:id', async (req, res) => {
  try {
    const html = await buildAutoHtml(req.params.id);
    if (!html) return res.status(404).type('text/plain').send('Vehículo no encontrado');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar vista previa');
  }
});

// ── GESTORES ──────────────────────────────────────────────────────────────────

async function buildGestorHtml(slug) {
  const row = await get(
    `SELECT g.slug, g.name, g.location, g.photo_url, g.banner_url, u.logo_url
     FROM gestores g
     JOIN users u ON g.user_id = u.id
     WHERE g.slug = ?`,
    [slug],
  );
  if (!row) return null;

  const imageUrl = (row.logo_url || row.photo_url || row.banner_url)
    ? `${SITE_BASE}/og/gestor/${row.slug}.jpg`
    : null;
  const pageUrl  = `${SITE_BASE}/gestores/${row.slug}`;
  const shareUrl = `${SITE_BASE}/sg/${row.slug}`;
  const subtitle = `${row.name} — ${row.location || 'México'}`;

  return buildHtml({
    tagline: GESTOR_TAGLINE,
    subtitle,
    shareUrl,
    pageUrl,
    imgMeta: buildImageMeta(imageUrl, subtitle),
  });
}

// GET /api/share/gestores/:slug
router.get('/gestores/:slug', async (req, res) => {
  try {
    const html = await buildGestorHtml(req.params.slug);
    if (!html) return res.status(404).type('text/plain').send('Gestor no encontrado');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar vista previa');
  }
});

// ── CONCESIONARIAS ───────────────────────────────────────────────────────────

async function buildDealerHtml(slug) {
  const row = await get(
    "SELECT id, slug, name, logo_url FROM users WHERE slug = ? AND role = 'concesionaria'",
    [slug],
  );
  if (!row) return null;

  const imageUrl = row.logo_url
    ? `${SITE_BASE}/og/dealer/${row.slug}.jpg`
    : null;
  const pageUrl  = `${SITE_BASE}/concesionarias/${row.slug}`;
  const shareUrl = `${SITE_BASE}/sc/${row.slug}`;
  const subtitle = row.name;

  return buildHtml({
    tagline: AUTO_TAGLINE,
    subtitle,
    shareUrl,
    pageUrl,
    imgMeta: buildImageMeta(imageUrl, subtitle),
  });
}

// GET /api/share/concesionarias/:slug
router.get('/concesionarias/:slug', async (req, res) => {
  try {
    const html = await buildDealerHtml(req.params.slug);
    if (!html) return res.status(404).type('text/plain').send('Concesionaria no encontrada');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar vista previa');
  }
});

// Catálogo /autos — HTML con OG para crawlers (WhatsApp, Facebook, etc.)
router.get('/catalog/autos', (_req, res) => {
  const pageUrl = `${SITE_BASE}/autos`;
  const description = 'Explora seminuevos verificados de concesionarias en todo México.';
  const imageUrl = `${SITE_BASE}/og/autos.jpg`;

  const html = buildHtml({
    tagline: AUTO_TAGLINE,
    subtitle: description,
    shareUrl: pageUrl,
    pageUrl,
    imgMeta: buildImageMeta(imageUrl, AUTO_TAGLINE),
  });

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

export default router;
