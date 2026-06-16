/** URLs de autos verificadas (HTTP 200). Unsplash eliminó muchas fotos antiguas. */
export const CAR_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1542362567-b07e54358753?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1502877338535-766e1452684a?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=900&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=900&auto=format&fit=crop',
];

export const DEFAULT_CAR_IMAGE = CAR_IMAGE_POOL[1];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Galería determinística de `count` fotos distintas a partir de un id/semente. */
export function buildGallery(seed, count = 4) {
  const pool = CAR_IMAGE_POOL;
  const start = hashStr(String(seed)) % pool.length;
  const gallery = [];
  for (let i = 0; i < count; i++) {
    gallery.push(pool[(start + i) % pool.length]);
  }
  return gallery;
}
