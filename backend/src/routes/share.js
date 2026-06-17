import { Router } from 'express';
import { get } from '../db.js';

const router = Router();

const SHARE_TAGLINE = 'EL INVENTARIO DE SEMINUEVOS MÁS GRANDE DE MÉXICO';
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

function absoluteUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_BASE}${url.startsWith('/') ? url : `/${url}`}`;
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

  const imgMeta = imageUrl ? `
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(subtitle)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subtitle)}</title>
  <meta name="description" content="${escapeHtml(subtitle)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Tr\u00e1mites Vehiculares de M\u00e9xico">
  <meta property="og:title" content="${escapeHtml(SHARE_TAGLINE)}">
  <meta property="og:description" content="${escapeHtml(subtitle)}">
  <meta property="og:url" content="${escapeHtml(shareUrl)}">
  ${imgMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(SHARE_TAGLINE)}">
  <meta name="twitter:description" content="${escapeHtml(subtitle)}">
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}">
  <script>window.location.replace("${escapeHtml(pageUrl)}");</script>
</head>
<body>
  <p>Redirigiendo... <a href="${escapeHtml(pageUrl)}">${escapeHtml(subtitle)}</a></p>
</body>
</html>`;
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

// Ruta corta montada en /s: GET /s/:id
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

export default router;
