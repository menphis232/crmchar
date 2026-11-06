import { normalizeMxPhone } from '../utils/phone.js';

/**
 * El contacto del trámite coincide con el usuario cliente por correo real
 * o por los últimos 10 dígitos del teléfono / WhatsApp.
 */
export function clientContactPredicate(user) {
  const email = String(user?.email || '').toLowerCase();
  const realEmail = email.endsWith('@clientes.tramitesmx.local') ? null : (email || null);
  const phone = normalizeMxPhone(user?.phone);
  const digits = `RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(%s,''),' ',''),'-',''),'+',''),'(',''),')',''), 10)`;
  const sql = `(
    (? IS NOT NULL AND c.email IS NOT NULL AND LOWER(c.email) = ?)
    OR (? IS NOT NULL AND (
      ${digits.replace('%s', 'c.phone')} = ?
      OR ${digits.replace('%s', 'c.whatsapp')} = ?
    ))
  )`;
  return { sql, params: [realEmail, realEmail, phone, phone, phone] };
}
