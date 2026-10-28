import { Injectable, signal } from '@angular/core';

export type ColorMode = 'dark' | 'light';

const STORAGE_KEY = 'tvm-color-mode';
const LIGHT_VARS = ['--bg', '--panel-bg', '--panel-sidebar-bg', '--panel-card-bg'];

@Injectable({ providedIn: 'root' })
export class ColorModeService {
  readonly mode = signal<ColorMode>(this.read());
  private lightApplied = false;

  constructor() {
    this.apply(this.mode());
  }

  toggle(): void {
    this.set(this.mode() === 'light' ? 'dark' : 'light');
  }

  set(mode: ColorMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* almacenamiento no disponible */
    }
    this.apply(mode);
  }

  private read(): ColorMode {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  private apply(mode: ColorMode): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset['theme'] = mode;

    if (mode === 'light') {
      root.style.colorScheme = 'light';
      LIGHT_VARS.forEach(v => root.style.setProperty(v, '#ffffff'));
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#5c5c5c';
      this.lightApplied = true;
      return;
    }

    if (!this.lightApplied) return;
    root.style.colorScheme = '';
    LIGHT_VARS.forEach(v => root.style.removeProperty(v));
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
    this.lightApplied = false;
  }
}
