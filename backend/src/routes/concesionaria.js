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

    const stats = await get(`
      SELECT COUNT(*) as autosCount, AVG(r.rating) as avgRating, COUNT(r.id) as reviewCount
      FROM autos a
      LEFT JOIN concesionaria_reviews r ON r.user_id = a.user_id
      WHERE a.user_id = ? AND a.status = 'published'
    `, [user.id]);

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
      autosCount: stats.autosCount || 0,
      rating: stats.avgRating ? Number(Number(stats.avgRating).toFixed(1)) : 0,
      reviewCount: stats.reviewCount || 0,
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
    if (minPrice) { sql += ' AND price >= ?'; params.push(Number(minPrice)); }
    if (maxPrice) { sql += ' AND price <= ?'; params.push(Number(maxPrice)); }
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

    if (user.ai_provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(user.ai_api_key);
      const modelsToTry = ['gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
      let lastError;
      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const chat = model.startChat({
            history: history ? history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })) : []
          });
          const result = await chat.sendMessage(prompt + '\n\nPregunta del cliente: ' + message);
          generatedText = (await result.response).text();
          break;
        } catch (err) { lastError = err; continue; }
      }
      if (!generatedText && lastError) throw lastError;
    } else if (user.ai_provider === 'openai') {
      let msgs = [{ role: 'system', content: prompt }];
      if (history) msgs = msgs.concat(history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })));
      msgs.push({ role: 'user', content: message });
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.ai_api_key}` },
        body: JSON.stringify({ model: 'gpt-3.5-turbo', messages: msgs, max_tokens: 300, temperature: 0.7 })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);
      generatedText = data.choices[0].message.content;
    } else {
      return res.status(400).json({ error: 'Proveedor de IA no soportado' });
    }

    res.json({ reply: generatedText });
  } catch (err) {
    console.error('Error Chatbot Concesionaria IA:', err.message);
    res.status(500).json({ error: 'Error del asistente virtual' });
  }
});

export default router;

