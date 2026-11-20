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

export function orderedStageIds(
  stagesConfig: CrmStageConfig[] | Record<string, string> | string[] = {},
): string[] {
  if (Array.isArray(stagesConfig)) {
    if (stagesConfig.length && typeof stagesConfig[0] === 'object' && stagesConfig[0] && 'id' in stagesConfig[0]) {
      return (stagesConfig as CrmStageConfig[]).map((s) => s.id);
    }
    if (stagesConfig.length && typeof stagesConfig[0] === 'string') {
      return stagesConfig as string[];
    }
  }
  if (stagesConfig && typeof stagesConfig === 'object') {
    return Object.keys(stagesConfig);
  }
  return [];
}

export function isBackwardStageMove(
  stagesConfig: CrmStageConfig[] | Record<string, string> | string[],
  fromStageId: string,
  toStageId: string,
): boolean {
  if (!fromStageId || !toStageId || fromStageId === toStageId) return false;
  const ids = orderedStageIds(stagesConfig);
  const fromIdx = ids.indexOf(fromStageId);
  const toIdx = ids.indexOf(toStageId);
  if (fromIdx < 0 || toIdx < 0) return false;
  return toIdx < fromIdx;
}

/** Trámites pagados no pueden retroceder en el embudo. */
export function isPaidDealBackwardMoveBlocked(
  deal: { stage?: string; paymentStatus?: string },
  stagesConfig: CrmStageConfig[] | Record<string, string> | string[],
  toStageId: string,
): boolean {
  if (deal.paymentStatus !== 'paid') return false;
  return isBackwardStageMove(stagesConfig, deal.stage || '', toStageId);
}

/** Etapa de pérdida real (no ids reutilizados mid-embudo, p.ej. TVM `perdido` = "PAGO DE LINEA"). */
export function looksLikeLostLabel(label?: string): boolean {
  const key = normalizeStageKey(label);
  return /perdid|cancel|rechaz/.test(key);
}

export function isLostStage(
  stageId: string,
  stagesConfig: CrmStageConfig[] | Record<string, string> | string[] = {},
): boolean {
  if (!stageId) return false;

  if (Array.isArray(stagesConfig) && stagesConfig.length && typeof stagesConfig[0] === 'object') {
    const stages = stagesConfig as CrmStageConfig[];
    const idx = stages.findIndex((s) => s.id === stageId);
    const stage = idx >= 0 ? stages[idx] : null;
    if (looksLikeLostLabel(stage?.label)) return true;
    // Id "perdido" a mitad del embudo con otro label → no es pérdida
    if (stageId === 'perdido' && idx >= 0 && idx < stages.length - 1) return false;
    if (stageId === 'perdido' && stage && !looksLikeLostLabel(stage.label)) return false;
    return false;
  }

  if (stagesConfig && typeof stagesConfig === 'object' && !Array.isArray(stagesConfig)) {
    const label = (stagesConfig as Record<string, string>)[stageId];
    if (looksLikeLostLabel(label)) return true;
    if (stageId === 'perdido' && label && !looksLikeLostLabel(label)) return false;
  }

  return stageId === 'perdido';
}

export function isCompletedStage(
  stageId: string,
  stagesConfig: CrmStageConfig[] | Record<string, string> | string[] = {},
): boolean {
  if (!stageId) return false;

  if (Array.isArray(stagesConfig) && stagesConfig.length && typeof stagesConfig[0] === 'object') {
    const stage = (stagesConfig as CrmStageConfig[]).find((s) => s.id === stageId);
    const label = normalizeStageKey(stage?.label || '');
    if (label === 'completado' || label === 'vendido' || /\bcompletad/.test(label)) return true;
    // Id "completado" reutilizado (ej. TVM = "INGRESO") → no es cierre
    if (stage && (stageId === 'completado' || stageId === 'vendido')) return false;
    return false;
  }

  if (stagesConfig && typeof stagesConfig === 'object' && !Array.isArray(stagesConfig)) {
    const label = normalizeStageKey((stagesConfig as Record<string, string>)[stageId] || '');
    if (label === 'completado' || label === 'vendido' || /\bcompletad/.test(label)) return true;
    if ((stageId === 'completado' || stageId === 'vendido') && label) return false;
  }

  return stageId === 'completado' || stageId === 'vendido';
}

export function isShippedStage(
  stageId: string,
  stagesConfig: CrmStageConfig[] | Record<string, string> | string[] = {},
): boolean {
  if (!stageId) return false;

  const idKey = normalizeStageKey(stageId);
  if (idKey === 'enviado' || /\benviad/.test(idKey)) return true;

  if (Array.isArray(stagesConfig) && stagesConfig.length && typeof stagesConfig[0] === 'object') {
    const stage = (stagesConfig as CrmStageConfig[]).find((s) => s.id === stageId);
    const label = normalizeStageKey(stage?.label || '');
    if (label === 'enviado' || /\benviad/.test(label)) return true;
  } else if (stagesConfig && typeof stagesConfig === 'object' && !Array.isArray(stagesConfig)) {
    const label = normalizeStageKey((stagesConfig as Record<string, string>)[stageId] || '');
    if (label === 'enviado' || /\benviad/.test(label)) return true;
  }

  return false;
}
