/**
 * Normaliza teléfono para login/CRM.
 * - México: 10 dígitos (quita lada 52 / 521).
 * - Internacional: dígitos E.164 sin "+", 8–15 (ej. +1 312 532 6515 → 13125326515).
 */
export function normalizeMxPhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return null;

  // México con lada internacional
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);

  if (digits.length === 10) return digits;

  // Internacional (USA/Canada +1, etc.)
  if (digits.length >= 8 && digits.length <= 15) return digits;

  return null;
}

/** Los peritos entran con teléfono; users.email es obligatorio y único, así que se guarda uno interno que nunca recibe correos. */
export function peritoInternalEmail(phone) {
  return `perito.${phone}@peritos.tramitesmx.local`;
}

/** Los clientes creados solo con teléfono usan un correo interno. Entran con el número normalizado. */
export function clienteInternalEmail(phone) {
  return `cliente.${phone}@clientes.tramitesmx.local`;
}

export function isInternalClientEmail(email) {
  return String(email || '').toLowerCase().endsWith('@clientes.tramitesmx.local');
}

/** Abre WhatsApp con el texto listo. Los 10 dígitos de México llevan lada 52; el resto se usa tal cual (E.164). */
export function whatsappMeUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
