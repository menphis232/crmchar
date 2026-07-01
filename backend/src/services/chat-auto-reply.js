import { get, query, run } from '../db.js';
import { v4 as uuid } from 'uuid';
import { callAIProvider } from '../utils/ai_helper.js';
import { emitChatMessage, emitUserNotification } from '../utils/socket-events.js';

async function getGestorAiConfig(gestorUserId) {
  let user = await get(
    'SELECT id, name, ai_provider, ai_api_key, chat_ai_auto_reply_enabled, chat_ai_inactivity_minutes, panel_assistant_prompt FROM users WHERE id = ?',
    [gestorUserId],
  );
  if (!user?.ai_provider || !user?.ai_api_key) {
    user = await get(
      "SELECT id, name, ai_provider, ai_api_key, chat_ai_auto_reply_enabled, chat_ai_inactivity_minutes, panel_assistant_prompt FROM users WHERE role = 'admin' AND ai_api_key IS NOT NULL LIMIT 1",
    );
    if (user) user.id = gestorUserId;
  }
  return user;
}

export async function shouldAutoReplyChat(gestorUserId, dealId) {
  const gestor = await get(
    'SELECT chat_ai_auto_reply_enabled, chat_ai_inactivity_minutes FROM users WHERE id = ?',
    [gestorUserId],
  );
  if (!gestor?.chat_ai_auto_reply_enabled) return false;

  const inactivityMin = Math.max(5, Number(gestor.chat_ai_inactivity_minutes) || 30);

  const lastHumanGestor = await get(
    `SELECT m.created_at
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.deal_id = ?
       AND COALESCE(m.is_ai_generated, 0) = 0
       AND u.role IN ('gestor', 'admin', 'concesionaria')
       AND (u.id = ? OR u.parent_id = ?)
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [dealId, gestorUserId, gestorUserId],
  );

  if (lastHumanGestor?.created_at) {
    const minutesSince = (Date.now() - new Date(lastHumanGestor.created_at).getTime()) / 60000;
    if (minutesSince < inactivityMin) return false;
  }

  const lastMsg = await get(
    `SELECT u.role AS sender_role
     FROM chat_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.deal_id = ?
     ORDER BY m.created_at DESC
     LIMIT 1`,
    [dealId],
  );
  return lastMsg?.sender_role === 'cliente';
}

export async function maybeAutoReplyClientChat(dealId, gestorUserId, clientUserId) {
  try {
    if (!await shouldAutoReplyChat(gestorUserId, dealId)) return;

    const aiUser = await getGestorAiConfig(gestorUserId);
    if (!aiUser?.ai_provider || !aiUser?.ai_api_key) return;

    const deal = await get(
      `SELECT d.title, d.stage, c.name AS contact_name, g.name AS gestor_name
       FROM crm_deals d
       LEFT JOIN contacts c ON c.id = d.contact_id
       LEFT JOIN gestores g ON g.user_id = d.user_id
       WHERE d.id = ?`,
      [dealId],
    );
    if (!deal) return;

    const messages = await query(
      `SELECT m.message, m.sender_id, m.is_ai_generated, u.role AS sender_role
       FROM chat_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.deal_id = ?
       ORDER BY m.created_at ASC
       LIMIT 20`,
      [dealId],
    );

    const history = [];
    let lastClientText = '';
    for (const msg of messages) {
      const text = (msg.message || '').trim();
      if (!text) continue;
      const isClient = msg.sender_role === 'cliente';
      if (isClient) lastClientText = text;
      history.push({
        role: isClient ? 'user' : 'assistant',
        content: text,
      });
    }
    if (!lastClientText) return;

    const customPrompt = aiUser.panel_assistant_prompt?.trim();
    const systemPrompt = `Eres el asistente virtual de ${deal.gestor_name || 'la gestoría'}, respondiendo en el chat de un trámite vehicular en nombre del gestor.
Responde SIEMPRE en español mexicano, con tono profesional, cálido y conciso (máximo 3 párrafos cortos).
NO inventes datos del trámite. Si no sabes algo, indica que el gestor confirmará pronto.
NO uses bloques de acción ni JSON. Solo el texto de la respuesta al cliente.
Trámite: ${deal.title || 'Sin título'} | Etapa: ${deal.stage || 'N/A'} | Cliente: ${deal.contact_name || 'Cliente'}
${customPrompt ? `\nInstrucciones del negocio:\n${customPrompt}` : ''}`;

    const replyText = await callAIProvider(aiUser, systemPrompt, history.slice(0, -1), lastClientText);
    const cleanReply = (replyText || '').trim();
    if (!cleanReply) return;

    const msgId = uuid();
    await run(
      `INSERT INTO chat_messages (id, deal_id, sender_id, message, is_ai_generated)
       VALUES (?, ?, ?, ?, 1)`,
      [msgId, dealId, gestorUserId, cleanReply],
    );

    const saved = await get(
      `SELECT m.id, m.sender_id, m.message, m.file_url, m.created_at, u.name AS sender_name, u.role AS sender_role
       FROM chat_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.id = ?`,
      [msgId],
    );

    if (clientUserId) {
      const notifId = uuid();
      const title = 'Respuesta de tu gestoría';
      const body = cleanReply.substring(0, 100);
      await run(
        `INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, 'new_message', ?, ?, ?)`,
        [notifId, clientUserId, title, body, dealId],
      );
      emitUserNotification(clientUserId, {
        id: notifId,
        type: 'new_message',
        title,
        body,
        ref_id: dealId,
        is_read: 0,
        created_at: new Date().toISOString(),
      });
    }

    emitChatMessage(dealId, saved);
  } catch (err) {
    console.error('chat auto-reply error:', err.message);
  }
}
