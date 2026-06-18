/**
 * ai.js — Proxy seguro para el asistente de IA
 * ===============================================
 * Expone un endpoint de chat que usa la API Key global del admin.
 * Los paneles (gestor, concesionaria, admin) consumen esta ruta.
 */

import { Router } from 'express';
import { get, query, run } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { sendEmail } from '../utils/mailer.js';
import { findOrCreateContact, createManualVentaDeal } from '../crm/helpers.js';
import { v4 as uuid } from 'uuid';

const router = Router();

/**
 * GET /api/ai/config
 * Devuelve solo el proveedor configurado (sin exponer la key).
 */
router.get('/config', authRequired, async (req, res) => {
  try {
    const userRow = await get("SELECT ai_provider FROM users WHERE id = ?", [req.user.id]);
    if (userRow?.ai_provider) {
      return res.json({ provider: userRow.ai_provider });
    }
    const admin = await get("SELECT ai_provider FROM users WHERE role = 'admin' LIMIT 1");
    res.json({ provider: admin?.ai_provider || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener config de IA' });
  }
});

/**
 * POST /api/ai/chat
 * Body: { message, history, context }
 */
router.post('/chat', authRequired, async (req, res) => {
  try {
    const { message, history = [], context = '' } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    const userId = req.user.id;
    const userRole = req.user.role;

    // 1. Config IA (usuario o admin)
    let config = await get("SELECT ai_provider, ai_api_key FROM users WHERE id = ?", [userId]);
    if (!config || !config.ai_provider || !config.ai_api_key) {
      config = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
    }
    if (!config || !config.ai_provider || !config.ai_api_key) {
      return res.status(503).json({ error: 'No hay configuración de IA disponible.' });
    }

    const { ai_api_key: apiKeyStr } = config;
    let aiConfigs = [];
    try {
      if (apiKeyStr.trim().startsWith('[')) {
        aiConfigs = JSON.parse(apiKeyStr);
      } else {
        const keys = apiKeyStr.split(',').map(k => k.trim()).filter(Boolean);
        aiConfigs = keys.map(k => ({ provider: config.ai_provider, key: k }));
      }
    } catch (e) {
      aiConfigs = [{ provider: config.ai_provider, key: apiKeyStr }];
    }

    if (userRole !== 'admin') {
      const adminConfig = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' AND ai_api_key IS NOT NULL LIMIT 1");
      if (adminConfig?.ai_api_key) {
        try {
          if (adminConfig.ai_api_key.trim().startsWith('[')) {
            aiConfigs.push(...JSON.parse(adminConfig.ai_api_key));
          } else {
            const keys = adminConfig.ai_api_key.split(',').map(k => k.trim()).filter(Boolean);
            aiConfigs.push(...keys.map(k => ({ provider: adminConfig.ai_provider, key: k })));
          }
        } catch (e) {
          aiConfigs.push({ provider: adminConfig.ai_provider, key: adminConfig.ai_api_key });
        }
      }
    }

    const validConfigs = aiConfigs.filter(c => c.provider && c.key);
    if (!validConfigs.length) {
      return res.status(400).json({ error: 'No se encontraron configuraciones de IA válidas.' });
    }

    // ── DATOS DEL NEGOCIO ──────────────────────────────

    // Perfil del usuario (incluye prompt personalizado)
    const userProfile = await get('SELECT name, email, phone, address, description, panel_assistant_prompt FROM users WHERE id = ?', [userId]);

    // Contactos
    const contacts = await query('SELECT name, email FROM contacts WHERE user_id = ? AND email IS NOT NULL LIMIT 50', [userId]);
    const contactsStr = contacts.length
      ? contacts.map(c => `- ${c.name} (${c.email})`).join('\n')
      : '(Sin contactos guardados aún)';

    // Leads/trámites activos
    const dealsQ = await query(`
      SELECT d.id, d.title, d.stage, d.estimated_value, d.auto_id,
             c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
             a.make, a.model, a.year
      FROM crm_deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN autos a ON d.auto_id = a.id
      WHERE d.user_id = ? AND d.stage NOT IN ('won', 'lost', 'perdido', 'vendido')
      ORDER BY d.updated_at DESC LIMIT 50
    `, [userId]);
    const fmtMoney = n => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    const dealsStr = dealsQ.length
      ? dealsQ.map(d => {
          const vehicle = d.make ? `${d.make} ${d.model} ${d.year}` : '';
          const val = d.estimated_value ? ` | Valor: ${fmtMoney(d.estimated_value)}` : '';
          const veh = vehicle ? ` | Vehículo: ${vehicle}` : '';
          return `- ID: ${d.id} | Cliente: ${d.contact_name || 'Sin contacto'} | Título: ${d.title} | Etapa: ${d.stage}${veh}${val}`;
        }).join('\n')
      : '(Sin leads/trámites activos)';

    // Finanzas — dashboard rápido
    const finRows = await query(
      `SELECT type, SUM(amount) as total FROM fin_transactions WHERE user_id = ? GROUP BY type`,
      [userId]
    );
    let finIncome = 0, finExpense = 0;
    finRows.forEach(r => {
      if (r.type === 'income') finIncome = Number(r.total);
      if (r.type === 'expense') finExpense = Number(r.total);
    });
    const finBalance = finIncome - finExpense;

    // Últimas transacciones (5)
    const recentTx = await query(
      `SELECT f.type, f.amount, f.description, f.date, f.payment_method, f.referencia,
              COALESCE(CONCAT(a.make, ' ', a.model, ' ', a.year), d.title) as link_label
       FROM fin_transactions f
       LEFT JOIN crm_deals d ON f.deal_id = d.id
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ?
       ORDER BY f.date DESC, f.created_at DESC LIMIT 5`,
      [userId]
    );
    const recentTxStr = recentTx.length
      ? recentTx.map(t => `- [${t.type === 'income' ? 'Ingreso' : 'Gasto'}] ${fmtMoney(t.amount)} | ${t.description} | ${t.date} | ${t.payment_method || 'general'}${t.referencia ? ` | Ref: ${t.referencia}` : ''}${t.link_label ? ` | Vehículo/Lead: ${t.link_label}` : ''}`).join('\n')
      : '(Sin transacciones recientes)';

    // Inventario (solo concesionaria)
    let inventoryStr = '';
    if (userRole === 'concesionaria') {
      const autos = await query(
        `SELECT id, make, model, year, price, special_price, status, mileage, transmission, location
         FROM autos WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
        [userId]
      );
      inventoryStr = autos.length
        ? autos.map(a => {
            const p = a.special_price ? `${fmtMoney(a.special_price)} (antes ${fmtMoney(a.price)})` : fmtMoney(a.price);
            return `- ID: ${a.id} | ${a.make} ${a.model} ${a.year} | ${p} | ${a.mileage?.toLocaleString()} km | ${a.transmission} | ${a.status} | ${a.location || 'Sin ubicación'}`;
          }).join('\n')
        : '(Sin vehículos en inventario)';
    }

    // ── SYSTEM PROMPT ──────────────────────────────────

    const roleName = userRole === 'gestor' ? 'Gestor de Trámites'
      : userRole === 'concesionaria' ? 'Concesionaria'
      : 'Administrador';

    const customPrompt = userProfile?.panel_assistant_prompt?.trim();
    let systemPrompt = `Eres un asistente virtual inteligente del panel de TrámitesVehicularesdeMéxico.mx.
Eres amigable, profesional y muy útil. Ayudas a ${roleName}s a gestionar su negocio.
Respondes SIEMPRE en español mexicano, de forma concisa y clara.
Si no sabes algo específico del sistema, sugiere al usuario que contacte soporte.${customPrompt ? `\n\nINSTRUCCIONES PERSONALIZADAS DEL NEGOCIO:\n${customPrompt}` : ''}`;

    systemPrompt += `

══════════════════════════════════════════
DATOS ACTUALES DEL NEGOCIO (${new Date().toLocaleDateString('es-MX')})
══════════════════════════════════════════

PERFIL DEL USUARIO:
Nombre: ${userProfile?.name || 'No definido'}
Email: ${userProfile?.email || ''}
Teléfono: ${userProfile?.phone || 'No definido'}
Dirección: ${userProfile?.address || 'No definida'}
Descripción: ${userProfile?.description || 'No definida'}

FINANZAS (acumulado total):
  Ingresos: ${fmtMoney(finIncome)}
  Gastos:   ${fmtMoney(finExpense)}
  Balance:  ${fmtMoney(finBalance)}

ÚLTIMAS 5 TRANSACCIONES:
${recentTxStr}

LEADS/TRÁMITES ACTIVOS (${dealsQ.length}):
${dealsStr}
`;

    if (userRole === 'concesionaria') {
      systemPrompt += `
INVENTARIO DE VEHÍCULOS (${inventoryStr.split('\n').length} vehículos):
${inventoryStr}
`;
    }

    systemPrompt += `
CONTACTOS (para envío de correos):
${contactsStr}

══════════════════════════════════════════
SUPERPODERES (ACCIONES QUE PUEDES EJECUTAR)
══════════════════════════════════════════

**SUPERPODER 1 — Enviar correo electrónico**
Si el usuario pide enviar un correo, incluye EXACTAMENTE:
[SEND_EMAIL]
{
  "to": "correo@destino.com",
  "subject": "Asunto",
  "body": "Cuerpo del correo"
}
[/SEND_EMAIL]

**SUPERPODER 2 — Enviar mensaje al chat interno de un lead**
Si el usuario pide enviar un mensaje a un cliente por su lead, incluye EXACTAMENTE:
[SEND_CHAT]
{
  "deal_id": "ID del lead aquí",
  "message": "Texto del mensaje"
}
[/SEND_CHAT]
REGLA DE AMBIGÜEDAD: si hay varios leads con el mismo nombre de cliente, pregunta cuál antes de actuar.

**SUPERPODER 3 — Crear lead de venta**
Si el usuario pide crear un lead/cliente/prospecto, incluye EXACTAMENTE:
[CREATE_LEAD]
{
  "clientName": "Nombre del cliente",
  "clientEmail": "correo@opcional.com",
  "clientPhone": "5512345678",
  "title": "Título del lead (ej: Toyota Corolla 2022)",
  "autoId": null,
  "estimatedValue": 0,
  "message": "Nota inicial opcional"
}
[/CREATE_LEAD]
NOTA: Si el usuario menciona un vehículo del inventario, usa el ID del auto (del inventario) en "autoId".

**SUPERPODER 4 — Registrar ingreso o gasto en finanzas**
Si el usuario pide cargar/registrar un ingreso o gasto, incluye EXACTAMENTE:
[CREATE_TRANSACTION]
{
  "type": "income",
  "amount": 5000,
  "description": "Descripción clara",
  "date": "${new Date().toISOString().split('T')[0]}",
  "payment_method": "efectivo",
  "referencia": "Folio o referencia opcional",
  "deal_id": null,
  "category": "general"
}
[/CREATE_TRANSACTION]
REGLAS:
- "type" puede ser "income" (ingreso) o "expense" (gasto)
- "payment_method" puede ser: efectivo, transferencia, mercadopago, stripe, general, u otro método configurado
- Si el usuario menciona un lead/vehículo específico, coloca su "deal_id" del listado de leads activos
- La fecha de hoy es ${new Date().toISOString().split('T')[0]}
`;

    if (userRole === 'concesionaria') {
      systemPrompt += `
**SUPERPODER 5 — Agregar vehículo al inventario**
Si el usuario pide agregar/publicar un vehículo, incluye EXACTAMENTE:
[CREATE_AUTO]
{
  "make": "Toyota",
  "model": "Corolla",
  "year": 2022,
  "price": 350000,
  "mileage": 15000,
  "transmission": "Automático",
  "location": "Ciudad de México",
  "description": "Descripción del vehículo",
  "status": "draft"
}
[/CREATE_AUTO]
REGLAS:
- "status" puede ser "draft" (borrador) o "published" (publicado)
- "transmission" puede ser "Automático" o "Manual"
- Si el usuario no menciona status, usa "draft" para que revise antes de publicar
`;
    }

    systemPrompt += `
**SUPERPODER 6 — Actualizar perfil**
Si el usuario pide cambiar su nombre, teléfono, dirección o descripción del negocio, incluye EXACTAMENTE:
[UPDATE_PROFILE]
{
  "name": "Nuevo nombre",
  "phone": "5512345678",
  "address": "Calle y ciudad",
  "description": "Descripción del negocio"
}
[/UPDATE_PROFILE]
REGLA: Solo incluye los campos que el usuario pidió cambiar explícitamente.

══════════════════════════════════════════
REGLAS CRÍTICAS PARA ACCIONES:
- SIEMPRE confirma al usuario qué acción ejecutaste y con qué datos.
- Si faltan datos obligatorios (ej: nombre del cliente para un lead), pregunta antes de actuar.
- NUNCA inventes datos que el usuario no proporcionó.
- Puedes ejecutar múltiples superpoderes en una sola respuesta si el usuario lo requiere.
══════════════════════════════════════════
`;

    // ── LLAMADA AL LLM ──────────────────────────────────

    let reply = '';
    let lastGlobalError = null;

    const geminiHistory = history.map(h => ({
      role: (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));
    while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') geminiHistory.shift();

    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: (h.role === 'assistant' || h.role === 'model') ? 'assistant' : 'user', content: h.content })),
      { role: 'user', content: message }
    ];

    keyLoop: for (const cfg of validConfigs) {
      const { provider, key } = cfg;

      if (provider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
        const genAI = new GoogleGenerativeAI(key);

        for (const modelName of modelsToTry) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
            const chat = model.startChat({ history: geminiHistory, generationConfig: { temperature: 0.7, maxOutputTokens: 1500 } });
            const result = await chat.sendMessage(message);
            reply = result.response.text();
            break keyLoop;
          } catch (err) {
            lastGlobalError = err;
            if (err.message && err.message.includes('404')) continue;
            break;
          }
        }
      } else if (provider === 'openai' || provider === 'deepseek') {
        const endpoint = provider === 'deepseek'
          ? 'https://api.deepseek.com/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';
        const modelName = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: modelName, messages: openAiMessages, max_tokens: 1500, temperature: 0.7 })
          });
          if (!response.ok) {
            lastGlobalError = new Error(await response.text());
            continue;
          }
          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
          break keyLoop;
        } catch (err) {
          lastGlobalError = err;
          continue;
        }
      }
    }

    if (!reply) {
      console.error('AI error:', lastGlobalError);
      return res.status(502).json({ error: 'Error al conectar con los proveedores de IA. ' + (lastGlobalError?.message || '') });
    }

    // ── INTERCEPTAR ACCIONES ────────────────────────────

    // SEND_EMAIL
    const emailMatch = reply.match(/\[SEND_EMAIL\]([\s\S]*?)\[\/SEND_EMAIL\]/);
    if (emailMatch) {
      try {
        const emailData = JSON.parse(emailMatch[1]);
        if (emailData.to && emailData.subject && emailData.body) {
          await sendEmail(emailData.to, emailData.subject, emailData.body, null, userId);
          reply = reply.replace(/\[SEND_EMAIL\][\s\S]*?\[\/SEND_EMAIL\]/, `\n\n📧 *¡Correo enviado a ${emailData.to} exitosamente!*`);
        }
      } catch (e) {
        console.error('Error email from AI:', e);
        reply = reply.replace(/\[SEND_EMAIL\][\s\S]*?\[\/SEND_EMAIL\]/, '\n\n❌ *Error al enviar el correo.*');
      }
    }

    // SEND_CHAT
    const chatMatch = reply.match(/\[SEND_CHAT\]([\s\S]*?)\[\/SEND_CHAT\]/);
    if (chatMatch) {
      try {
        const chatData = JSON.parse(chatMatch[1]);
        if (chatData.deal_id && chatData.message) {
          const msgId = uuid();
          await run(`INSERT INTO chat_messages (id, deal_id, sender_id, message) VALUES (?, ?, ?, ?)`, [msgId, chatData.deal_id, userId, chatData.message]);
          const dealInfo = await get('SELECT c.user_id as client_user_id FROM crm_deals d JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?', [chatData.deal_id]);
          if (dealInfo?.client_user_id) {
            const notifId = uuid();
            const title = 'Nuevo mensaje en tu trámite';
            const body = chatData.message.substring(0, 100);
            await run(`INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, 'new_message', ?, ?, ?)`, [notifId, dealInfo.client_user_id, title, body, chatData.deal_id]);
            const io = req.app.get('io');
            if (io) {
              io.to('user_' + dealInfo.client_user_id).emit('notification', { id: notifId, type: 'new_message', title, body, ref_id: chatData.deal_id, is_read: 0, created_at: new Date().toISOString() });
              io.to(chatData.deal_id).emit('receive_message', { id: msgId, dealId: chatData.deal_id, message: chatData.message, senderId: userId, senderName: req.user.name || 'Asistente IA', created_at: new Date().toISOString() });
            }
          }
          reply = reply.replace(/\[SEND_CHAT\][\s\S]*?\[\/SEND_CHAT\]/, '\n\n💬 *¡Mensaje enviado al chat del lead exitosamente!*');
        }
      } catch (e) {
        console.error('Error send_chat from AI:', e);
        reply = reply.replace(/\[SEND_CHAT\][\s\S]*?\[\/SEND_CHAT\]/, '\n\n❌ *Error al enviar el mensaje al chat.*');
      }
    }

    // CREATE_LEAD
    const leadMatch = reply.match(/\[CREATE_LEAD\]([\s\S]*?)\[\/CREATE_LEAD\]/);
    if (leadMatch) {
      try {
        const leadData = JSON.parse(leadMatch[1]);
        if (!leadData.clientName?.trim()) throw new Error('clientName requerido');
        const dealId = await createManualVentaDeal(userId, {
          clientName: leadData.clientName,
          clientEmail: leadData.clientEmail || null,
          clientPhone: leadData.clientPhone || null,
          title: leadData.title || null,
          autoId: leadData.autoId || null,
          estimatedValue: leadData.estimatedValue || 0,
          message: leadData.message || null,
          stage: 'lead_nuevo',
        });
        reply = reply.replace(/\[CREATE_LEAD\][\s\S]*?\[\/CREATE_LEAD\]/, `\n\n✅ *Lead creado exitosamente* — **${leadData.clientName}** fue registrado como nuevo lead (ID: \`${dealId}\`). Puedes verlo en tu embudo CRM.`);
      } catch (e) {
        console.error('Error create_lead from AI:', e);
        reply = reply.replace(/\[CREATE_LEAD\][\s\S]*?\[\/CREATE_LEAD\]/, `\n\n❌ *Error al crear el lead: ${e.message}*`);
      }
    }

    // CREATE_TRANSACTION
    const txMatch = reply.match(/\[CREATE_TRANSACTION\]([\s\S]*?)\[\/CREATE_TRANSACTION\]/);
    if (txMatch) {
      try {
        const txData = JSON.parse(txMatch[1]);
        if (!txData.type || !txData.amount || !txData.description || !txData.date) throw new Error('Faltan campos obligatorios (type, amount, description, date)');
        const txId = uuid();
        await run(
          'INSERT INTO fin_transactions (id, user_id, deal_id, type, amount, description, category, date, payment_method, referencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [txId, userId, txData.deal_id || null, txData.type, Number(txData.amount), txData.description, txData.category || 'general', txData.date, txData.payment_method || 'general', txData.referencia?.trim() || null]
        );
        const typeLabel = txData.type === 'income' ? 'Ingreso' : 'Gasto';
        reply = reply.replace(/\[CREATE_TRANSACTION\][\s\S]*?\[\/CREATE_TRANSACTION\]/, `\n\n✅ *${typeLabel} registrado exitosamente* — **${fmtMoney(txData.amount)}** | "${txData.description}" | ${txData.date}${txData.referencia ? ` | Ref: ${txData.referencia}` : ''}. Puedes verlo en el módulo de Finanzas.`);
      } catch (e) {
        console.error('Error create_transaction from AI:', e);
        reply = reply.replace(/\[CREATE_TRANSACTION\][\s\S]*?\[\/CREATE_TRANSACTION\]/, `\n\n❌ *Error al registrar la transacción: ${e.message}*`);
      }
    }

    // CREATE_AUTO (solo concesionaria)
    const autoMatch = reply.match(/\[CREATE_AUTO\]([\s\S]*?)\[\/CREATE_AUTO\]/);
    if (autoMatch) {
      try {
        if (userRole !== 'concesionaria') throw new Error('Solo concesionarias pueden agregar vehículos');
        const autoData = JSON.parse(autoMatch[1]);
        if (!autoData.make || !autoData.model || !autoData.year || !autoData.price) throw new Error('Faltan campos obligatorios (make, model, year, price)');
        const autoId = uuid();
        await run(
          `INSERT INTO autos (id, user_id, make, model, year, price, mileage, transmission, location, description, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [autoId, userId, autoData.make, autoData.model, Number(autoData.year), Number(autoData.price), Number(autoData.mileage || 0), autoData.transmission || 'Automático', autoData.location || null, autoData.description || null, autoData.status === 'published' ? 'published' : 'draft']
        );
        const statusLabel = autoData.status === 'published' ? 'publicado' : 'guardado como borrador';
        reply = reply.replace(/\[CREATE_AUTO\][\s\S]*?\[\/CREATE_AUTO\]/, `\n\n✅ *Vehículo ${statusLabel}* — **${autoData.make} ${autoData.model} ${autoData.year}** (${fmtMoney(autoData.price)}) fue agregado a tu inventario (ID: \`${autoId}\`). Puedes editarlo desde la sección Inventario.`);
      } catch (e) {
        console.error('Error create_auto from AI:', e);
        reply = reply.replace(/\[CREATE_AUTO\][\s\S]*?\[\/CREATE_AUTO\]/, `\n\n❌ *Error al agregar el vehículo: ${e.message}*`);
      }
    }

    // UPDATE_PROFILE
    const profileMatch = reply.match(/\[UPDATE_PROFILE\]([\s\S]*?)\[\/UPDATE_PROFILE\]/);
    if (profileMatch) {
      try {
        const profileData = JSON.parse(profileMatch[1]);
        const sets = [];
        const params = [];
        if (profileData.name) { sets.push('name = ?'); params.push(profileData.name); }
        if (profileData.phone !== undefined) { sets.push('phone = ?'); params.push(profileData.phone || null); }
        if (profileData.address !== undefined) { sets.push('address = ?'); params.push(profileData.address || null); }
        if (profileData.description !== undefined) { sets.push('description = ?'); params.push(profileData.description || null); }
        if (sets.length) {
          params.push(userId);
          await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
          reply = reply.replace(/\[UPDATE_PROFILE\][\s\S]*?\[\/UPDATE_PROFILE\]/, `\n\n✅ *Perfil actualizado* — Los cambios han sido guardados: ${sets.map(s => s.split(' =')[0]).join(', ')}. Recarga la página para ver los cambios.`);
        }
      } catch (e) {
        console.error('Error update_profile from AI:', e);
        reply = reply.replace(/\[UPDATE_PROFILE\][\s\S]*?\[\/UPDATE_PROFILE\]/, `\n\n❌ *Error al actualizar el perfil: ${e.message}*`);
      }
    }

    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Error interno al procesar tu mensaje' });
  }
});

export default router;
