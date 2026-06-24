function normalizeStageKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isPaymentLike(value) {
  const key = normalizeStageKey(value);
  return key === 'pago' || /\bpago\b/.test(key);
}

function parseStages(stagesJson) {
  if (!stagesJson) return [];
  try {
    const stages = typeof stagesJson === 'string' ? JSON.parse(stagesJson) : stagesJson;
    return Array.isArray(stages) ? stages : [];
  } catch {
    return [];
  }
}

function explicitPaymentStageId(stagesJson) {
  const stages = parseStages(stagesJson);
  const found = stages.find((s) => s.isPayment === true);
  return found?.id || null;
}

export function isPaymentStageId(stageId, stagesJson = null) {
  if (!stageId) return false;
  const explicitId = explicitPaymentStageId(stagesJson);
  if (explicitId) return explicitId === stageId;
  if (isPaymentLike(stageId)) return true;
  const stages = parseStages(stagesJson);
  const stage = stages.find((s) => s.id === stageId);
  if (stage?.label && isPaymentLike(stage.label)) return true;
  return false;
}

export function isDealPaymentLocked(deal, stagesJson = null) {
  if (!deal) return false;
  if (deal.payment_status === 'paid') return false;
  return isPaymentStageId(deal.stage, stagesJson);
}

export function paymentMethodLabel(method) {
  const map = {
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    mercadopago: 'Mercado Pago',
    stripe: 'Tarjeta (Stripe)',
    tarjeta: 'Tarjeta',
    otro: 'Otro',
  };
  return map[method] || method || 'Otro';
}
