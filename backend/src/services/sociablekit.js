/**
 * SociableKIT / AccentAPI public feed (no API key).
 * Embed: <div class="sk-ww-google-reviews" data-embed-id="25730629"></div>
 * Feed:  https://data.accentapi.com/feed/25730629.json
 */

export function extractSociableKitEmbedId(embedHtml) {
  const raw = String(embedHtml || '');
  const m =
    raw.match(/data-embed-id=["'](\d+)["']/i) ||
    raw.match(/data\.accentapi\.com\/feed\/(\d+)\.json/i) ||
    raw.match(/embed[_-]?id[=:]?\s*["']?(\d+)/i);
  return m ? m[1] : null;
}

export async function fetchSociableKitReviewStats(embedHtmlOrId) {
  const embedId = /^\d+$/.test(String(embedHtmlOrId || '').trim())
    ? String(embedHtmlOrId).trim()
    : extractSociableKitEmbedId(embedHtmlOrId);
  if (!embedId) return null;

  const url = `https://data.accentapi.com/feed/${embedId}.json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const err = new Error(`SociableKIT feed HTTP ${res.status}`);
    err.code = `http_${res.status}`;
    throw err;
  }
  const data = await res.json();
  const bio = data?.bio || {};
  const rating = bio.overall_star_rating != null ? Number(bio.overall_star_rating) : null;
  const reviewCount = bio.rating_count != null ? Number(bio.rating_count) : null;
  if ((rating == null || Number.isNaN(rating)) && (reviewCount == null || Number.isNaN(reviewCount))) {
    return null;
  }
  return {
    embedId,
    rating: rating != null && !Number.isNaN(rating) ? rating : null,
    reviewCount: reviewCount != null && !Number.isNaN(reviewCount) ? Math.floor(reviewCount) : null,
    placeId: bio.place_id || null,
    mapsUrl: bio.link || null,
  };
}
