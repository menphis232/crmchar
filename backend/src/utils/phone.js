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
