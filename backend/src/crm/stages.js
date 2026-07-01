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

const PIPELINE_KEY = { gestor: 'tramite', concesionaria: 'venta' };

export function pipelineForRole(role) {
  return role === 'gestor' ? 'tramite' : 'venta';
}

/** Etapas guardadas para un pipeline concreto (soporta JSON anidado o array legacy). */
export function parseCrmStagesForRole(role, userStagesJson = null) {
  if (!userStagesJson) return null;

  let parsed = userStagesJson;
  if (typeof userStagesJson === 'string') {
    try { parsed = JSON.parse(userStagesJson); } catch { return null; }
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const key = PIPELINE_KEY[role] || 'venta';
    const nested = parsed[key];
    if (Array.isArray(nested) && nested.length > 0) return nested;
    return null;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const ids = parsed.map((s) => s.id);
  const tramiteHits = ids.filter((id) => TRAMITE_STAGES.includes(id)).length;
  const ventaHits = ids.filter((id) => VENTA_STAGES.includes(id)).length;

  if (role === 'gestor') {
    if (ventaHits > tramiteHits) return null;
    return parsed;
  }
  if (tramiteHits > ventaHits) return null;
  return parsed;
}

/** Array de etapas para enviar al frontend. */
export function crmStagesArrayForRole(role, userStagesJson = null) {
  return parseCrmStagesForRole(role, userStagesJson);
}

/** Fusiona etapas al guardar sin pisar el embudo del otro negocio. */
export function mergeCrmStagesForSave(existingJson, role, newStages) {
  const key = PIPELINE_KEY[role] || 'venta';
  let store = {};

  if (existingJson) {
    let parsed = existingJson;
    if (typeof existingJson === 'string') {
      try { parsed = JSON.parse(existingJson); } catch { parsed = null; }
    }
    if (Array.isArray(parsed)) {
      const legacyKey = role === 'gestor' ? 'tramite' : 'venta';
      store[legacyKey] = parsed;
    } else if (parsed && typeof parsed === 'object') {
      store = { ...parsed };
    }
  }

  store[key] = newStages;
  return store;
}

export function stagesForRole(role, userStagesJson = null) {
  const custom = parseCrmStagesForRole(role, userStagesJson);
  if (custom?.length) {
    return custom.map((s) => s.id);
  }
  return role === 'gestor' ? TRAMITE_STAGES : VENTA_STAGES;
}

export function pipelineStagesForUser(role, userStagesJson = null) {
  const custom = parseCrmStagesForRole(role, userStagesJson);
  if (custom?.length) {
    return custom.map((s) => ({ id: s.id, label: s.label || s.id }));
  }
  const ids = role === 'gestor' ? TRAMITE_STAGES : VENTA_STAGES;
  const labels = role === 'gestor' ? TRAMITE_STAGE_LABELS : VENTA_STAGE_LABELS;
  return ids.map((id) => ({ id, label: labels[id] || id }));
}

export function stageLabelsForUser(role, userStagesJson = null) {
  const custom = parseCrmStagesForRole(role, userStagesJson);
  if (custom?.length) {
    const map = {};
    custom.forEach((s) => { map[s.id] = s.label; });
    return map;
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

/** Primera etapa del pipeline del gestor (respeta crm_stages personalizados). */
export function firstStageForGestor(userStagesJson = null) {
  const stages = stagesForRole('gestor', userStagesJson);
  return stages[0] || 'nuevo';
}
