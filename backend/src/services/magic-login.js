import crypto from 'crypto';
import { get, run } from '../db.js';
import { getFrontendBase } from '../utils/frontend-url.js';

const MAGIC_TTL_MINUTES = 60;

/**
 * Crea token mágico de un solo uso. Devuelve el token crudo o null.
 */
export async function createMagicLoginToken(userId) {
  const user = await get('SELECT id, role, status FROM users WHERE id = ?', [userId]);
  if (!user || user.role !== 'cliente') return null;
  if (user.status && user.status !== 'active' && user.status !== 'trialing') {
    if (user.status === 'suspended' || user.status === 'cancelled') return null;
  }

  const token = crypto.randomBytes(32).toString('hex');
  await run(
    `UPDATE users
     SET magic_login_token = ?, magic_login_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
     WHERE id = ?`,
    [token, MAGIC_TTL_MINUTES, userId],
  );
  return token;
}

/**
 * Genera un link de un solo uso para entrar al panel sin contraseña.
 * Solo para rol cliente.
 */
export async function createMagicLoginUrl(userId, { redirectPath = '/panel/cliente' } = {}) {
  const token = await createMagicLoginToken(userId);
  if (!token) return null;
  const base = getFrontendBase();
  const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
  return `${base}/login/magic/${token}?next=${encodeURIComponent(path)}`;
}

export async function createMagicLoginUrlByEmail(email, opts) {
  if (!email) return null;
  const user = await get('SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1', [email, 'cliente']);
  if (!user) return null;
  return createMagicLoginUrl(user.id, opts);
}

/** Cliente vinculado al deal (por email del contacto). */
export async function resolveClienteUserIdForDeal(dealId) {
  const row = await get(
    `SELECT u.id AS user_id
     FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     JOIN users u ON u.email = c.email AND u.role = 'cliente'
     WHERE d.id = ?
     LIMIT 1`,
    [dealId],
  );
  return row?.user_id || null;
}
