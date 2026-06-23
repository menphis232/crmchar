import { Gestor } from '../models';
import { toAbsoluteUrl } from './auto-share.util';

export function getGestorShareSubtitle(gestor: Pick<Gestor, 'name' | 'location'>): string {
  return `${gestor.name} — ${gestor.location || 'México'}`;
}

export function getGestorOgImageUrl(gestor: Pick<Gestor, 'slug' | 'logoUrl' | 'photoUrl' | 'bannerUrl'>): string | null {
  if (gestor.logoUrl && gestor.slug) {
    return toAbsoluteUrl(`/og/gestor/${gestor.slug}.jpg`);
  }
  return toAbsoluteUrl(gestor.photoUrl || gestor.bannerUrl || null);
}

export function getGestorShareUrl(gestor: Pick<Gestor, 'slug'>, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/sg/${gestor.slug}`;
}
