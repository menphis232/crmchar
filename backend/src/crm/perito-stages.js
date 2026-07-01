export const PERITO_STAGES = [
  'tramite',
  'generacion_poliza',
  'poliza_pagada',
  'ingreso',
  'conclusion',
  'enviado',
  'pago_servicio',
];

export const PERITO_STAGE_LABELS = {
  tramite: 'Trámite',
  generacion_poliza: 'Generación de póliza de pago',
  poliza_pagada: 'Póliza pagada',
  ingreso: 'Ingreso',
  conclusion: 'Conclusión',
  enviado: 'Enviado',
  pago_servicio: 'Pago de servicio',
};

export function peritoStagesForApi() {
  return PERITO_STAGES.map((id) => ({ id, label: PERITO_STAGE_LABELS[id] }));
}

export function isValidPeritoStage(stage) {
  return PERITO_STAGES.includes(stage);
}

export const PERITO_SUCCESS_STAGE = 'pago_servicio';
