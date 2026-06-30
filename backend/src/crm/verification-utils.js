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

export function vehicleRowWithVerification(row) {
  const verification = getVerificationInfo(row.plate);
  return {
    id: row.id,
    contactId: row.contact_id,
    plate: row.plate,
    make: row.make,
    model: row.model,
    year: row.year != null ? Number(row.year) : null,
    state: row.state,
    engomadoColor: row.engomado_color,
    vehicleNotes: row.vehicle_notes,
    insuranceExpiry: row.insurance_expiry
      ? (row.insurance_expiry instanceof Date
          ? row.insurance_expiry.toISOString().slice(0, 10)
          : String(row.insurance_expiry).slice(0, 10))
      : null,
    tenenciaStatus: row.tenencia_2026 || null,
    tenenciaYear: row.tenencia_year != null ? Number(row.tenencia_year) : null,
    verificationMonth: verification.month,
    verificationStatus: verification.status,
    verificationLabel: verification.label,
    createdAt: row.created_at,
  };
}
