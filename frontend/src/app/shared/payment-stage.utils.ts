export function normalizeStageKey(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isPaymentStage(stageId: string, stageLabels: Record<string, string> = {}): boolean {
  if (!stageId) return false;
  const idKey = normalizeStageKey(stageId);
  if (idKey === 'pago' || /\bpago\b/.test(idKey)) return true;
  const labelKey = normalizeStageKey(stageLabels[stageId]);
  return labelKey === 'pago' || /\bpago\b/.test(labelKey);
}

export function isDealPaymentLocked(
  deal: { stage?: string; paymentStatus?: string },
  stageLabels: Record<string, string> = {},
): boolean {
  return isPaymentStage(deal.stage || '', stageLabels) && deal.paymentStatus !== 'paid';
}

export const MANUAL_PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta (terminal externa)' },
  { id: 'otro', label: 'Otro' },
] as const;
