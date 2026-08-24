/** Calendario Hoy No Circula / verificación CDMX y Zona Metropolitana (por último dígito de placa). */

export type EngomadoColor = 'amarillo' | 'rosa' | 'rojo' | 'verde' | 'azul';
export type WeekdayKey = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes';
export type Holograma = '0' | '1' | '2' | 0 | 1 | 2 | string | null | undefined;

export interface PlateCirculationRule {
  digit: number;
  color: EngomadoColor;
  colorLabel: string;
  weekday: WeekdayKey;
  weekdayLabel: string;
  verification1: string;
  verification2: string;
}

const RULES: Omit<PlateCirculationRule, 'digit'>[] = [
  { color: 'amarillo', colorLabel: 'Amarillo', weekday: 'lunes', weekdayLabel: 'Lunes', verification1: 'Enero y Febrero', verification2: 'Julio y Agosto' },
  { color: 'rosa', colorLabel: 'Rosa', weekday: 'martes', weekdayLabel: 'Martes', verification1: 'Febrero y Marzo', verification2: 'Agosto y Septiembre' },
  { color: 'rojo', colorLabel: 'Rojo', weekday: 'miercoles', weekdayLabel: 'Miércoles', verification1: 'Marzo y Abril', verification2: 'Septiembre y Octubre' },
  { color: 'verde', colorLabel: 'Verde', weekday: 'jueves', weekdayLabel: 'Jueves', verification1: 'Abril y Mayo', verification2: 'Octubre y Noviembre' },
  { color: 'azul', colorLabel: 'Azul', weekday: 'viernes', weekdayLabel: 'Viernes', verification1: 'Mayo y Junio', verification2: 'Noviembre y Diciembre' },
];

const DIGIT_RULE_INDEX: Record<number, number> = {
  5: 0, 6: 0,
  7: 1, 8: 1,
  3: 2, 4: 2,
  1: 3, 2: 3,
  9: 4, 0: 4,
};

const WEEKDAY_FROM_SHORT: Record<string, WeekdayKey | 'sabado' | 'domingo'> = {
  Mon: 'lunes',
  Tue: 'martes',
  Wed: 'miercoles',
  Thu: 'jueves',
  Fri: 'viernes',
  Sat: 'sabado',
  Sun: 'domingo',
};

export function plateLastDigit(plate: string | null | undefined): number | null {
  const cleaned = String(plate || '').replace(/\s/g, '').toUpperCase();
  const match = cleaned.match(/(\d)(?!.*\d)/);
  return match ? Number(match[1]) : null;
}

export function ruleForPlate(plate: string | null | undefined): PlateCirculationRule | null {
  const digit = plateLastDigit(plate);
  if (digit == null) return null;
  const idx = DIGIT_RULE_INDEX[digit];
  if (idx == null) return null;
  return { digit, ...RULES[idx] };
}

export function getMexicoCityCalendar(now = new Date()): {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: WeekdayKey | 'sabado' | 'domingo';
  weekdayLabel: string;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const weekdayShort = get('weekday');
  const weekday = WEEKDAY_FROM_SHORT[weekdayShort] || 'lunes';
  const labels: Record<string, string> = {
    lunes: 'Lunes',
    martes: 'Martes',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    sabado: 'Sábado',
    domingo: 'Domingo',
  };

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday,
    weekdayLabel: labels[weekday] || weekday,
  };
}

/** 1 = primer sábado del mes, 2 = segundo, … (solo válido si el día es sábado). */
export function saturdayOrdinalInMonth(year: number, month: number, day: number): number {
  let count = 0;
  for (let d = 1; d <= day; d++) {
    // noon UTC-ish local construction: use UTC date parts as civil CDMX date numbers
    const dow = new Date(Date.UTC(year, month - 1, d, 18, 0, 0)).getUTCDay();
    if (dow === 6) count++;
  }
  return count;
}

function normalizeHolograma(h: Holograma): '0' | '1' | '2' | null {
  if (h == null || h === '') return null;
  const s = String(h).trim();
  if (s === '0' || s === '1' || s === '2') return s;
  return null;
}

export interface CirculationCheck {
  rule: PlateCirculationRule | null;
  blockedToday: boolean;
  reason: string;
}

/**
 * Hoy No Circula (CDMX / ZM).
 * Entre semana: por dígito. Sábado: solo si se conoce holograma (0 libre, 1 non/par, 2 todos).
 */
export function checkCirculationToday(
  plate: string | null | undefined,
  holograma?: Holograma,
  now = new Date(),
): CirculationCheck {
  const rule = ruleForPlate(plate);
  const cal = getMexicoCityCalendar(now);

  if (!rule) {
    return { rule: null, blockedToday: false, reason: 'No se pudo leer el dígito de la placa' };
  }

  if (cal.weekday === 'domingo') {
    return { rule, blockedToday: false, reason: 'Domingo: sin restricción de engomado' };
  }

  if (cal.weekday !== 'sabado') {
    const blocked = rule.weekday === cal.weekday;
    return {
      rule,
      blockedToday: blocked,
      reason: blocked
        ? `Parada de engomado ${rule.colorLabel}: no circula los ${rule.weekdayLabel}`
        : `Hoy es ${cal.weekdayLabel}; su parada es ${rule.weekdayLabel}`,
    };
  }

  // Sábado
  const holo = normalizeHolograma(holograma);
  if (!holo || holo === '0') {
    return {
      rule,
      blockedToday: false,
      reason: holo === '0'
        ? 'Holograma 0: puede circular los sábados'
        : 'Sábado: indica holograma (1 o 2) para saber si aplica parada sabatina',
    };
  }

  if (holo === '2') {
    return {
      rule,
      blockedToday: true,
      reason: 'Holograma 2: no circula ningún sábado del mes',
    };
  }

  // Holograma 1
  const ordinal = saturdayOrdinalInMonth(cal.year, cal.month, cal.day);
  const odd = rule.digit % 2 === 1;
  const blocked = odd
    ? ordinal === 1 || ordinal === 3 || ordinal === 5
    : ordinal === 2 || ordinal === 4;

  return {
    rule,
    blockedToday: blocked,
    reason: blocked
      ? `Holograma 1: placa ${odd ? 'non' : 'par'} — no circula el ${ordinal}º sábado`
      : `Holograma 1: hoy es el ${ordinal}º sábado; tu placa ${odd ? 'non' : 'par'} sí puede circular`,
  };
}

export function vehicleDisplayName(v: {
  plate?: string;
  make?: string;
  model?: string;
  year?: number | null;
}): string {
  const parts = [v.make, v.model, v.year != null ? String(v.year) : ''].filter(Boolean);
  const label = parts.join(' ').trim();
  if (label && v.plate) return `${label} (${v.plate})`;
  return v.plate || label || 'tu auto';
}
