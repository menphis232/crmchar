export const ENGOMADO_COLORS = [
  { id: 'amarillo', label: 'Amarillo' },
  { id: 'rosa', label: 'Rosa' },
  { id: 'rojo', label: 'Rojo' },
  { id: 'verde', label: 'Verde' },
  { id: 'azul', label: 'Azul' },
] as const;

export function engomadoLabel(color?: string | null): string {
  if (!color) return '—';
  return ENGOMADO_COLORS.find(c => c.id === color)?.label || color;
}
