import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { get, query, run } from '../db.js';
import { sendEmail } from '../utils/mailer.js';
import {
  dealTypeForRole, mapDealStageToSolicitudStatus, mapInquiryStatus, mapSolicitudStatus, templateCategoryForRole,
  firstStageForGestor,
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

export async function findOrCreateContact(userId, { name, email, phone, whatsapp, source = 'directorio', pipeline = 'tramite' }) {
  const pipe = pipeline === 'venta' ? 'venta' : 'tramite';
  if (email) {
    const existing = await get(
      'SELECT * FROM contacts WHERE user_id = ? AND email = ? AND pipeline = ? LIMIT 1',
      [userId, email.toLowerCase(), pipe],
    );
    if (existing) return existing;
  }
  if (phone) {
    const existing = await get(
      'SELECT * FROM contacts WHERE user_id = ? AND phone = ? AND pipeline = ? LIMIT 1',
      [userId, phone, pipe],
    );
    if (existing) return existing;
  }

  const id = uuid();
  await run(
    `INSERT INTO contacts (id, user_id, pipeline, name, email, phone, whatsapp, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, pipe, name, email?.toLowerCase() || null, phone || null, whatsapp || phone || null, source],
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
    pipeline: 'tramite',
  });

  const dealId = uuid();
  const userRow = await get('SELECT crm_stages FROM users WHERE id = ?', [gestorUserId]);
  const initialStage = firstStageForGestor(userRow?.crm_stages);
  const title = solicitud.service_name || solicitud.serviceName || 'Trámite vehicular';
  const estimatedValue = extra.estimatedValue || 0;
  
  const crypto = await import('crypto');
  const trackingCode = crypto.randomBytes(4).toString('hex').toUpperCase();

  await run(
    `INSERT INTO crm_deals (id, user_id, contact_id, deal_type, title, stage, ref_type, ref_id, tracking_code, stage_changed_at, estimated_value, client_message)
     VALUES (?, ?, ?, 'tramite', ?, ?, 'solicitud', ?, ?, NOW(), ?, ?)`,
    [dealId, gestorUserId, contact.id, title, initialStage, solicitud.id, trackingCode, estimatedValue, extra.clientMessage || null],
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
    pipeline: 'venta',
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
    pipeline: 'venta',
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

export async function ensureClientUser({ clientName, clientEmail, gestorUserId, gestorName, serviceName }) {
  if (!clientEmail?.trim()) return;
  const email = clientEmail.trim().toLowerCase();
  const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
  if (existingUser) return;

  const tempPassword = Math.random().toString(36).slice(-8);
  const hash = bcrypt.hashSync(tempPassword, 10);
  const userId = uuid();
  await run(
    'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
    [userId, email, hash, 'cliente', clientName.trim()],
  );

  const tramiteLabel = serviceName || 'Trámite vehicular';
  const html = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 500;">Hola ${clientName.trim()},</h2>
    <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Tu gestor <strong>${gestorName || 'asignado'}</strong> registró tu trámite de <strong>${tramiteLabel}</strong> en nuestra plataforma.</p>
    <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">Te hemos creado una cuenta para que puedas hacer seguimiento, chatear con tu gestor y subir documentos.</p>
    <div style="background-color: #0f1117; border: 1px dashed #c8a94a; border-radius: 8px; padding: 20px; margin: 30px 0;">
      <p style="color: #a0aec0; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Tus credenciales de acceso:</p>
      <ul style="color: #c8a94a; font-size: 16px; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 5px;"><strong>Usuario/Email:</strong> <span style="color: #ffffff;">${email}</span></li>
        <li><strong>Contraseña provisional:</strong> <span style="color: #ffffff;">${tempPassword}</span></li>
      </ul>
    </div>
    <p style="color: #a0aec0; font-size: 14px; text-align: center;">Por favor cambia tu contraseña en la sección de Ajustes al iniciar sesión.</p>
  `;
  try {
    await sendEmail(email, 'Tu cuenta ha sido creada - Seguimiento de trámite', 'Tu cuenta ha sido creada', html, gestorUserId);
  } catch (e) {
    console.error('Error enviando correo de bienvenida al cliente:', e);
  }
}

export async function createManualTramiteDeal(gestorUserId, data) {
  const {
    clientName,
    clientEmail,
    clientPhone,
    title,
    serviceName,
    location,
    message,
    estimatedValue,
    stage = 'nuevo',
  } = data;

  const gestor = await get('SELECT id, name FROM gestores WHERE user_id = ?', [gestorUserId]);
  if (!gestor) throw new Error('Perfil de gestor no encontrado');

  let dealTitle = title?.trim() || serviceName?.trim() || '';
  let estValue = Number(estimatedValue) || 0;

  if (serviceName?.trim()) {
    const service = await get(
      'SELECT name, price FROM gestor_services WHERE gestor_id = ? AND name = ? LIMIT 1',
      [gestor.id, serviceName.trim()],
    );
    if (!service) throw new Error('Servicio no encontrado en tu catálogo');
    if (!dealTitle) dealTitle = service.name;
    if (!estValue) estValue = Number(service.price || 0);
  }

  if (!dealTitle) dealTitle = 'Trámite manual';

  await ensureClientUser({
    clientName: clientName.trim(),
    clientEmail,
    gestorUserId,
    gestorName: gestor.name,
    serviceName: dealTitle,
  });

  const contact = await findOrCreateContact(gestorUserId, {
    name: clientName.trim(),
    email: clientEmail?.trim() || null,
    phone: clientPhone?.trim() || null,
    source: 'manual',
    pipeline: 'tramite',
  });

  const solicitudId = uuid();
  const solStatus = mapDealStageToSolicitudStatus(stage);
  await run(
    `INSERT INTO solicitudes (id, gestor_id, client_name, service_name, location, client_email, client_phone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      solicitudId, gestor.id, clientName.trim(), dealTitle,
      location?.trim() || null,
      clientEmail?.trim()?.toLowerCase() || null,
      clientPhone?.trim() || null,
      solStatus,
    ],
  );

  const dealId = uuid();
  const trackingCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  await run(
    `INSERT INTO crm_deals (id, user_id, contact_id, deal_type, title, stage, ref_type, ref_id, tracking_code, stage_changed_at, estimated_value, client_message)
     VALUES (?, ?, ?, 'tramite', ?, ?, 'solicitud', ?, ?, NOW(), ?, ?)`,
    [dealId, gestorUserId, contact.id, dealTitle, stage, solicitudId, trackingCode, estValue, message?.trim() || null],
  );

  try {
    await run('UPDATE solicitudes SET deal_id = ? WHERE id = ?', [dealId, solicitudId]);
  } catch { /* column optional until migration */ }

  await run(
    `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content)
     VALUES (?, ?, ?, 'note', ?)`,
    [uuid(), dealId, gestorUserId, 'Trámite registrado manualmente'],
  );

  if (message?.trim()) {
    await run(
      `INSERT INTO crm_activities (id, deal_id, user_id, activity_type, content)
       VALUES (?, ?, ?, 'message', ?)`,
      [uuid(), dealId, gestorUserId, message.trim()],
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
    residenceState: row.residence_state,
    vehicleCount: row.vehicleCount != null ? Number(row.vehicleCount) : undefined,
    plates: row.plates || undefined,
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
    assignedTo: row.assigned_to || null,
    assignedToName: row.assigned_to_name || null,
    assignedAt: row.assigned_at || null,
    closedBy: row.closed_by || null,
    closedByName: row.closed_by_name || null,
    peritoId: row.perito_id || null,
    peritoName: row.perito_name || null,
    peritoStage: row.perito_stage || null,
    peritoPolizaStatus: row.perito_poliza_status || 'pendiente',
    peritoAssignedAt: row.perito_assigned_at || null,
    peritoCompletedAt: row.perito_completed_at || null,
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
