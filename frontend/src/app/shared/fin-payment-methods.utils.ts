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

export const DEFAULT_ACTIVE_PREDEFINED_IDS = ['efectivo', 'transferencia', 'mercadopago'] as const;

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
      if (seen.has(m)) continue;
      seen.add(m);
      const pre = PREDEFINED_MAP[m];
      methods.push(
        pre
          ? { ...pre, enabled: true }
          : { id: m, label: m, icon: '💰', color: '#C8A94A', enabled: true },
      );
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

/** Métodos activos listos para selects (ingresos, egresos, pago externo). */
export function buildActiveFormMethods(
  allPredefined: readonly FinPaymentMethodOption[],
  customMethods: FinPaymentMethodOption[],
  selectedMethodIds: string[],
): FinPaymentMethodOption[] {
  const predefined = allPredefined.filter(
    (m) => m.id !== 'stripe' && selectedMethodIds.includes(m.id),
  );
  const custom = customMethods.filter((m) => selectedMethodIds.includes(m.id));
  return [...predefined, ...custom];
}

/** Une listas de métodos; la primera lista gana en caso de duplicados. */
export function mergeFormPaymentMethods(
  ...lists: FinPaymentMethodOption[][]
): FinPaymentMethodOption[] {
  const map = new Map<string, FinPaymentMethodOption>();
  for (const list of lists) {
    for (const m of list) {
      if (m.id === 'stripe') continue;
      if (!map.has(m.id)) map.set(m.id, m);
    }
  }
  return [...map.values()];
}
