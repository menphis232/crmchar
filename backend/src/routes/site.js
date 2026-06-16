import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

function parseSettings(row) {
  if (!row) return null;
  const s = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
  return { pageKey: row.page_key, ...s, updatedAt: row.updated_at };
}

// Público: ID global de Google Analytics (gtag en todo el sitio)
router.get('/analytics-id', async (_req, res) => {
  try {
    const row = await get('SELECT measurement_id FROM analytics_settings WHERE id = 1');
    res.json({ measurementId: row?.measurement_id || null });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar Analytics' });
  }
});

// Público: configuración visual de una página
router.get('/:pageKey', async (req, res) => {
  try {
    const row = await get('SELECT * FROM site_settings WHERE page_key = ?', [req.params.pageKey]);
    if (!row) return res.json({ pageKey: req.params.pageKey });
    res.json(parseSettings(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar configuración' });
  }
});

export default router;

// Admin routes exported separately
export const adminSiteRouter = Router();

adminSiteRouter.get('/', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM site_settings');
    res.json(rows.map(parseSettings));
  } catch (err) {
    res.status(500).json({ error: 'Error al listar configuraciones' });
  }
});

adminSiteRouter.put('/:pageKey', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { pageKey } = req.params;
    const settings = { ...req.body };
    delete settings.pageKey;
    delete settings.updatedAt;

    const exists = await get('SELECT page_key FROM site_settings WHERE page_key = ?', [pageKey]);
    if (exists) {
      await run('UPDATE site_settings SET settings = ? WHERE page_key = ?', [JSON.stringify(settings), pageKey]);
    } else {
      await run('INSERT INTO site_settings (page_key, settings) VALUES (?, ?)', [pageKey, JSON.stringify(settings)]);
    }
    const row = await get('SELECT * FROM site_settings WHERE page_key = ?', [pageKey]);
    res.json(parseSettings(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});
