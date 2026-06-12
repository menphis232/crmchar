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
import { v4 as uuid } from 'uuid';

const router = Router();

/**
 * GET /api/ai/config
 * Devuelve solo el proveedor configurado (sin exponer la key).
 * Primero busca en el usuario actual, si no tiene, usa el global del admin.
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
 * Body: { message: string, history: [{role: 'user'|'assistant', content: string}], context: string }
 * Usa la API Key (propia o admin) para llamar a Gemini o OpenAI.
 */
router.post('/chat', authRequired, async (req, res) => {
  try {
    const { message, history = [], context = '' } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });

    // 1. Intentar usar la config del usuario actual
    let config = await get("SELECT ai_provider, ai_api_key FROM users WHERE id = ?", [req.user.id]);
    
    // 2. Si no tiene, usar la global del admin
    if (!config || !config.ai_provider || !config.ai_api_key) {
      config = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
    }

    if (!config || !config.ai_provider || !config.ai_api_key) {
      return res.status(503).json({ error: 'No hay configuración de IA disponible. Configúrala en tu perfil o pide al admin que lo haga globalmente.' });
    }

    const { ai_api_key: apiKeyStr } = config;
    
    let aiConfigs = [];
    try {
      if (apiKeyStr.trim().startsWith('[')) {
        aiConfigs = JSON.parse(apiKeyStr);
      } else {
        // Legacy fallback
        const keys = apiKeyStr.split(',').map(k => k.trim()).filter(Boolean);
        aiConfigs = keys.map(k => ({ provider: config.ai_provider, key: k }));
      }
    } catch (e) {
      aiConfigs = [{ provider: config.ai_provider, key: apiKeyStr }];
    }

    // Si el usuario no es admin, agregar las llaves globales del admin como respaldo
    if (req.user.role !== 'admin') {
      const adminConfig = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' AND ai_api_key IS NOT NULL LIMIT 1");
      if (adminConfig && adminConfig.ai_api_key) {
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

    // Obtener contactos para inyectarlos en el prompt
    const contacts = await query('SELECT name, email FROM contacts WHERE user_id = ? AND email IS NOT NULL LIMIT 50', [req.user.id]);
    const contactsStr = contacts.length > 0 ? contacts.map(c => `- ${c.name} (${c.email})`).join('\n') : '(Sin contactos guardados aún)';

    // Obtener trámites activos
    const deals = await query(`
      SELECT d.id, d.title, d.stage, c.name as contact_name
      FROM crm_deals d
      LEFT JOIN contacts c ON d.contact_id = c.id
      WHERE d.user_id = ? AND d.stage NOT IN ('won', 'lost')
      LIMIT 50
    `, [req.user.id]);
    const dealsStr = deals.length > 0 ? deals.map(d => `- ID: ${d.id} | Cliente: ${d.contact_name || 'Sin contacto'} | Trámite: ${d.title} | Etapa actual: ${d.stage}`).join('\n') : '(Sin trámites activos)';

    // Sistema de contexto según el rol del usuario
    let systemPrompt = context || `Eres VEGA, un asistente virtual inteligente de TrámitesVehiculares.mx.
Eres amigable, profesional y muy útil. Ayudas a gestores, concesionarias y administradores a navegar y usar la plataforma.
Respondes SIEMPRE en español mexicano, de forma concisa y clara.
Si no sabes algo específico del sistema, sugiere al usuario que contacte soporte.`;

    systemPrompt += `

SUPERPODER: Enviar Correos Electrónicos
Si el usuario te pide explícitamente que envíes un correo a alguien (ya sea por nombre o por dirección de correo), tienes la habilidad de hacerlo.
Para enviar el correo, debes incluir EXACTAMENTE el siguiente bloque en tu respuesta (puedes añadir texto antes o después del bloque para decirle al usuario que lo enviaste).

[SEND_EMAIL]
{
  "to": "correo@destino.com",
  "subject": "Asunto del correo",
  "body": "Cuerpo del correo..."
}
[/SEND_EMAIL]

Aquí tienes la lista de los contactos del usuario por si te piden enviar un correo por nombre:
${contactsStr}

SUPERPODER 2: Enviar Mensajes Directos (Chat Interno)
Si el usuario te pide que escribas un mensaje a un cliente en el chat de su trámite, tienes la habilidad de hacerlo.
Debes incluir EXACTAMENTE el siguiente bloque en tu respuesta:

[SEND_CHAT]
{
  "deal_id": "ID del trámite",
  "message": "Cuerpo del mensaje"
}
[/SEND_CHAT]

REGLA DE ORO DE AMBIGÜEDAD: Si el usuario te pide enviarle un mensaje a un cliente (ej. "Jhonathan") y en la lista ves que hay VARIOS trámites con ese mismo nombre, NO generes el bloque [SEND_CHAT]. En su lugar, explícale que hay varios y pregúntale a cuál se refiere (mencionando las diferentes etapas o los diferentes ID) para asegurarte de enviarlo al correcto.

CRÍTICO: Cuando sí vayas a enviar el mensaje, no agregues NINGUNA explicación antes ni después del bloque. NO pienses en voz alta en inglés ni en español. SOLO devuelve el bloque JSON.

Aquí tienes la lista de trámites activos del usuario para que sepas el ID del trámite:
${dealsStr}
`;

    let reply = '';
    let lastGlobalError = null;
    
    const geminiHistory = history.map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    }));
    while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.shift();
    }
    
    const openAiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
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
            const chat = model.startChat({ history: geminiHistory, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } });
            const result = await chat.sendMessage(message);
            reply = result.response.text();
            break keyLoop;
          } catch (err) {
            lastGlobalError = err;
            if (err.message && err.message.includes('404')) continue;
            break; // Mover a la siguiente configuracion (puede ser openai)
          }
        }
      } else if (provider === 'openai' || provider === 'deepseek') {
        const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const modelName = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify({ model: modelName, messages: openAiMessages, max_tokens: 1024, temperature: 0.7 })
          });

          if (!response.ok) {
            const err = await response.text();
            lastGlobalError = new Error(err);
            continue; // Intentar con la siguiente configuracion
          }

          const data = await response.json();
          reply = data.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
          break keyLoop;
        } catch (err) {
          lastGlobalError = err;
          continue; // Intentar con la siguiente configuracion
        }
      }
    }

    if (!reply) {
      console.error('AI error:', lastGlobalError);
      return res.status(502).json({ error: 'Error al conectar con los proveedores de IA. ' + (lastGlobalError?.message || '') });
    }

    // Interceptar petición de envío de correo
    const emailMatch = reply.match(/\[SEND_EMAIL\]([\s\S]*?)\[\/SEND_EMAIL\]/);
    if (emailMatch) {
      try {
        const emailData = JSON.parse(emailMatch[1]);
        if (emailData.to && emailData.subject && emailData.body) {
          await sendEmail(emailData.to, emailData.subject, emailData.body, null, req.user.id);
          reply = reply.replace(/\[SEND_EMAIL\][\s\S]*?\[\/SEND_EMAIL\]/, `\n\n📧 *¡He enviado el correo a ${emailData.to} exitosamente!*`);
        }
      } catch (e) {
        console.error('Error parsing or sending email from AI:', e);
        reply = reply.replace(/\[SEND_EMAIL\][\s\S]*?\[\/SEND_EMAIL\]/, `\n\n❌ *Intenté enviar el correo pero ocurrió un error técnico.*`);
      }
    }

    // Interceptar petición de chat interno
    const chatMatch = reply.match(/\[SEND_CHAT\]([\s\S]*?)\[\/SEND_CHAT\]/);
    if (chatMatch) {
      try {
        const chatData = JSON.parse(chatMatch[1]);
        if (chatData.deal_id && chatData.message) {
          const dealId = chatData.deal_id;
          const msg = chatData.message;
          const msgId = uuid();
          await run(`INSERT INTO chat_messages (id, deal_id, sender_id, message) VALUES (?, ?, ?, ?)`, [msgId, dealId, req.user.id, msg]);
          
          // Buscar si el cliente tiene un portal
          const dealInfo = await get('SELECT c.user_id as client_user_id FROM crm_deals d JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?', [dealId]);
          if (dealInfo && dealInfo.client_user_id) {
            const notifId = uuid();
            const title = 'Nuevo mensaje en tu trámite';
            const body = msg.substring(0, 100);
            await run(`INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, 'new_message', ?, ?, ?)`, 
              [notifId, dealInfo.client_user_id, title, body, dealId]);
              
            const io = req.app.get('io');
            if (io) {
              io.to('user_' + dealInfo.client_user_id).emit('notification', {
                id: notifId, type: 'new_message', title, body, ref_id: dealId, is_read: 0, created_at: new Date().toISOString()
              });
              io.to(dealId).emit('receive_message', {
                id: msgId,
                dealId: dealId,
                message: msg,
                senderId: req.user.id,
                senderName: req.user.name || 'Asistente IA',
                created_at: new Date().toISOString()
              });
            }
          }
          reply = reply.replace(/\[SEND_CHAT\][\s\S]*?\[\/SEND_CHAT\]/, `\n\n💬 *¡He enviado el mensaje al chat del trámite exitosamente!*`);
        }
      } catch (e) {
        console.error('Error parsing or sending chat from AI:', e);
        reply = reply.replace(/\[SEND_CHAT\][\s\S]*?\[\/SEND_CHAT\]/, `\n\n❌ *Intenté enviar el mensaje al chat pero ocurrió un error.*`);
      }
    }

    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Error interno al procesar tu mensaje' });
  }
});

export default router;
   