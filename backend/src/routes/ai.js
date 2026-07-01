/**
 * ai.js — Proxy seguro para el asistente de IA
 * ===============================================
 * Expone un endpoint de chat que usa la API Key global del admin.
 * Los paneles (gestor, concesionaria, admin) consumen esta ruta.
 */

import { Router } from 'express';
import { get, query } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { processAiActions, clienteSuperpowersPrompt, businessSuperpowersPrompt } from '../services/ai-actions.js';

const router = Router();

/**
 * GET /api/ai/config
 * Devuelve solo el proveedor configurado (sin exponer la key).
 */
router.get('/config', authRequired, async (req, res) => {
  try {
    if (req.user.role === 'cliente') {
      const admin = await get("SELECT ai_provider FROM users WHERE role = 'admin' LIMIT 1");
      return res.json({ provider: admin?.ai_provider || null });
    }
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

    // ── ASISTENTE LEGAL PARA CLIENTES ──────────────────
    if (userRole === 'cliente') {
      const clientDeals = await query(`
        SELECT d.id, d.title, d.stage, d.tracking_code, d.updated_at, g.name as gestor_name
        FROM crm_deals d
        JOIN contacts c ON c.id = d.contact_id
        LEFT JOIN gestores g ON g.user_id = d.user_id
        WHERE c.email = ?
        ORDER BY d.updated_at DESC LIMIT 20
      `, [req.user.email]);

      const activeDeals = clientDeals.filter(d => !['completado', 'vendido', 'perdido'].includes(d.stage));
      const dealsContext = clientDeals.length
        ? clientDeals.map(d => `- ID: ${d.id} | ${d.title} | Gestoría: ${d.gestor_name || 'N/A'} | Etapa: ${d.stage} | Código: ${d.tracking_code || 'N/A'}`).join('\n')
        : '(Sin trámites registrados)';

      const clientUser = await get('SELECT id FROM users WHERE email = ? LIMIT 1', [req.user.email]);
      let walletDocs = [];
      if (clientUser) {
        const personal = await query(
          'SELECT id, label, category FROM client_wallet_documents WHERE user_id = ? ORDER BY created_at DESC LIMIT 15',
          [clientUser.id],
        );
        const vehicleDocs = await query(
          `SELECT cvd.id, COALESCE(cvd.label, cvd.file_name) AS label, cv.plate AS vehiclePlate
           FROM contact_vehicle_documents cvd
           JOIN contact_vehicles cv ON cv.id = cvd.vehicle_id
           JOIN contacts c ON c.id = cv.contact_id
           WHERE LOWER(c.email) = LOWER(?)
           ORDER BY cvd.created_at DESC LIMIT 15`,
          [req.user.email],
        );
        walletDocs = [
          ...personal.map(w => ({ ...w, source: 'wallet', vehiclePlate: null })),
          ...vehicleDocs.map(w => ({ ...w, category: 'Vehículo', source: 'vehicle' })),
        ];
      }

      const walletContext = walletDocs.length
        ? walletDocs.map(w => `- ID: ${w.id} | ${w.label} (${w.category || 'Otro'}) | source: ${w.source || 'wallet'}`).join('\n')
        : '(Sin documentos en billetera)';

      const vehicles = await query(
        `SELECT cv.id, cv.plate, cv.make, cv.model, cv.year, cv.state
         FROM contact_vehicles cv
         JOIN contacts c ON c.id = cv.contact_id
         WHERE LOWER(c.email) = LOWER(?)
         ORDER BY cv.updated_at DESC LIMIT 15`,
        [req.user.email],
      );
      const vehiclesContext = vehicles.length
        ? vehicles.map(v => `- ID: ${v.id} | ${[v.make, v.model, v.year].filter(Boolean).join(' ')} | Placa: ${v.plate}${v.state ? ` | ${v.state}` : ''}`).join('\n')
        : '(Sin vehículos registrados)';

      const invoices = await query(
        `SELECT i.invoice_number, i.amount, d.title AS deal_title
         FROM deal_invoices i
         JOIN crm_deals d ON d.id = i.deal_id
         JOIN contacts c ON c.id = d.contact_id
         WHERE LOWER(c.email) = LOWER(?)
         ORDER BY i.created_at DESC LIMIT 10`,
        [req.user.email],
      );
      const invoicesContext = invoices.length
        ? invoices.map(i => `- ${i.invoice_number} | ${i.deal_title} | $${Number(i.amount || 0).toLocaleString('es-MX')}`).join('\n')
        : '(Sin comprobantes)';

      const systemPrompt = `Eres el Asistente Virtual del panel del cliente en Trámites Vehiculares de México.
Tu conocimiento cubre la Ley General de Movilidad y Seguridad Vial, el Reglamento General de Tránsito, normativa de la Secretaría de Movilidad, REPUVE, verificación vehicular, tenencia, refrendo, cambio de propietario, altas y bajas de placas, placas foráneas, legalización de vehículos, adeudos vehiculares, engomado y holograma, seguros obligatorios, y regulaciones estatales de los 32 estados (Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de México, Coahuila, Colima, Durango, Estado de México, Guanajuato, Guerrero, Hidalgo, Jalisco, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán, Zacatecas).

REGLAS:
- Responde SIEMPRE en español mexicano, claro y accesible para personas sin conocimiento legal.
- Cuando la normativa varíe por estado, indícalo explícitamente y menciona el estado relevante.
- Cita leyes, reglamentos o artículos cuando sea posible (ej. Ley de Movilidad del Estado de México, Reglamento de Tránsito de Jalisco).
- Si no tienes certeza sobre una tarifa, plazo o requisito específico actualizado, dilo y recomienda verificar en la oficialía o con su gestoría.
- NO des asesoría legal vinculante; aclara que es orientación informativa.
- Puedes explicar documentos requeridos, costos aproximados, tiempos de trámite y pasos generales.
- Si preguntan por sus trámites en la plataforma, usa los datos abajo.
- Conoces los módulos del panel: Dashboard, Mis Trámites (chat con gestoría), Historial, Billetera de documentos, Mis Comprobantes, Mis Vehículos y Ajustes.
- Puedes orientar sobre cómo usar cada módulo del panel además de la normativa vehicular.
- Cuando el usuario pida crear, actualizar o eliminar datos del panel, ejecuta la acción con los bloques indicados abajo.
- Para subir archivos nuevos a la billetera, indica que debe hacerlo manualmente en el panel (requiere archivo).

TRÁMITES DEL USUARIO (${clientDeals.length} total, ${activeDeals.length} activos):
${dealsContext}

BILLETERA DE DOCUMENTOS:
${walletContext}

VEHÍCULOS REGISTRADOS:
${vehiclesContext}

COMPROBANTES DE PAGO:
${invoicesContext}
${clienteSuperpowersPrompt(clientDeals, walletDocs, vehicles)}

Fecha: ${new Date().toLocaleDateString('es-MX')}`;

      let reply = '';
      let lastGlobalError = null;
      const geminiHistory = history.map(h => ({
        role: (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user',
        parts: [{ text: h.content }],
      }));
      while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') geminiHistory.shift();

      keyLoop: for (const cfg of validConfigs) {
        const { provider, key } = cfg;
        if (provider === 'gemini') {
          const { GoogleGenerativeAI } = await import('@google/generative-ai');
          const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
          const genAI = new GoogleGenerativeAI(key);
          for (const modelName of modelsToTry) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
              const chat = model.startChat({ history: geminiHistory, generationConfig: { temperature: 0.5, maxOutputTokens: 1800 } });
              const result = await chat.sendMessage(message);
              reply = result.response.text();
              break keyLoop;
            } catch (err) {
              lastGlobalError = err;
              if (err.message?.includes('404')) continue;
              break;
            }
          }
        } else if (provider === 'openai' || provider === 'deepseek') {
          const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
          const modelName = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';
          try {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
              body: JSON.stringify({
                model: modelName,
                messages: [
                  { role: 'system', content: systemPrompt },
                  ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
                  { role: 'user', content: message },
                ],
                max_tokens: 1800,
                temperature: 0.5,
              }),
            });
            if (!response.ok) { lastGlobalError = new Error(await response.text()); continue; }
            const data = await response.json();
            reply = data.choices?.[0]?.message?.content || '';
            break keyLoop;
          } catch (err) { lastGlobalError = err; continue; }
        }
      }

      if (!reply) {
        return res.status(502).json({ error: 'Error al conectar con IA. ' + (lastGlobalError?.message || '') });
      }
      reply = await processAiActions(reply, { user: req.user, req });
      return res.json({ reply });
    }

    // ── DATOS DEL NEGOCIO ──────────────────────────────
    const orgUserId = req.user.parent_id || req.user.id;

    // Perfil del usuario (incluye prompt personalizado)
    const userProfile = await get('SELECT name, email, phone, address, description, panel_assistant_prompt FROM users WHERE id = ?', [orgUserId]);

    // Contactos
    const contacts = await query('SELECT name, email FROM contacts WHERE user_id = ? AND email IS NOT NULL LIMIT 50', [orgUserId]);
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
    `, [orgUserId]);
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
      [orgUserId]
    );
    let finIncome = 0, finExpense = 0;
    finRows.forEach(r => {
      if (r.type === 'income') finIncome = Number(r.total);
      if (r.type === 'expense') finExpense = Number(r.total);
    });
    const finBalance = finIncome - finExpense;

    // Últimas transacciones (5)
    const recentTx = await query(
      `SELECT f.id, f.type, f.amount, f.description, f.date, f.payment_method, f.referencia,
              COALESCE(CONCAT(a.make, ' ', a.model, ' ', a.year), d.title) as link_label
       FROM fin_transactions f
       LEFT JOIN crm_deals d ON f.deal_id = d.id
       LEFT JOIN autos a ON d.auto_id = a.id
       WHERE f.user_id = ?
       ORDER BY f.date DESC, f.created_at DESC LIMIT 10`,
      [orgUserId]
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
        [orgUserId]
      );
      inventoryStr = autos.length
        ? autos.map(a => {
            const p = a.special_price ? `${fmtMoney(a.special_price)} (antes ${fmtMoney(a.price)})` : fmtMoney(a.price);
            return `- ID: ${a.id} | ${a.make} ${a.model} ${a.year} | ${p} | ${a.mileage?.toLocaleString()} km | ${a.transmission} | ${a.status} | ${a.location || 'Sin ubicación'}`;
          }).join('\n')
        : '(Sin vehículos en inventario)';
    }

    // Servicios del gestor
    let gestorServices = [];
    if (userRole === 'gestor') {
      const gestorRow = await get('SELECT id FROM gestores WHERE user_id = ?', [orgUserId]);
      if (gestorRow) {
        gestorServices = await query(
          'SELECT id, name, time_estimate, price FROM gestor_services WHERE gestor_id = ? ORDER BY sort_order ASC, name ASC LIMIT 30',
          [gestorRow.id],
        );
      }
    }

    // ── SYSTEM PROMPT ──────────────────────────────────

    const roleName = userRole === 'gestor' ? 'Gestor de Trámites'
      : userRole === 'concesionaria' ? 'Concesionaria'
      : 'Administrador';

    const customPrompt = userProfile?.panel_assistant_prompt?.trim();
    let systemPrompt = `Eres un asistente virtual inteligente del panel de TrámitesVehicularesdeMéxico.mx.
Eres amigable, profesional y muy útil. Ayudas a ${roleName}s a gestionar su negocio.
Respondes SIEMPRE en español mexicano, de forma concisa y clara.
Conoces los módulos del panel según el rol y puedes guiar paso a paso.
${userRole === 'gestor' ? 'Módulos del gestor: Dashboard, Embudo de Trámites, Servicios, Finanzas, Contactos, Automatizaciones, Plantillas, Mi página pública, Asistente IA y configuración del perfil.' : ''}
${userRole === 'concesionaria' ? 'Módulos de concesionaria: Dashboard, Embudo de ventas, Inventario, Finanzas, Contactos y Asistente IA.' : ''}
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
${businessSuperpowersPrompt(userRole, dealsQ, recentTx, gestorServices)}
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

    reply = await processAiActions(reply, { user: req.user, req });
    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'Error interno al procesar tu mensaje' });
  }
});

export default router;
