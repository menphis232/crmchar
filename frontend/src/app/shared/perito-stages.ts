export const PERITO_STAGES = [
  'tramite',
  'generacion_poliza',
  'poliza_pagada',
  'ingreso',
  'conclusion',
  'enviado',
  'pago_servicio',
] as const;

export type PeritoStageId = (typeof PERITO_STAGES)[number];

export const PERITO_STAGE_LABELS: Record<PeritoStageId, string> = {
  tramite: 'Trámite',
  generacion_poliza: 'Generación de póliza de pago',
  poliza_pagada: 'Póliza pagada',
  ingreso: 'Ingreso',
  conclusion: 'Conclusión',
  enviado: 'Enviado',
  pago_servicio: 'Pago de servicio',
};

export const PERITO_SUCCESS_STAGE: PeritoStageId = 'pago_servicio';

export function peritoStagesForUi() {
  return PERITO_STAGES.map((id) => ({ id, label: PERITO_STAGE_LABELS[id] }));
}
