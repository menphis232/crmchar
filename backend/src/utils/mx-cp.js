/**
 * Consulta código postal MX y regresa colonias + ciudad/municipio + estado.
 * Usa SEPOMEX vía API pública (icalialabs); fallback Copomex token de pruebas.
 */
export async function lookupMxPostalCode(cpRaw) {
  const cp = String(cpRaw || '').replace(/\D/g, '').slice(0, 5);
  if (!/^\d{5}$/.test(cp)) {
    return { error: 'Código postal inválido (5 dígitos)', cp };
  }

  try {
    const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const rows = Array.isArray(data?.zip_codes) ? data.zip_codes : [];
      if (rows.length) {
        const colonies = [...new Set(rows.map((r) => String(r.d_asenta || r.asentamiento || '').trim()).filter(Boolean))];
        const city = String(rows[0].d_mnpio || rows[0].municipio || rows[0].d_ciudad || '').trim();
        const state = String(rows[0].d_estado || rows[0].estado || '').trim();
        return {
          cp,
          colonies,
          city: city || null,
          state: state || null,
          country: 'México',
        };
      }
    }
  } catch (err) {
    console.warn('sepomex icalialabs:', err.message);
  }

  try {
    const token = process.env.COPOMEX_TOKEN || 'pruebas';
    const url = `https://api.copomex.com/query/info_cp/${cp}?type=simplified&token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const response = data?.response || data;
      const colonies = Array.isArray(response?.asentamiento)
        ? response.asentamiento.map((c) => String(c).trim()).filter(Boolean)
        : (response?.asentamiento ? [String(response.asentamiento).trim()] : []);
      return {
        cp,
        colonies: [...new Set(colonies)],
        city: response?.municipio || response?.ciudad || null,
        state: response?.estado || null,
        country: 'México',
      };
    }
  } catch (err) {
    console.warn('copomex:', err.message);
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
