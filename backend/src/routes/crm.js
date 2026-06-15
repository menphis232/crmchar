import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { callAIProvider } from '../utils/ai_helper.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { processStageChangeAutomations } from '../services/automation.js';
import {
  contactRow, dealRow, ensureDefaultTemplates, markFirstResponse, taskRow,
} from '../crm/helpers.js';
import {
  dealTypeForRole, initialStageForRole, LOST_REASONS, mapDealStageToSolicitudStatus,
  stagesForRole, stageLabelsForUser,
} from '../crm/stages.js';
import { generateQuotePdf } from '../crm/pdf-generator.js';
import Stripe from 'stripe';

const router = Router();

function crmRoles(req, res, next) {
  if (!['gestor', 'concesionaria'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  req.orgId = req.user.parent_id || req.user.id;
  next();
}

router.use(authRequired, crmRoles);

// FASE 3.4: Notificaciones
router.get('/notifications', async (req, res) => {
  try {
    const notifs = await query(
      'SELECT id, type, title, body, is_read as isRead, ref_id as refId, created_at as createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.orgId]
    );
    res.json(notifs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

router.patch('/notifications/:id/read', async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.orgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al marcar notificacion' });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  try {
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.orgId]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al marcar todas las notificaciones' });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const uid = req.orgId;
    const role = req.user.role;
    const dealType = dealTypeForRole(role);
    const userRow = await get('SELECT crm_stages FROM users WHERE id = ?', [uid]);
    const stages = stagesForRole(role, userRow?.crm_stages);
    const stageLabels = stageLabelsForUser(role, userRow?.crm_stages);
    const wonStage = role === 'gestor' ? 'completado' : 'vendido';
    const lostStage = 'perdido';

    await ensureDefaultTemplates(uid, role);

    const [total, active, won, lost, stalled, pipelineValue, newThisWeek, uncontacted, tasksOverdue, tasksToday, avgResponse] = await Promise.all([
      get('SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ?', [uid, dealType]),
      get(`SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ? AND stage NOT IN (?, ?)`,
        [uid, dealType, wonStage, lostStage]),
      get('SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ? AND stage = ?', [uid, dealType, wonStage]),
      get('SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ? AND stage = ?', [uid, dealType, lostStage]),
      get(`SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ?
           AND stage NOT IN (?, ?) AND stage_changed_at < DATE_SUB(NOW(), INTERVAL 2 DAY)`,
        [uid, dealType, wonStage, lostStage]),
      get(`SELECT COALESCE(SUM(estimated_value), 0) as v FROM crm_deals
           WHERE user_id = ? AND deal_type = ? AND stage NOT IN (?, ?)`,
        [uid, dealType, wonStage, lostStage]),
      get(`SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ?
           AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
        [uid, dealType]),
      get(`SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ?
           AND stage NOT IN (?, ?) AND first_response_at IS NULL`,
        [uid, dealType, wonStage, lostStage]),
      get(`SELECT COUNT(*) as c FROM crm_tasks WHERE user_id = ? AND completed = 0 AND due_at < NOW()`, [uid]),
      get(`SELECT COUNT(*) as c FROM crm_tasks WHERE user_id = ? AND completed = 0
           AND DATE(due_at) = CURDATE()`, [uid]),
      get(`SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, first_response_at)) as h
           FROM crm_deals WHERE user_id = ? AND deal_type = ? AND first_response_at IS NOT NULL`,
        [uid, dealType]),
    ]);

    const byStage = {};
    for (const s of stages) {
      const row = await get(
        'SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ? AND stage = ?',
        [uid, dealType, s],
      );
      byStage[s] = row.c;
    }

    const totalCount = total.c || 0;
    const wonCount = won.c || 0;
    const conversionRate = totalCount > 0 ? Math.round((wonCount / totalCount) * 100) : 0;

    res.json({
      totals: {
        total: totalCount,
        active: active.c || 0,
        won: wonCount,
        lost: lost.c || 0,
        stalled: stalled.c || 0,
        pipelineValue: Number(pipelineValue.v || 0),
        newThisWeek: newThisWeek.c || 0,
        conversionRate,
        uncontacted: uncontacted.c || 0,
        tasksOverdue: tasksOverdue.c || 0,
        tasksDueToday: tasksToday.c || 0,
        avgFirstResponseHours: avgResponse.h ? Math.round(Number(avgResponse.h)) : null,
      },
      byStage,
      stages,
      stageLabels,
      lostReasons: LOST_REASONS,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar dashboard CRM' });
  }
});

router.get('/ai/insights', async (req, res) => {
  try {
    const uid = req.orgId;
    let user = await get('SELECT ai_provider, ai_api_key FROM users WHERE id = ?', [uid]);
    if (!user || !user.ai_provider || !user.ai_api_key) {
      user = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
    }
    if (!user || !user.ai_provider || !user.ai_api_key) {
      return res.status(400).json({ error: 'El administrador debe configurar el proveedor de IA y API Key globalmente.' });
    }

    const role = req.user.role;
    const dealType = dealTypeForRole(role);
    const wonStage = role === 'gestor' ? 'completado' : 'vendido';
    const lostStage = 'perdido';

    const [total, won, lost, avgResponse] = await Promise.all([
      get('SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ?', [uid, dealType]),
      get('SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ? AND stage = ?', [uid, dealType, wonStage]),
      get('SELECT COUNT(*) as c FROM crm_deals WHERE user_id = ? AND deal_type = ? AND stage = ?', [uid, dealType, lostStage]),
      get('SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, first_response_at)) as h FROM crm_deals WHERE user_id = ? AND deal_type = ? AND first_response_at IS NOT NULL', [uid, dealType]),
    ]);

    const totalCount = total.c || 0;
    const conversionRate = totalCount > 0 ? Math.round(((won.c || 0) / totalCount) * 100) : 0;
    const avgH = avgResponse.h ? Math.round(Number(avgResponse.h)) : 'N/A';

    let prompt = `Eres un experto en ventas y rendimiento comercial para gestorías vehiculares y concesionarias.
Analiza las siguientes métricas de un usuario (${role}):
- Total de prospectos/trámites: ${totalCount}
- Ganados (${wonStage}): ${won.c || 0}
- Perdidos: ${lost.c || 0}
- Tasa de conversión: ${conversionRate}%
- Tiempo promedio de primera respuesta: ${avgH} horas.

Instrucciones: Devuelve EXACTAMENTE 3 puntos clave accionables (insights) para mejorar su rendimiento comercial o eficiencia operativa. Sé directo y útil. Devuelve los 3 puntos separados por un salto de línea y numerados (1. 2. 3.). Nada más.`;

    let aiConfigs = [];
    try {
      if (user.ai_api_key && user.ai_api_key.trim().startsWith('[')) {
        aiConfigs = JSON.parse(user.ai_api_key);
      } else {
        const keys = (user.ai_api_key || '').split(',').map(k => k.trim()).filter(Boolean);
        aiConfigs = keys.map(k => ({ provider: user.ai_provider, key: k }));
      }
    } catch (e) {
      aiConfigs = [{ provider: user.ai_provider, key: user.ai_api_key }];
    }

    const validConfigs = aiConfigs.filter(c => c.provider && c.key);
    if (!validConfigs.length) {
      throw new Error('Configuración de IA incompleta');
    }

    let generatedText = '';
    let lastGlobalError = null;

    keyLoop: for (const cfg of validConfigs) {
      const { provider, key } = cfg;

      if (provider === 'gemini') {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
        const genAI = new GoogleGenerativeAI(key);
        
        for (const modelName of modelsToTry) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            generatedText = response.text();
            break keyLoop;
          } catch (err) {
            lastGlobalError = err;
            if (err.message && err.message.includes('404')) continue;
            break; // Intentar la siguiente config
          }
        }
      } else if (provider === 'openai' || provider === 'deepseek') {
        const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        const modelName = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-3.5-turbo';

        try {
          const resp = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 300,
              temperature: 0.7
            })
          });
          if (!resp.ok) {
            const errText = await resp.text();
            lastGlobalError = new Error(errText);
            continue; // Intentar la siguiente config
          }
          const data = await resp.json();
          generatedText = data.choices[0].message.content;
          break keyLoop;
        } catch (err) {
          lastGlobalError = err;
          continue; // Intentar la siguiente config
        }
      }
    }
    
    if (!generatedText && lastGlobalError) throw lastGlobalError;
    if (!generatedText) throw new Error('No se pudo generar análisis con ningún proveedor.');

    const insights = generatedText.split('\n').map(l => l.trim()).filter(l => l.match(/^[1-3]\./)).map(l => l.replace(/^[1-3]\.\s*/, ''));
    res.json({ insights: insights.length > 0 ? insights : generatedText.split('\n').filter(l=>l.trim()!=='') });
  } catch (err) {
    console.error('Error AI Insights:', err.message);
    res.status(500).json({ error: 'Error al generar insights con IA' });
  }
});

router.get('/deals', async (req, res) => {
  try {
    const uid = req.orgId;
    const dealType = dealTypeForRole(req.user.role);
    const { q, stage } = req.query;

    let sql = `
      SELECT d.*,
             c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
             c.whatsapp as contact_whatsapp,
             i.message as client_message, i.reply as client_reply,
             a.make, a.model,
             DATEDIFF(NOW(), d.stage_changed_at) as days_in_stage
      FROM crm_deals d
      JOIN contacts c ON c.id = d.contact_id
      LEFT JOIN auto_inquiries i ON d.ref_type = 'auto_inquiry' AND d.ref_id = i.id
      LEFT JOIN autos a ON d.auto_id = a.id
      WHERE d.user_id = ? AND d.deal_type = ?
    `;
    const params = [uid, dealType];

    if (stage) {
      sql += ' AND d.stage = ?';
      params.push(stage);
    }
    if (q) {
      sql += ' AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR d.title LIKE ?)';
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }
    sql += ' ORDER BY d.updated_at DESC';

    const rows = await query(sql, params);
    res.json(rows.map(dealRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar deals' });
  }
});

router.get('/today', async (req, res) => {
  try {
    const uid = req.orgId;
    const role = req.user.role;
    const dealType = dealTypeForRole(role);
    const wonStage = role === 'gestor' ? 'completado' : 'vendido';
    const initial = initialStageForRole(role);

    const [overdueTasks, todayTasks, stalledDeals, uncontactedDeals] = await Promise.all([
      query(`
        SELECT t.*, d.title as deal_title, c.name as contact_name
        FROM crm_tasks t
        JOIN crm_deals d ON d.id = t.deal_id
        JOIN contacts c ON c.id = d.contact_id
        WHERE t.user_id = ? AND t.completed = 0 AND t.due_at < NOW()
        ORDER BY t.due_at ASC LIMIT 20
      `, [uid]),
      query(`
        SELECT t.*, d.title as deal_title, c.name as contact_name
        FROM crm_tasks t
        JOIN crm_deals d ON d.id = t.deal_id
        JOIN contacts c ON c.id = d.contact_id
        WHERE t.user_id = ? AND t.completed = 0 AND DATE(t.due_at) = CURDATE()
        ORDER BY t.due_at ASC LIMIT 20
      `, [uid]),
      query(`
        SELECT d.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
               c.whatsapp as contact_whatsapp,
               DATEDIFF(NOW(), d.stage_changed_at) as days_in_stage
        FROM crm_deals d
        JOIN contacts c ON c.id = d.contact_id
        WHERE d.user_id = ? AND d.deal_type = ? AND d.stage NOT IN (?, 'perdido')
          AND d.stage_changed_at < DATE_SUB(NOW(), INTERVAL 2 DAY)
        ORDER BY d.stage_changed_at ASC LIMIT 15
      `, [uid, dealType, wonStage]),
      query(`
        SELECT d.*, c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
               c.whatsapp as contact_whatsapp,
               DATEDIFF(NOW(), d.stage_changed_at) as days_in_stage
        FROM crm_deals d
        JOIN contacts c ON c.id = d.contact_id
        WHERE d.user_id = ? AND d.deal_type = ? AND d.stage NOT IN (?, 'perdido')
          AND d.first_response_at IS NULL
        ORDER BY d.created_at ASC LIMIT 15
      `, [uid, dealType, wonStage]),
    ]);

    res.json({
      overdueTasks: overdueTasks.map(taskRow),
      todayTasks: todayTasks.map(taskRow),
      stalledDeals: stalledDeals.map(dealRow),
      uncontactedDeals: uncontactedDeals.map(dealRow),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar bandeja de hoy' });
  }
});

router.get('/deals/:id', async (req, res) => {
  try {
    const uid = req.orgId;
    const row = await get(`
      SELECT d.*,
             c.name as contact_name, c.email as contact_email, c.phone as contact_phone,
             c.whatsapp as contact_whatsapp, c.source as contact_source, c.notes as contact_notes,
             i.message as client_message, i.reply as client_reply,
             a.make, a.model,
             DATEDIFF(NOW(), d.stage_changed_at) as days_in_stage
      FROM crm_deals d
      JOIN contacts c ON c.id = d.contact_id
      LEFT JOIN auto_inquiries i ON d.ref_type = 'auto_inquiry' AND d.ref_id = i.id
      LEFT JOIN autos a ON d.auto_id = a.id
      WHERE d.id = ? AND d.user_id = ?
    `, [req.params.id, uid]);

    if (!row) return res.status(404).json({ error: 'Deal no encontrado' });

    const activities = await query(`
      SELECT id, activity_type as activityType, content, created_at as createdAt
      FROM crm_activities WHERE deal_id = ? ORDER BY created_at DESC
    `, [req.params.id]);

    const tasks = await query(`
      SELECT id, deal_id, title, due_at, completed, created_at
      FROM crm_tasks WHERE deal_id = ? ORDER BY due_at ASC
    `, [req.params.id]);

    const contact = await get('SELECT * FROM contacts WHERE id = ?', [row.contact_id]);

    res.json({
      ...dealRow(row),
      contact: contactRow(contact),
      activities,
      tasks: tasks.map(t => ({
        id: t.id,
        dealId: t.deal_id,
        title: t.title,
        dueAt: t.due_at,
        completed: !!t.completed,
        createdAt: t.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar deal' });
  }
});

router.post('/deals/:id/ai-reply', async (req, res) => {
  try {
    const uid = req.orgId;
    let user = await get('SELECT ai_provider, ai_api_key FROM users WHERE id = ?', [uid]);
    if (!user || !user.ai_provider || !user.ai_api_key) {
      user = await get("SELECT ai_provider, ai_api_key FROM users WHERE role = 'admin' LIMIT 1");
    }
    if (!user || !user.ai_provider || !user.ai_api_key) {
      return res.status(400).json({ error: 'El administrador debe configurar el proveedor de IA y API Key globalmente.' });
    }

    const row = await get(`
      SELECT d.title, i.message as client_message
      FROM crm_deals d
      LEFT JOIN auto_inquiries i ON d.ref_type = 'auto_inquiry' AND d.ref_id = i.id
      WHERE d.id = ? AND d.user_id = ?
    `, [req.params.id, uid]);

    if (!row) return res.status(404).json({ error: 'Deal no encontrado' });

    // Try to get chat history context
    const messages = await query(`
      SELECT message, sender_id FROM chat_messages 
      WHERE deal_id = ? ORDER BY created_at ASC LIMIT 10
    `, [req.params.id]);

    let prompt = `Eres un asistente virtual para una empresa automotriz o de trámites vehiculares.
Actúas en nombre del gestor/concesionario para responder al cliente.
Trámite: ${row.title}
Mensaje inicial del cliente: "${row.client_message || 'El cliente ha solicitado información.'}"
`;
    if (messages.length > 0) {
      prompt += "\nHistorial reciente del chat:\n";
      for (const msg of messages) {
        const isMe = msg.sender_id === uid;
        prompt += `${isMe ? 'Gestor' : 'Cliente'}: ${msg.message}\n`;
      }
    }
    prompt += `\nInstrucción: Redacta una respuesta amable, profesional y concisa (máximo 3 párrafos cortos) al cliente. Solo devuelve la respuesta.`;

    let generatedText = '';
    try {
      generatedText = await callAIProvider(user, 'Eres un asistente útil que responde a clientes.', [], prompt);
    } catch (e) {
      throw e;
    }

    res.json({ reply: generatedText });
  } catch (err) {
    console.error('Error IA:', err.message);
    res.status(500).json({ error: 'Error al generar la respuesta con IA: ' + err.message });
  }
});

router.patch('/deals/:id', async (req, res) => {
  try {
    const uid = req.orgId;
    const role = req.user.role;
    const { stage, internalNotes, estimatedValue, lostReason } = req.body;

    const deal = await get('SELECT * FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const userRow = await get('SELECT crm_stages FROM users WHERE id = ?', [uid]);
    const allowedStages = stagesForRole(role, userRow?.crm_stages);
    const isCustom = stage && stage.startsWith('etapa_');
    if (stage && !allowedStages.includes(stage) && !isCustom && !['completado', 'perdido'].includes(stage)) {
      return res.status(400).json({ error: 'Etapa inválida' });
    }
    if (stage === 'perdido' && !lostReason && !deal.lost_reason) {
      return res.status(400).json({ error: 'Indica el motivo de pérdida' });
    }

    const oldStage = deal.stage;
    const sets = ['updated_at = NOW()'];
    const params = [];

    if (stage !== undefined) {
      sets.push('stage = ?');
      params.push(stage);
      if (stage !== oldStage) {
        sets.push('stage_changed_at = NOW()');
      }
    }
    if (internalNotes !== undefined) {
      sets.push('internal_notes = ?');
      params.push(internalNotes);
    }
    if (estimatedValue !== undefined) {
      sets.push('estimated_value = ?');
      params.push(estimatedValue);
    }
    if (lostReason !== undefined) {
      sets.push('lost_reason = ?');
      params.push(lostReason);
    }

    params.push(req.params.id, uid);
    await run(`UPDATE crm_deals SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, params);

    // FASE 3.2: Review Email Simulation
    if (stage === 'completado' && oldStage !== 'completado') {
      const contact = await get('SELECT email FROM contacts WHERE id = ?', [deal.contact_id]);
      if (contact && contact.email) {
        console.log(`\n[SIMULACIÓN CORREO] Enviando email a ${contact.email} para calificar la gestoría.`);
        console.log(`[SIMULACIÓN CORREO] Link: http://localhost:4200/review/${req.params.id}\n`);
      }
    }

    const initial = initialStageForRole(role);
    if (stage && stage !== initial && oldStage === initial) {
      await markFirstResponse(req.params.id);
    }
    if (stage && stage !== oldStage && stage !== initial) {
      await markFirstResponse(req.params.id);
    }

    if (stage && stage !== oldStage) {
      await run(
        `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content) VALUES (?, ?, ?, 'stage_change', ?)`,
        [uuid(), req.params.id, uid, `Etapa: ${oldStage} → ${stage}`]
      );
      processStageChangeAutomations(req.params.id, stage);

      if (deal.ref_type === 'solicitud' && deal.ref_id) {
        const solStatus = mapDealStageToSolicitudStatus(stage);
        await run('UPDATE solicitudes SET status = ? WHERE id = ?', [solStatus, deal.ref_id]);
      }
      if (deal.ref_type === 'auto_inquiry' && deal.ref_id && ['contactado', 'interesado', 'visita', 'negociacion', 'vendido'].includes(stage)) {
        await run("UPDATE auto_inquiries SET status = 'respondido' WHERE id = ?", [deal.ref_id]);
      }
    }

    const updated = await get('SELECT * FROM crm_deals WHERE id = ?', [req.params.id]);
    res.json(dealRow(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar deal' });
  }
});

router.post('/deals/:id/activities', async (req, res) => {
  try {
    const uid = req.orgId;
    const { content, activityType = 'note' } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Contenido requerido' });

    const deal = await get('SELECT id FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const id = uuid();
    await run(
      `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content) VALUES (?, ?, ?, ?, ?)`,
      [id, req.params.id, uid, activityType, content.trim()],
    );

    await run('UPDATE crm_deals SET updated_at = NOW() WHERE id = ?', [req.params.id]);
    await markFirstResponse(req.params.id);

    res.status(201).json({ id, activityType, content: content.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar actividad' });
  }
});

router.post('/deals/:id/reply', async (req, res) => {
  try {
    const uid = req.orgId;
    const { reply } = req.body;
    if (!reply?.trim()) return res.status(400).json({ error: 'Respuesta requerida' });

    const deal = await get('SELECT * FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });
    if (deal.ref_type !== 'auto_inquiry' || !deal.ref_id) {
      return res.status(400).json({ error: 'Este deal no tiene mensaje asociado' });
    }

    await run(
      "UPDATE auto_inquiries SET reply = ?, status = 'respondido' WHERE id = ? AND user_id = ?",
      [reply.trim(), deal.ref_id, uid],
    );

    const newStage = deal.stage === 'lead_nuevo' ? 'contactado' : deal.stage;
    await run(
      `UPDATE crm_deals SET stage = ?, stage_changed_at = IF(stage = ?, stage_changed_at, NOW()), updated_at = NOW() WHERE id = ?`,
      [newStage, newStage, req.params.id],
    );

    await run(
      `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content) VALUES (?, ?, ?, 'message', ?)`,
      [uuid(), req.params.id, uid, reply.trim()],
    );
    await markFirstResponse(req.params.id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al responder' });
  }
});

router.get('/contacts/:id', async (req, res) => {
  try {
    const uid = req.orgId;
    const contact = await get('SELECT * FROM contacts WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!contact) return res.status(404).json({ error: 'Contacto no encontrado' });

    const deals = await query(`
      SELECT d.*, DATEDIFF(NOW(), d.stage_changed_at) as days_in_stage
      FROM crm_deals d WHERE d.contact_id = ? AND d.user_id = ? ORDER BY d.updated_at DESC
    `, [req.params.id, uid]);

    const activities = await query(`
      SELECT a.id, a.activity_type as activityType, a.content, a.created_at as createdAt,
             d.title as dealTitle, d.id as dealId
      FROM crm_activities a
      JOIN crm_deals d ON d.id = a.deal_id
      WHERE d.contact_id = ? AND d.user_id = ?
      ORDER BY a.created_at DESC LIMIT 50
    `, [req.params.id, uid]);

    const tasks = await query(`
      SELECT t.*, d.title as deal_title
      FROM crm_tasks t
      JOIN crm_deals d ON d.id = t.deal_id
      WHERE d.contact_id = ? AND d.user_id = ?
      ORDER BY t.completed ASC, t.due_at ASC
    `, [req.params.id, uid]);

    res.json({
      contact: contactRow(contact),
      deals: deals.map(dealRow),
      activities,
      tasks: tasks.map(taskRow),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar contacto' });
  }
});

router.get('/contacts', async (req, res) => {
  try {
    const rows = await query(`
      SELECT c.*, COUNT(d.id) as dealCount
      FROM contacts c
      LEFT JOIN crm_deals d ON d.contact_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `, [req.orgId]);
    res.json(rows.map(r => ({ ...contactRow(r), dealCount: r.dealCount })));
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar contactos' });
  }
});

router.patch('/contacts/:id', async (req, res) => {
  try {
    const { name, email, phone, whatsapp, notes } = req.body;
    const result = await run(`
      UPDATE contacts SET
        name = COALESCE(?, name), email = COALESCE(?, email),
        phone = COALESCE(?, phone), whatsapp = COALESCE(?, whatsapp),
        notes = COALESCE(?, notes), updated_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [name, email?.toLowerCase(), phone, whatsapp, notes, req.params.id, req.orgId]);

    if (!result.affectedRows) return res.status(404).json({ error: 'Contacto no encontrado' });
    const row = await get('SELECT * FROM contacts WHERE id = ?', [req.params.id]);
    res.json(contactRow(row));
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar contacto' });
  }
});

router.get('/templates', async (req, res) => {
  try {
    await ensureDefaultTemplates(req.orgId, req.user.role);
    const category = dealTypeForRole(req.user.role) === 'tramite' ? 'tramite' : 'venta';
    const rows = await query(
      'SELECT id, name, content, template_category as templateCategory, created_at as createdAt FROM message_templates WHERE user_id = ? AND template_category = ? ORDER BY name',
      [req.orgId, category],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar plantillas' });
  }
});

router.post('/templates', async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content) return res.status(400).json({ error: 'Nombre y contenido requeridos' });
    const category = dealTypeForRole(req.user.role) === 'tramite' ? 'tramite' : 'venta';
    const id = uuid();
    await run(
      'INSERT INTO message_templates (id, user_id, name, content, template_category) VALUES (?, ?, ?, ?, ?)',
      [id, req.orgId, name, content, category],
    );
    res.status(201).json({ id, name, content, templateCategory: category });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    const result = await run(
      'DELETE FROM message_templates WHERE id = ? AND user_id = ?',
      [req.params.id, req.orgId],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
});

router.get('/tasks', async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.*, d.title as deal_title, c.name as contact_name
      FROM crm_tasks t
      JOIN crm_deals d ON d.id = t.deal_id
      JOIN contacts c ON c.id = d.contact_id
      WHERE t.user_id = ? AND t.completed = 0
      ORDER BY t.due_at ASC
    `, [req.orgId]);
    res.json(rows.map(taskRow));
  } catch (err) {
    res.status(500).json({ error: 'Error al cargar tareas' });
  }
});

router.post('/deals/:id/tasks', async (req, res) => {
  try {
    const uid = req.orgId;
    const { title, dueAt } = req.body;
    if (!title?.trim() || !dueAt) {
      return res.status(400).json({ error: 'Título y fecha requeridos' });
    }
    const deal = await get('SELECT id FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const id = uuid();
    await run(
      'INSERT INTO crm_tasks (id, deal_id, user_id, title, due_at) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, uid, title.trim(), dueAt],
    );
    res.status(201).json({ id, title: title.trim(), dueAt, completed: false });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

router.patch('/tasks/:id', async (req, res) => {
  try {
    const { completed, title, dueAt } = req.body;
    const sets = [];
    const params = [];
    if (completed !== undefined) { sets.push('completed = ?'); params.push(completed ? 1 : 0); }
    if (title !== undefined) { sets.push('title = ?'); params.push(title); }
    if (dueAt !== undefined) { sets.push('due_at = ?'); params.push(dueAt); }
    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });

    params.push(req.params.id, req.orgId);
    const result = await run(
      `UPDATE crm_tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
      params,
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const result = await run('DELETE FROM crm_tasks WHERE id = ? AND user_id = ?', [req.params.id, req.orgId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
});

// --- FASE 3.1: COTIZACIONES ---

router.get('/deals/:id/quotes', async (req, res) => {
  try {
    const uid = req.orgId;
    const rows = await query(`
      SELECT * FROM crm_quotes 
      WHERE deal_id = ? AND user_id = ? 
      ORDER BY created_at DESC
    `, [req.params.id, uid]);
    
    // Parse JSON items
    const parsed = rows.map(r => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || [])
    }));
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar cotizaciones' });
  }
});

router.post('/deals/:id/quotes', async (req, res) => {
  try {
    const uid = req.orgId;
    const { items, total, validUntil, downPayment, tradeInValue, termMonths } = req.body;
    
    const deal = await get('SELECT id FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const dealSets = ['updated_at = NOW()'];
    const dealParams = [];
    if (downPayment !== undefined) { dealSets.push('down_payment = ?'); dealParams.push(downPayment); }
    if (tradeInValue !== undefined) { dealSets.push('trade_in_value = ?'); dealParams.push(tradeInValue); }
    if (termMonths !== undefined) { dealSets.push('term_months = ?'); dealParams.push(termMonths); }
    dealParams.push(req.params.id);
    await run(`UPDATE crm_deals SET ${dealSets.join(', ')} WHERE id = ?`, dealParams);

    const quoteId = uuid();
    const vUntil = validUntil || new Date(Date.now() + 15 * 86400000).toISOString().slice(0,19).replace('T', ' ');

    await run(`
      INSERT INTO crm_quotes (id, deal_id, user_id, items, total, valid_until, status)
      VALUES (?, ?, ?, ?, ?, ?, 'draft')
    `, [quoteId, req.params.id, uid, JSON.stringify(items || []), total || 0, vUntil]);

    res.status(201).json({ id: quoteId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cotización' });
  }
});

router.get('/quotes/:id/pdf', async (req, res) => {
  try {
    const uid = req.orgId;
    const quote = await get('SELECT * FROM crm_quotes WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!quote) return res.status(404).json({ error: 'Cotización no encontrada' });

    const dealRaw = await get(`
      SELECT d.*, c.name as contact_name, c.email as contact_email, 
             c.phone as contact_phone, c.whatsapp as contact_whatsapp 
      FROM crm_deals d 
      JOIN contacts c ON c.id = d.contact_id 
      WHERE d.id = ?
    `, [quote.deal_id]);

    const user = await get('SELECT name, email, logo_url, pdf_settings FROM users WHERE id = ?', [uid]);
    
    // Parse pdf_settings if exists
    if (user.pdf_settings && typeof user.pdf_settings === 'string') {
      try { user.pdf_settings = JSON.parse(user.pdf_settings); } catch(e){}
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="cotizacion_${quote.id.split('-')[0]}.pdf"`);

    await generateQuotePdf(dealRaw, quote, user, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
});

// --- FASE 3.2: DOCUMENTOS ---

router.get('/deals/:id/documents', async (req, res) => {
  try {
    const uid = req.orgId;
    const rows = await query(`
      SELECT * FROM crm_documents 
      WHERE deal_id = ? AND user_id = ? 
      ORDER BY created_at DESC
    `, [req.params.id, uid]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar documentos' });
  }
});

router.post('/deals/:id/documents', async (req, res) => {
  try {
    const uid = req.orgId;
    const { fileName, fileUrl } = req.body;
    
    if (!fileName || !fileUrl) {
      return res.status(400).json({ error: 'Faltan datos del documento' });
    }

    const deal = await get('SELECT id FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const docId = uuid();
    await run(`
      INSERT INTO crm_documents (id, deal_id, user_id, file_name, file_url)
      VALUES (?, ?, ?, ?, ?)
    `, [docId, req.params.id, uid, fileName, fileUrl]);

    res.status(201).json({ id: docId, fileName, fileUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al agregar documento' });
  }
});

router.delete('/documents/:id', async (req, res) => {
  try {
    const uid = req.orgId;
    const result = await run('DELETE FROM crm_documents WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Documento no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
});

router.get('/deals/:id/client-documents', async (req, res) => {
  try {
    const uid = req.orgId;
    const deal = await get('SELECT id FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const rows = await query('SELECT * FROM deal_documents WHERE deal_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar documentos del cliente' });
  }
});

router.post('/deals/:id/apply-ocr', async (req, res) => {
  try {
    const uid = req.orgId;
    const { documentId } = req.body;
    
    const deal = await get('SELECT id, internal_notes FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Deal no encontrado' });

    const doc = await get('SELECT * FROM deal_documents WHERE id = ? AND deal_id = ?', [documentId, req.params.id]);
    if (!doc || !doc.extracted_data) return res.status(400).json({ error: 'Documento sin datos OCR' });

    let extracted;
    try { extracted = typeof doc.extracted_data === 'string' ? JSON.parse(doc.extracted_data) : doc.extracted_data; } catch(e) { return res.status(400).json({error: 'Datos corruptos'}); }

    // Format the JSON data into a readable string to append to internal notes
    const dataStr = Object.entries(extracted).map(([k,v]) => `${k}: ${v}`).join('\n');
    const newNotes = (deal.internal_notes ? deal.internal_notes + '\n\n' : '') + `--- Datos extraídos de ${doc.document_type} ---\n${dataStr}`;

    await run('UPDATE crm_deals SET internal_notes = ?, updated_at = NOW() WHERE id = ?', [newNotes, req.params.id]);
    await run("UPDATE deal_documents SET status = 'approved' WHERE id = ?", [documentId]);

    res.json({ success: true, notes: newNotes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al aplicar datos OCR' });
  }
});

// --- FASE 3.5: GESTIÓN DE EQUIPO ---
router.get('/team', async (req, res) => {
  try {
    // Solo el jefe puede ver esto
    if (req.user.parent_id) return res.status(403).json({ error: 'Solo el administrador puede ver el equipo' });
    const team = await query(
      'SELECT id, email, name, permissions, created_at FROM users WHERE parent_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    team.forEach(t => {
      if (t.permissions && typeof t.permissions === 'string') {
        try { t.permissions = JSON.parse(t.permissions); } catch(e){}
      }
    });
    res.json(team);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
});

router.post('/team', async (req, res) => {
  try {
    if (req.user.parent_id) return res.status(403).json({ error: 'Solo el administrador puede crear empleados' });
    const { email, password, name, permissions } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'Faltan campos' });

    const exists = await get('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });

    const empId = uuid();
    const bcrypt = (await import('bcryptjs')).default;
    const hash = bcrypt.hashSync(password, 10);
    
    await run(
      'INSERT INTO users (id, email, password_hash, role, name, parent_id, permissions) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [empId, email.toLowerCase(), hash, req.user.role, name, req.user.id, JSON.stringify(permissions || [])]
    );
    res.status(201).json({ id: empId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});

router.put('/team/:id', async (req, res) => {
  try {
    if (req.user.parent_id) return res.status(403).json({ error: 'No autorizado' });
    const { name, permissions, password } = req.body;
    const sets = [];
    const params = [];
    if (name) { sets.push('name = ?'); params.push(name); }
    if (permissions) { sets.push('permissions = ?'); params.push(JSON.stringify(permissions)); }
    if (password) {
      const bcrypt = (await import('bcryptjs')).default;
      sets.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10));
    }
    if (sets.length === 0) return res.json({ success: true });
    
    params.push(req.params.id, req.user.id);
    await run(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND parent_id = ?`, params);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar empleado' });
  }
});

router.delete('/team/:id', async (req, res) => {
  try {
    if (req.user.parent_id) return res.status(403).json({ error: 'No autorizado' });
    await run('DELETE FROM users WHERE id = ? AND parent_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar empleado' });
  }
});

// ==========================================
// Stripe Payments Integration
// ==========================================

router.post('/deals/:id/checkout', async (req, res) => {
  try {
    const dealId = req.params.id;
    const deal = await get('SELECT * FROM crm_deals WHERE id = ? AND user_id = ?', [dealId, req.orgId]);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });

    if (!deal.estimated_value || deal.estimated_value <= 0) {
      return res.status(400).json({ error: 'El trámite no tiene un valor válido para cobrar' });
    }

    // Get the Stripe keys for the organization owner
    const owner = await get('SELECT stripe_secret_key FROM users WHERE id = ?', [req.orgId]);
    if (!owner || !owner.stripe_secret_key) {
      return res.status(400).json({ error: 'Debes configurar tu Stripe Secret Key en la pestaña Perfil' });
    }

    const stripe = new Stripe(owner.stripe_secret_key);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'mxn',
            product_data: {
              name: deal.title || 'Cobro de Trámite/Apartado',
            },
            unit_amount: Math.round(deal.estimated_value * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:4200/pay/success?session_id={CHECKOUT_SESSION_ID}&deal_id=${dealId}`,
      cancel_url: `http://localhost:4200/panel`,
      metadata: { deal_id: dealId },
    });

    await run('UPDATE crm_deals SET payment_session_id = ? WHERE id = ?', [session.id, dealId]);

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe Checkout Error:', err);
    res.status(500).json({ error: 'Error al generar link de pago: ' + err.message });
  }
});

// ─── AI INSIGHTS ───────────────────────────────────────────
router.get('/ai/insights', async (req, res) => {
  try {
    const uid = req.orgId;
    const [totalDeals, openDeals, closedDeals, totalContacts] = await Promise.all([
      get('SELECT COUNT(*) as n FROM crm_deals WHERE user_id = ?', [uid]),
      get("SELECT COUNT(*) as n FROM crm_deals WHERE user_id = ? AND stage NOT IN ('completado','perdido')", [uid]),
      get("SELECT COUNT(*) as n FROM crm_deals WHERE user_id = ? AND stage = 'completado'", [uid]),
      get('SELECT COUNT(*) as n FROM contacts WHERE user_id = ?', [uid]),
    ]);
    const convRate = totalDeals.n > 0 ? Math.round((closedDeals.n / totalDeals.n) * 100) : 0;
    res.json({
      summary: `Tienes ${openDeals.n} trámites activos de ${totalDeals.n} totales con una tasa de cierre del ${convRate}%.`,
      insights: [
        { icon: '📋', text: `${totalDeals.n} trámites totales registrados` },
        { icon: '⏳', text: `${openDeals.n} trámites activos en proceso` },
        { icon: '✅', text: `${closedDeals.n} trámites completados (${convRate}% de cierre)` },
        { icon: '👥', text: `${totalContacts.n} contactos en tu CRM` },
      ]
    });
  } catch (err) {
    console.error('AI Insights error:', err);
    res.status(500).json({ error: 'Error al obtener insights' });
  }
});

// ─── CHAT MESSAGES (Gestor ↔ Cliente) ─────────────────────
router.get('/deals/:id/messages', async (req, res) => {
  try {
    const uid = req.orgId;
    const deal = await get('SELECT id FROM crm_deals WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
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

router.post('/deals/:id/messages', async (req, res) => {
  try {
    const uid = req.orgId;
    const { message, fileUrl } = req.body;
    if (!message && !fileUrl) return res.status(400).json({ error: 'Mensaje vacío' });
    const deal = await get(`
      SELECT d.id, d.title, c.user_id as client_user_id 
      FROM crm_deals d 
      LEFT JOIN contacts c ON c.id = d.contact_id 
      WHERE d.id = ? AND d.user_id = ?
    `, [req.params.id, uid]);
    if (!deal) return res.status(404).json({ error: 'Trámite no encontrado' });
    const id = uuid();
    await run(`INSERT INTO chat_messages (id, deal_id, sender_id, message, file_url) VALUES (?, ?, ?, ?, ?)`,
      [id, req.params.id, req.user.id, message || null, fileUrl || null]);
    const saved = await get(`
      SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name as sender_name, u.role as sender_role
      FROM chat_messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?
    `, [id]);

    // Send notification to client
    if (deal.client_user_id) {
      const notifId = uuid();
      const title = 'Nuevo mensaje de tu Gestor/Concesionaria';
      const body = message ? message.substring(0, 100) : 'Te han enviado un archivo.';
      await run(`INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, 'new_message', ?, ?, ?)`,
        [notifId, deal.client_user_id, title, body, deal.id]);
      
      const io = req.app.get('io');
      if (io) {
        io.to('user_' + deal.client_user_id).emit('notification', {
          id: notifId, type: 'new_message', title, body, ref_id: deal.id, is_read: 0, created_at: new Date().toISOString()
        });
      }
    }

    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// --- AUTOMATIONS ---
router.get('/automations', async (req, res) => {
  try {
    const uid = req.orgId;
    const rows = await query('SELECT * FROM crm_automations WHERE user_id = ? ORDER BY created_at DESC', [uid]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar automatizaciones' });
  }
});

router.post('/automations', async (req, res) => {
  try {
    const uid = req.orgId;
    const { name, trigger_event, trigger_stage, trigger_delay_days, action_type, action_content, is_active } = req.body;
    const id = uuid();
    await run(`INSERT INTO crm_automations (id, user_id, name, trigger_event, trigger_stage, trigger_delay_days, action_type, action_content, is_active) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, uid, name, trigger_event, trigger_stage, trigger_delay_days || 0, action_type, action_content, is_active === undefined ? true : is_active]);
    res.status(201).json({ id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear automatización' });
  }
});

router.delete('/automations/:id', async (req, res) => {
  try {
    const uid = req.orgId;
    await run('DELETE FROM crm_automations WHERE id = ? AND user_id = ?', [req.params.id, uid]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar automatización' });
  }
});

export default router;
