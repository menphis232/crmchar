import { Auto } from '../models';

export function getAutoShareSubtitle(auto: Auto): string {
  return `${auto.make} ${auto.model} ${auto.year}`;
}

export function getAutoPrimaryImageUrl(auto: Auto): string | null {
  return auto.images?.[0] || auto.imageUrl || null;
}

export function toAbsoluteUrl(url: string | null | undefined, origin?: string): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}
