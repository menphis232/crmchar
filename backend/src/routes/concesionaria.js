import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import { createDealFromInquiry, findOrCreateContact, createManualVentaDeal } from '../crm/helpers.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/mailer.js';
import { callAIProvider } from '../utils/ai_helper.js';
const router = Router();

router.get('/me/dashboard', authRequired, requireRole('concesionaria'), requireActiveSubscription, async (req, res) => {
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

router.get('/me/inquiries', authRequired, requireRole('concesionaria'), requireActiveSubscription, async (req, res) => {
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

router.patch('/me/inquiries/:id', authRequired, requireRole('concesionaria'), requireActiveSubscription, async (req, res) => {
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

router.get('/me/reviews', authRequired, requireRole('concesionaria'), requireActiveSubscription, async (req, res) => {
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
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 500;">Hola ${clientName},</h2>
          <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Hemos recibido tu interés sobre el vehículo <strong>${auto.make} ${auto.model}</strong>.</p>
          <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Te hemos creado una cuenta para que puedas chatear directamente con la concesionaria, subir documentos o hacer seguimiento.</p>
          
          <div style="background-color: #0f1117; border: 1px dashed #c8a94a; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: #a0aec0; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Tus credenciales de acceso:</p>
            <ul style="color: #c8a94a; font-size: 16px; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 5px;"><strong>Usuario/Email:</strong> <span style="color: #ffffff;">${clientEmail}</span></li>
              <li><strong>Contraseña provisional:</strong> <span style="color: #ffffff;">${tempPassword}</span></li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 40px 0;">
            <a href="http://localhost:4200/login" style="background: linear-gradient(135deg, #c8a94a, #d4af37); color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Iniciar Sesión Ahora</a>
          </div>
          <p style="color: #a0aec0; font-size: 15px; line-height: 1.6; text-align: center;">Por favor cambia tu contraseña lo antes posible en la sección de Ajustes.</p>
        `;
        try {
          await sendEmail(clientEmail, 'Tu cuenta ha sido creada', 'Tu cuenta ha sido creada', html, auto.user_id);
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
    const dealId = await createDealFromInquiry(inquiry, auto.user_id);

    const io = req.app.get('io');
    if (io) {
      const notifId = uuid();
      const title = 'Nuevo interés en vehículo';
      const body = `${clientName} está interesado en ${inquiry.make} ${inquiry.model}.`;
      await run(`INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, 'nuevo_lead', ?, ?, ?)`,
        [notifId, auto.user_id, title, body, dealId]);
      
      io.to('user_' + auto.user_id).emit('notification', {
        id: notifId, type: 'nuevo_lead', title, body, ref_id: dealId, is_read: 0, created_at: new Date().toISOString()
      });
    }

    res.status(201).json({ id, status: 'nuevo' });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

/**
 * POST /concesionaria/whatsapp-lead
 * Público — Captura de lead antes de abrir WhatsApp.
 * Crea cuenta de cliente si se provee email + CRM lead.
 */
router.post('/whatsapp-lead', async (req, res) => {
  try {
    const { dealerSlug, clientName, clientEmail, clientPhone, autoId } = req.body;
    if (!dealerSlug || !clientName) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Buscar concesionaria por slug
    const dealer = await get("SELECT id, name, phone FROM users WHERE slug = ? AND role = 'concesionaria'", [dealerSlug]);
    if (!dealer) return res.status(404).json({ error: 'Concesionaria no encontrada' });

    // Auto-registro del cliente si hay email
    if (clientEmail) {
      const existingUser = await get('SELECT id FROM users WHERE email = ?', [clientEmail.toLowerCase()]);
      if (!existingUser) {
        const tempPassword = Math.random().toString(36).slice(-8);
        const hash = bcrypt.hashSync(tempPassword, 10);
        const userId = uuid();
        await run(
          'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
          [userId, clientEmail.toLowerCase(), hash, 'cliente', clientName]
        );
        const html = `
          <h2 style="color:#fff;font-size:20px;font-weight:500;">Hola ${clientName},</h2>
          <p style="color:#a0aec0;font-size:15px;line-height:1.6;">Contactaste a <strong>${dealer.name}</strong> por WhatsApp a través de nuestra plataforma.</p>
          <p style="color:#a0aec0;font-size:15px;line-height:1.6;">Te hemos creado una cuenta para que puedas hacer seguimiento de tu consulta, subir documentos y chatear directamente.</p>
          <div style="background:#0f1117;border:1px dashed #c8a94a;border-radius:8px;padding:20px;margin:30px 0;">
            <p style="color:#a0aec0;font-size:13px;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:1px;">Tus credenciales de acceso:</p>
            <ul style="color:#c8a94a;font-size:16px;margin:0;padding-left:20px;">
              <li style="margin-bottom:5px;"><strong>Email:</strong> <span style="color:#fff;">${clientEmail}</span></li>
              <li><strong>Contraseña provisional:</strong> <span style="color:#fff;">${tempPassword}</span></li>
            </ul>
          </div>
          <p style="color:#a0aec0;font-size:14px;text-align:center;">Por favor cambia tu contraseña en la sección de Ajustes al iniciar sesión.</p>
        `;
        try {
          await sendEmail(clientEmail, 'Tu cuenta ha sido creada', `Hola ${clientName}, tu cuenta ha sido creada.`, html, dealer.id);
        } catch(e) {
          console.error('Error enviando correo de bienvenida:', e);
        }
      }
    }

    // Crear CRM lead en el panel de la concesionaria
    let auto = null;
    if (autoId) {
      auto = await get("SELECT id, make, model, year, price FROM autos WHERE id = ? AND user_id = ?", [autoId, dealer.id]);
    }
    const leadTitle = auto
      ? `Contacto WhatsApp — ${auto.make} ${auto.model} ${auto.year}`
      : `Contacto WhatsApp — Consulta general`;

    await createManualVentaDeal(dealer.id, {
      clientName,
      clientEmail: clientEmail || null,
      clientPhone: clientPhone || null,
      title: leadTitle,
      autoId: auto?.id || null,
      estimatedValue: auto ? Number(auto.price) : 0,
      message: `Cliente contactó por WhatsApp desde ${auto ? `el vehículo ${auto.make} ${auto.model} ${auto.year}` : 'la página de la concesionaria'}.`,
      stage: 'lead_nuevo',
    });

    // Notificación en tiempo real
    try {
      const io = req.app.get('io');
      if (io) {
        const notifId = uuid();
        const notifTitle = 'Nuevo lead por WhatsApp';
        const notifBody = `${clientName} quiere contactarte por WhatsApp.`;
        await run(
          `INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, 'nuevo_lead', ?, ?)`,
          [notifId, dealer.id, notifTitle, notifBody]
        );
        io.to('user_' + dealer.id).emit('notification', {
          id: notifId, type: 'nuevo_lead', title: notifTitle, body: notifBody, is_read: 0, created_at: new Date().toISOString()
        });
      }
    } catch(e) { /* notif no crítica */ }

    res.status(201).json({ ok: true, dealerPhone: dealer.phone });
  } catch (err) {
    console.error('whatsapp-lead error:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
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

// ─── ENDPOINTS PÚBLICOS DE CONCESIONARIA ───────────────────────────────────

// GET /concesionaria/public/:slug  — Perfil público
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const user = await get(`
      SELECT id, name, slug, logo_url, description, phone, address, map_embed_url,
             chatbot_bg_color, chatbot_btn_color, chatbot_text_color,
             CASE WHEN ai_api_key IS NOT NULL AND ai_api_key != '' THEN 1 ELSE 0 END as has_ai
      FROM users WHERE slug = ? AND role = 'concesionaria'
    `, [slug]);
    if (!user) return res.status(404).json({ error: 'Concesionaria no encontrada' });

    if (!user.has_ai) {
      const admin = await get("SELECT ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
      if (admin && admin.ai_api_key) user.has_ai = 1;
    }

    const [autosCount, reviewAgg, reviewRows] = await Promise.all([
      get(`SELECT COUNT(*) as c FROM autos WHERE user_id = ? AND status = 'published'`, [user.id]),
      get('SELECT AVG(rating) as avg, COUNT(*) as count FROM concesionaria_reviews WHERE user_id = ?', [user.id]),
      query(`
        SELECT id, author, rating, comment, created_at as createdAt
        FROM concesionaria_reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
      `, [user.id]),
    ]);

    res.json({
      id: user.id,
      slug: user.slug,
      name: user.name,
      logoUrl: user.logo_url || null,
      description: user.description || null,
      phone: user.phone || null,
      address: user.address || null,
      mapEmbedUrl: user.map_embed_url || null,
      chatbot_bg_color: user.chatbot_bg_color || '#000000',
      chatbot_btn_color: user.chatbot_btn_color || '#4F46E5',
      chatbot_text_color: user.chatbot_text_color || '#FFFFFF',
      hasAi: !!user.has_ai,
      autosCount: autosCount?.c || 0,
      rating: reviewAgg?.avg ? Number(Number(reviewAgg.avg).toFixed(1)) : 0,
      reviewCount: reviewAgg?.count || 0,
      reviews: reviewRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar perfil de concesionaria' });
  }
});

// GET /concesionaria/public/:slug/autos  — Inventario público con filtros
router.get('/public/:slug/autos', async (req, res) => {
  try {
    const { slug } = req.params;
    const { q, make, minPrice, maxPrice } = req.query;

    const user = await get("SELECT id FROM users WHERE slug = ? AND role = 'concesionaria'", [slug]);
    if (!user) return res.status(404).json({ error: 'Concesionaria no encontrada' });

    let sql = "SELECT * FROM autos WHERE user_id = ? AND status = 'published'";
    const params = [user.id];

    if (q) { sql += ' AND (make LIKE ? OR model LIKE ? OR location LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    if (make) { sql += ' AND make LIKE ?'; params.push(`%${make}%`); }
    if (minPrice) { sql += ' AND COALESCE(special_price, price) >= ?'; params.push(Number(minPrice)); }
    if (maxPrice) { sql += ' AND COALESCE(special_price, price) <= ?'; params.push(Number(maxPrice)); }
    sql += ' ORDER BY created_at DESC';

    const { autoRow: _autoRow } = await import('./autos.js').catch(() => ({ autoRow: null }));

    const rows = await query(sql, params);
    const parseImages = (val) => {
      if (!val) return [];
      if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
      return val;
    };
    res.json(rows.map(row => ({
      id: row.id,
      make: row.make,
      model: row.model,
      year: row.year,
      price: Number(row.price),
      specialPrice: row.special_price != null ? Number(row.special_price) : null,
      verified: !!row.verified,
      mileage: row.mileage,
      transmission: row.transmission,
      location: row.location,
      imageUrl: row.image_url,
      images: parseImages(row.images),
      dealerName: row.dealer_name,
      createdAt: row.created_at,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar vehículos' });
  }
});

// POST /concesionaria/public/:slug/chat  — Asistente IA del dealer
router.post('/public/:slug/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    let user = await get(`
      SELECT id, name, description, ai_provider, ai_api_key
      FROM users WHERE slug = ? AND role = 'concesionaria'
    `, [req.params.slug]);
    if (!user) return res.status(404).json({ error: 'Concesionaria no encontrada' });
    if (!user.ai_provider || !user.ai_api_key) {
      const admin = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
      if (admin && admin.ai_provider && admin.ai_api_key) {
        user.ai_provider = admin.ai_provider;
        user.ai_api_key = admin.ai_api_key;
      }
    }
    if (!user.ai_provider || !user.ai_api_key) {
      return res.status(400).json({ error: 'El asistente IA no está configurado en este momento.' });
    }

    // Fetch published inventory for context
    const autos = await query(
      "SELECT make, model, year, price, mileage, transmission, location FROM autos WHERE user_id = ? AND status = 'published' LIMIT 20",
      [user.id]
    );
    const inventoryText = autos.map(a =>
      `- ${a.year} ${a.make} ${a.model}: $${Number(a.price).toLocaleString('es-MX')} MXN, ${a.mileage?.toLocaleString()} km, ${a.transmission || ''}, ${a.location || ''}`
    ).join('\n');

    const prompt = `Eres el asistente virtual de la concesionaria "${user.name}".
${user.description ? `Descripción: "${user.description}"` : ''}

Inventario actual disponible:
${inventoryText || 'No hay vehículos disponibles en este momento.'}

Instrucciones: Eres un asesor de ventas amable y profesional. Responde preguntas sobre el inventario, precios, financiamiento y disponibilidad. Si el cliente quiere agendar una cita o solicitar información, pide su nombre, teléfono y correo. No inventes autos ni precios que no estén en la lista.`;

    let generatedText = '';
    try {
      generatedText = await callAIProvider(user, prompt, history, message);
    } catch (e) {
      throw e;
    }

    res.json({ reply: generatedText });
  } catch (err) {
    console.error('Error Chatbot Concesionaria IA:', err.message);
    res.status(500).json({ error: 'Error del asistente virtual' });
  }
});

export default router;

