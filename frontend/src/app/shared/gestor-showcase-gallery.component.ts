import { Component, input, signal, HostListener } from '@angular/core';
import { GESTOR_GALLERY_COLUMNS } from './gestor-media.constants';

@Component({
  selector: 'app-gestor-showcase-gallery',
  standalone: true,
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
              <span class="gg-cell-overlay" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </span>
            </button>
          }
        </div>
      </section>

      @if (lightboxIdx() !== null) {
        <div class="gg-lightbox" (click)="close()" role="dialog" aria-modal="true" aria-label="Vista ampliada">
          <button type="button" class="gg-lb-close-fab" (click)="close($event)" aria-label="Cerrar foto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span>Cerrar</span>
          </button>

          <div class="gg-lb-toolbar" (click)="$event.stopPropagation()">
            <span class="gg-lb-title">{{ title() }}</span>
            <span class="gg-lb-count">{{ lightboxIdx()! + 1 }} / {{ images().length }}</span>
          </div>
          <div class="gg-lb-body" (click)="$event.stopPropagation()">
            @if (images().length > 1) {
              <button type="button" class="gg-lb-nav gg-lb-prev" (click)="prev($event)" aria-label="Anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            }
            <img [src]="images()[lightboxIdx()!]" class="gg-lb-img" alt="" />
            @if (images().length > 1) {
              <button type="button" class="gg-lb-nav gg-lb-next" (click)="next($event)" aria-label="Siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            }
          </div>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }

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
      position: relative;
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
      object-position: center;
      display: block;
      user-select: none;
    }

    .gg-cell-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.35);
      color: #fff;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .gg-cell-overlay svg { width: 22px; height: 22px; }
    .gg-cell:hover .gg-cell-overlay { opacity: 1; }

    .gg-lightbox {
      position: fixed;
      inset: 0;
      z-index: 50000;
      background: rgba(0, 0, 0, 0.96);
      display: flex;
      flex-direction: column;
    }

    .gg-lb-close-fab {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 50001;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-width: 56px;
      min-height: 56px;
      padding: 10px 14px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
    }

    .gg-lb-close-fab svg { width: 22px; height: 22px; flex-shrink: 0; }
    .gg-lb-close-fab span {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      line-height: 1;
    }

    .gg-lb-close-fab:hover {
      background: rgba(220, 38, 38, 0.85);
      border-color: rgba(255, 255, 255, 0.5);
      transform: scale(1.03);
    }

    .gg-lb-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }

    .gg-lb-title {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.7);
      flex: 1;
    }

    .gg-lb-count { font-size: 12px; color: rgba(255, 255, 255, 0.45); }

    .gg-lb-body {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 16px 56px;
      min-height: 0;
    }

    .gg-lb-img {
      max-width: min(1080px, 100%);
      max-height: 100%;
      aspect-ratio: 1 / 1;
      object-fit: contain;
      border-radius: 4px;
      user-select: none;
    }

    .gg-lb-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px;
      height: 48px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gg-lb-nav:hover { background: rgba(255, 255, 255, 0.12); }
    .gg-lb-nav svg { width: 20px; height: 20px; }
    .gg-lb-prev { left: 12px; }
    .gg-lb-next { right: 12px; }

    @media (max-width: 768px) {
      .gg-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
      .gg-cell-overlay { opacity: 1; }
      .gg-lb-body { padding: 12px 44px; padding-top: 72px; }
      .gg-lb-nav { width: 40px; height: 40px; }
      .gg-lb-close-fab { top: 12px; right: 12px; min-width: 52px; min-height: 52px; }
    }

    @media (max-width: 420px) {
      .gg-grid { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class GestorShowcaseGalleryComponent {
  images = input.required<string[]>();
  title = input('Galería fotos');

  lightboxIdx = signal<number | null>(null);

  open(i: number) {
    this.lightboxIdx.set(i);
    document.body.style.overflow = 'hidden';
  }

  close(e?: Event) {
    e?.stopPropagation();
    this.lightboxIdx.set(null);
    document.body.style.overflow = '';
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
