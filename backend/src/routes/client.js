import { Router } from 'express';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { v4 as uuid } from 'uuid';

const router = Router();

// Get all deals for the client
router.get('/deals', authRequired, requireRole('cliente'), async (req, res) => {
  try {
    const deals = await query(`
      SELECT d.id, d.title, d.stage, d.estimated_value as price, d.created_at, g.name as gestor_name, d.deal_type, d.tracking_code
      FROM crm_deals d
      LEFT JOIN gestores g ON g.user_id = d.user_id
      JOIN contacts c ON c.id = d.contact_id
      WHERE c.email = ?
      ORDER BY d.created_at DESC
    `, [req.user.email]);
    res.json(deals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener trámites' });
  }
});

// Get chat messages for a deal
router.get('/deals/:id/messages', authRequired, async (req, res) => {
  try {
    const messages = await query(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.deal_id = ?
      ORDER BY m.created_at ASC
    `, [req.params.id]);
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Send a chat message
router.post('/deals/:id/messages', authRequired, async (req, res) => {
  try {
    const { message, fileUrl } = req.body;
    if (!message && !fileUrl) {
      return res.status(400).json({ error: 'Mensaje vacío' });
    }
    
    const id = uuid();
    await run(`
      INSERT INTO chat_messages (id, deal_id, sender_id, message, file_url)
      VALUES (?, ?, ?, ?, ?)
    `, [id, req.params.id, req.user.id, message || null, fileUrl || null]);
    
    const saved = await get(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name as sender_name, u.role as sender_role
      FROM chat_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?
    `, [id]);
    
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

export default router;
