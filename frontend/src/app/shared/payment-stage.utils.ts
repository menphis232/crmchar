export interface CrmStageConfig {
  id: string;
  label: string;
  isPayment?: boolean;
}

export function normalizeStageKey(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isPaymentLike(value?: string): boolean {
  const key = normalizeStageKey(value);
  return key === 'pago' || /\bpago\b/.test(key);
}

function explicitPaymentStageId(stagesConfig: CrmStageConfig[] | null | undefined): string | null {
  if (!Array.isArray(stagesConfig)) return null;
  const found = stagesConfig.find((s) => s.isPayment === true);
  return found?.id || null;
}

export function isPaymentStage(
  stageId: string,
  stagesConfig: CrmStageConfig[] | Record<string, string> = {},
): boolean {
  if (!stageId) return false;

  if (Array.isArray(stagesConfig)) {
    const explicitId = explicitPaymentStageId(stagesConfig);
    if (explicitId) return explicitId === stageId;
    const stage = stagesConfig.find((s) => s.id === stageId);
    return isPaymentLike(stageId) || isPaymentLike(stage?.label);
  }

  if (isPaymentLike(stageId)) return true;
  return isPaymentLike(stagesConfig[stageId]);
}

export function isDealPaymentLocked(
  deal: { stage?: string; paymentStatus?: string },
  stagesConfig: CrmStageConfig[] | Record<string, string> = {},
): boolean {
  return isPaymentStage(deal.stage || '', stagesConfig) && deal.paymentStatus !== 'paid';
}
