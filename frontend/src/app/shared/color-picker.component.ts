import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ColorPaletteFieldDef } from './theme-colors';
import { PanelColorPaletteComponent } from './panel-color-palette.component';

/** Selector compacto: un solo campo usando la paleta compartida. */
@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [PanelColorPaletteComponent],
  template: `
    <app-panel-color-palette
      [fields]="fieldDefs"
      [colors]="colorMap"
      [hint]="''"
      (colorPicked)="onPick($event)"
    />
  `,
})
export class ColorPickerComponent {
  @Input() value: string = '#000000';
  @Output() valueChange = new EventEmitter<string>();

  fieldDefs: ColorPaletteFieldDef[] = [{ key: 'value', label: 'Color' }];

  get colorMap() {
    return { value: this.value };
  }

  onPick({ value }: { key: string; value: string }) {
    this.value = value;
    this.valueChange.emit(value);
  }
}
