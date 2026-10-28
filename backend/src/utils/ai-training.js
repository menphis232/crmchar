const LIMITS = {
  about: 2000,
  coverage: 600,
  hours: 400,
  payments: 400,
  rules: 1500,
  faqQuestion: 300,
  faqAnswer: 1200,
  faqs: 25,
};

function clip(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function normalizeAiTraining(input) {
  if (!input || typeof input !== 'object') return null;
  const faqs = (Array.isArray(input.faqs) ? input.faqs : [])
    .map(f => ({ q: clip(f?.q, LIMITS.faqQuestion), a: clip(f?.a, LIMITS.faqAnswer) }))
    .filter(f => f.q && f.a)
    .slice(0, LIMITS.faqs);
  const training = {
    about: clip(input.about, LIMITS.about),
    coverage: clip(input.coverage, LIMITS.coverage),
    hours: clip(input.hours, LIMITS.hours),
    payments: clip(input.payments, LIMITS.payments),
    rules: clip(input.rules, LIMITS.rules),
    faqs,
  };
  const empty = !training.about && !training.coverage && !training.hours
    && !training.payments && !training.rules && !faqs.length;
  return empty ? null : training;
}

export function parseAiTraining(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return normalizeAiTraining(raw);
  try {
    return normalizeAiTraining(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Bloque de texto para el prompt del sistema. Vacío si el gestor no ha entrenado su IA. */
export function aiTrainingPrompt(raw) {
  const t = parseAiTraining(raw);
  if (!t) return '';
  const parts = ['CONOCIMIENTO DEL NEGOCIO (escrito por el gestor; tiene prioridad sobre tus suposiciones):'];
  if (t.about) parts.push(`Sobre la gestoría:\n${t.about}`);
  if (t.coverage) parts.push(`Estados y zonas que atiende:\n${t.coverage}`);
  if (t.hours) parts.push(`Horario de atención:\n${t.hours}`);
  if (t.payments) parts.push(`Formas de pago:\n${t.payments}`);
  if (t.faqs.length) {
    parts.push('Preguntas frecuentes (responde con esta información cuando el cliente pregunte algo parecido):\n'
      + t.faqs.map(f => `P: ${f.q}\nR: ${f.a}`).join('\n\n'));
  }
  if (t.rules) parts.push(`Lo que NUNCA debes decir ni prometer:\n${t.rules}`);
  parts.push('Si el cliente pregunta algo que no está en este conocimiento ni en los servicios, dilo con honestidad y ofrece que un asesor lo confirme.');
  return parts.join('\n\n');
}
