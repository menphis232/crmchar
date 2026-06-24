import { get, run } from '../db.js';

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

export function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parseChecklist(val) {
  return parseJsonArray(val).map((item) => {
    if (typeof item === 'string') {
      return { text: item, checked: true };
    }
    return {
      text: String(item?.text || '').trim(),
      checked: item?.checked !== false,
    };
  }).filter(i => i.text);
}

export function mergeTemplateLists(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const item of parseJsonArray(list)) {
      const text = typeof item === 'string' ? item.trim() : String(item?.text || '').trim();
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

export function checklistFromTexts(texts, checkedDefault = true) {
  return mergeTemplateLists(texts).map((text) => ({
    text,
    checked: checkedDefault,
  }));
}

export async function getUserQuoteTemplates(uid) {
  const row = await get(
    'SELECT quote_includes_templates, quote_requirements_templates, quote_bonus_templates FROM users WHERE id = ?',
    [uid],
  );
  return {
    includes: mergeTemplateLists(row?.quote_includes_templates, DEFAULT_QUOTE_INCLUDES),
    requirements: mergeTemplateLists(row?.quote_requirements_templates, DEFAULT_QUOTE_REQUIREMENTS),
    bonus: mergeTemplateLists(row?.quote_bonus_templates, DEFAULT_QUOTE_BONUS),
  };
}

export async function syncUserQuoteTemplates(uid, { includes, requirements, bonus }) {
  const texts = (list) => (list || [])
    .map((i) => String(i?.text || i || '').trim())
    .filter(Boolean);
  await run(
    `UPDATE users SET
      quote_includes_templates = ?,
      quote_requirements_templates = ?,
      quote_bonus_templates = ?
    WHERE id = ?`,
    [
      JSON.stringify(texts(includes)),
      JSON.stringify(texts(requirements)),
      JSON.stringify(texts(bonus)),
      uid,
    ],
  );
}
