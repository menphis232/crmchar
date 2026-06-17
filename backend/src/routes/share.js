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
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return val;
}

function absoluteUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

router.get('/autos/:id', async (req, res) => {
  try {
    const row = await get(
      "SELECT id, make, model, year, image_url, images FROM autos WHERE id = ? AND status = 'published'",
      [req.params.id],
    );
    if (!row) return res.status(404).type('text/plain').send('Vehículo no encontrado');

    const images = parseImages(row.images);
    const imageUrl = absoluteUrl(row.image_url || images[0] || null);
    const pageUrl = `${SITE_BASE}/autos/${row.id}`;
    const subtitle = `${row.make} ${row.model} ${row.year}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(subtitle)}</title>
  <meta name="description" content="${escapeHtml(subtitle)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Trámites Vehiculares de México">
  <meta property="og:title" content="${escapeHtml(SHARE_TAGLINE)}">
  <meta property="og:description" content="${escapeHtml(subtitle)}">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
  ${imageUrl ? `<meta property="og:image:alt" content="${escapeHtml(subtitle)}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(SHARE_TAGLINE)}">
  <meta name="twitter:description" content="${escapeHtml(subtitle)}">
  ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : ''}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(pageUrl)}">
</head>
<body>
  <p><a href="${escapeHtml(pageUrl)}">${escapeHtml(subtitle)}</a></p>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar vista previa');
  }
});

export default router;
