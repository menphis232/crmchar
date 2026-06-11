import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { createDealFromSolicitud } from '../crm/helpers.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/mailer.js';

const router = Router();

function gestorRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.location,
    state: row.state,
    bannerUrl: row.banner_url,
    photoUrl: row.photo_url,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    tramitesCount: row.tramites_count,
    experienceYears: row.experience_years,
    bio: row.bio,
    whatsapp: row.whatsapp,
    schedule: row.schedule,
    phone: row.phone || null,
    address: row.address || null,
    mapEmbedUrl: row.map_embed_url || null,
  };
}

router.get('/', async (req, res) => {
  try {
    const { state, minRating } = req.query;
    let sql = 'SELECT * FROM gestores WHERE 1=1';
    const params = [];
    if (state) { sql += ' AND state = ?'; params.push(state); }
    if (minRating) { sql += ' AND rating >= ?'; params.push(Number(minRating)); }
    sql += ' ORDER BY rating DESC, tramites_count DESC';
    const rows = await query(sql, params);
    res.json(rows.map(gestorRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar gestores' });
  }
});

router.get('/filters/states', async (_req, res) => {
  try {
    const rows = await query('SELECT state, COUNT(*) as count FROM gestores GROUP BY state ORDER BY count DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener filtros' });
  }
});

router.get('/me/profile', authRequired, requireRole('gestor'), async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Perfil de gestor no encontrado' });

    const services = await query(
      'SELECT id, name, time_estimate as timeEstimate, price FROM gestor_services WHERE gestor_id = ?', [row.id]);
    const solicitudes = await query(`
      SELECT id, client_name as clientName, service_name as serviceName, location, status, created_at as createdAt
      FROM solicitudes WHERE gestor_id = ? ORDER BY created_at DESC`, [row.id]);

    res.json({ ...gestorRow(row), services, solicitudes, publicUrl: `/gestores/${row.slug}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar perfil' });
  }
});

router.put('/me/profile', authRequired, requireRole('gestor'), async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Perfil no encontrado' });

    const { name, location, state, bannerUrl, photoUrl, bio, whatsapp, schedule, experienceYears, phone, address, mapEmbedUrl } = req.body;
    
    const params = [
      name, location, state, bannerUrl, photoUrl, bio, whatsapp, schedule, experienceYears, phone, address, mapEmbedUrl
    ].map(v => v === undefined ? null : v);
    params.push(req.user.id);

    await run(`
      UPDATE gestores SET
        name = COALESCE(?, name), location = COALESCE(?, location), state = COALESCE(?, state),
        banner_url = COALESCE(?, banner_url), photo_url = COALESCE(?, photo_url),
        bio = COALESCE(?, bio), whatsapp = COALESCE(?, whatsapp),
        schedule = COALESCE(?, schedule), experience_years = COALESCE(?, experience_years),
        phone = COALESCE(?, phone), address = COALESCE(?, address), map_embed_url = COALESCE(?, map_embed_url)
      WHERE user_id = ?
    `, params);

    const updated = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    res.json(gestorRow(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

router.post('/me/services', authRequired, requireRole('gestor'), async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    const { name, timeEstimate, price } = req.body;
    if (!name || !timeEstimate || price == null) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const id = uuid();
    await run('INSERT INTO gestor_services (id, gestor_id, name, time_estimate, price) VALUES (?, ?, ?, ?, ?)',
      [id, row.id, name, timeEstimate, price]);
    res.status(201).json({ id, name, timeEstimate, price });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

router.delete('/me/services/:id', authRequired, requireRole('gestor'), async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    const result = await run('DELETE FROM gestor_services WHERE id = ? AND gestor_id = ?', [req.params.id, row.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

router.patch('/me/solicitudes/:id', authRequired, requireRole('gestor'), async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    const { status } = req.body;
    if (!['nuevo', 'en_proceso', 'completado'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }
    const result = await run('UPDATE solicitudes SET status = ? WHERE id = ? AND gestor_id = ?',
      [status, req.params.id, row.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Solicitud no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar solicitud' });
  }
});

router.get('/:slugOrId', async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const row = await get(`
      SELECT g.*, u.google_analytics_id, u.page_builder_config, u.chatbot_bg_color, u.chatbot_btn_color, u.chatbot_text_color
      FROM gestores g 
      JOIN users u ON g.user_id = u.id 
      WHERE g.slug = ? OR g.id = ?`, [slugOrId, slugOrId]);
    if (!row) return res.status(404).json({ error: 'Gestor no encontrado' });

    const services = await query(
      'SELECT id, name, time_estimate as timeEstimate, price FROM gestor_services WHERE gestor_id = ?', [row.id]);
    const reviews = await query(
      'SELECT id, author, rating, comment, created_at as createdAt FROM gestor_reviews WHERE gestor_id = ? ORDER BY created_at DESC LIMIT 10',
      [row.id]);

    let pageBuilderConfig = row.page_builder_config;
    if (typeof pageBuilderConfig === 'string') {
      try { pageBuilderConfig = JSON.parse(pageBuilderConfig); } catch(e) { pageBuilderConfig = null; }
    }

    res.json({ ...gestorRow(row), google_analytics_id: row.google_analytics_id, page_builder_config: pageBuilderConfig, chatbot_bg_color: row.chatbot_bg_color, chatbot_btn_color: row.chatbot_btn_color, chatbot_text_color: row.chatbot_text_color, services, reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar gestor' });
  }
});

async function processLeadCreation(gestor, clientName, clientEmail, clientPhone, location, serviceName, customData = null) {
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
        <p>Hemos recibido tu solicitud para el trámite de <strong>${serviceName}</strong> con el gestor ${gestor.name || 'asignado'}.</p>
        <p>Te hemos creado una cuenta para que puedas hacer seguimiento a tu trámite, chatear con tu gestor y subir documentos.</p>
        <p><strong>Tus credenciales de acceso:</strong></p>
        <ul>
          <li><strong>Usuario/Email:</strong> ${clientEmail}</li>
          <li><strong>Contraseña provisional:</strong> ${tempPassword}</li>
        </ul>
        <p>Por favor, <a href="http://localhost:4200/login">inicia sesión aquí</a> y cambia tu contraseña lo antes posible.</p>
      `;
      try {
        await sendEmail(clientEmail, 'Tu cuenta ha sido creada - Seguimiento de trámite', 'Tu cuenta ha sido creada', html);
      } catch(e) {
        console.error("No se pudo enviar el correo:", e);
      }
    }
  }

  const id = uuid();
  await run(
    `INSERT INTO solicitudes (id, gestor_id, client_name, service_name, location, client_email, client_phone, custom_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, gestor.id, clientName, serviceName, location || null, clientEmail || null, clientPhone || null, customData ? JSON.stringify(customData) : null],
  );

  const service = await get('SELECT price FROM gestor_services WHERE gestor_id = ? AND name = ? LIMIT 1', [gestor.id, serviceName]);
  const estimatedValue = service ? service.price : 0;

  const solicitud = await get('SELECT * FROM solicitudes WHERE id = ?', [id]);
  
  // Format customData into a readable message if it exists
  let clientMessage = '';
  if (customData && typeof customData === 'object') {
    clientMessage = Object.entries(customData)
      .map(([question, answer]) => `**${question}:**\n${answer}`)
      .join('\n\n');
  }

  await createDealFromSolicitud(solicitud, gestor.user_id, { clientEmail, clientPhone, estimatedValue, clientMessage });

  // FASE 3.3: Automatización en tiempo real (Notificación)
  const notifId = uuid();
  await run(
    'INSERT INTO notifications (id, user_id, type, title, body) VALUES (?, ?, ?, ?, ?)',
    [notifId, gestor.user_id, 'nuevo_lead', 'Nueva Solicitud Recibida', `Tienes un nuevo trámite de ${serviceName} de ${clientName}.`]
  );

  return id;
}

router.post('/:id/solicitudes', async (req, res) => {
  try {
    const gestor = await get('SELECT id, user_id FROM gestores WHERE id = ? OR slug = ?', [req.params.id, req.params.id]);
    if (!gestor) return res.status(404).json({ error: 'Gestor no encontrado' });

    const { clientName, serviceName, location, clientEmail, clientPhone, customData } = req.body;
    if (!clientName || !serviceName) {
      return res.status(400).json({ error: 'Nombre y servicio requeridos' });
    }

    // Calls the extracted function
    const id = await processLeadCreation(gestor, clientName, clientEmail, clientPhone, location, serviceName, customData);

    res.status(201).json({ id, status: 'nuevo' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear solicitud' });
  }
});

router.get('/:slugOrId/track/:code', async (req, res) => {
  try {
    const { slugOrId, code } = req.params;
    const gestor = await get('SELECT id, user_id FROM gestores WHERE id = ? OR slug = ?', [slugOrId, slugOrId]);
    if (!gestor) return res.status(404).json({ error: 'Gestor no encontrado' });

    const deal = await get(
      `SELECT stage, title, updated_at FROM crm_deals 
       WHERE user_id = ? AND tracking_code = ? AND deal_type = 'tramite'`,
      [gestor.user_id, code.toUpperCase()]
    );

    if (!deal) return res.status(404).json({ error: 'Código de seguimiento no válido para este gestor.' });

    res.json({
      title: deal.title,
      stage: deal.stage,
      updatedAt: deal.updated_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al rastrear trámite' });
  }
});

// FASE 3.2: Reviews
router.get('/review-context/:dealId', async (req, res) => {
  try {
    const deal = await get(`
      SELECT d.id, d.title, d.stage, g.name as gestor_name, g.id as gestor_id
      FROM crm_deals d
      JOIN gestores g ON g.user_id = d.user_id
      WHERE d.id = ? AND d.deal_type = 'tramite'
    `, [req.params.dealId]);
    
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    if (deal.stage !== 'completado') return res.status(400).json({ error: 'El trámite aún no está completado.' });

    const review = await get('SELECT id FROM gestor_reviews WHERE deal_id = ?', [deal.id]);
    if (review) return res.status(400).json({ error: 'Ya has calificado este trámite anteriormente.' });

    res.json({
      dealId: deal.id,
      title: deal.title,
      gestorName: deal.gestor_name,
      gestorId: deal.gestor_id
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener contexto de reseña' });
  }
});

router.post('/review/:dealId', async (req, res) => {
  try {
    const { rating, comment, authorName } = req.body;
    if (!rating || rating < 1 || rating > 5 || !comment || !authorName) {
      return res.status(400).json({ error: 'Datos de reseña incompletos o inválidos.' });
    }

    const deal = await get(`
      SELECT d.id, g.id as gestor_id 
      FROM crm_deals d
      JOIN gestores g ON g.user_id = d.user_id
      WHERE d.id = ? AND d.deal_type = 'tramite' AND d.stage = 'completado'
    `, [req.params.dealId]);
    
    if (!deal) return res.status(404).json({ error: 'Trámite no válido para calificar.' });

    const existing = await get('SELECT id FROM gestor_reviews WHERE deal_id = ?', [deal.id]);
    if (existing) return res.status(400).json({ error: 'Ya has calificado este trámite.' });

    const id = uuid();
    await run(
      'INSERT INTO gestor_reviews (id, gestor_id, deal_id, author, rating, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [id, deal.gestor_id, deal.id, authorName, rating, comment]
    );

    // Actualizar rating y review_count del gestor
    const stats = await get('SELECT AVG(rating) as avgRating, COUNT(*) as cnt FROM gestor_reviews WHERE gestor_id = ?', [deal.gestor_id]);
    await run('UPDATE gestores SET rating = ?, review_count = ? WHERE id = ?', [stats.avgRating || 0, stats.cnt || 0, deal.gestor_id]);

    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar reseña' });
  }
});

// FASE 4: Chatbot Público
router.post('/:slugOrId/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    const gestor = await get('SELECT user_id, name, bio FROM gestores WHERE slug = ? OR id = ?', [req.params.slugOrId, req.params.slugOrId]);
    if (!gestor) return res.status(404).json({ error: 'Gestor no encontrado' });

    const user = await get('SELECT ai_provider, ai_api_key FROM users WHERE id = ?', [gestor.user_id]);
    if (!user || !user.ai_provider || !user.ai_api_key) {
      return res.status(400).json({ error: 'El gestor no tiene configurado el asistente IA en este momento.' });
    }

    const services = await query('SELECT name, time_estimate, price FROM gestor_services WHERE gestor_id = (SELECT id FROM gestores WHERE user_id = ?)', [gestor.user_id]);
    let servicesText = services.map(s => `- ${s.name}: $${s.price} MXN, demora aprox ${s.time_estimate}`).join('\n');

    let prompt = `Eres el asistente virtual público de un gestor vehicular llamado "${gestor.name}".
Aquí está su biografía: "${gestor.bio || 'Gestor profesional.'}"
Y aquí están sus servicios y precios actuales:
${servicesText || 'No hay servicios listados.'}

Instrucciones IMPORTANTES: Eres amable, profesional y actúas como un agente de ventas. 
1. Si el cliente quiere iniciar un trámite o contratar un servicio, DEBES pedirle que te proporcione sus datos para registrar su solicitud.
2. Los datos que necesitas obligatoriamente son: Su Nombre completo, su Correo electrónico, su Teléfono o WhatsApp, su Ubicación (Ciudad/Estado), y el Servicio que desea contratar.
3. Pregunta estos datos de forma natural y conversacional, uno a uno o todos juntos si fluye bien en la plática.
4. NUNCA inventes precios o servicios.
5. UNA VEZ QUE TENGAS TODOS ESTOS DATOS Y EL CLIENTE CONFIRME QUE DESEA CONTINUAR, debes añadir EXACTAMENTE al FINAL de tu respuesta el siguiente bloque JSON. NUNCA añadas este bloque si faltan datos.
\`\`\`json
{"action": "create_lead", "clientName": "...", "clientEmail": "...", "clientPhone": "...", "location": "...", "serviceName": "..."}
\`\`\`
Reemplaza los "..." con los datos recolectados. El servicio debe coincidir exactamente con uno de la lista de servicios.`;

    let generatedText = '';

    if (user.ai_provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(user.ai_api_key);
      const modelsToTry = ['gemini-3.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro'];
      
      let lastError;
      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const chat = model.startChat({
            history: history ? history.map((h) => ({
              role: h.role === 'user' ? 'user' : 'model',
              parts: [{ text: h.content }]
            })) : []
          });
          const result = await chat.sendMessage(prompt + "\n\nPregunta del usuario: " + message);
          const response = await result.response;
          generatedText = response.text();
          break; // success
        } catch (err) {
          lastError = err;
          continue; // Always try the next model on any error (404, 503, 403, etc)
        }
      }
      if (!generatedText && lastError) {
        throw lastError;
      }
    } else if (user.ai_provider === 'openai') {
      let msgs = [
        { role: 'system', content: prompt }
      ];
      if (history) {
        msgs = msgs.concat(history.map(h => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })));
      }
      msgs.push({ role: 'user', content: message });

      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.ai_api_key}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: msgs,
          max_tokens: 250,
          temperature: 0.7
        })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message);
      generatedText = data.choices[0].message.content;
    } else {
      return res.status(400).json({ error: 'Proveedor de IA no soportado' });
    }

    // Extract JSON block if AI decided to create a lead
    const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data.action === 'create_lead') {
          // Call the lead creation logic
          await processLeadCreation(gestor, data.clientName, data.clientEmail, data.clientPhone, data.location, data.serviceName);
          // Remove the JSON block from the generated text so the user doesn't see it
          generatedText = generatedText.replace(/```json\n[\s\S]*?\n```/, '').trim();
          if (!generatedText) {
            generatedText = "¡Excelente! He registrado tu solicitud. Te hemos enviado un correo con los detalles y pronto nos pondremos en contacto contigo.";
          }
        }
      } catch (e) {
        console.error("Error parsing AI JSON output:", e);
      }
    }

    res.json({ reply: generatedText });
  } catch (err) {
    console.error('Error Chatbot IA:', err.message);
    res.status(500).json({ error: 'Error del asistente virtual' });
  }
});

export default router;
