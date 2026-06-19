export type AutoGalleryItem =
  | { type: 'video'; url: string; embedUrl: string | null; poster?: string }
  | { type: 'image'; url: string };

export type AutoGalleriaSlide = {
  itemImageSrc: string;
  thumbnailImageSrc: string;
  type: 'image' | 'video';
  url?: string;
  embedUrl?: string | null;
  poster?: string;
};

export function mapAutoGalleryToGalleriaSlides(items: AutoGalleryItem[]): AutoGalleriaSlide[] {
  return items.map(item => {
    if (item.type === 'video') {
      const thumb = item.poster || item.url;
      return {
        type: 'video',
        itemImageSrc: thumb,
        thumbnailImageSrc: thumb,
        url: item.url,
        embedUrl: item.embedUrl,
        poster: item.poster,
      };
    }
    return {
      type: 'image',
      itemImageSrc: item.url,
      thumbnailImageSrc: item.url,
    };
  });
}

export function parseVideoEmbedUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const url = raw.trim();

  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
  }

  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return null;
}

export function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes('/uploads/');
}

export function buildAutoGalleryItems(auto: {
  videoUrl?: string | null;
  images?: string[];
  imageUrl?: string;
}): AutoGalleryItem[] {
  const items: AutoGalleryItem[] = [];
  const poster = auto.images?.[0] || auto.imageUrl || undefined;

  if (auto.videoUrl?.trim()) {
    items.push({
      type: 'video',
      url: auto.videoUrl.trim(),
      embedUrl: parseVideoEmbedUrl(auto.videoUrl),
      poster,
    });
  }

  const images = auto.images?.length ? auto.images : auto.imageUrl ? [auto.imageUrl] : [];
  images.forEach(url => items.push({ type: 'image', url }));

  return items;
}
