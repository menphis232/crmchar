export const DEFAULT_SERVICE_DOCUMENTS = ['INE', 'Tarjeta de Circulación', 'Factura de Origen'];

export function serviceRequirements(s: { required_documents?: string[] }): string[] {
  return s.required_documents?.length ? s.required_documents : DEFAULT_SERVICE_DOCUMENTS;
}

export function hasServicePrice(s: { price?: number | null }): boolean {
  return s.price != null && Number(s.price) > 0;
}
