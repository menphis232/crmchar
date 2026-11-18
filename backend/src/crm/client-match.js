import { normalizeMxPhone } from '../utils/phone.js';

/**
 * El contacto del trámite coincide con el usuario cliente por correo real
 * o por teléfono (número completo o últimos 10 dígitos para compatibilidad MX).
 */
export function clientContactPredicate(user) {
  const email = String(user?.email || '').toLowerCase();
  const realEmail = email.endsWith('@clientes.tramitesmx.local') ? null : (email || null);
  const phone = normalizeMxPhone(user?.phone);
  const last10 = phone && phone.length >= 10 ? phone.slice(-10) : phone;
  const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(%s,''),' ',''),'-',''),'+',''),'(',''),')','')`;
  const sql = `(
    (? IS NOT NULL AND c.email IS NOT NULL AND LOWER(c.email) = ?)
    OR (? IS NOT NULL AND (
      ${digits.replace('%s', 'c.phone')} = ?
      OR ${digits.replace('%s', 'c.whatsapp')} = ?
      OR RIGHT(${digits.replace('%s', 'c.phone')}, 10) = ?
      OR RIGHT(${digits.replace('%s', 'c.whatsapp')}, 10) = ?
    ))
  )`;
  return { sql, params: [realEmail, realEmail, phone, phone, phone, last10, last10] };
}
