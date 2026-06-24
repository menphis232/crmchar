import { stagesForRole } from './stages.js';

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

function orderedStageIdsForUser(role, stagesJson) {
  return stagesForRole(role, stagesJson);
}

export function isBackwardStageMove(stageIds, fromStageId, toStageId) {
  if (!fromStageId || !toStageId || fromStageId === toStageId) return false;
  const fromIdx = stageIds.indexOf(fromStageId);
  const toIdx = stageIds.indexOf(toStageId);
  if (fromIdx < 0 || toIdx < 0) return false;
  return toIdx < fromIdx;
}

/** Trámites pagados no pueden retroceder en el embudo. */
export function isPaidDealBackwardMoveBlocked(deal, role, stagesJson, toStageId) {
  if (!deal || deal.payment_status !== 'paid') return false;
  const ids = orderedStageIdsForUser(role, stagesJson);
  return isBackwardStageMove(ids, deal.stage, toStageId);
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
