import { Gestor } from '../models';
import { toAbsoluteUrl } from './auto-share.util';

export function getGestorShareSubtitle(gestor: Pick<Gestor, 'name' | 'location'>): string {
  return `${gestor.name} — ${gestor.location || 'México'}`;
}

export function getGestorOgImageUrl(gestor: Pick<Gestor, 'slug' | 'logoUrl' | 'photoUrl' | 'bannerUrl'>): string | null {
  if (gestor.slug && (gestor.logoUrl || gestor.photoUrl || gestor.bannerUrl)) {
    return toAbsoluteUrl(`/og/gestor/${gestor.slug}.jpg`);
  }
  return null;
}

/** Vista previa en panel: logo real del gestor (siempre carga en el navegador). */
export function getGestorPanelPreviewImageUrl(
  gestor: Pick<Gestor, 'logoUrl' | 'photoUrl' | 'bannerUrl'>,
  logoOverride?: string,
): string | null {
  return toAbsoluteUrl(logoOverride || gestor.logoUrl || gestor.photoUrl || gestor.bannerUrl || null);
}

export function getGestorShareUrl(gestor: Pick<Gestor, 'slug'>, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/sg/${gestor.slug}`;
}
