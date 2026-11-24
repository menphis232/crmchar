import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { get, run } from '../db.js';
import { createDealFromSolicitud } from '../crm/helpers.js';
import { finalizeDealPayment } from './deal-payment.js';
import { getFrontendBase } from '../utils/frontend-url.js';
import { sendEmail } from '../utils/mailer.js';

/**
 * Crea un checkout pendiente (sin trámite). El deal se crea al confirmar el pago.
 */
export async function createPendingCheckout({
  gestor,
  clientName,
  clientEmail,
  clientPhone,
  location,
  serviceName,
  amount,
  customData = null,
}) {
  const token = uuid();
  const id = uuid();
  await run(
    `INSERT INTO mp_pending_checkouts
      (id, token, gestor_id, gestor_user_id, client_name, client_email, client_phone,
       location, service_name, amount, custom_data, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      token,
      gestor.id,
      gestor.user_id,
      clientName,
      clientEmail || null,
      clientPhone || null,
      location || null,
      serviceName,
      Number(amount),
      customData ? JSON.stringify(customData) : null,
    ],
  );

  const paymentUrl = `${getFrontendBase()}/pay/mp/${token}`;
  return { id, token, paymentUrl, amount: Number(amount) };
}

async function ensureClientAccountAfterPayment(pending, gestorUserId) {
  const clientEmail = pending.client_email;
  if (!clientEmail) return;

  const existingUser = await get('SELECT id FROM users WHERE email = ?', [clientEmail]);
  if (existingUser) return;

  const tempPassword = Math.random().toString(36).slice(-8);
  const hash = bcrypt.hashSync(tempPassword, 10);
  const userId = uuid();
  await run(
    'INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, ?, ?)',
    [userId, clientEmail, hash, 'cliente', pending.client_name],
  );

  const panelUrl = `${getFrontendBase()}/login/cliente`;
  const html = `
    <h2 style="color: #ffffff; font-size: 20px; font-weight: 500;">Hola ${pending.client_name},</h2>
    <p style="color: #a0aec0; font-size: 15px; line-height: 1.6;">
      Tu pago de <strong>${pending.service_name}</strong> fue confirmado. Ya puedes seguir tu trámite en el panel.
    </p>
    <div style="background-color: #0f1117; border: 1px dashed #c8a94a; border-radius: 8px; padding: 20px; margin: 30px 0;">
      <p style="color: #a0aec0; font-size: 13px; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Tus credenciales de acceso:</p>
      <ul style="color: #c8a94a; font-size: 16px; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 5px;"><strong>Usuario/Email:</strong> <span style="color: #ffffff;">${clientEmail}</span></li>
        <li><strong>Contraseña provisional:</strong> <span style="color: #ffffff;">${tempPassword}</span></li>
      </ul>
    </div>
    <div style="text-align: center; margin: 40px 0;">
      <a href="${panelUrl}" style="background: linear-gradient(135deg, #c8a94a, #d4af37); color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">Ir a mi panel</a>
    </div>
  `;
  try {
    await sendEmail(clientEmail, 'Pago confirmado — tu trámite ya está activo', 'Pago confirmado', html, gestorUserId);
  } catch (e) {
    console.error('No se pudo enviar correo post-pago:', e);
  }
}

export async function findPendingByToken(token) {
  return get(
    `SELECT p.*, u.mp_public_key, u.mp_access_token, u.name AS gestor_user_name
     FROM mp_pending_checkouts p
     JOIN users u ON u.id = p.gestor_user_id
     WHERE p.token = ?`,
    [token],
  );
}

export async function findPendingByOrderId(orderId) {
  return get(
    `SELECT p.*, u.mp_access_token
     FROM mp_pending_checkouts p
     JOIN users u ON u.id = p.gestor_user_id
     WHERE p.mp_order_id = ?`,
    [orderId],
  );
}

/**
 * Tras pago aprobado: crea solicitud + deal, registra ingreso y marca el pending como paid.
 */
export async function fulfillPendingCheckout(pending, { mpOrderId = null } = {}) {
  if (!pending) return { dealId: null, alreadyPaid: true };
  if (pending.status === 'paid') {
    return { dealId: pending.deal_id || null, alreadyPaid: true };
  }

  // Claim atómico para evitar doble creación (webhook + process-payment)
  const claim = await run(
    `UPDATE mp_pending_checkouts
     SET status = 'paid', paid_at = NOW(),
         mp_order_id = COALESCE(?, mp_order_id)
     WHERE id = ? AND status = 'pending'`,
    [mpOrderId || null, pending.id],
  );
  if (!claim?.affectedRows) {
    const again = await get('SELECT deal_id FROM mp_pending_checkouts WHERE id = ?', [pending.id]);
    return { dealId: again?.deal_id || null, alreadyPaid: true };
  }

  let customData = null;
  if (pending.custom_data) {
    try {
      customData = typeof pending.custom_data === 'string'
        ? JSON.parse(pending.custom_data)
        : pending.custom_data;
    } catch {
      customData = null;
    }
  }

  const solicitudId = uuid();
  await run(
    `INSERT INTO solicitudes
      (id, gestor_id, client_name, service_name, location, client_email, client_phone, custom_data, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'nuevo')`,
    [
      solicitudId,
      pending.gestor_id,
      pending.client_name,
      pending.service_name,
      pending.location || null,
      pending.client_email || null,
      pending.client_phone || null,
      customData ? JSON.stringify(customData) : null,
    ],
  );

  let clientMessage = '';
  if (customData && typeof customData === 'object') {
    clientMessage = Object.entries(customData)
      .map(([question, answer]) => `**${question}:**\n${answer}`)
      .join('\n\n');
  }

  const solicitud = await get('SELECT * FROM solicitudes WHERE id = ?', [solicitudId]);
  const dealId = await createDealFromSolicitud(solicitud, pending.gestor_user_id, {
    clientEmail: pending.client_email,
    clientPhone: pending.client_phone,
    estimatedValue: Number(pending.amount),
    clientMessage,
  });

  await finalizeDealPayment(dealId, {
    amount: Number(pending.amount),
    mpOrderId: mpOrderId || pending.mp_order_id || null,
    paymentMethod: 'mercadopago',
    keepStage: true,
  });

  await run(
    `UPDATE mp_pending_checkouts
     SET deal_id = ?, solicitud_id = ?
     WHERE id = ?`,
    [dealId, solicitudId, pending.id],
  );

  await ensureClientAccountAfterPayment(pending, pending.gestor_user_id);

  const notifId = uuid();
  await run(
    'INSERT INTO notifications (id, user_id, type, title, body, ref_id) VALUES (?, ?, ?, ?, ?, ?)',
    [
      notifId,
      pending.gestor_user_id,
      'nuevo_lead',
      'Trámite pagado',
      `${pending.client_name} pagó ${pending.service_name}. El trámite ya está en el pipeline.`,
      dealId,
    ],
  );

  return { dealId, solicitudId, alreadyPaid: false };
}
