import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

function mapPost(row, likedByMe = false) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body || '',
    coverUrl: row.cover_url || null,
    externalUrl: row.external_url || null,
    isPublished: !!row.is_published,
    sortOrder: Number(row.sort_order) || 0,
    likesCount: Number(row.likes_count) || 0,
    likedByMe: !!likedByMe || !!Number(row.liked_by_me),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_BASE = `
  SELECT p.id, p.type, p.title, p.body, p.cover_url, p.external_url,
         p.is_published, p.sort_order, p.created_at, p.updated_at,
         (SELECT COUNT(*) FROM knowledge_likes kl WHERE kl.post_id = p.id) AS likes_count
`;

router.use(authRequired);

/** Admin: listado completo */
router.get('/admin', requireRole('admin'), async (_req, res) => {
  try {
    const rows = await query(`
      ${SELECT_BASE}
      FROM knowledge_posts p
      ORDER BY p.sort_order ASC, p.created_at DESC
    `);
    res.json(rows.map(r => mapPost(r)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar contenidos' });
  }
});

/** Admin: crear */
router.post('/admin', requireRole('admin'), async (req, res) => {
  try {
    const { type, title, body, coverUrl, externalUrl, isPublished, sortOrder } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    const allowed = ['video', 'article', 'link'];
    const postType = allowed.includes(type) ? type : 'video';
    const id = uuid();
    await run(`
      INSERT INTO knowledge_posts
        (id, type, title, body, cover_url, external_url, is_published, sort_order, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      postType,
      String(title).trim().slice(0, 255),
      body ? String(body) : null,
      coverUrl || null,
      externalUrl || null,
      isPublished === false || isPublished === 0 ? 0 : 1,
      Number(sortOrder) || 0,
      req.user.id,
    ]);
    const row = await get(`${SELECT_BASE} FROM knowledge_posts p WHERE p.id = ?`, [id]);
    res.status(201).json(mapPost(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear contenido' });
  }
});

/** Admin: actualizar */
router.put('/admin/:id', requireRole('admin'), async (req, res) => {
  try {
    const existing = await get('SELECT id FROM knowledge_posts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Contenido no encontrado' });

    const { type, title, body, coverUrl, externalUrl, isPublished, sortOrder } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }
    const allowed = ['video', 'article', 'link'];
    const postType = allowed.includes(type) ? type : 'video';

    await run(`
      UPDATE knowledge_posts SET
        type = ?, title = ?, body = ?, cover_url = ?, external_url = ?,
        is_published = ?, sort_order = ?
      WHERE id = ?
    `, [
      postType,
      String(title).trim().slice(0, 255),
      body ? String(body) : null,
      coverUrl || null,
      externalUrl || null,
      isPublished === false || isPublished === 0 ? 0 : 1,
      Number(sortOrder) || 0,
      req.params.id,
    ]);

    const row = await get(`${SELECT_BASE} FROM knowledge_posts p WHERE p.id = ?`, [req.params.id]);
    res.json(mapPost(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar contenido' });
  }
});

/** Admin: eliminar */
router.delete('/admin/:id', requireRole('admin'), async (req, res) => {
  try {
    const existing = await get('SELECT id FROM knowledge_posts WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Contenido no encontrado' });
    await run('DELETE FROM knowledge_posts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar contenido' });
  }
});

/** Cliente (y cualquier autenticado): feed publicado */
router.get('/feed', async (req, res) => {
  try {
    const rows = await query(`
      ${SELECT_BASE},
        EXISTS(
          SELECT 1 FROM knowledge_likes kl
          WHERE kl.post_id = p.id AND kl.user_id = ?
        ) AS liked_by_me
      FROM knowledge_posts p
      WHERE p.is_published = 1
      ORDER BY p.sort_order ASC, p.created_at DESC
    `, [req.user.id]);
    res.json(rows.map(r => mapPost(r)));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el feed' });
  }
});

/** Cliente: detalle de un post publicado */
router.get('/:id', async (req, res) => {
  try {
    if (req.params.id === 'admin' || req.params.id === 'feed') {
      return res.status(404).json({ error: 'No encontrado' });
    }
    const row = await get(`
      ${SELECT_BASE},
        EXISTS(
          SELECT 1 FROM knowledge_likes kl
          WHERE kl.post_id = p.id AND kl.user_id = ?
        ) AS liked_by_me
      FROM knowledge_posts p
      WHERE p.id = ? AND p.is_published = 1
    `, [req.user.id, req.params.id]);
    if (!row) return res.status(404).json({ error: 'Contenido no encontrado' });
    res.json(mapPost(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el contenido' });
  }
});

/** Toggle like */
router.post('/:id/like', async (req, res) => {
  try {
    const post = await get('SELECT id FROM knowledge_posts WHERE id = ? AND is_published = 1', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Contenido no encontrado' });

    const existing = await get(
      'SELECT post_id FROM knowledge_likes WHERE post_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (existing) {
      await run('DELETE FROM knowledge_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id]);
    } else {
      await run('INSERT INTO knowledge_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id]);
    }

    const likes = await get('SELECT COUNT(*) AS c FROM knowledge_likes WHERE post_id = ?', [req.params.id]);
    res.json({ likedByMe: !existing, likesCount: Number(likes?.c) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar me gusta' });
  }
});

export default router;
