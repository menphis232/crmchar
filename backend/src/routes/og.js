import { Router } from 'express';
import path from 'path';
import { get } from '../db.js';
import { generateDealerOgImage, generateGestorOgImage, generateAutosOgImage } from '../utils/og-image.js';

const router = Router();

router.get('/dealer/:slug.jpg', async (req, res) => {
  try {
    const { slug } = req.params;
    const row = await get(
      "SELECT slug, logo_url FROM users WHERE slug = ? AND role = 'concesionaria'",
      [slug],
    );
    if (!row?.logo_url) {
      return res.status(404).type('text/plain').send('Logo no encontrado');
    }

    const filePath = await generateDealerOgImage(row.logo_url, row.slug);
    if (!filePath) {
      return res.status(404).type('text/plain').send('No se pudo generar la imagen');
    }

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar imagen OG');
  }
});

router.get('/gestor/:slug.jpg', async (req, res) => {
  try {
    const { slug } = req.params;
    const row = await get(
      `SELECT g.slug, u.logo_url, g.photo_url, g.banner_url
       FROM gestores g
       JOIN users u ON g.user_id = u.id
       WHERE g.slug = ?`,
      [slug],
    );
    const logoSource = row?.logo_url || row?.photo_url || row?.banner_url;
    if (!logoSource) {
      return res.status(404).type('text/plain').send('Logo no encontrado');
    }

    const filePath = await generateGestorOgImage(logoSource, row.slug);
    if (!filePath) {
      return res.status(404).type('text/plain').send('No se pudo generar la imagen');
    }

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar imagen OG');
  }
});

router.get('/autos.jpg', async (_req, res) => {
  try {
    const filePath = await generateAutosOgImage();
    if (!filePath) {
      return res.status(404).type('text/plain').send('No se pudo generar la imagen');
    }

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    console.error(err);
    res.status(500).type('text/plain').send('Error al generar imagen OG');
  }
});

export default router;
