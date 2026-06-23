import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import { createDealFromSolicitud } from '../crm/helpers.js';
import bcrypt from 'bcryptjs';
import { sendEmail } from '../utils/mailer.js';
import { callAIProvider } from '../utils/ai_helper.js';
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
    logoUrl: row.logo_url || null,
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
    let sql = `SELECT g.*, u.logo_url FROM gestores g JOIN users u ON g.user_id = u.id WHERE 1=1`;
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

router.get('/me/profile', authRequired, requireRole('gestor'), requireActiveSubscription, async (req, res) => {
  try {
    const row = await get(`
      SELECT g.*, u.logo_url
      FROM gestores g
      JOIN users u ON g.user_id = u.id
      WHERE g.user_id = ?`, [req.user.id]);
    if (!row) return res.status(404).json({ error: 'Perfil de gestor no encontrado' });

    const services = await query(
      'SELECT id, name, time_estimate as timeEstimate, price, required_documents FROM gestor_services WHERE gestor_id = ?', [row.id]);
    services.forEach(s => {
      try { s.required_documents = typeof s.required_documents === 'string' ? JSON.parse(s.required_documents) : s.required_documents; } catch(e) {}
    });
    const solicitudes = await query(`
      SELECT id, client_name as clientName, service_name as serviceName, location, status, created_at as createdAt
      FROM solicitudes WHERE gestor_id = ? ORDER BY created_at DESC`, [row.id]);

    res.json({ ...gestorRow(row), services, solicitudes, publicUrl: `/gestores/${row.slug}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar perfil' });
  }
});

router.put('/me/profile', authRequired, requireRole('gestor'), requireActiveSubscription, async (req, res) => {
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

router.post('/me/services', authRequired, requireRole('gestor'), requireActiveSubscription, async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    const { name, timeEstimate, price, required_documents } = req.body;
    if (!name || !timeEstimate || price == null) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
    const id = uuid();
    let docs = [];
    if (required_documents && Array.isArray(required_documents)) {
      docs = required_documents;
    } else if (typeof required_documents === 'string') {
      docs = required_documents.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (docs.length === 0) docs = ['INE', 'Tarjeta de Circulación', 'Factura de Origen'];

    await run('INSERT INTO gestor_services (id, gestor_id, name, time_estimate, price, required_documents) VALUES (?, ?, ?, ?, ?, ?)',
      [id, row.id, name, timeEstimate, price, JSON.stringify(docs)]);
    res.status(201).json({ id, name, timeEstimate, price, required_documents: docs });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear servicio' });
  }
});

router.delete('/me/services/:id', authRequired, requireRole('gestor'), requireActiveSubscription, async (req, res) => {
  try {
    const row = await get('SELECT * FROM gestores WHERE user_id = ?', [req.user.id]);
    const result = await run('DELETE FROM gestor_services WHERE id = ? AND gestor_id = ?', [req.params.id, row.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar servicio' });
  }
});

router.patch('/me/solicitudes/:id', authRequired, requireRole('gestor'), requireActiveSubscription, async (req, res) => {
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
      SELECT g.*, u.google_analytics_id, u.page_builder_config, u.chatbot_bg_color, u.chatbot_btn_color, u.chatbot_text_color, u.logo_url
      FROM gestores g 
      JOIN users u ON g.user_id = u.id 
      WHERE g.slug = ? OR g.id = ?`, [slugOrId, slugOrId]);
    if (!row) return res.status(404).json({ error: 'Gestor no encontrado' });

    const services = await query(
      'SELECT id, name, time_estimate as timeEstimate, price, required_documents FROM gestor_services WHERE gestor_id = ?', [row.id]);
    services.forEach(s => {
      try { s.required_documents = typeof s.required_documents === 'string' ? JSON.parse(s.required_documents) : s.required_documents; } catch(e) {}
    });
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

function extractCreateLeadAction(text) {
  const blockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (blockMatch) {
    try {
      const data = JSON.parse(blockMatch[1].trim());
      if (data.action === 'create_lead') return data;
    } catch { /* try other patterns */ }
  }
  const inlineMatch = text.match(/\{[\s\S]*?"action"\s*:\s*"create_lead"[\s\S]*?\}/);
  if (inlineMatch) {
    try {
      const data = JSON.parse(inlineMatch[0]);
      if (data.action === 'create_lead') return data;
    } catch { /* ignore */ }
  }
  return null;
}

async function processLeadCreation(gestor, clientName, clientEmail, clientPhone, location, serviceName, customData = null) {
  if (!gestor?.id || !gestor?.user_id) {
    throw new Error('Gestor inválido: falta id o user_id');
  }
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
        <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Hemos recibido tu solicitud para el trámite de <strong>${serviceName}</strong> con el gestor ${gestor.name || 'asignado'}.</p>
        <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Te hemos creado una cuenta para que puedas hacer seguimiento a tu trámite, chatear con tu gestor y subir documentos.</p>
        
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
        await sendEmail(clientEmail, 'Tu cuenta ha sido creada - Seguimiento de trámite', 'Tu cuenta ha sido creada', html, gestor.user_id);
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

  const dealId = await createDealFromSolicitud(solicitud, gestor.user_id, { clientEmail, clientPhone, estimatedValue, clientMessage });

  // FASE 3.3: Automatización en tiempo real (Notificación)
  const notifId = uuid();
  await run(
    'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
    [notifId, gestor.user_id, 'nuevo_lead', 'Nueva Solicitud Recibida', `Tienes un nuevo trámite de ${serviceName} de ${clientName}.`, dealId]
  );

  return { id, dealId };
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
    const result = await processLeadCreation(gestor, clientName, clientEmail, clientPhone, location, serviceName, customData);

    const io = req.app.get('io');
    if (io) {
      io.to('user_' + gestor.user_id).emit('notification', {
        id: uuid(),
        type: 'nuevo_lead',
        title: 'Nueva Solicitud Recibida',
        body: `Tienes un nuevo trámite de ${serviceName} de ${clientName}.`,
        ref_id: result.dealId,
        is_read: 0,
        created_at: new Date().toISOString()
      });
    }

    res.status(201).json({ id: result.id, status: 'nuevo' });
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

    const user = await get('SELECT crm_stages FROM users WHERE id = ?', [gestor.user_id]);

    const deal = await get(
      `SELECT stage, title, updated_at FROM crm_deals 
       WHERE user_id = ? AND tracking_code = ? AND deal_type = 'tramite'`,
      [gestor.user_id, code.toUpperCase()]
    );

    if (!deal) return res.status(404).json({ error: 'Código de seguimiento no válido para este gestor.' });

    res.json({
      title: deal.title,
      stage: deal.stage,
      updatedAt: deal.updated_at,
      stages: user?.crm_stages ? JSON.parse(user.crm_stages) : null
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

    const gestor = await get(
      'SELECT id, user_id, name, bio FROM gestores WHERE slug = ? OR id = ? LIMIT 1',
      [req.params.slugOrId, req.params.slugOrId],
    );
    if (!gestor) return res.status(404).json({ error: 'Gestor no encontrado' });

    let user = await get('SELECT ai_provider, ai_api_key FROM users WHERE id = ?', [gestor.user_id]);
    if (!user || !user.ai_provider || !user.ai_api_key) {
      user = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
    }
    if (!user || !user.ai_provider || !user.ai_api_key) {
      return res.status(400).json({ error: 'El administrador debe configurar el asistente IA.' });
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
    try {
      generatedText = await callAIProvider(user, prompt, history, message);
    } catch (e) {
      throw e;
    }

    const leadData = extractCreateLeadAction(generatedText);
    if (leadData) {
      try {
        const result = await processLeadCreation(
          gestor,
          leadData.clientName,
          leadData.clientEmail,
          leadData.clientPhone,
          leadData.location,
          leadData.serviceName,
        );
        generatedText = generatedText.replace(/```(?:json)?\s*[\s\S]*?```/i, '').replace(/\{[\s\S]*?"action"\s*:\s*"create_lead"[\s\S]*?\}/, '').trim();
        if (!generatedText) {
          generatedText = '¡Excelente! He registrado tu solicitud. Te hemos enviado un correo con los detalles y pronto nos pondremos en contacto contigo.';
        }
        const io = req.app.get('io');
        if (io) {
          io.to('user_' + gestor.user_id).emit('notification', {
            id: uuid(),
            type: 'nuevo_lead',
            title: 'Nueva Solicitud Recibida',
            body: `Tienes un nuevo trámite de ${leadData.serviceName} de ${leadData.clientName}.`,
            ref_id: result.dealId,
            is_read: 0,
            created_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('Error creando lead desde chatbot:', e.message);
        generatedText = (generatedText.replace(/```(?:json)?\s*[\s\S]*?```/i, '').trim())
          || 'Recibí tus datos pero hubo un problema al registrar la solicitud. Por favor intenta de nuevo o contáctanos directamente.';
      }
    }

    res.json({ reply: generatedText, leadCreated: !!leadData });
  } catch (err) {
    console.error('Error Chatbot IA:', err.message);
    res.status(500).json({ error: 'Error del asistente virtual' });
  }
});

export default router;
