export const TRAMITE_STAGES = ['nuevo', 'contactado', 'en_tramite', 'documentacion', 'completado', 'perdido'];
export const VENTA_STAGES = ['lead_nuevo', 'contactado', 'interesado', 'visita', 'negociacion', 'vendido', 'perdido'];

export const TRAMITE_STAGE_LABELS = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  en_tramite: 'En trámite',
  documentacion: 'Documentación',
  completado: 'Completado',
  perdido: 'Perdido',
};

export const VENTA_STAGE_LABELS = {
  lead_nuevo: 'Lead nuevo',
  contactado: 'Contactado',
  interesado: 'Interesado',
  visita: 'Visita agendada',
  negociacion: 'Negociación',
  vendido: 'Vendido',
  perdido: 'Perdido',
};

export function stagesForRole(role, userStagesJson = null) {
  if (userStagesJson) {
    try {
      const stages = typeof userStagesJson === 'string' ? JSON.parse(userStagesJson) : userStagesJson;
      if (Array.isArray(stages) && stages.length > 0) {
        return stages.map(s => s.id);
      }
    } catch(e) {}
  }
  return role === 'gestor' ? TRAMITE_STAGES : VENTA_STAGES;
}

export function pipelineStagesForUser(role, userStagesJson = null) {
  if (userStagesJson) {
    try {
      const stages = typeof userStagesJson === 'string' ? JSON.parse(userStagesJson) : userStagesJson;
      if (Array.isArray(stages) && stages.length > 0) {
        return stages.map(s => ({ id: s.id, label: s.label || s.id }));
      }
    } catch (e) { /* fall through to defaults */ }
  }
  const ids = role === 'gestor' ? TRAMITE_STAGES : VENTA_STAGES;
  const labels = role === 'gestor' ? TRAMITE_STAGE_LABELS : VENTA_STAGE_LABELS;
  return ids.map(id => ({ id, label: labels[id] || id }));
}

export function stageLabelsForUser(role, userStagesJson = null) {
  if (userStagesJson) {
    try {
      const stages = typeof userStagesJson === 'string' ? JSON.parse(userStagesJson) : userStagesJson;
      if (Array.isArray(stages) && stages.length > 0) {
        const map = {};
        stages.forEach(s => map[s.id] = s.label);
        return map;
      }
    } catch(e) {}
  }
  return role === 'gestor' ? TRAMITE_STAGE_LABELS : VENTA_STAGE_LABELS;
}

export function dealTypeForRole(role) {
  return role === 'gestor' ? 'tramite' : 'venta_auto';
}

export function templateCategoryForRole(role) {
  return role === 'gestor' ? 'tramite' : 'venta';
}

export function mapSolicitudStatus(status) {
  return ({ nuevo: 'nuevo', en_proceso: 'en_tramite', completado: 'completado' })[status] || 'nuevo';
}

export function mapInquiryStatus(status) {
  return status === 'respondido' ? 'contactado' : 'lead_nuevo';
}

export function mapDealStageToSolicitudStatus(stage) {
  return ({
    nuevo: 'nuevo',
    contactado: 'en_proceso',
    en_tramite: 'en_proceso',
    documentacion: 'en_proceso',
    completado: 'completado',
    perdido: 'completado',
  })[stage] || 'nuevo';
}

export const LOST_REASONS = [
  'Precio alto',
  'Eligió otro proveedor',
  'No respondió',
  'No califica / canceló',
  'Otro',
];

export function initialStageForRole(role) {
  return role === 'gestor' ? 'nuevo' : 'lead_nuevo';
}
