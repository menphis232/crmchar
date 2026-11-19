/**
 * Proxy a la API oficial Guía EBC / Libro Azul.
 * Docs: https://api.libroazul.com/Help
 *
 * Env:
 *   LIBROAZUL_USER
 *   LIBROAZUL_PASSWORD
 *   LIBROAZUL_API_BASE (default https://api.libroazul.com)
 */

const DEFAULT_BASE = 'https://api.libroazul.com';
const SESSION_TTL_MS = 90 * 60 * 1000; // renovar antes de las 2h de inactividad

let cachedSession = { key: null, expiresAt: 0 };

function configured() {
  return !!(process.env.LIBROAZUL_USER || '').trim() && !!(process.env.LIBROAZUL_PASSWORD || '').trim();
}

function apiBase() {
  return (process.env.LIBROAZUL_API_BASE || DEFAULT_BASE).replace(/\/$/, '');
}

function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

/** Normaliza catálogos { Clave, Nombre } / variantes. */
export function normalizeCatalog(raw) {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.Catalogo)
      ? raw.Catalogo
      : Array.isArray(raw?.items)
        ? raw.items
        : [];
  return list
    .map((item) => {
      const clave = pick(item, 'Clave', 'clave', 'Id', 'id', 'Key', 'key');
      const nombre = pick(item, 'Nombre', 'nombre', 'Name', 'name', 'Descripcion', 'descripcion');
      if (clave == null || nombre == null) return null;
      return { clave: String(clave), nombre: String(nombre) };
    })
    .filter(Boolean);
}

async function apiCall(method, path, query = {}) {
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    qs.set(k, String(v));
  });
  const url = `${apiBase()}${path}?${qs.toString()}`;
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(
      typeof data === 'string' ? data : data?.Message || data?.message || `Libro Azul HTTP ${res.status}`,
    );
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function getSessionKey({ force = false } = {}) {
  if (!configured()) {
    const err = new Error('Faltan LIBROAZUL_USER / LIBROAZUL_PASSWORD en el servidor.');
    err.code = 'not_configured';
    throw err;
  }
  if (!force && cachedSession.key && Date.now() < cachedSession.expiresAt) {
    return cachedSession.key;
  }
  const user = process.env.LIBROAZUL_USER.trim();
  const pass = process.env.LIBROAZUL_PASSWORD.trim();
  const raw = await apiCall('GET', '/api/Sesion', { Usuario: user, Contrasena: pass });
  const key = typeof raw === 'string' ? raw.replace(/^"|"$/g, '') : pick(raw, 'Llave', 'llave', 'Key');
  if (!key) {
    const err = new Error('Libro Azul no devolvió llave de sesión.');
    err.code = 'session_failed';
    throw err;
  }
  cachedSession = { key: String(key), expiresAt: Date.now() + SESSION_TTL_MS };
  return cachedSession.key;
}

async function withSession(fn) {
  const llave = await getSessionKey();
  try {
    return await fn(llave);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      const llave2 = await getSessionKey({ force: true });
      return fn(llave2);
    }
    throw err;
  }
}

export async function listAnios() {
  return withSession(async (Llave) => {
    const data = await apiCall('POST', '/api/Años', { Llave });
    return normalizeCatalog(data);
  });
}

export async function listMarcas(claveAnio) {
  return withSession(async (Llave) => {
    const data = await apiCall('POST', '/api/Marcas', { Llave, ClaveAnio: claveAnio });
    return normalizeCatalog(data);
  });
}

export async function listModelos(claveAnio, claveMarca) {
  return withSession(async (Llave) => {
    const data = await apiCall('POST', '/api/Modelos', {
      Llave,
      ClaveAnio: claveAnio,
      ClaveMarca: claveMarca,
    });
    return normalizeCatalog(data);
  });
}

export async function listVersiones(claveAnio, claveMarca, claveModelo) {
  return withSession(async (Llave) => {
    const data = await apiCall('POST', '/api/Versiones', {
      Llave,
      ClaveAnio: claveAnio,
      ClaveMarca: claveMarca,
      ClaveModelo: claveModelo,
    });
    return normalizeCatalog(data);
  });
}

export async function getPrecio(claveVersion, kilometraje = 0) {
  return withSession(async (Llave) => {
    const data = await apiCall('POST', '/api/Precio', {
      Llave,
      ClaveVersion: claveVersion,
      Kilometraje: Number(kilometraje) || 0,
    });
    return {
      venta: pick(data, 'Venta', 'venta') ?? null,
      compra: pick(data, 'Compra', 'compra') ?? null,
      moneda: pick(data, 'Moneda', 'moneda') ?? 'MXN',
      raw: data,
    };
  });
}

export function libroAzulStatus() {
  return {
    configured: configured(),
    apiBase: apiBase(),
  };
}
