/** Referencia al servidor Socket.IO (se asigna desde index.js). */
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
