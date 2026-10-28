import { Component, inject } from '@angular/core';
import { ColorModeService } from '../core/color-mode.service';

@Component({
  selector: 'app-theme-switch',
  standalone: true,
  template: `
    <button
      type="button"
      class="theme-switch"
      role="switch"
      [attr.aria-checked]="colorMode.mode() === 'light'"
      [attr.aria-label]="colorMode.mode() === 'light' ? 'Tema claro activo. Cambiar a negro' : 'Tema negro activo. Cambiar a claro'"
      (click)="colorMode.toggle()"
    >
      <span class="theme-switch-label">{{ colorMode.mode() === 'light' ? 'Claro' : 'Negro' }}</span>
      <span class="theme-switch-track" aria-hidden="true">
        <span class="theme-switch-thumb"></span>
      </span>
    </button>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .theme-switch {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      margin: 0;
      padding: 0 8px 0 12px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 999px;
      background: transparent;
      color: #d4d4d4;
      font-family: var(--f-ui, 'Spartan', sans-serif);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
      line-height: 1;
    }
    .theme-switch:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    .theme-switch-track {
      width: 36px;
      height: 18px;
      border-radius: 999px;
      border: 1px solid currentColor;
      position: relative;
      box-sizing: border-box;
    }
    .theme-switch-thumb {
      position: absolute;
      top: 1px;
      left: 1px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: currentColor;
      transition: transform 0.18s ease;
    }
    :host-context(html[data-theme='light']) .theme-switch {
      background: #fff;
      color: #5c5c5c;
      border-color: #c5c5c5;
    }
    :host-context(html[data-theme='light']) .theme-switch-thumb {
      transform: translateX(18px);
    }
  `],
})
export class ThemeSwitchComponent {
  readonly colorMode = inject(ColorModeService);
}
