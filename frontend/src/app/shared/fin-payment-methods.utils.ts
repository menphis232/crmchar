import { FIN_ALL_METHODS } from '../models';

export interface FinPaymentMethodOption {
  id: string;
  label: string;
  icon: string;
  color: string;
  enabled?: boolean;
}

export type FinPaymentMethodRaw =
  | string
  | { id: string; label?: string; icon?: string; enabled?: boolean };

const PREDEFINED_MAP = Object.fromEntries(
  FIN_ALL_METHODS.map((m) => [m.id, { ...m }]),
) as Record<string, FinPaymentMethodOption>;

const FALLBACK_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mercadopago: 'MercadoPago',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
  general: 'General',
};

export function parseFinPaymentMethods(
  raw: FinPaymentMethodRaw[] | null | undefined,
  opts?: { excludeStripe?: boolean; onlyEnabled?: boolean },
): FinPaymentMethodOption[] {
  const excludeStripe = opts?.excludeStripe ?? false;
  const onlyEnabled = opts?.onlyEnabled ?? true;
  const methods: FinPaymentMethodOption[] = [];
  const seen = new Set<string>();

  for (const m of raw || []) {
    if (typeof m === 'string') {
      if (excludeStripe && m === 'stripe') continue;
      const pre = PREDEFINED_MAP[m];
      if (pre && !seen.has(m)) {
        seen.add(m);
        methods.push({ ...pre, enabled: true });
      }
      continue;
    }

    if (!m?.id || seen.has(m.id)) continue;
    if (excludeStripe && m.id === 'stripe') continue;
    if (onlyEnabled && m.enabled === false) continue;

    seen.add(m.id);
    const pre = PREDEFINED_MAP[m.id];
    if (pre) {
      methods.push({ ...pre, enabled: m.enabled !== false });
    } else {
      methods.push({
        id: m.id,
        label: m.label || m.id,
        icon: m.icon || '💰',
        color: '#C8A94A',
        enabled: m.enabled !== false,
      });
    }
  }

  return methods;
}

export function finPaymentMethodLabel(
  method: string,
  catalog: FinPaymentMethodOption[] = [],
): string {
  if (!method) return '—';
  if (method === 'general') return 'General';
  const found = catalog.find((m) => m.id === method);
  if (found) return found.label;
  if (FALLBACK_LABELS[method]) return FALLBACK_LABELS[method];
  return method;
}

export function buildFinPaymentMethodsPayload(
  allPredefined: readonly { id: string }[],
  customMethods: FinPaymentMethodOption[],
  selectedMethodIds: string[],
): FinPaymentMethodRaw[] {
  const predefinedSet = new Set(allPredefined.map((m) => m.id));
  const payload: FinPaymentMethodRaw[] = [];

  for (const id of selectedMethodIds) {
    if (id === 'stripe') continue;
    if (predefinedSet.has(id)) payload.push(id);
  }

  for (const cm of customMethods) {
    payload.push({
      id: cm.id,
      label: cm.label,
      icon: cm.icon,
      enabled: selectedMethodIds.includes(cm.id),
    });
  }

  return payload;
}
