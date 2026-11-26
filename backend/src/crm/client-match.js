import { get } from '../db.js';
import { normalizeMxPhone } from '../utils/phone.js';

/**
 * El contacto del trámite coincide con el usuario cliente.
 *
 * - Si tiene correo real → SOLO por email (no arrastrar trámites ajenos
 *   que compartan el mismo teléfono de prueba / familiar).
 * - Si es cuenta solo-teléfono (@clientes.tramitesmx.local) → por teléfono.
 */
export function clientContactPredicate(user) {
  const email = String(user?.email || '').toLowerCase();
  const realEmail = email.endsWith('@clientes.tramitesmx.local') ? null : (email || null);
  const phone = normalizeMxPhone(user?.phone);
  const last10 = phone && phone.length >= 10 ? phone.slice(-10) : phone;
  const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(%s,''),' ',''),'-',''),'+',''),'(',''),')','')`;

  // Cuenta con email real: ownership estricto por correo del contacto.
  if (realEmail) {
    return {
      sql: `(? IS NOT NULL AND c.email IS NOT NULL AND LOWER(c.email) = ?)`,
      params: [realEmail, realEmail],
    };
  }

  // Cuenta solo-teléfono: match por número / últimos 10 dígitos.
  const sql = `(
    (? IS NOT NULL AND (
      ${digits.replace('%s', 'c.phone')} = ?
      OR ${digits.replace('%s', 'c.whatsapp')} = ?
      OR RIGHT(${digits.replace('%s', 'c.phone')}, 10) = ?
      OR RIGHT(${digits.replace('%s', 'c.whatsapp')}, 10) = ?
    ))
  )`;
  return { sql, params: [phone, phone, phone, last10, last10] };
}

/** Predicado de flotilla: principal moral ve toda la empresa; subusuario solo lo asignado. */
export async function clientVehiclePredicate(user) {
  const principalId = user?.parent_id || user?.id || null;
  if (!principalId) return clientContactPredicate(user);

  const empresa = await get(
    `SELECT id FROM contacts
     WHERE empresa_user_id = ? AND IFNULL(person_type, 'fisica') = 'moral'
     LIMIT 1`,
    [principalId],
  ).catch(() => null);

  if (!empresa) return clientContactPredicate(user);

  if (user.parent_id) {
    return {
      sql: `(c.empresa_user_id = ? AND cv.assigned_user_id = ?)`,
      params: [principalId, user.id],
    };
  }

  return {
    sql: `(c.empresa_user_id = ?)`,
    params: [principalId],
  };
}
