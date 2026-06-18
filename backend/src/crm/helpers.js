import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import {
  dealTypeForRole, mapInquiryStatus, mapSolicitudStatus, templateCategoryForRole,
} from './stages.js';

const DEFAULT_TEMPLATES = {
  tramite: [
    { name: 'Confirmación de solicitud', content: 'Hola {{nombre}}, recibimos tu solicitud de {{titulo}}. Te contactaremos en breve.' },
    { name: 'Documentos faltantes', content: 'Hola {{nombre}}, para continuar con tu trámite necesitamos los siguientes documentos...' },
    { name: 'Trámite completado', content: 'Hola {{nombre}}, tu trámite ha sido completado exitosamente. ¡Gracias por confiar en nosotros!' },
  ],
  venta: [
    { name: 'Primera respuesta', content: 'Hola {{nombre}}, gracias por tu interés en el {{titulo}}. ¿Te gustaría agendar una visita?' },
    { name: 'Invitación a prueba', content: 'Hola {{nombre}}, el vehículo está disponible. ¿Qué día te conviene venir a verlo?' },
    { name: 'Propuesta de precio', content: 'Hola {{nombre}}, te comparto la propuesta para el {{titulo}}. Quedo atento a tus comentarios.' },
  ],
};

export async function findOrCreateContact(userId, { name, email, phone, whatsapp, source = 'directorio' }) {
  if (email) {
    const existing = await get(
      'SELECT * FROM contacts WHERE user_id = ? AND email = ? LIMIT 1',
      [userId, email.toLowerCase()],
    );
    if (existing) return existing;
  }
  if (phone) {
    const existing = await get(
      'SELECT * FROM contacts WHERE user_id = ? AND phone = ? LIMIT 1',
      [userId, phone],
    );
    if (existing) return existing;
  }

  const id = uuid();
  await run(
    `INSERT INTO contacts (id, user_id, name, email, phone, whatsapp, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, name, email?.toLowerCase() || null, phone || null, whatsapp || phone || null, source],
  );
  return get('SELECT * FROM contacts WHERE id = ?', [id]);
}

export async function ensureDefaultTemplates(userId, role) {
  const category = templateCategoryForRole(role);
  const count = await get(
    'SELECT COUNT(*) as c FROM message_templates WHERE user_id = ? AND template_category = ?',
    [userId, category],
  );
  if (count.c > 0) return;

  for (const t of DEFAULT_TEMPLATES[category]) {
    await run(
      'INSERT INTO message_templates (id, user_id, name, content, template_category) VALUES (?, ?, ?, ?, ?)',
      [uuid(), userId, t.name, t.content, category],
    );
  }
}

export async function createDealFromSolicitud(solicitud, gestorUserId, extra = {}) {
  const contact = await findOrCreateContact(gestorUserId, {
    name: solicitud.client_name || solicitud.clientName,
    email: solicitud.client_email || extra.clientEmail,
    phone: solicitud.client_phone || extra.clientPhone,
    source: 'directorio',
  });

  const dealId = uuid();
  const stage = mapSolicitudStatus(solicitud.status);
  const title = solicitud.service_name || solicitud.serviceName || 'Trámite vehicular';
  const estimatedValue = extra.estimatedValue || 0;
  
  const crypto = await import('crypto');
  const trackingCode = crypto.randomBytes(4).toString('hex').toUpperCase();

  await run(
    `INSERT INTO crm_deals (id, user_id, contact_id, deal_type, title, stage, ref_type, ref_id, tracking_code, stage_changed_at, estimated_value, client_message)
     VALUES (?, ?, ?, 'tramite', ?, ?, 'solicitud', ?, ?, NOW(), ?, ?)`,
    [dealId, gestorUserId, contact.id, title, stage, solicitud.id, trackingCode, estimatedValue, extra.clientMessage || null],
  );

  console.log(`[SIMULACIÓN CORREO] Enviando email a ${contact.email} con el código de seguimiento: ${trackingCode}`);

  try {
    await run('UPDATE solicitudes SET deal_id = ? WHERE id = ?', [dealId, solicitud.id]);
  } catch {
    // deal_id column may not exist on older schemas until migration alters table
  }

  await run(
    `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content)
     VALUES (?, ?, ?, 'note', ?)`,
    [uuid(), dealId, gestorUserId, `Solicitud recibida: ${title}`],
  );

  return dealId;
}

export async function createDealFromInquiry(inquiry, dealerUserId) {
  const contact = await findOrCreateContact(dealerUserId, {
    name: inquiry.client_name || inquiry.clientName,
    email: inquiry.client_email || inquiry.clientEmail,
    phone: inquiry.client_phone || inquiry.clientPhone,
    source: 'catalogo_autos',
  });

  const dealId = uuid();
  const stage = mapInquiryStatus(inquiry.status);
  const title = inquiry.make && inquiry.model
    ? `${inquiry.make} ${inquiry.model}`
    : 'Consulta de vehículo';

  await run(
    `INSERT INTO crm_deals (id, user_id, contact_id, deal_type, title, stage, ref_type, ref_id, auto_id, stage_changed_at)
     VALUES (?, ?, ?, 'venta_auto', ?, ?, 'auto_inquiry', ?, ?, NOW())`,
    [dealId, dealerUserId, contact.id, title, stage, inquiry.id, inquiry.auto_id || inquiry.autoId],
  );

  try {
    await run('UPDATE auto_inquiries SET deal_id = ? WHERE id = ?', [dealId, inquiry.id]);
  } catch { /* column optional until migration */ }

  const msg = inquiry.message || '';
  await run(
    `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content)
     VALUES (?, ?, ?, 'message', ?)`,
    [uuid(), dealId, dealerUserId, msg],
  );

  return dealId;
}

export async function createManualVentaDeal(dealerUserId, data) {
  const {
    clientName,
    clientEmail,
    clientPhone,
    title,
    autoId,
    message,
    estimatedValue,
    stage = 'lead_nuevo',
  } = data;

  const contact = await findOrCreateContact(dealerUserId, {
    name: clientName.trim(),
    email: clientEmail?.trim() || null,
    phone: clientPhone?.trim() || null,
    source: 'manual',
  });

  let dealTitle = title?.trim() || '';
  let auto_id = autoId || null;
  let estValue = Number(estimatedValue) || 0;

  if (auto_id) {
    const auto = await get(
      'SELECT id, make, model, year, price, special_price FROM autos WHERE id = ? AND user_id = ?',
      [auto_id, dealerUserId],
    );
    if (!auto) throw new Error('Vehículo no encontrado en tu inventario');
    if (!dealTitle) dealTitle = `${auto.make} ${auto.model} ${auto.year}`;
    if (!estValue) estValue = Number(auto.special_price || auto.price || 0);
  }

  if (!dealTitle) dealTitle = 'Lead manual';

  const dealId = uuid();
  await run(
    `INSERT INTO crm_deals (id, user_id, contact_id, deal_type, title, stage, ref_type, ref_id, auto_id, stage_changed_at, estimated_value, client_message)
     VALUES (?, ?, ?, 'venta_auto', ?, ?, NULL, NULL, ?, NOW(), ?, ?)`,
    [dealId, dealerUserId, contact.id, dealTitle, stage, auto_id, estValue, message?.trim() || null],
  );

  await run(
    `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content)
     VALUES (?, ?, ?, 'note', ?)`,
    [uuid(), dealId, dealerUserId, 'Lead registrado manualmente'],
  );

  if (message?.trim()) {
    await run(
      `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content)
       VALUES (?, ?, ?, 'message', ?)`,
      [uuid(), dealId, dealerUserId, message.trim()],
    );
  }

  return dealId;
}

export function contactRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    source: row.source,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function dealRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    dealType: row.deal_type,
    title: row.title,
    stage: row.stage,
    estimatedValue: Number(row.estimated_value || 0),
    internalNotes: row.internal_notes,
    refType: row.ref_type,
    refId: row.ref_id,
    autoId: row.auto_id,
    stageChangedAt: row.stage_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    contact: row.contact_name ? {
      id: row.contact_id,
      name: row.contact_name,
      email: row.contact_email,
      phone: row.contact_phone,
      whatsapp: row.contact_whatsapp,
    } : undefined,
    clientMessage: row.client_message,
    clientReply: row.client_reply,
    make: row.make,
    model: row.model,
    daysInStage: row.days_in_stage != null ? Number(row.days_in_stage) : 0,
    lostReason: row.lost_reason,
    firstResponseAt: row.first_response_at,
    contactId: row.contact_id,
    downPayment: Number(row.down_payment || 0),
    tradeInValue: Number(row.trade_in_value || 0),
    termMonths: Number(row.term_months || 0),
    trackingCode: row.tracking_code,
    paymentStatus: row.payment_status,
    paymentSessionId: row.payment_session_id,
  };
}

export function taskRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    dealId: row.deal_id,
    title: row.title,
    dueAt: row.due_at,
    completed: !!row.completed,
    createdAt: row.created_at,
    dealTitle: row.deal_title,
    contactName: row.contact_name,
  };
}

export async function markFirstResponse(dealId) {
  await run(
    'UPDATE crm_deals SET first_response_at = NOW() WHERE id = ? AND first_response_at IS NULL',
    [dealId],
  );
}

export async function getDealTypeForUser(userId, role) {
  return dealTypeForRole(role);
}
