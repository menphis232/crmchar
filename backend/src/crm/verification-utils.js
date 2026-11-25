/** Calendario habitual de verificación por último dígito de placa (CDMX, Edomex y varios estados). */
const DIGIT_TO_VERIFICATION_MONTH = {
  5: 1, 6: 1,
  7: 2, 8: 2,
  3: 3, 4: 3,
  1: 4, 2: 4,
  9: 5, 0: 5,
};

const MONTH_NAMES = [
  '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const ENGOMADO_COLORS = ['amarillo', 'rosa', 'rojo', 'verde', 'azul'];
export const VERIFICATION_HOLOGRAMS = ['00', '0', '1', '2', 'exento'];

export function normalizeVerificationHologram(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'exento') return 'exento';
  if (raw === '00' || raw === '0' || raw === '1' || raw === '2') return raw;
  return null;
}

export function normalizeNextVerificationDate(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export function formatDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function plateLastDigit(plate) {
  const cleaned = String(plate || '').replace(/\s/g, '').toUpperCase();
  const match = cleaned.match(/(\d)(?!.*\d)/);
  return match ? Number(match[1]) : null;
}

export function verificationMonthForPlate(plate) {
  const digit = plateLastDigit(plate);
  if (digit == null) return null;
  return DIGIT_TO_VERIFICATION_MONTH[digit] ?? null;
}

function monthDiff(fromMonth, toMonth) {
  if (fromMonth == null || toMonth == null) return null;
  let diff = toMonth - fromMonth;
  if (diff < -6) diff += 12;
  if (diff > 6) diff -= 12;
  return diff;
}

export function getVerificationInfo(plate, now = new Date()) {
  const verMonth = verificationMonthForPlate(plate);
  if (!verMonth) {
    return { status: 'unknown', month: null, label: 'Sin calendario para esta placa' };
  }

  const currentMonth = now.getMonth() + 1;
  const diff = monthDiff(currentMonth, verMonth);
  const monthLabel = MONTH_NAMES[verMonth];

  if (diff === 0) {
    return { status: 'due', month: verMonth, label: `Verificación en ${monthLabel} (este mes)` };
  }
  if (diff === 1) {
    return { status: 'soon', month: verMonth, label: `Verificación en ${monthLabel} (próximo mes)` };
  }
  if (diff === -1) {
    return { status: 'overdue', month: verMonth, label: `Verificación en ${monthLabel} (mes pasado)` };
  }
  return { status: 'ok', month: verMonth, label: `Verificación en ${monthLabel}` };
}

export function isInsuranceExpired(expiry, now = new Date()) {
  const d = formatDateOnly(expiry);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return d < `${y}-${m}-${day}`;
}

export function vehicleRowWithVerification(row) {
  const verification = getVerificationInfo(row.plate);
  const insuranceExpiry = formatDateOnly(row.insurance_expiry);
  return {
    id: row.id,
    contactId: row.contact_id,
    plate: row.plate,
    circulationCardName: row.circulation_card_name || null,
    make: row.make,
    model: row.model,
    year: row.year != null ? Number(row.year) : null,
    state: row.state,
    engomadoColor: row.engomado_color,
    vehicleNotes: row.vehicle_notes,
    insuranceExpiry,
    insuranceExpired: isInsuranceExpired(insuranceExpiry),
    tenenciaStatus: row.tenencia_2026 || null,
    tenenciaYear: row.tenencia_year != null ? Number(row.tenencia_year) : null,
    verificationHologram: row.verification_hologram || null,
    nextVerificationDate: formatDateOnly(row.next_verification_date),
    verificationMonth: verification.month,
    verificationStatus: verification.status,
    verificationLabel: verification.label,
    createdAt: row.created_at,
  };
}
