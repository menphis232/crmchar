import { Component, EventEmitter, Input, OnChanges, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorPaletteFieldDef, THEME_COLOR_PALETTE } from './theme-colors';

@Component({
  selector: 'app-panel-color-palette',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './panel-color-palette.component.html',
  styleUrl: './panel-color-palette.component.css',
})
export class PanelColorPaletteComponent implements OnInit, OnChanges {
  @Input({ required: true }) fields: ColorPaletteFieldDef[] = [];
  @Input({ required: true }) colors: Record<string, string> = {};
  @Input() hint = 'Selecciona qué color editar y elige un tono de la paleta.';

  @Output() colorsChange = new EventEmitter<Record<string, string>>();
  @Output() colorPicked = new EventEmitter<{ key: string; value: string }>();

  readonly palette = THEME_COLOR_PALETTE;
  activeKey = '';

  ngOnInit() {
    this.ensureActiveKey();
  }

  ngOnChanges() {
    this.ensureActiveKey();
  }

  private ensureActiveKey() {
    if (!this.activeKey && this.fields.length) {
      this.activeKey = this.fields[0].key;
    }
  }

  get activeValue(): string {
    return this.colors[this.activeKey] || '#000000';
  }

  selectField(key: string) {
    this.activeKey = key;
  }

  pickColor(color: string) {
    if (!this.activeKey) return;
    const next = { ...this.colors, [this.activeKey]: color };
    this.colorsChange.emit(next);
    this.colorPicked.emit({ key: this.activeKey, value: color });
  }

  onHexInput(value: string) {
    const hex = value.trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return;
    this.pickColor(hex);
  }
}
