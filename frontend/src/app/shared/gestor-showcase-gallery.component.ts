import { Component, input, signal, HostListener } from '@angular/core';

@Component({
  selector: 'app-gestor-showcase-gallery',
  standalone: true,
  template: `
    @if (images().length) {
      <section class="gsg" [attr.aria-label]="title() || 'Galería'">
        @if (title()) {
          <h3 class="gsg-title">{{ title() }}</h3>
        }
        <div class="gsg-grid" [class.gsg-grid--solo]="images().length === 1" [class.gsg-grid--duo]="images().length === 2">
          @for (img of images(); track img; let i = $index) {
            <button
              type="button"
              class="gsg-cell"
              [class.gsg-cell--hero]="i === 0 && images().length >= 3"
              (click)="open(i)"
              [attr.aria-label]="'Ampliar imagen ' + (i + 1)">
              <img [src]="img" alt="" loading="lazy" />
            </button>
          }
        </div>
      </section>

      @if (lightboxIdx() !== null) {
        <div class="gsg-lightbox" (click)="close()" role="dialog" aria-modal="true" aria-label="Vista ampliada">
          <button type="button" class="gsg-lb-close" (click)="close($event)" aria-label="Cerrar">×</button>
          @if (images().length > 1) {
            <button type="button" class="gsg-lb-nav gsg-lb-prev" (click)="prev($event)" aria-label="Anterior">‹</button>
            <button type="button" class="gsg-lb-nav gsg-lb-next" (click)="next($event)" aria-label="Siguiente">›</button>
          }
          <img [src]="images()[lightboxIdx()!]" class="gsg-lb-img" alt="" (click)="$event.stopPropagation()" />
          <span class="gsg-lb-counter">{{ lightboxIdx()! + 1 }} / {{ images().length }}</span>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .gsg-title {
      font-family: var(--f-display, inherit);
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 16px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #fff;
    }

    .gsg-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      grid-auto-rows: minmax(120px, auto);
      gap: 10px;
      width: 100%;
    }

    .gsg-grid--solo { grid-template-columns: 1fr; }
    .gsg-grid--solo .gsg-cell { grid-column: 1 / -1; aspect-ratio: 4 / 3; }

    .gsg-grid--duo { grid-template-columns: 1fr 1fr; }
    .gsg-grid--duo .gsg-cell { aspect-ratio: 4 / 3; }

    .gsg-cell {
      grid-column: span 2;
      aspect-ratio: 4 / 3;
      border: none;
      padding: 0;
      border-radius: 10px;
      overflow: hidden;
      cursor: zoom-in;
      background: rgba(255, 255, 255, 0.04);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .gsg-cell--hero {
      grid-column: span 4;
      grid-row: span 2;
      aspect-ratio: auto;
      min-height: 220px;
    }

    .gsg-cell:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }

    .gsg-cell img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .gsg-lightbox {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.92);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 16px 16px;
      box-sizing: border-box;
    }

    .gsg-lb-img {
      max-width: min(960px, 100%);
      max-height: calc(100vh - 80px);
      object-fit: contain;
      border-radius: 8px;
      user-select: none;
    }

    .gsg-lb-close {
      position: absolute;
      top: 12px;
      right: 16px;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
    }

    .gsg-lb-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 28px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gsg-lb-prev { left: 12px; }
    .gsg-lb-next { right: 12px; }

    .gsg-lb-counter {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255, 255, 255, 0.75);
      font-size: 13px;
      letter-spacing: 0.04em;
    }

    @media (max-width: 768px) {
      .gsg-grid {
        grid-template-columns: 1fr 1fr;
        grid-auto-rows: auto;
      }

      .gsg-cell,
      .gsg-cell--hero {
        grid-column: span 1;
        grid-row: span 1;
        aspect-ratio: 4 / 3;
        min-height: unset;
      }

      .gsg-grid--solo .gsg-cell { grid-column: 1 / -1; }
    }
  `],
})
export class GestorShowcaseGalleryComponent {
  images = input.required<string[]>();
  title = input('Galería');

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
