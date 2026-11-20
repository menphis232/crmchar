import { pipelineStagesForUser } from './stages.js';

export function looksLikeLostLabel(label) {
  const key = String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return /perdid|cancel|rechaz/.test(key);
}

/** True solo si la etapa es pérdida real (no id `perdido` reutilizado mid-embudo). */
export function isLostStageId(stageId, role, stagesJson = null) {
  if (!stageId) return false;
  const stages = pipelineStagesForUser(role || 'gestor', stagesJson);
  if (!Array.isArray(stages) || !stages.length) return stageId === 'perdido';
  const idx = stages.findIndex((s) => s.id === stageId);
  const stage = idx >= 0 ? stages[idx] : null;
  if (looksLikeLostLabel(stage?.label)) return true;
  if (stageId === 'perdido' && idx >= 0 && idx < stages.length - 1) return false;
  if (stageId === 'perdido' && stage && !looksLikeLostLabel(stage.label)) return false;
  return stageId === 'perdido' && idx < 0;
}

/**
 * Un trámite está cerrado solo si está en la última etapa "ganadora" del embudo
 * real del gestor, o en una etapa de pérdida/cancelación.
 *
 * No hardcodear `completado`/`vendido`: en TVM el id `completado` es "INGRESO"
 * (post-pago) y el cierre real es otra etapa (p.ej. completado_<ts> = "COMPLETADO").
 */
export function isDealClosed(deal) {
  const id = deal?.stage;
  if (!id) return false;

  const stages = deal.pipeline_stages || pipelineStagesForUser(deal.owner_role || 'gestor', deal.crm_stages);
  if (!Array.isArray(stages) || !stages.length) {
    return id === 'perdido' || id === 'completado' || id === 'vendido';
  }

  const idx = stages.findIndex((s) => s.id === id);
  const current = idx >= 0 ? stages[idx] : null;
  const last = stages[stages.length - 1];
  const lastIsLost = last?.id === 'perdido' || looksLikeLostLabel(last?.label);

  // Etapa final de pérdida/cancelación
  if (id === last?.id && lastIsLost) return true;

  // Id "perdido" reutilizado a mitad del embudo (ej. TVM "PAGO DE LINEA") → no cerrado
  if (id === 'perdido' && idx >= 0 && idx < stages.length - 1 && !looksLikeLostLabel(current?.label)) {
    return false;
  }
  if (looksLikeLostLabel(current?.label)) return true;

  const closable = lastIsLost ? stages.slice(0, -1) : stages;
  const win = closable[closable.length - 1];
  return !!win && id === win.id;
}
