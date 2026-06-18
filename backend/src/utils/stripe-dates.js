/** Helpers de fechas compatibles con Stripe API 2025+ (periodos en subscription items). */

export function tsToIso(unix) {
  if (unix == null || unix === '') return null;
  const n = typeof unix === 'number' ? unix : parseInt(String(unix), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = new Date(n * 1000);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function subscriptionPeriodEnd(sub) {
  if (!sub) return null;
  const item = sub.items?.data?.[0];
  return tsToIso(
    item?.current_period_end
    ?? sub.current_period_end
    ?? sub.cancel_at,
  );
}

export function subscriptionPeriodStart(sub) {
  if (!sub) return null;
  const item = sub.items?.data?.[0];
  return tsToIso(
    item?.current_period_start
    ?? sub.current_period_start,
  );
}

export function invoiceDisplayDate(inv) {
  if (!inv) return null;
  return tsToIso(
    inv.status_transitions?.paid_at
    ?? inv.effective_at
    ?? inv.status_transitions?.finalized_at
    ?? inv.period_start
    ?? inv.created,
  );
}
