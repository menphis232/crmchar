import crypto from 'crypto';
import { get } from '../db.js';

/** Vida útil del link de pago (horas). */
export const MP_PAYMENT_TTL_HOURS = 48;

/** Intentos de cobro por token+IP en la ventana. */
const PAY_RATE_MAX = 8;
const PAY_RATE_WINDOW_MS = 15 * 60 * 1000;
const payAttempts = new Map();

export function createPaymentLinkToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function paymentExpirySql() {
  return `DATE_ADD(NOW(), INTERVAL ${MP_PAYMENT_TTL_HOURS} HOUR)`;
}

/** true si el link sigue vigente (NULL = legado sin expiración). */
export function isPaymentTokenExpired(expiresAt) {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

/**
 * Rate limit simple en memoria (por proceso).
 * @returns {{ ok: boolean, retryAfterSec?: number }}
 */
export function rateLimitPaymentAttempt(key) {
  const now = Date.now();
  let entry = payAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + PAY_RATE_WINDOW_MS };
    payAttempts.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > PAY_RATE_MAX) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  return { ok: true };
}

/**
 * Solo emitir magic login si el email del pagador coincide con el del cliente del trámite.
 * Evita que quien tenga el link y pague con otro correo entre al panel del cliente.
 */
export async function payerMatchesDealClient(dealId, payerEmail) {
  const email = String(payerEmail || '').trim().toLowerCase();
  if (!email || !dealId) return false;

  const row = await get(
    `SELECT LOWER(TRIM(c.email)) AS contact_email
     FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE d.id = ?
     LIMIT 1`,
    [dealId],
  );
  const contactEmail = row?.contact_email || null;
  if (!contactEmail) return false;
  if (contactEmail.endsWith('@clientes.tramitesmx.local')) return false;
  return contactEmail === email;
}
