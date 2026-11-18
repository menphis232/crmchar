const CACHE_HOURS = 12;

export function placesApiKey() {
  return (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

export function mapsUrlForPlace(placeId) {
  if (!placeId) return null;
  return `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(placeId)}`;
}

export function parseCachedReviews(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isStale(syncedAt) {
  if (!syncedAt) return true;
  const t = new Date(syncedAt).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t > CACHE_HOURS * 60 * 60 * 1000;
}

/**
 * Place Details (legacy) — hasta 5 reseñas + rating agregado.
 * Requiere GOOGLE_PLACES_API_KEY o GOOGLE_MAPS_API_KEY con Places API habilitada.
 */
export async function fetchPlaceDetails(placeId) {
  const key = placesApiKey();
  if (!key || !placeId) return null;

  const fields = 'name,rating,user_ratings_total,reviews,url';
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=${fields}&language=es&reviews_sort=newest&key=${encodeURIComponent(key)}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.result) {
    const err = new Error(data.error_message || data.status || 'Places API error');
    err.code = data.status;
    throw err;
  }

  const result = data.result;
  const reviews = (result.reviews || []).map((r, i) => ({
    id: `google-${placeId}-${i}-${r.time || i}`,
    author: r.author_name || 'Cliente Google',
    rating: Number(r.rating) || 0,
    comment: r.text || '',
    createdAt: r.time ? new Date(r.time * 1000).toISOString() : null,
    source: 'google',
    profilePhotoUrl: r.profile_photo_url || null,
    relativeTime: r.relative_time_description || null,
  }));

  return {
    rating: result.rating != null ? Number(result.rating) : null,
    reviewCount: result.user_ratings_total != null ? Number(result.user_ratings_total) : null,
    reviews,
    mapsUrl: result.url || mapsUrlForPlace(placeId),
  };
}

export { CACHE_HOURS };
