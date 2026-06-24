export interface QuoteCheckItem {
  id: string;
  text: string;
  checked: boolean;
}

export const DEFAULT_QUOTE_INCLUDES = [
  'Registro en el Padrón Vehicular de Morelos',
  'Alta de placas particulares',
  'Laminas nuevas (nuevo diseño)',
  'Engomado',
  'Tarjeta de circulación a nombre del nuevo titular',
  'Cambio de Propietario',
  'Pago de derechos',
];

export const DEFAULT_QUOTE_REQUIREMENTS = [
  'Factura de origen',
  'INE nuevo titular ambos lados',
  'Refacturas todas',
  'Pago 24-25 y 26',
  'Póliza de seguro vigente',
];

export const DEFAULT_QUOTE_BONUS = [
  'COMPRA PROTEGIDA con Mercado Pago',
  'Envío a domicilio gratis',
  'Hasta 6 MSI con cualquier tarjeta de crédito',
];

let checklistSeq = 0;

export function nextChecklistId(prefix = 'chk'): string {
  checklistSeq += 1;
  return `${prefix}-${checklistSeq}`;
}

export function resetChecklistSeq() {
  checklistSeq = 0;
}

export function checklistFromApi(items: { text?: string; checked?: boolean }[] | null | undefined): QuoteCheckItem[] {
  return (items || [])
    .map((item, index) => ({
      id: nextChecklistId(`saved-${index}`),
      text: String(item.text || '').trim(),
      checked: item.checked !== false,
    }))
    .filter((item) => item.text);
}

export function checklistFromTexts(texts: string[], checked = true): QuoteCheckItem[] {
  const seen = new Set<string>();
  const out: QuoteCheckItem[] = [];
  for (const raw of texts) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: nextChecklistId(), text, checked });
  }
  return out;
}

export function checklistToPayload(items: QuoteCheckItem[]) {
  return items
    .map((item) => ({
      text: item.text.trim(),
      checked: item.checked,
    }))
    .filter((item) => item.text);
}

export function mergeTextLists(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const text = String(raw || '').trim();
      if (!text) continue;
      const key = text.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(text);
      }
    }
  }
  return out;
}
