import { v4 as uuid } from 'uuid';
import { get, query } from '../db.js';
import { clientContactPredicate } from '../crm/client-match.js';

const TITLE_SIZES = new Set(['sm', 'md', 'lg', 'xl']);
const TITLE_ALIGNS = new Set(['left', 'center', 'right']);
const TITLE_VALIGNS = new Set(['top', 'center', 'bottom']);
const TITLE_PLACEMENTS = new Set(['overlay', 'below']);
const AUDIENCE_MODES = new Set(['all', 'filtered']);
const AUDIENCE_PURCHASED = new Set(['any', 'yes', 'no']);

export function normalizePromoBannerTitleColor(value, fallback = '#ffffff') {
  const raw = String(value || '').trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
  return fallback;
}

export function normalizePromoBannerTitleSize(value, fallback = 'md') {
  const raw = String(value || '').trim().toLowerCase();
  return TITLE_SIZES.has(raw) ? raw : fallback;
}

export function normalizePromoBannerTitleAlign(value, fallback = 'center') {
  const raw = String(value || '').trim().toLowerCase();
  return TITLE_ALIGNS.has(raw) ? raw : fallback;
}

export function normalizePromoBannerTitleVAlign(value, fallback = 'center') {
  const raw = String(value || '').trim().toLowerCase();
  return TITLE_VALIGNS.has(raw) ? raw : fallback;
}

export function normalizePromoBannerTitlePlacement(value, fallback = 'overlay') {
  const raw = String(value || '').trim().toLowerCase();
  return TITLE_PLACEMENTS.has(raw) ? raw : fallback;
}

function normalizeAudienceMode(value, fallback = 'all') {
  const raw = String(value || '').trim().toLowerCase();
  return AUDIENCE_MODES.has(raw) ? raw : fallback;
}

function normalizeAudiencePurchased(value, fallback = 'any') {
  const raw = String(value || '').trim().toLowerCase();
  return AUDIENCE_PURCHASED.has(raw) ? raw : fallback;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v || '').trim()).filter(Boolean))];
}

const MX_STATE_NAMES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'CDMX', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato',
  'Guerrero', 'Hidalgo', 'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León',
  'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora',
  'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

function extractStatesFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const lower = raw.toLowerCase();
  return MX_STATE_NAMES.filter((st) => lower.includes(st.toLowerCase()));
}

function serviceNameMatches(dealTitle, wantedLowerSet) {
  const title = String(dealTitle || '').trim().toLowerCase();
  if (!title) return false;
  if (wantedLowerSet.has(title)) return true;
  for (const wanted of wantedLowerSet) {
    if (!wanted) continue;
    if (title === wanted || title.startsWith(`${wanted} `) || title.startsWith(`${wanted}|`) || title.startsWith(`${wanted} |`)) {
      return true;
    }
    if (wanted.startsWith(title) && title.length >= 8) return true;
  }
  return false;
}

export function emptyPromoBanner(partial = {}) {
  return normalizePromoBanner({
    id: uuid(),
    enabled: true,
    imageDesktop: '',
    imageMobile: '',
    link: '',
    title: '',
    subtitle: '',
    titleColor: '#ffffff',
    titleSize: 'md',
    titleAlign: 'center',
    titleVAlign: 'center',
    titlePlacement: 'overlay',
    alt: '',
    sortOrder: 0,
    audienceMode: 'all',
    audienceUserIds: [],
    audienceStates: [],
    audienceServiceNames: [],
    audiencePurchased: 'any',
    ...partial,
  });
}

export function normalizePromoBanner(raw = {}, index = 0) {
  const desktop = String(raw.imageDesktop || raw.promoBannerImageDesktop || raw.promoBannerImage || '').trim();
  const mobile = String(raw.imageMobile || raw.promoBannerImageMobile || desktop || '').trim();
  return {
    id: String(raw.id || uuid()),
    enabled: raw.enabled !== undefined ? !!raw.enabled : true,
    imageDesktop: desktop,
    imageMobile: mobile,
    link: String(raw.link || raw.promoBannerLink || '').trim(),
    title: String(raw.title || raw.promoBannerTitle || '').trim(),
    subtitle: String(raw.subtitle || raw.promoBannerSubtitle || '').trim(),
    titleColor: normalizePromoBannerTitleColor(raw.titleColor || raw.promoBannerTitleColor),
    titleSize: normalizePromoBannerTitleSize(raw.titleSize || raw.promoBannerTitleSize),
    titleAlign: normalizePromoBannerTitleAlign(raw.titleAlign || raw.promoBannerTitleAlign),
    titleVAlign: normalizePromoBannerTitleVAlign(raw.titleVAlign || raw.promoBannerTitleVAlign),
    titlePlacement: normalizePromoBannerTitlePlacement(raw.titlePlacement || raw.promoBannerTitlePlacement),
    alt: String(raw.alt || raw.promoBannerAlt || '').trim(),
    sortOrder: Number.isFinite(Number(raw.sortOrder)) ? Number(raw.sortOrder) : index,
    audienceMode: normalizeAudienceMode(raw.audienceMode),
    audienceUserIds: asStringArray(raw.audienceUserIds),
    audienceStates: asStringArray(raw.audienceStates),
    audienceServiceNames: asStringArray(raw.audienceServiceNames),
    audiencePurchased: normalizeAudiencePurchased(raw.audiencePurchased),
  };
}

/** Convierte settings legacy (1 banner) + array nuevo a lista canónica. */
export function promoBannersFromSettings(settings = {}) {
  const list = Array.isArray(settings.promoBanners) ? settings.promoBanners : [];
  if (list.length) {
    return list
      .map((b, i) => normalizePromoBanner(b, i))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }

  const desktop = settings.promoBannerImageDesktop || settings.promoBannerImage || '';
  const mobile = settings.promoBannerImageMobile || '';
  const hasLegacy = !!(
    settings.promoBannerEnabled
    || desktop
    || mobile
    || settings.promoBannerTitle
  );
  if (!hasLegacy) return [];

  return [
    normalizePromoBanner({
      id: 'legacy-panel-cliente',
      enabled: !!settings.promoBannerEnabled,
      imageDesktop: desktop,
      imageMobile: mobile || desktop,
      link: settings.promoBannerLink || '',
      title: settings.promoBannerTitle || '',
      titleColor: settings.promoBannerTitleColor,
      titleSize: settings.promoBannerTitleSize,
      titleAlign: settings.promoBannerTitleAlign,
      titleVAlign: settings.promoBannerTitleVAlign,
      titlePlacement: settings.promoBannerTitlePlacement,
      alt: settings.promoBannerAlt || '',
      sortOrder: 0,
      audienceMode: 'all',
      audienceUserIds: [],
      audienceStates: [],
      audienceServiceNames: [],
      audiencePurchased: 'any',
    }, 0),
  ];
}

/** Sincroniza campos legacy con el primer banner (compat lectura vieja). */
export function syncLegacyPromoFields(settings, banners) {
  const first = banners.find((b) => b.enabled) || banners[0] || null;
  return {
    ...settings,
    promoBanners: banners,
    promoBannerEnabled: !!(first && first.enabled),
    promoBannerImage: first?.imageDesktop || '',
    promoBannerImageDesktop: first?.imageDesktop || '',
    promoBannerImageMobile: first?.imageMobile || '',
    promoBannerLink: first?.link || '',
    promoBannerTitle: first?.title || '',
    promoBannerSubtitle: first?.subtitle || '',
    promoBannerTitleColor: first?.titleColor || '#ffffff',
    promoBannerTitleSize: first?.titleSize || 'md',
    promoBannerTitleAlign: first?.titleAlign || 'center',
    promoBannerTitleVAlign: first?.titleVAlign || 'center',
    promoBannerTitlePlacement: first?.titlePlacement || 'overlay',
    promoBannerAlt: first?.alt || '',
  };
}

export function bannerToClientDto(banner) {
  return {
    id: banner.id,
    promoBannerEnabled: !!banner.enabled,
    promoBannerImage: banner.imageDesktop || '',
    promoBannerImageDesktop: banner.imageDesktop || '',
    promoBannerImageMobile: banner.imageMobile || banner.imageDesktop || '',
    promoBannerLink: banner.link || '',
    promoBannerTitle: banner.title || '',
    promoBannerSubtitle: banner.subtitle || '',
    promoBannerTitleColor: banner.titleColor || '#ffffff',
    promoBannerTitleSize: banner.titleSize || 'md',
    promoBannerTitleAlign: banner.titleAlign || 'center',
    promoBannerTitleVAlign: banner.titleVAlign || 'center',
    promoBannerTitlePlacement: banner.titlePlacement || 'overlay',
    promoBannerAlt: banner.alt || '',
  };
}

export async function loadPanelClienteSettings() {
  const row = await get('SELECT * FROM site_settings WHERE page_key = ?', ['panel-cliente']);
  if (!row) return {};
  return typeof row.settings === 'string' ? JSON.parse(row.settings) : (row.settings || {});
}

/**
 * Contexto de audiencia del cliente autenticado.
 * - states: vehículos + ubicación de solicitudes/trámites (ej. Morelos)
 * - serviceNames / paidServiceNames: títulos de trámites
 * - hasPurchased: tiene al menos un trámite pagado
 */
export async function resolveClientPromoAudience(user) {
  const match = clientContactPredicate(user);
  const vehicleRows = await query(
    `SELECT DISTINCT cv.state AS state
     FROM contact_vehicles cv
     JOIN contacts c ON c.id = cv.contact_id
     WHERE cv.state IS NOT NULL AND TRIM(cv.state) <> ''
       AND (${match.sql} OR cv.user_id = ?)`,
    [...match.params, user.id],
  ).catch(() => []);

  const locationRows = await query(
    `SELECT DISTINCT s.location AS location
     FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     LEFT JOIN solicitudes s ON s.id = d.ref_id AND d.ref_type = 'solicitud'
     WHERE (${match.sql})
       AND s.location IS NOT NULL AND TRIM(s.location) <> ''`,
    match.params,
  ).catch(() => []);

  const states = [...new Set([
    ...(vehicleRows || []).map((r) => String(r.state || '').trim()).filter(Boolean),
    ...(locationRows || []).flatMap((r) => extractStatesFromText(r.location)),
  ])];

  const dealRows = await query(
    `SELECT d.title, d.payment_status
     FROM crm_deals d
     JOIN contacts c ON c.id = d.contact_id
     WHERE (${match.sql}) AND d.deal_type = 'tramite'`,
    match.params,
  ).catch(() => []);

  const serviceNames = [...new Set(
    (dealRows || []).map((r) => String(r.title || '').trim()).filter(Boolean),
  )];
  const paidServiceNames = [...new Set(
    (dealRows || [])
      .filter((r) => String(r.payment_status || '').toLowerCase() === 'paid')
      .map((r) => String(r.title || '').trim())
      .filter(Boolean),
  )];

  return {
    userId: user.id,
    states,
    serviceNames,
    paidServiceNames,
    hasPurchased: paidServiceNames.length > 0,
  };
}

export function bannerMatchesAudience(banner, audience) {
  if (!banner?.enabled) return false;
  const hasContent = !!(banner.imageDesktop || banner.imageMobile || banner.title || banner.subtitle);
  if (!hasContent) return false;

  if (banner.audienceMode !== 'filtered') return true;

  const userIds = banner.audienceUserIds || [];
  const states = banner.audienceStates || [];
  const serviceNames = banner.audienceServiceNames || [];
  const purchased = banner.audiencePurchased || 'any';

  // Sin ningún filtro concreto ⇒ se comporta como "todos"
  if (!userIds.length && !states.length && !serviceNames.length && purchased === 'any') return true;

  if (userIds.length && !userIds.includes(audience.userId)) return false;

  if (states.length) {
    const clientStates = new Set((audience.states || []).map((s) => s.toLowerCase()));
    const hit = states.some((s) => {
      const key = String(s || '').toLowerCase();
      if (clientStates.has(key)) return true;
      // CDMX aliases
      if (key === 'ciudad de méxico' || key === 'cdmx') {
        return clientStates.has('cdmx') || clientStates.has('ciudad de méxico');
      }
      return [...clientStates].some((cs) => cs.includes(key) || key.includes(cs));
    });
    if (!hit) return false;
  }

  if (serviceNames.length) {
    const wanted = new Set(serviceNames.map((s) => String(s).trim().toLowerCase()).filter(Boolean));
    if (purchased === 'yes') {
      const hit = (audience.paidServiceNames || []).some((t) => serviceNameMatches(t, wanted));
      if (!hit) return false;
    } else if (purchased === 'no') {
      const hit = (audience.paidServiceNames || []).some((t) => serviceNameMatches(t, wanted));
      if (hit) return false;
    } else {
      const hit = (audience.serviceNames || []).some((t) => serviceNameMatches(t, wanted));
      if (!hit) return false;
    }
  } else {
    if (purchased === 'yes' && !audience.hasPurchased) return false;
    if (purchased === 'no' && audience.hasPurchased) return false;
  }

  return true;
}

export function filterBannersForAudience(banners, audience) {
  return (banners || [])
    .filter((b) => bannerMatchesAudience(b, audience))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
