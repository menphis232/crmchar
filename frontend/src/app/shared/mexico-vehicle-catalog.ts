import catalogData from './data/mexico-vehicles.json';

const CATALOG = catalogData as Record<string, string[]>;

export function getVehicleMakes(): string[] {
  return Object.keys(CATALOG).sort((a, b) => a.localeCompare(b, 'es'));
}

export function getVehicleModels(make: string): string[] {
  if (!make) return [];
  const models = CATALOG[make] || [];
  return [...models].sort((a, b) => a.localeCompare(b, 'es'));
}

export function getVehicleYears(minYear = 1990): number[] {
  const max = new Date().getFullYear() + 1;
  const years: number[] = [];
  for (let y = max; y >= minYear; y--) years.push(y);
  return years;
}

export function formatVehicleLabel(v: { make?: string; model?: string; year?: number | null }): string {
  const parts = [v.make, v.model, v.year].filter(Boolean);
  return parts.join(' ') || '';
}
