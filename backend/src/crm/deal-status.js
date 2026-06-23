import { pipelineStagesForUser } from './stages.js';

export function isDealClosed(deal) {
  const id = deal?.stage;
  if (!id) return false;
  if (id === 'perdido') return true;
  if (id === 'completado' || id === 'vendido') return true;
  const stages = deal.pipeline_stages || pipelineStagesForUser(deal.owner_role || 'gestor', deal.crm_stages);
  const last = stages[stages.length - 1];
  return !!last && id === last.id && last.id !== 'perdido';
}
