import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="simple-color-picker">
      <div class="preset-colors">
        @for (color of presetColors; track color) {
          <button 
            type="button"
            class="color-swatch" 
            [class.active]="value === color"
            [style.background-color]="color"
            (click)="selectColor(color)"
            title="{{ color }}">
          </button>
        }
      </div>
      <div class="custom-color">
        <span style="font-size: 12px; color: var(--muted);">HEX:</span>
        <input 
          type="text" 
          [ngModel]="value" 
          (ngModelChange)="onInputChange($event)"
          placeholder="#000000"
          style="width: 80px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); background: rgba(0,0,0,0.2); color: var(--text); font-size: 12px;"
        >
      </div>
    </div>
  `,
  styles: [`
    .simple-color-picker {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .preset-colors {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .color-swatch {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      padding: 0;
      transition: transform 0.1s, border-color 0.1s;
    }
    .color-swatch:hover {
      transform: scale(1.1);
    }
    .color-swatch.active {
      border-color: #fff;
      box-shadow: 0 0 0 1px var(--gold);
    }
    .custom-color {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ColorPickerComponent {
  @Input() value: string = '#000000';
  @Output() valueChange = new EventEmitter<string>();

  presetColors = [
    '#ffffff', '#f8f9fa', '#e9ecef', '#ced4da', '#6c757d', '#343a40', '#000000',
    '#d32f2f', '#c2185b', '#7b1fa2', '#512da8', '#303f9f', '#1976d2', '#0288d1',
    '#0097a7', '#00796b', '#388e3c', '#689f38', '#afb42b', '#fbc02d', '#ffa000',
    '#f57c00', '#e64a19', '#5d4037', '#616161', '#455a64'
  ];

  selectColor(color: string) {
    this.value = color;
    this.valueChange.emit(color);
  }

  onInputChange(val: string) {
    this.value = val;
    this.valueChange.emit(val);
  }
}
