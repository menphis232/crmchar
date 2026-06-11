import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { createDealFromInquiry } from '../crm/helpers.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/mailer.js';

const router = Router();

router.get('/me/dashboard', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const uid = req.user.id;
    const [published, draft, baja, inquiriesNew, reviews] = await Promise.all([
      get("SELECT COUNT(*) as c FROM autos WHERE user_id = ? AND status = 'published'", [uid]),
      get("SELECT COUNT(*) as c FROM autos WHERE user_id = ? AND status = 'draft'", [uid]),
      get("SELECT COUNT(*) as c FROM autos WHERE user_id = ? AND status = 'baja'", [uid]),
      get("SELECT COUNT(*) as c FROM auto_inquiries WHERE user_id = ? AND status = 'nuevo'", [uid]),
      get('SELECT AVG(rating) as avg, COUNT(*) as count FROM concesionaria_reviews WHERE user_id = ?', [uid]),
    ]);
    res.json({
      published: published.c,
      draft: draft.c,
      baja: baja.c,
      inquiriesNew: inquiriesNew.c,
      rating: reviews.avg ? Number(Number(reviews.avg).toFixed(1)) : 0,
      reviewCount: reviews.count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar dashboard' });
  }
});

router.get('/me/inquiries', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const rows = await query(`
      SELECT i.id, i.client_name as clientName, i.client_email as clientEmail,
             i.client_phone as clientPhone, i.message, i.status, i.reply,
             i.created_at as createdAt, a.make, a.model, a.id as autoId
      FROM auto_inquiries i
      JOIN autos a ON a.id = i.auto_id
      WHERE i.user_id = ? ORDER BY i.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar mensajes' });
  }
});

router.patch('/me/inquiries/:id', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const { reply, status } = req.body;
    const result = await run(`
      UPDATE auto_inquiries SET reply = COALESCE(?, reply), status = COALESCE(?, status)
      WHERE id = ? AND user_id = ?
    `, [reply, status || 'respondido', req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Mensaje no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al responder' });
  }
});

router.get('/me/reviews', authRequired, requireRole('concesionaria'), async (req, res) => {
  try {
    const rows = await query(`
      SELECT id, author, rating, comment, created_at as createdAt
      FROM concesionaria_reviews WHERE user_id = ? ORDER BY created_at DESC
    `, [req.user.id]);
    const agg = await get('SELECT AVG(rating) as avg, COUNT(*) as count FROM concesionaria_reviews WHERE user_id = ?', [req.user.id]);
    res.json({
      reviews: rows,
      rating: agg.avg ? Number(Number(agg.avg).toFixed(1)) : 0,
      reviewCount: agg.count,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar reseñas' });
  }
});

// Público: enviar pregunta sobre un auto
router.post('/inquiries', async (req, res) => {
  try {
    const { autoId, clientName, clientEmail, clientPhone, message } = req.body;
    if (!autoId || !clientName || !message) {
      return res.status(400).json({ error: 'Auto, nombre y mensaje requeridos' });
    }
    const auto = await get("SELECT id, user_id FROM autos WHERE id = ? AND status = 'published'", [autoId]);
    if (!auto) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const id = uuid();

    // Auto-registro de cliente
    if (clientEmail) {
      const existingUser = await get('SELECT id FROM users WHERE email = ?', [clientEmail]);
      if (!existingUser) {
        const tempPassword = Math.random().toString(36).slice(-8);
        const hash = bcrypt.hashSync(tempPassword, 10);
        const userId = uuid();
        await run(
          'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
          [userId, clientEmail, hash, 'cliente', clientName]
        );
        
        // Enviar correo con credenciales provisionales
        const html = `
          <h2>Bienvenido a Trámites Vehiculares</h2>
          <p>Hola ${clientName},</p>
          <p>Hemos recibido tu interés sobre el vehículo <strong>${auto.make} ${auto.model}</strong>.</p>
          <p>Te hemos creado una cuenta para que puedas chatear directamente con la concesionaria, subir documentos o hacer seguimiento.</p>
          <p><strong>Tus credenciales de acceso:</strong></p>
          <ul>
            <li><strong>Usuario/Email:</strong> ${clientEmail}</li>
            <li><strong>Contraseña provisional:</strong> ${tempPassword}</li>
          </ul>
          <p>Por favor, <a href="http://localhost:4200/login">inicia sesión aquí</a> y cambia tu contraseña lo antes posible.</p>
        `;
        try {
          await sendEmail(clientEmail, 'Tu cuenta ha sido creada', 'Tu cuenta ha sido creada', html);
        } catch(e) {
          console.error("No se pudo enviar el correo:", e);
        }
      }
    }

    await run(`
      INSERT INTO auto_inquiries (id, auto_id, user_id, client_name, client_email, client_phone, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, autoId, auto.user_id, clientName, clientEmail || null, clientPhone || null, message]);

    const inquiry = await get(`
      SELECT i.*, a.make, a.model FROM auto_inquiries i
      JOIN autos a ON a.id = i.auto_id WHERE i.id = ?
    `, [id]);
    await createDealFromInquiry(inquiry, auto.user_id);

    res.status(201).json({ id, status: 'nuevo' });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Público: dejar reseña a concesionaria (desde detalle de auto)
router.post('/reviews', async (req, res) => {
  try {
    const { userId, author, rating, comment } = req.body;
    if (!userId || !author || !rating || !comment) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const dealer = await get("SELECT id FROM users WHERE id = ? AND role = 'concesionaria'", [userId]);
    if (!dealer) return res.status(404).json({ error: 'Concesionaria no encontrada' });

    await run('INSERT INTO concesionaria_reviews (id, user_id, author, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [uuid(), userId, author, rating, comment]);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar reseña' });
  }
});

export default router;
