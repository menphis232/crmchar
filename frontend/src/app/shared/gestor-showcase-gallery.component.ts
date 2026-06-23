import {
  Component,
  input,
  signal,
  HostListener,
  ViewEncapsulation,
  ElementRef,
  inject,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { GESTOR_GALLERY_COLUMNS } from './gestor-media.constants';

@Component({
  selector: 'app-gestor-showcase-gallery',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (images().length) {
      <section class="gg" [attr.aria-label]="title() || 'Galería'">
        <div class="gg-head">
          <h3 class="gg-title">{{ title() }}</h3>
          <span class="gg-meta">{{ images().length }} / 9</span>
        </div>

        <div class="gg-grid">
          @for (img of images(); track img; let i = $index) {
            <button
              type="button"
              class="gg-cell"
              (click)="open(i)"
              [attr.aria-label]="'Ampliar foto ' + (i + 1)">
              <img [src]="img" alt="" loading="lazy" draggable="false" />
            </button>
          }
        </div>
      </section>

      @if (lightboxIdx() !== null) {
        <div #lightboxRoot class="gg-lightbox" (click)="close()" role="dialog" aria-modal="true" aria-label="Vista ampliada">
          <div class="gg-lb-panel" (click)="$event.stopPropagation()">
            <div class="gg-lb-frame">
              <button type="button" class="gg-lb-close" (click)="close($event)" aria-label="Cerrar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              @if (images().length > 1) {
                <button type="button" class="gg-lb-nav gg-lb-prev" (click)="prev($event)" aria-label="Foto anterior">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
              }
              <img [src]="images()[lightboxIdx()!]" class="gg-lb-img" alt="" />
              @if (images().length > 1) {
                <button type="button" class="gg-lb-nav gg-lb-next" (click)="next($event)" aria-label="Foto siguiente">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              }
            </div>

            <p class="gg-lb-caption">{{ lightboxIdx()! + 1 }} de {{ images().length }}</p>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .gg { display: block; width: 100%; }

    .gg-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .gg-title {
      font-family: var(--f-display, inherit);
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #fff;
    }

    .gg-meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.45);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .gg-grid {
      display: grid;
      grid-template-columns: repeat(${GESTOR_GALLERY_COLUMNS}, 1fr);
      gap: 10px;
      width: 100%;
    }

    .gg-cell {
      aspect-ratio: 1 / 1;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 8px;
      overflow: hidden;
      cursor: zoom-in;
      background: #111;
      transition: border-color 0.2s, transform 0.2s;
    }

    .gg-cell:hover {
      border-color: rgba(255, 255, 255, 0.35);
      transform: translateY(-1px);
    }

    .gg-cell img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      user-select: none;
    }

    /* ── Lightbox (portal a body) ── */
    .gg-lightbox {
      position: fixed;
      inset: 0;
      z-index: 200000;
      background: rgba(0, 0, 0, 0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      box-sizing: border-box;
      animation: gg-fade-in 0.2s ease;
    }

    @keyframes gg-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .gg-lb-panel {
      position: relative;
      width: min(92vw, 640px);
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      overflow: visible;
    }

    .gg-lb-close {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 10;
      width: 46px;
      height: 46px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      background: #000000;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
      transition: transform 0.15s, background 0.15s, border-color 0.15s;
      padding: 0;
    }

    .gg-lb-close svg {
      width: 20px;
      height: 20px;
      stroke: #ffffff;
    }

    .gg-lb-close:hover {
      transform: scale(1.06);
      background: #111111;
      border-color: #ffffff;
    }

    .gg-lb-close:active { transform: scale(0.95); }

    .gg-lb-frame {
      position: relative;
      width: 100%;
      aspect-ratio: 1 / 1;
      border-radius: 12px;
      overflow: hidden;
      background: #000000;
      border: 2px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75);
    }

    .gg-lb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      user-select: none;
      background: #000;
    }

    .gg-lb-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 3;
      width: 42px;
      height: 42px;
      border: 2px solid #ffffff;
      border-radius: 50%;
      background: #000000;
      color: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      transition: transform 0.15s, background 0.15s;
      padding: 0;
    }

    .gg-lb-nav svg { width: 18px; height: 18px; stroke: #ffffff; }
    .gg-lb-nav:hover { transform: translateY(-50%) scale(1.06); background: #111111; }
    .gg-lb-prev { left: 12px; }
    .gg-lb-next { right: 12px; }

    .gg-lb-caption {
      margin: 14px 0 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.06em;
      color: rgba(255, 255, 255, 0.55);
      text-transform: uppercase;
    }

    @media (max-width: 768px) {
      .gg-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .gg-lightbox { padding: 16px 12px; }
      .gg-lb-panel { width: min(96vw, 480px); }
      .gg-lb-close { top: 10px; right: 10px; width: 44px; height: 44px; }
      .gg-lb-nav { width: 38px; height: 38px; }
      .gg-lb-prev { left: 8px; }
      .gg-lb-next { right: 8px; }
    }
  `],
})
export class GestorShowcaseGalleryComponent {
  private host = inject(ElementRef<HTMLElement>);
  private destroyRef = inject(DestroyRef);

  images = input.required<string[]>();
  title = input('Galería fotos');

  lightboxIdx = signal<number | null>(null);
  private lightboxEl: HTMLElement | null = null;

  constructor() {
    afterNextRender(() => this.syncLightboxPortal());
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
      this.lightboxEl?.remove();
      this.lightboxEl = null;
    });
  }

  private syncLightboxPortal() {
    const root = this.host.nativeElement.querySelector('.gg-lightbox') as HTMLElement | null;
    if (this.lightboxIdx() !== null && root) {
      if (root.parentElement !== document.body) {
        document.body.appendChild(root);
      }
      this.lightboxEl = root;
    }
  }

  open(i: number) {
    this.lightboxIdx.set(i);
    document.body.style.overflow = 'hidden';
    queueMicrotask(() => this.syncLightboxPortal());
  }

  close(e?: Event) {
    e?.stopPropagation();
    this.lightboxIdx.set(null);
    document.body.style.overflow = '';
    this.lightboxEl = null;
  }

  prev(e: Event) {
    e.stopPropagation();
    const n = this.images().length;
    const cur = this.lightboxIdx() ?? 0;
    this.lightboxIdx.set((cur - 1 + n) % n);
  }

  next(e: Event) {
    e.stopPropagation();
    const n = this.images().length;
    const cur = this.lightboxIdx() ?? 0;
    this.lightboxIdx.set((cur + 1) % n);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.lightboxIdx() === null) return;
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.prev(e);
    if (e.key === 'ArrowRight') this.next(e);
  }
}
