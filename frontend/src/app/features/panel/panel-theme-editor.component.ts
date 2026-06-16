import { Component, Input, OnInit, OnDestroy, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { AdminService } from '../../core/api.service';
import { PreviewThemeService } from '../../core/preview-theme.service';
import { CustomBlock, SiteSettings } from '../../models';
import { PanelColorPaletteComponent } from '../../shared/panel-color-palette.component';
import { ColorPaletteFieldDef } from '../../shared/theme-colors';
import { PanelLivePreviewComponent } from './panel-live-preview.component';
import { THEME_BODY_FONTS, THEME_DISPLAY_FONTS } from '../../shared/theme-fonts';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return { r: 20, g: 26, b: 38 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toCssColor(hex: string, opacity: number): string {
  if (opacity >= 100) return hex;
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(2)})`;
}

function parseColorValue(value: string | undefined, fallbackHex: string) {
  if (!value) return { hex: fallbackHex, opacity: 100 };
  if (value.startsWith('#')) return { hex: value.slice(0, 7), opacity: 100 };
  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (m) {
    const hex = `#${(+m[1]).toString(16).padStart(2, '0')}${(+m[2]).toString(16).padStart(2, '0')}${(+m[3]).toString(16).padStart(2, '0')}`;
    return { hex, opacity: m[4] ? Math.round(parseFloat(m[4]) * 100) : 100 };
  }
  return { hex: fallbackHex, opacity: 100 };
}

@Component({
  selector: 'app-panel-theme-editor',
  standalone: true,
  imports: [FormsModule, PanelColorPaletteComponent, PanelLivePreviewComponent],
  templateUrl: './panel-theme-editor.component.html',
  styleUrls: ['./panel-theme-editor.component.css', './panel-dashboard.css'],
})
export class PanelThemeEditorComponent implements OnInit, OnDestroy {
  @Input({ required: true }) pageKey!: string;
  @Input({ required: true }) title!: string;
  @Input() isPanel = false;

  theme = signal<SiteSettings>({});
  saved = signal('');
  sidebarHex = signal('#ffffff');
  sidebarOpacity = signal(4);
  cardHex = signal('#ffffff');
  cardOpacity = signal(4);
  themeLoaded = signal(false);

  readonly bodyFonts = THEME_BODY_FONTS;
  readonly displayFonts = THEME_DISPLAY_FONTS;

  liveTheme = computed(() => {
    const t = this.theme();
    return {
      ...t,
      pageKey: this.pageKey,
      sidebarBg: toCssColor(this.sidebarHex(), this.sidebarOpacity()),
      cardBg: toCssColor(this.cardHex(), this.cardOpacity()),
    };
  });

  previewUrl = computed(() => {
    const path = this.pageKey === 'gestores' ? '/gestores' : '/autos';
    return this.sanitizer.bypassSecurityTrustResourceUrl(`${path}?preview=1`);
  });

  constructor(
    private adminService: AdminService,
    private previewTheme: PreviewThemeService,
    private sanitizer: DomSanitizer,
  ) {
    effect(() => {
      if (!this.themeLoaded()) return;
      this.previewTheme.setPreview(this.pageKey, this.liveTheme());
    });
  }

  ngOnInit() {
    this.adminService.getAllSiteSettings().subscribe(list => {
      const found = list.find(s => s.pageKey === this.pageKey) || { pageKey: this.pageKey };
      const sb = parseColorValue(found.sidebarBg, '#ffffff');
      const cb = parseColorValue(found.cardBg, '#ffffff');
      this.sidebarHex.set(sb.hex);
      this.sidebarOpacity.set(sb.opacity);
      this.cardHex.set(cb.hex);
      this.cardOpacity.set(cb.opacity);
      this.theme.set({ ...found, customBlocks: found.customBlocks || [] });
      this.themeLoaded.set(true);
    });
  }

  ngOnDestroy() {
    this.previewTheme.clearPreview(this.pageKey);
  }

  update(field: keyof SiteSettings, value: string) {
    this.theme.update(t => ({ ...t, [field]: value }));
  }

  setSidebarColor(hex: string) {
    this.sidebarHex.set(hex);
    this.update('sidebarBg', toCssColor(hex, this.sidebarOpacity()));
  }

  setSidebarOpacity(opacity: number) {
    this.sidebarOpacity.set(opacity);
    this.update('sidebarBg', toCssColor(this.sidebarHex(), opacity));
  }

  setCardColor(hex: string) {
    this.cardHex.set(hex);
    this.update('cardBg', toCssColor(hex, this.cardOpacity()));
  }

  setCardOpacity(opacity: number) {
    this.cardOpacity.set(opacity);
    this.update('cardBg', toCssColor(this.cardHex(), opacity));
  }

  get themeColorFieldDefs(): ColorPaletteFieldDef[] {
    const base: ColorPaletteFieldDef[] = [
      { key: 'primaryColor', label: 'Color principal' },
      { key: 'accentColor', label: 'Color acento' },
      { key: 'backgroundColor', label: 'Fondo' },
    ];
    if (this.isPanel) {
      return [
        ...base,
        { key: 'sidebarBg', label: 'Fondo sidebar' },
        { key: 'cardBg', label: 'Fondo tarjetas' },
      ];
    }
    return base;
  }

  get themeEditorColors(): Record<string, string> {
    const t = this.theme();
    const colors: Record<string, string> = {
      primaryColor: t.primaryColor || '#000000',
      accentColor: t.accentColor || '#000000',
      backgroundColor: t.backgroundColor || '#000000',
    };
    if (this.isPanel) {
      colors['sidebarBg'] = this.sidebarHex();
      colors['cardBg'] = this.cardHex();
    }
    return colors;
  }

  applyThemeColors(map: Record<string, string>) {
    if (map['primaryColor']) this.update('primaryColor', map['primaryColor']);
    if (map['accentColor']) this.update('accentColor', map['accentColor']);
    if (map['backgroundColor']) this.update('backgroundColor', map['backgroundColor']);
    if (map['sidebarBg']) this.setSidebarColor(map['sidebarBg']);
    if (map['cardBg']) this.setCardColor(map['cardBg']);
  }

  saveThemeColor() {
    this.save();
  }

  addBlock() {
    this.theme.update(t => ({
      ...t,
      customBlocks: [...(t.customBlocks || []), { type: 'notice', text: 'Nuevo aviso', visible: true }],
    }));
  }

  removeBlock(i: number) {
    this.theme.update(t => ({ ...t, customBlocks: (t.customBlocks || []).filter((_, idx) => idx !== i) }));
  }

  updateBlock(i: number, field: keyof CustomBlock, value: string | boolean) {
    this.theme.update(t => {
      const blocks = [...(t.customBlocks || [])];
      blocks[i] = { ...blocks[i], [field]: value };
      return { ...t, customBlocks: blocks };
    });
  }

  save() {
    this.theme.update(t => ({
      ...t,
      sidebarBg: toCssColor(this.sidebarHex(), this.sidebarOpacity()),
      cardBg: toCssColor(this.cardHex(), this.cardOpacity()),
    }));
    this.adminService.saveSiteSettings(this.pageKey, this.theme()).subscribe({
      next: () => this.saved.set('Guardado correctamente'),
      error: () => this.saved.set('Error al guardar'),
    });
  }
}
