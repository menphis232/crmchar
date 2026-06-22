import { Auto } from '../models';
import { TVM_BRAND_NAME } from './brand.constants';

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

export function getAutoShareUrl(auto: Auto, origin?: string): string {
  const base = (origin || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  return `${base}/s/${auto.id}`;
}

export function buildAutoWhatsappMessage(auto: Auto, origin?: string): string {
  const label = getAutoShareSubtitle(auto);
  const shareUrl = getAutoShareUrl(auto, origin);
  const greeting = auto.dealerName ? `Hola *${auto.dealerName}*, ` : 'Hola, ';
  const lines = [
    `${greeting}me interesa el *${label}*.`,
    '',
    `Lo vi por *${TVM_BRAND_NAME}*.`,
    '',
    shareUrl,
  ];
  return lines.join('\n');
}
