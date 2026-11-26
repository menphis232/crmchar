/**
 * Consulta código postal MX → colonias + municipio/ciudad + estado.
 * Fuente principal: Postali (SEPOMEX, sin token).
 * Fallback: sepomex.kurenn.dev. NO usar Copomex token=pruebas (ofusca nombres).
 */

function looksLikeRealPlaceName(value) {
  const s = String(value || '').trim();
  if (!s || s.length < 2) return false;
  // Basura tipo "DS8ii8szF" / "hDFrtx" del token Copomex de pruebas
  if (/^[A-Za-z0-9]{4,20}$/.test(s) && !/[áéíóúñüÁÉÍÓÚÑÜ\s\-.]/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s)) {
    return false;
  }
  if (/^[A-Za-z0-9]{6,}$/.test(s) && !/\s/.test(s) && /[A-Z].*[a-z].*[A-Z]|[a-z].*[A-Z].*[a-z]/.test(s) && !/^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+(?:[-\s][A-ZÁÉÍÓÚÑa-záéíóúñü]+)*$/.test(s)) {
    // Cadenas camel/random sin espacios típicas de ofuscación
    const vowels = (s.match(/[aeiouAEIOUáéíóúÁÉÍÓÚ]/g) || []).length;
    if (vowels < Math.max(1, Math.floor(s.length / 5))) return false;
  }
  return true;
}

function normalizeResult(cp, { colonies, city, state, country }) {
  const cleanColonies = [...new Set(
    (colonies || [])
      .map((c) => String(c || '').trim())
      .filter((c) => c && looksLikeRealPlaceName(c)),
  )].sort((a, b) => a.localeCompare(b, 'es'));
  const cleanCity = city && looksLikeRealPlaceName(city) ? String(city).trim() : null;
  const cleanState = state && looksLikeRealPlaceName(state) ? String(state).trim() : null;

  if (!cleanColonies.length && !cleanCity) return null;

  return {
    cp,
    colonies: cleanColonies,
    city: cleanCity,
    state: cleanState,
    country: country || 'México',
  };
}

async function fromPostali(cp) {
  const res = await fetch(`https://postali.app/api/v1/mx/cp/${cp}`, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const asentamientos = Array.isArray(data?.asentamientos) ? data.asentamientos : [];
  return normalizeResult(cp, {
    colonies: asentamientos.map((a) => a?.nombre || a).filter(Boolean),
    city: data?.municipio || data?.ciudad || null,
    state: data?.estado || null,
    country: 'México',
  });
}

async function fromKurenn(cp) {
  const res = await fetch(
    `https://sepomex.kurenn.dev/api/v1/zip_codes?zip_code=${encodeURIComponent(cp)}&per_page=100`,
    { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const rows = Array.isArray(data?.zip_codes) ? data.zip_codes : [];
  if (!rows.length) return null;
  return normalizeResult(cp, {
    colonies: rows.map((r) => r.d_asenta || r.asentamiento).filter(Boolean),
    city: rows[0].d_mnpio || rows[0].municipio || rows[0].d_ciudad || null,
    state: rows[0].d_estado || rows[0].estado || null,
    country: 'México',
  });
}

/** Copomex solo si hay token real (no "pruebas"). */
async function fromCopomex(cp) {
  const token = String(process.env.COPOMEX_TOKEN || '').trim();
  if (!token || token.toLowerCase() === 'pruebas') return null;

  const res = await fetch(
    `https://api.copomex.com/query/info_cp/${cp}?type=simplified&token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const response = data?.response || data;
  const colonies = Array.isArray(response?.asentamiento)
    ? response.asentamiento
    : (response?.asentamiento ? [response.asentamiento] : []);
  return normalizeResult(cp, {
    colonies,
    city: response?.municipio || response?.ciudad || null,
    state: response?.estado || null,
    country: response?.pais || 'México',
  });
}

export async function lookupMxPostalCode(cpRaw) {
  const cp = String(cpRaw || '').replace(/\D/g, '').slice(0, 5);
  if (!/^\d{5}$/.test(cp)) {
    return { error: 'Código postal inválido (5 dígitos)', cp };
  }

  const providers = [fromPostali, fromKurenn, fromCopomex];
  for (const provider of providers) {
    try {
      const result = await provider(cp);
      if (result?.colonies?.length || result?.city) return result;
    } catch (err) {
      console.warn(`mx-cp ${provider.name}:`, err.message);
    }
  }

  return {
    cp,
    colonies: [],
    city: null,
    state: null,
    country: 'México',
    warning: 'No se encontraron colonias para ese CP. Puedes escribirlas a mano.',
  };
}
