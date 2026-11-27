import { Component, Input, ViewEncapsulation, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideEye, LucideEyeOff } from '@lucide/angular';

/** Input de contraseña con ojito para revelar/ocultar. Compatible con [(ngModel)]. */
@Component({
  selector: 'app-password-field',
  standalone: true,
  imports: [LucideEye, LucideEyeOff],
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordFieldComponent),
      multi: true,
    },
  ],
  template: `
    <div class="pw-field" [class.pw-field--disabled]="disabled">
      <input
        class="pw-field-input"
        [attr.id]="inputId || null"
        [attr.name]="name || null"
        [type]="visible() ? 'text' : 'password'"
        [value]="value"
        [placeholder]="placeholder"
        [disabled]="disabled"
        [required]="required"
        [attr.minlength]="minlength || null"
        [attr.autocomplete]="autocomplete || null"
        (input)="onInput($event)"
        (blur)="onTouched()"
      />
      <button
        type="button"
        class="pw-field-toggle"
        (click)="toggle()"
        [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        [attr.aria-pressed]="visible()"
        tabindex="-1"
      >
        @if (visible()) {
          <svg lucideEyeOff [size]="18" [strokeWidth]="2" aria-hidden="true"></svg>
        } @else {
          <svg lucideEye [size]="18" [strokeWidth]="2" aria-hidden="true"></svg>
        }
      </button>
    </div>
  `,
  styles: [`
    app-password-field {
      display: block;
      width: 100%;
    }
    app-password-field .pw-field {
      position: relative;
      display: block;
      width: 100%;
    }
    app-password-field .pw-field-input {
      width: 100%;
      box-sizing: border-box;
      padding-right: 2.75rem;
    }
    app-password-field .pw-field-toggle {
      position: absolute;
      top: 50%;
      right: 0.35rem;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.1rem;
      height: 2.1rem;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      opacity: 0.55;
      cursor: pointer;
    }
    app-password-field .pw-field-toggle:hover {
      opacity: 0.95;
      background: rgba(127, 127, 127, 0.12);
    }
    app-password-field .pw-field--disabled .pw-field-toggle {
      opacity: 0.3;
      pointer-events: none;
    }

    /* Login oscuro: igual que los otros inputs del portal (el CSS encapsulado del login no llega aquí) */
    .login-page app-password-field .pw-field-input {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      background: rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      padding: 14px 2.75rem 14px 16px !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      border-radius: 0 !important;
      font-family: var(--f-ui, inherit) !important;
      font-size: 14px !important;
      outline: none !important;
      box-shadow: none !important;
      transition: border-color 0.2s, background 0.2s;
    }
    .login-page app-password-field .pw-field-input::placeholder {
      color: rgba(255, 255, 255, 0.2) !important;
      opacity: 1 !important;
    }
    .login-page app-password-field .pw-field-input:focus {
      border-color: var(--brand-blue, #bac9cf) !important;
      background: rgba(186, 201, 207, 0.06) !important;
    }
    .login-page app-password-field .pw-field-toggle {
      color: rgba(255, 255, 255, 0.55) !important;
      opacity: 1;
    }
    .login-page app-password-field .pw-field-toggle:hover {
      color: rgba(255, 255, 255, 0.95) !important;
      background: rgba(255, 255, 255, 0.08) !important;
    }
  `],
})
export class PasswordFieldComponent implements ControlValueAccessor {
  @Input() inputId = '';
  @Input() name = '';
  @Input() placeholder = '';
  @Input() autocomplete = '';
  @Input() required = false;
  @Input() minlength: number | null = null;

  value = '';
  disabled = false;
  visible = signal(false);

  private onChange: (v: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(ev: Event) {
    const next = (ev.target as HTMLInputElement).value;
    this.value = next;
    this.onChange(next);
  }

  toggle() {
    if (this.disabled) return;
    this.visible.update((v) => !v);
  }
}
