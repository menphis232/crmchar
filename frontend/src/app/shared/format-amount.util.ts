/** Formatea montos y trunca para display con tooltip del valor completo. */

export interface AmountDisplay {
  full: string;
  display: string;
  truncated: boolean;
}

export function formatMoney(
  value: number | null | undefined,
  opts: {
    signed?: boolean;
    currency?: string;
    maxLength?: number;
    decimals?: number;
  } = {},
): AmountDisplay {
  const decimals = opts.decimals ?? 2;
  const maxLength = opts.maxLength ?? 12;
  const n = Number(value ?? 0);
  const absFormatted = Math.abs(n).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  let full: string;
  if (opts.signed) {
    full = n >= 0 ? `+$${absFormatted}` : `-$${absFormatted}`;
  } else {
    full = `$${absFormatted}`;
  }

  return truncateText(full, maxLength);
}

export function formatPlainNumber(
  value: number | string | null | undefined,
  opts: { suffix?: string; maxLength?: number } = {},
): AmountDisplay {
  const maxLength = opts.maxLength ?? 10;
  const suffix = opts.suffix ?? '';
  const raw = value ?? 0;
  const num = typeof raw === 'number'
    ? raw.toLocaleString('es-MX')
    : String(raw);
  const full = `${num}${suffix}`;
  return truncateText(full, maxLength);
}

export function truncateText(full: string, maxLength: number): AmountDisplay {
  if (full.length <= maxLength) {
    return { full, display: full, truncated: false };
  }
  return {
    full,
    display: `${full.slice(0, maxLength - 3)}...`,
    truncated: true,
  };
}
