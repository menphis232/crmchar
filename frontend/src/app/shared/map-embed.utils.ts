export function googleEmbedFromCoords(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed&hl=es`;
}

export function googleEmbedFromAddress(address: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(address.trim())}&output=embed&hl=es`;
}

/** Normaliza cualquier URL de mapa (OSM, Google share, etc.) a embed de Google Maps. */
export function toGoogleMapsEmbedUrl(url: string, fallbackAddress?: string): string | null {
  const s = url.trim();
  if (!s) {
    return fallbackAddress?.trim() ? googleEmbedFromAddress(fallbackAddress) : null;
  }

  if (s.includes('maps.google.com') && s.includes('output=embed')) return s;
  if (s.includes('maps/embed')) return s;

  const osmMarker = s.match(/marker=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (osmMarker) {
    return googleEmbedFromCoords(parseFloat(osmMarker[1]), parseFloat(osmMarker[2]));
  }

  const coordMatch = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || s.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    return googleEmbedFromCoords(parseFloat(coordMatch[1]), parseFloat(coordMatch[2]));
  }

  if (s.includes('google.com/maps') || s.includes('goo.gl/maps') || s.includes('maps.google')) {
    const placeMatch = s.match(/\/place\/([^/@?&]+)/);
    if (placeMatch) {
      const q = encodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      return `https://maps.google.com/maps?q=${q}&output=embed&hl=es`;
    }
    const qMatch = s.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      return `https://maps.google.com/maps?q=${qMatch[1]}&output=embed&hl=es`;
    }
  }

  if (fallbackAddress?.trim()) {
    return googleEmbedFromAddress(fallbackAddress);
  }

  return null;
}
