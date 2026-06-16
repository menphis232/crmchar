export interface ThemeFontOption {
  value: string;
  label: string;
}

/** Fuente corporativa global */
export const SPARTAN_FONT = "'League Spartan', sans-serif";

/** Convierte valores legacy (Inter/Montserrat) a Spartan; respeta otras fuentes elegidas en el editor. */
export function resolveThemeFont(value?: string): string {
  if (!value?.trim()) return SPARTAN_FONT;
  const norm = value.toLowerCase();
  if (norm.includes('inter') || norm.includes('montserrat')) return SPARTAN_FONT;
  return value;
}

/** Fuentes para texto / cuerpo (panel admin → editor de temas) */
export const THEME_BODY_FONTS: ThemeFontOption[] = [
  { value: "'League Spartan', sans-serif", label: 'Spartan' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Open Sans, sans-serif', label: 'Open Sans' },
  { value: 'Lato, sans-serif', label: 'Lato' },
  { value: 'Poppins, sans-serif', label: 'Poppins' },
  { value: 'Nunito, sans-serif', label: 'Nunito' },
  { value: 'Source Sans 3, sans-serif', label: 'Source Sans 3' },
  { value: 'Work Sans, sans-serif', label: 'Work Sans' },
  { value: 'DM Sans, sans-serif', label: 'DM Sans' },
  { value: 'Outfit, sans-serif', label: 'Outfit' },
  { value: 'Georgia, serif', label: 'Georgia' },
];

/** Fuentes para títulos / encabezados */
export const THEME_DISPLAY_FONTS: ThemeFontOption[] = [
  { value: "'League Spartan', sans-serif", label: 'Spartan' },
  { value: 'Montserrat, sans-serif', label: 'Montserrat' },
  { value: 'Oswald, sans-serif', label: 'Oswald' },
  { value: 'Playfair Display, serif', label: 'Playfair Display' },
  { value: 'Raleway, sans-serif', label: 'Raleway' },
  { value: 'Bebas Neue, sans-serif', label: 'Bebas Neue' },
  { value: 'Anton, sans-serif', label: 'Anton' },
  { value: 'Merriweather, serif', label: 'Merriweather' },
  { value: 'Libre Baskerville, serif', label: 'Libre Baskerville' },
  { value: 'Archivo Black, sans-serif', label: 'Archivo Black' },
  { value: 'Barlow Condensed, sans-serif', label: 'Barlow Condensed' },
];

/** Constructor web — usa nombre corto como valor guardado */
export const PAGE_BUILDER_FONTS: ThemeFontOption[] = THEME_BODY_FONTS
  .filter(f => f.value !== 'Georgia, serif')
  .map(f => ({ value: f.label, label: f.label }));
