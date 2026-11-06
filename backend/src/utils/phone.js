/** Teléfono de México a 10 dígitos. Quita espacios, guiones y la lada 52 / 521. Null si no son 10 dígitos. */
export function normalizeMxPhone(value) {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('521')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('52')) digits = digits.slice(2);
  return digits.length === 10 ? digits : null;
}

/** Los peritos entran con teléfono; users.email es obligatorio y único, así que se guarda uno interno que nunca recibe correos. */
export function peritoInternalEmail(phone) {
  return `perito.${phone}@peritos.tramitesmx.local`;
}

/** Los clientes creados solo con teléfono usan un correo interno. Entran con los 10 dígitos. */
export function clienteInternalEmail(phone) {
  return `cliente.${phone}@clientes.tramitesmx.local`;
}

export function isInternalClientEmail(email) {
  return String(email || '').toLowerCase().endsWith('@clientes.tramitesmx.local');
}

/** Abre WhatsApp con el texto listo. Los 10 dígitos de México llevan lada 52. */
export function whatsappMeUrl(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const full = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}
