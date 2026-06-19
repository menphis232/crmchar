import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import { orgId, requireStaffPerm } from '../utils/org-access.js';

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
    specialPrice: row.special_price != null ? Number(row.special_price) : null,
    verified: !!row.verified,
    mileage: row.mileage,
    transmission: row.transmission,
    location: row.location,
    description: row.description,
    imageUrl: row.image_url,
    images: parseImages(row.images),
    videoUrl: row.video_url || null,
    dealerName: row.dealer_name,
    dealerSlug: row.dealer_slug || null,
    dealerLogoUrl: row.dealer_logo_url || null,
    dealerPhone: row.dealer_phone || null,
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


function privateDocRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    autoId: row.auto_id,
    label: row.label,
    fileUrl: row.file_url,
    fileName: row.file_name || null,
    notes: row.notes || null,
    createdAt: row.created_at,
  };
}

async function assertAutoOwner(autoId, userId) {
  return get('SELECT id FROM autos WHERE id = ? AND user_id = ?', [autoId, userId]);
}

function dealerId(req) {
  return orgId(req);
}

router.get('/', async (req, res) => {
  try {
    const { make, minPrice, maxPrice } = req.query;
    let sql = `SELECT a.*, u.slug AS dealer_slug, u.logo_url AS dealer_logo_url, u.google_analytics_id, u.page_builder_config
               FROM autos a JOIN users u ON a.user_id = u.id
               WHERE a.status = 'published'`;
    const params = [];
    if (make) { sql += ' AND a.make LIKE ?'; params.push(`%${make}%`); }
    if (minPrice) { sql += ' AND COALESCE(a.special_price, a.price) >= ?'; params.push(Number(minPrice)); }
    if (maxPrice) { sql += ' AND COALESCE(a.special_price, a.price) <= ?'; params.push(Number(maxPrice)); }
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

router.get('/me/inventory', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('inventory'), async (req, res) => {
  try {
    const { status } = req.query;
    const uid = dealerId(req);
    let sql = 'SELECT * FROM autos WHERE user_id = ?';
    const params = [uid];
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
      SELECT a.*, u.google_analytics_id, u.page_builder_config, u.slug AS dealer_slug, u.logo_url AS dealer_logo_url, u.name AS dealer_name, u.phone AS dealer_phone
      FROM autos a 
      JOIN users u ON a.user_id = u.id 
      WHERE a.id = ? AND a.status = 'published'`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(autoRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar vehículo' });
  }
});

// Documentación privada del vehículo (solo panel concesionaria, no pública)
router.get('/:id/private-documents', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('inventory'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const auto = await assertAutoOwner(req.params.id, uid);
    if (!auto) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const rows = await query(
      'SELECT * FROM auto_private_documents WHERE auto_id = ? AND user_id = ? ORDER BY created_at DESC',
      [req.params.id, uid],
    );
    res.json(rows.map(privateDocRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar documentación' });
  }
});

router.post('/:id/private-documents', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('edit'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const auto = await assertAutoOwner(req.params.id, uid);
    if (!auto) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const { label, fileUrl, fileName, notes } = req.body;
    if (!label?.trim() || !fileUrl?.trim()) {
      return res.status(400).json({ error: 'Tipo de documento y archivo requeridos' });
    }

    const id = uuid();
    await run(
      `INSERT INTO auto_private_documents (id, auto_id, user_id, label, file_url, file_name, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.id, uid, label.trim(), fileUrl.trim(), fileName || null, notes?.trim() || null],
    );

    const row = await get('SELECT * FROM auto_private_documents WHERE id = ?', [id]);
    res.status(201).json(privateDocRow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar documento' });
  }
});

router.delete('/:id/private-documents/:docId', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('edit'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const auto = await assertAutoOwner(req.params.id, uid);
    if (!auto) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const result = await run(
      'DELETE FROM auto_private_documents WHERE id = ? AND auto_id = ? AND user_id = ?',
      [req.params.docId, req.params.id, uid],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});


router.post('/', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('edit'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const { make, model, year, price, specialPrice, mileage, transmission, location, description, imageUrl, images, dealerName, status, videoUrl, verified } = req.body;
    if (!make || !model || !year || price == null || mileage == null) {
      return res.status(400).json({ error: 'Campos obligatorios incompletos' });
    }

    const id = uuid();
    const imgs = images?.length ? images : (imageUrl ? [imageUrl] : []);
    const mainImage = imageUrl || imgs[0] || 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&auto=format&fit=crop';
    const carStatus = ['draft', 'published', 'baja'].includes(status) ? status : 'published';

    const parsedSpecial = specialPrice != null && specialPrice !== '' ? Number(specialPrice) : null;
    const validSpecial = parsedSpecial != null && parsedSpecial > 0 && parsedSpecial < Number(price) ? parsedSpecial : null;

    const orgUser = await get('SELECT name FROM users WHERE id = ?', [uid]);

    await run(`
      INSERT INTO autos (id, user_id, make, model, year, price, special_price, verified, mileage, transmission, location, description, image_url, images, video_url, dealer_name, status, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, uid, make, model, year, price, validSpecial, verified ? 1 : 0, mileage,
      transmission || 'Automático', location || null, description || null,
      mainImage, JSON.stringify(imgs), videoUrl?.trim() || null, dealerName || orgUser?.name || req.user.name, carStatus, carStatus === 'published' ? 1 : 0,
    ]);

    const row = await get('SELECT * FROM autos WHERE id = ?', [id]);
    res.status(201).json(autoRow(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar vehículo' });
  }
});

router.put('/:id', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('edit'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const existing = await get('SELECT * FROM autos WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const { make, model, year, price, specialPrice, mileage, transmission, location, description, imageUrl, images, status, videoUrl, verified } = req.body;
    const imgs = images ? JSON.stringify(images) : (typeof existing.images === 'string' ? existing.images : JSON.stringify(existing.images || []));
    const newStatus = status ?? existing.status ?? 'published';
    const newVideoUrl = videoUrl !== undefined ? (videoUrl?.trim() || null) : existing.video_url;
    const basePrice = price != null ? Number(price) : Number(existing.price);
    let validSpecial = existing.special_price != null ? Number(existing.special_price) : null;
    if (specialPrice !== undefined) {
      const parsed = specialPrice != null && specialPrice !== '' ? Number(specialPrice) : null;
      validSpecial = parsed != null && parsed > 0 && parsed < basePrice ? parsed : null;
    } else if (price != null && validSpecial != null && validSpecial >= basePrice) {
      validSpecial = null;
    }

    const newVerified = verified !== undefined ? (verified ? 1 : 0) : existing.verified;

    await run(`
      UPDATE autos SET
        make = COALESCE(?, make), model = COALESCE(?, model), year = COALESCE(?, year),
        price = COALESCE(?, price), special_price = ?, verified = ?, mileage = COALESCE(?, mileage),
        transmission = COALESCE(?, transmission), location = COALESCE(?, location),
        description = COALESCE(?, description), image_url = COALESCE(?, image_url),
        images = ?, video_url = ?, status = ?, active = ?
      WHERE id = ? AND user_id = ?
    `, [
      make, model, year, price, validSpecial, newVerified, mileage, transmission, location, description, imageUrl, imgs,
      newVideoUrl, newStatus, newStatus === 'published' ? 1 : 0,
      req.params.id, uid,
    ]);

    const row = await get('SELECT * FROM autos WHERE id = ?', [req.params.id]);
    res.json(autoRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar vehículo' });
  }
});

router.patch('/:id/status', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('edit'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const { status } = req.body;
    if (!['draft', 'published', 'baja'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const result = await run(
      'UPDATE autos SET status = ?, active = ? WHERE id = ? AND user_id = ?',
      [status, status === 'published' ? 1 : 0, req.params.id, uid]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Vehículo no encontrado' });
    const row = await get('SELECT * FROM autos WHERE id = ?', [req.params.id]);
    res.json(autoRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

router.delete('/:id', authRequired, requireRole('concesionaria'), requireActiveSubscription, requireStaffPerm('edit'), async (req, res) => {
  try {
    const uid = dealerId(req);
    const result = await run('DELETE FROM autos WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar vehículo' });
  }
});

export default router;
