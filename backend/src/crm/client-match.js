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
