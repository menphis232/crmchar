/** Extrae YYYY-MM-DD sin convertir por zona horaria. */
export function toDateOnlyIso(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Formato México: DD/MM/AAAA (día/mes/año). */
export function formatDateOnlyMx(value: string | Date | null | undefined): string {
  const iso = toDateOnlyIso(value);
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
