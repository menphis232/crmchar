import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatDateOnlyMx, parseDateOnlyMx, toDateOnlyIso } from './date-only.util';

/** Campo de fecha en DD/MM/AAAA (visible) con selector nativo opcional. Emite YYYY-MM-DD. */
@Component({
  selector: 'app-mx-date-input',
  standalone: true,
  imports: [FormsModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="mx-date">
      <input
        type="text"
        class="mx-date-text"
        inputmode="numeric"
        autocomplete="off"
        placeholder="DD/MM/AAAA"
        maxlength="10"
        [disabled]="disabled"
        [value]="display"
        (input)="onTextInput($event)"
        (blur)="commitText()"
        (keydown.enter)="commitText(); $any($event.target).blur()"
      />
      <input
        type="date"
        class="mx-date-native"
        [disabled]="disabled"
        [attr.max]="max || null"
        [value]="iso"
        (change)="onNative($event)"
        tabindex="-1"
        aria-label="Elegir fecha"
      />
    </div>
  `,
  styles: [`
    app-mx-date-input { display: block; width: 100%; }
    app-mx-date-input .mx-date {
      position: relative;
      display: block;
      width: 100%;
    }
    app-mx-date-input .mx-date-text {
      width: 100%;
      box-sizing: border-box;
      padding-right: 2.4rem;
    }
    app-mx-date-input .mx-date-native {
      position: absolute;
      top: 0;
      right: 0;
      width: 2.4rem;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      opacity: 0.01;
      cursor: pointer;
    }
    app-mx-date-input .mx-date-native::-webkit-calendar-picker-indicator {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      cursor: pointer;
      opacity: 1;
    }
    app-mx-date-input .mx-date::after {
      content: '';
      position: absolute;
      top: 50%;
      right: 0.55rem;
      width: 0.95rem;
      height: 0.95rem;
      transform: translateY(-50%);
      pointer-events: none;
      background: currentColor;
      opacity: 0.45;
      mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E") center / contain no-repeat;
      -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cline x1='16' y1='2' x2='16' y2='6'/%3E%3Cline x1='8' y1='2' x2='8' y2='6'/%3E%3Cline x1='3' y1='10' x2='21' y2='10'/%3E%3C/svg%3E") center / contain no-repeat;
    }
  `],
})
export class MxDateInputComponent {
  @Input() set value(v: string | null | undefined) {
    this.iso = toDateOnlyIso(v);
    this.display = this.iso ? formatDateOnlyMx(this.iso) : '';
  }
  @Input() disabled = false;
  @Input() max = '';
  @Output() valueChange = new EventEmitter<string>();

  iso = '';
  display = '';

  onTextInput(ev: Event) {
    this.display = (ev.target as HTMLInputElement).value;
  }

  private clamp(iso: string): string {
    if (!iso) return '';
    if (this.max && iso > this.max) return this.max;
    return iso;
  }

  commitText() {
    const parsed = parseDateOnlyMx(this.display);
    if (!this.display.trim()) {
      this.iso = '';
      this.display = '';
      this.valueChange.emit('');
      return;
    }
    if (!parsed) {
      this.display = this.iso ? formatDateOnlyMx(this.iso) : '';
      return;
    }
    const next = this.clamp(parsed);
    this.iso = next;
    this.display = formatDateOnlyMx(next);
    this.valueChange.emit(next);
  }

  onNative(ev: Event) {
    const next = this.clamp(toDateOnlyIso((ev.target as HTMLInputElement).value));
    this.iso = next;
    this.display = next ? formatDateOnlyMx(next) : '';
    this.valueChange.emit(next);
  }
}
