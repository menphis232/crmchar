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

/** Parsea DD/MM/AAAA o YYYY-MM-DD → YYYY-MM-DD. Vacío si inválido. */
export function parseDateOnlyMx(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const iso = toDateOnlyIso(raw);
  if (iso) return iso;
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (!m) return '';
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
