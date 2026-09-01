const ONESIGNAL_API = 'https://api.onesignal.com/notifications';

export function isOneSignalConfigured() {
  return !!(process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY);
}

function siteBaseUrl() {
  return (process.env.FRONTEND_URL || 'https://central.tramitesvehicularesdemexico.com').replace(/\/$/, '');
}

function resolveUrl(url) {
  if (!url?.trim()) return undefined;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${siteBaseUrl()}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
}

function parseOneSignalError(data, status) {
  if (Array.isArray(data?.errors) && data.errors.length) {
    return data.errors.join(', ');
  }
  if (data?.error) return String(data.error);
  if (!data?.id) return `OneSignal HTTP ${status}`;
  return null;
}

async function fetchNotificationDelivery(notificationId) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey || !notificationId) {
    return { successful: 0, failed: 0, errored: 0 };
  }

  await new Promise(r => setTimeout(r, 2500));

  const res = await fetch(`${ONESIGNAL_API}/${notificationId}?app_id=${appId}`, {
    headers: { Authorization: `Key ${apiKey}` },
  });
  const data = await res.json().catch(() => ({}));
  return {
    successful: Number(data.successful) || 0,
    failed: Number(data.failed) || 0,
    errored: Number(data.errored) || 0,
    remaining: Number(data.remaining) || 0,
  };
}

/**
 * @param {{ title: string, body: string, url?: string, audience: string, audienceValue?: string, adminUserId?: string }} opts
 */
export async function sendOneSignalPush(opts) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) {
    throw new Error('OneSignal no está configurado en el servidor');
  }

  const { title, body, url, audience, audienceValue, adminUserId } = opts;
  const payload = {
    app_id: appId,
    target_channel: 'push',
    headings: { es: title, en: title },
    contents: { es: body, en: body },
  };

  const launchUrl = resolveUrl(url);
  if (launchUrl) payload.url = launchUrl;

  switch (audience) {
    case 'all':
      // "Subscribed Users" devuelve 0 en web push v16; Total Subscriptions incluye suscripciones web activas.
      payload.included_segments = ['Total Subscriptions'];
      break;
    case 'test':
      if (!adminUserId) throw new Error('Usuario admin requerido para prueba');
      payload.include_aliases = { external_id: [String(adminUserId)] };
      break;
    case 'user':
      if (!audienceValue) throw new Error('Selecciona un usuario destino');
      payload.include_aliases = { external_id: [String(audienceValue)] };
      break;
    case 'cliente':
    case 'gestor':
    case 'concesionaria':
    case 'perito':
    case 'admin':
      payload.filters = [{ field: 'tag', key: 'role', relation: '=', value: audience }];
      break;
    default:
      throw new Error('Audiencia no válida');
  }

  const res = await fetch(ONESIGNAL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  const apiError = parseOneSignalError(data, res.status);
  if (!res.ok) {
    throw new Error(apiError || `OneSignal HTTP ${res.status}`);
  }
  if (apiError) {
    const hint = audience === 'test' || audience === 'user'
      ? ' El usuario debe tener la app abierta, haber activado push y haber iniciado sesión después de suscribirse.'
      : '';
    throw new Error(`${apiError}.${hint}`);
  }

  const delivery = await fetchNotificationDelivery(data.id);

  return {
    id: data.id,
    recipients: delivery.successful || Number(data.recipients) || 0,
    delivered: delivery.successful,
    failed: delivery.failed,
    errored: delivery.errored,
    externalId: data.external_id || null,
  };
}

/**
 * Push transaccional a un usuario (external_id = user.id del CRM).
 */
export async function notifyUserPush(userId, { title, body, url } = {}) {
  if (!userId || !isOneSignalConfigured()) return null;
  const message = String(body || '').trim();
  if (!message) return null;
  return sendOneSignalPush({
    title: String(title || 'Trámites MX').trim() || 'Trámites MX',
    body: message,
    url,
    audience: 'user',
    audienceValue: String(userId),
  });
}
