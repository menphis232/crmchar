import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../core/api.service';
import { CustomBlock, SiteSettings } from '../../models';
import { ColorPickerComponent } from '../../shared/color-picker.component';

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
  imports: [FormsModule],
  templateUrl: './panel-theme-editor.component.html',
  styleUrl: './panel-dashboard.css',
})
export class PanelThemeEditorComponent implements OnInit {
  @Input({ required: true }) pageKey!: string;
  @Input({ required: true }) title!: string;
  @Input() isPanel = false;

  theme = signal<SiteSettings>({});
  saved = signal('');
  sidebarHex = signal('#ffffff');
  sidebarOpacity = signal(4);
  cardHex = signal('#ffffff');
  cardOpacity = signal(4);

  constructor(private adminService: AdminService) {}

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
    });
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
