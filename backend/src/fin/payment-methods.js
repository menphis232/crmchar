const PREDEFINED_LABELS = {
  stripe: 'Stripe',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
  general: 'General',
};

const DEFAULT_ACTIVE_PREDEFINED = ['efectivo', 'transferencia', 'mercadopago'];

function isPredefinedMethodId(id) {
  return Boolean(id && PREDEFINED_LABELS[id]);
}

export function parseFinPaymentMethodsJson(raw) {
  if (raw == null) return null;
  try {
    let value = raw;
    if (Buffer.isBuffer(value)) value = value.toString('utf8');
    if (typeof value === 'string') {
      value = JSON.parse(value);
      if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { /* keep */ }
      }
    }
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return Object.values(value);
    return null;
  } catch {
    return null;
  }
}

export function serializeFinPaymentMethodsForDb(methods) {
  return JSON.stringify(Array.isArray(methods) ? methods : []);
}

/** Si solo hay métodos personalizados guardados, incluir los predefinidos activos por defecto. */
export function normalizeStoredPaymentMethods(methods) {
  const list = Array.isArray(methods) ? [...methods] : [];
  if (!list.length) return [];

  const hasActivePredefined = list.some((m) => {
    if (typeof m === 'string') return m !== 'stripe';
    if (m?.id && isPredefinedMethodId(m.id)) return m.enabled !== false;
    return false;
  });

  if (hasActivePredefined) return list;
  return [...DEFAULT_ACTIVE_PREDEFINED, ...list];
}

/** IDs habilitados para registro manual (excluye stripe por defecto). */
export function enabledManualPaymentMethodIds(methodsJson, { includeStripe = false } = {}) {
  const parsed = normalizeStoredPaymentMethods(parseFinPaymentMethodsJson(methodsJson) ?? []);
  if (!parsed.length) return [];
  const ids = [];

  for (const m of parsed) {
    if (typeof m === 'string') {
      if (!includeStripe && m === 'stripe') continue;
      ids.push(m);
    } else if (m?.id) {
      if (m.enabled === false) continue;
      if (!includeStripe && m.id === 'stripe') continue;
      ids.push(m.id);
    }
  }

  return [...new Set(ids)];
}

export function resolvePaymentMethodLabel(method, methodsJson = null) {
  if (!method) return 'Otro';
  if (PREDEFINED_LABELS[method]) return PREDEFINED_LABELS[method];

  const parsed = parseFinPaymentMethodsJson(methodsJson) || [];
  for (const m of parsed) {
    if (typeof m === 'object' && m.id === method && m.label) return m.label;
  }
  return method;
}
