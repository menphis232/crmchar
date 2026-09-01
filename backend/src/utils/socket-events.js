/** Referencia al servidor Socket.IO (se asigna desde index.js). */
import { notifyUserPush } from '../services/onesignal.js';

let ioRef = null;

export function setSocketIo(io) {
  ioRef = io;
}

/** Notifica al gestor y a quienes estén viendo el trámite que el pago fue acreditado. */
export function emitDealPaymentPaid({ dealId, userId, paymentStatus = 'paid', stage }) {
  if (!ioRef || !dealId) return;
  const payload = { dealId, paymentStatus, stage };
  if (userId) ioRef.to(`user_${userId}`).emit('deal_payment_paid', payload);
  ioRef.to(String(dealId)).emit('deal_payment_paid', payload);
}

/** Difunde un mensaje de chat a quienes tengan abierto el trámite. */
export function emitChatMessage(dealId, saved) {
  if (!ioRef || !dealId || !saved) return;
  ioRef.to(String(dealId)).emit('receive_message', { dealId: String(dealId), ...saved });
}

/** Notificación en tiempo real + push OneSignal al usuario. */
export function emitUserNotification(userId, notif) {
  if (!userId || !notif) return;

  if (ioRef) {
    ioRef.to(`user_${userId}`).emit('notification', notif);
  }

  const title = notif.title || 'Trámites MX';
  const body = notif.body || '';
  const refId = notif.ref_id || notif.refId;
  const url = refId ? `/panel/cliente?tramite=${refId}` : '/panel/cliente';

  void notifyUserPush(userId, { title, body, url }).catch(err => {
    console.warn('[OneSignal] emitUserNotification:', err.message);
  });
}
