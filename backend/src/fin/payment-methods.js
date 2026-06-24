const PREDEFINED_LABELS = {
  stripe: 'Stripe',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'Mercado Pago',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
  general: 'General',
};

export function parseFinPaymentMethodsJson(raw) {
  if (!raw) return null;
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

/** IDs habilitados para registro manual (excluye stripe por defecto). */
export function enabledManualPaymentMethodIds(methodsJson, { includeStripe = false } = {}) {
  const parsed = parseFinPaymentMethodsJson(methodsJson);
  if (!parsed?.length) return [];
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

  const unique = [...new Set(ids)];
  return unique;
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
