import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

function parseImages(val) {
  if (!val) return [];
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return val;
}

function autoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    make: row.make,
    model: row.model,
    year: row.year,
    price: Number(row.price),
    mileage: row.mileage,
    transmission: row.transmission,
    location: row.location,
    description: row.description,
    imageUrl: row.image_url,
    images: parseImages(row.images),
    dealerName: row.dealer_name,
    dealerSlug: row.dealer_slug || null,
    status: row.status || 'published',
    active: row.status === 'published',
    googleAnalyticsId: row.google_analytics_id || null,
    page_builder_config: (function() {
      let conf = row.page_builder_config;
      if (typeof conf === 'string') {
        try { return JSON.parse(conf); } catch(e) { return null; }
      }
      return conf || null;
    })(),
    createdAt: row.created_at,
  };
}


router.get('/', async (req, res) => {
  try {
    const { make, minPrice, maxPrice } = req.query;
    let sql = `SELECT a.*, u.slug AS dealer_slug, u.google_analytics_id, u.page_builder_config
               FROM autos a JOIN users u ON a.user_id = u.id
               WHERE a.status = 'published'`;
    const params = [];
    if (make) { sql += ' AND a.make LIKE ?'; params.push(`%${make}%`); }
    if (minPrice) { sql += ' AND a.price >= ?'; params.push(Number(minPrice)); }
    if (maxPrice) { sql += ' AND a.price <= ?'; params.push(Number(maxPrice)); }
    sql += ' ORDER BY a.created_at DESC';
    const rows = await query(sql, params);
    res.json(rows.map(autoRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar autos' });
  }
});

router.get('/filters/makes', async (_req, res) => {
  try {
    const rows = await query("SELECT make, COUNT(*) as count FROM autos WHERE status = 'published' GROUP BY make ORDER BY count DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener marcas' });
  }
});

router.get('/me/inventory', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql = 'SELECT * FROM autos WHERE user_id = ?';
    const params = [req.user.id];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const rows = await query(sql, params);
    res.json(rows.map(autoRow));
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar inventario' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await get(`
      SELECT a.*, u.google_analytics_id, u.page_builder_config, u.slug AS dealer_slug
      FROM autos a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.id = ? AND a.status = 'published'`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(autoRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar vehículo' });
  }
});


router.post('/', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const { make, model, year, price, mileage, transmission, location, description, imageUrl, images, dealerName, status } = req.body;
    if (!make || !model || !year || price == null || mileage == null) {
      return res.status(400).json({ error: 'Campos obligatorios incompletos' });
    }

    const id = uuid();
    const imgs = images?.length ? images : (imageUrl ? [imageUrl] : []);
    const mainImage = imageUrl || imgs[0] || 'https://images.unsplash.com/photo-1503376713356-200d72f10255?q=80&w=600';
    const carStatus = ['draft', 'published', 'baja'].includes(status) ? status : 'published';

    await run(`
      INSERT INTO autos (id, user_id, make, model, year, price, mileage, transmission, location, description, image_url, images, dealer_name, status, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, req.user.id, make, model, year, price, mileage,
      transmission || 'Automático', location || null, description || null,
      mainImage, JSON.stringify(imgs), dealerName || req.user.name, carStatus, carStatus === 'published' ? 1 : 0,
    ]);

    const row = await get('SELECT * FROM autos WHERE id = ?', [id]);
    res.status(201).json(autoRow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar vehículo' });
  }
});

router.put('/:id', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const existing = await get('SELECT * FROM autos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const { make, model, year, price, mileage, transmission, location, description, imageUrl, images, status } = req.body;
    const imgs = images ? JSON.stringify(images) : (typeof existing.images === 'string' ? existing.images : JSON.stringify(existing.images || []));
    const newStatus = status ?? existing.status ?? 'published';

    await run(`
      UPDATE autos SET
        make = COALESCE(?, make), model = COALESCE(?, model), year = COALESCE(?, year),
        price = COALESCE(?, price), mileage = COALESCE(?, mileage),
        transmission = COALESCE(?, transmission), location = COALESCE(?, location),
        description = COALESCE(?, description), image_url = COALESCE(?, image_url),
        images = ?, status = ?, active = ?
      WHERE id = ? AND user_id = ?
    `, [
      make, model, year, price, mileage, transmission, location, description, imageUrl, imgs,
      newStatus, newStatus === 'published' ? 1 : 0,
      req.params.id, req.user.id,
    ]);

    const row = await get('SELECT * FROM autos WHERE id = ?', [req.params.id]);
    res.json(autoRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar vehículo' });
  }
});

router.patch('/:id/status', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['draft', 'published', 'baja'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const result = await run(
      'UPDATE autos SET status = ?, active = ? WHERE id = ? AND user_id = ?',
      [status, status === 'published' ? 1 : 0, req.params.id, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const row = await get('SELECT * FROM autos WHERE id = ?', [req.params.id]);
    res.json(autoRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.delete('/:id', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const result = await run('DELETE FROM autos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar vehículo' });
  }
});

export default router;
