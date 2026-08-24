import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';

const router = Router();

function clientIdOf(user) {
  if (user.role === 'cliente') return user.id;
  return user.parent_id || user.id;
}

async function loadMessages(clientId) {
  return query(`
    SELECT m.id, m.client_id as clientId, m.sender_id as senderId, m.message, m.file_url as fileUrl,
           m.is_read as isRead, m.created_at as createdAt,
           u.name as senderName, u.role as senderRole
    FROM support_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.client_id = ?
    ORDER BY m.created_at ASC
  `, [clientId]);
}

async function notifySupport(recipientUserId, title, body, refId) {
  try {
    await run(
      'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
      [uuid(), recipientUserId, 'support', title, body, refId]
    );
  } catch (err) {
    console.error('notifySupport:', err.message);
  }
}

async function markThreadRead(clientId, readerId) {
  await run(`
    UPDATE support_messages
    SET is_read = 1
    WHERE client_id = ? AND sender_id != ? AND is_read = 0
  `, [clientId, readerId]);
}

router.use(authRequired);

// Inbox del Super Admin: un hilo por gestoría / concesionario / cliente
router.get('/threads', requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.created_at as createdAt,
             (SELECT sm.message FROM support_messages sm
              WHERE sm.client_id = u.id ORDER BY sm.created_at DESC LIMIT 1) as lastMessage,
             (SELECT sm.created_at FROM support_messages sm
              WHERE sm.client_id = u.id ORDER BY sm.created_at DESC LIMIT 1) as lastAt,
             (SELECT COUNT(*) FROM support_messages sm
              WHERE sm.client_id = u.id AND sm.sender_id != ? AND sm.is_read = 0) as unread
      FROM users u
      WHERE u.role IN ('gestor', 'concesionaria', 'cliente')
        AND (u.role = 'cliente' OR u.parent_id IS NULL)
    `;
    const params = [req.user.id];
    if (role === 'gestor' || role === 'concesionaria' || role === 'cliente') {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    sql += ' ORDER BY (lastAt IS NULL), lastAt DESC, u.name ASC';
    const rows = await query(sql, params);
    res.json(rows.map(r => ({ ...r, unread: Number(r.unread) || 0 })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar hilos de soporte' });
  }
});

// Mensajes del propio hilo (gestor / concesionaria / cliente)
router.get('/messages', async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Usa /messages/:clientId como admin' });
    }
    const clientId = clientIdOf(req.user);
    await markThreadRead(clientId, req.user.id);
    res.json(await loadMessages(clientId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

router.get('/messages/:clientId', requireRole('admin'), async (req, res) => {
  try {
    const client = await get(
      `SELECT id, name, email, role FROM users
       WHERE id = ? AND role IN ('gestor','concesionaria','cliente')
         AND (role = 'cliente' OR parent_id IS NULL)`,
      [req.params.clientId]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
    await markThreadRead(client.id, req.user.id);
    res.json(await loadMessages(client.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

router.post('/messages', async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(400).json({ error: 'Usa /messages/:clientId como admin' });
    }
    const { message, fileUrl } = req.body;
    if (!message?.trim() && !fileUrl) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }
    const clientId = clientIdOf(req.user);
    const id = uuid();
    await run(
      `INSERT INTO support_messages (id, client_id, sender_id, message, file_url, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [id, clientId, req.user.id, message?.trim() || null, fileUrl || null]
    );
    const saved = (await loadMessages(clientId)).find(m => m.id === id);

    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    for (const a of admins) {
      await notifySupport(
        a.id,
        'Nuevo mensaje de soporte',
        `${req.user.name}: ${(message || '📎 Adjunto').slice(0, 120)}`,
        clientId
      );
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

router.post('/messages/:clientId', requireRole('admin'), async (req, res) => {
  try {
    const { message, fileUrl } = req.body;
    if (!message?.trim() && !fileUrl) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }
    const client = await get(
      `SELECT id, name FROM users
       WHERE id = ? AND role IN ('gestor','concesionaria','cliente')
         AND (role = 'cliente' OR parent_id IS NULL)`,
      [req.params.clientId]
    );
    if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

    const id = uuid();
    await run(
      `INSERT INTO support_messages (id, client_id, sender_id, message, file_url, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [id, client.id, req.user.id, message?.trim() || null, fileUrl || null]
    );
    const saved = (await loadMessages(client.id)).find(m => m.id === id);

    await notifySupport(
      client.id,
      'Respuesta de Soporte',
      `Super Admin: ${(message || '📎 Adjunto').slice(0, 120)}`,
      client.id
    );

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

router.get('/unread', async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const row = await get(`
        SELECT COUNT(*) as c FROM support_messages sm
        JOIN users u ON u.id = sm.client_id
        WHERE sm.is_read = 0 AND sm.sender_id != ?
          AND u.role IN ('gestor','concesionaria','cliente')
      `, [req.user.id]);
      return res.json({ unread: Number(row?.c) || 0 });
    }
    const clientId = clientIdOf(req.user);
    const row = await get(`
      SELECT COUNT(*) as c FROM support_messages
      WHERE client_id = ? AND sender_id != ? AND is_read = 0
    `, [clientId, req.user.id]);
    res.json({ unread: Number(row?.c) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al contar no leídos' });
  }
});

export default router;
