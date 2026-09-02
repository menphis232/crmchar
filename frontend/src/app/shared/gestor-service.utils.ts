export const DEFAULT_SERVICE_DOCUMENTS = ['INE', 'Tarjeta de Circulación', 'Factura de Origen'];

function serviceListItems(items: unknown[] | null | undefined): string[] {
  if (!items?.length) return [];
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object' && 'text' in item) {
        return String((item as { text?: string }).text || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

export function serviceRequirements(s: { required_documents?: unknown[] }): string[] {
  const docs = serviceListItems(s.required_documents);
  return docs.length ? docs : DEFAULT_SERVICE_DOCUMENTS;
}

export function serviceIncludes(s: { includes?: unknown[] }): string[] {
  return serviceListItems(s.includes);
}

export function serviceBonus(s: { bonus?: unknown[] }): string[] {
  return serviceListItems(s.bonus);
}

export function hasServicePrice(s: { price?: number | null }): boolean {
  return s.price != null && Number(s.price) > 0;
}
