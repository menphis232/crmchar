import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
  ViewEncapsulation,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AutoGalleryItem, mapAutoGalleryToGalleriaSlides } from './auto-video.util';

@Component({
  selector: 'app-auto-galleria',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (slides().length) {
      <div class="ag-root">

        <!-- ── Miniaturas (columna izquierda / fila inferior en móvil) ── -->
        <div class="ag-thumbs">
          @for (s of slides(); track $index) {
            <button
              class="ag-thumb-btn"
              [class.ag-thumb-btn--active]="current() === $index"
              (click)="goto($index)"
              type="button"
              [attr.aria-label]="'Ver foto ' + ($index + 1)">
              @if (s.type === 'video') {
                <div class="ag-thumb-video-wrap">
                  <img [src]="s.thumbnailImageSrc" class="ag-thumb-img" alt="Video" />
                  <span class="ag-thumb-play">▶</span>
                </div>
              } @else {
                <img [src]="s.thumbnailImageSrc" class="ag-thumb-img" [alt]="alt() + ' miniatura ' + ($index + 1)" />
              }
            </button>
          }
        </div>

        <!-- ── Imagen principal (columna derecha) ── -->
        <div class="ag-main">
          @for (s of slides(); track $index) {
            <div class="ag-item" [class.ag-item--visible]="current() === $index">
              @if (s.type === 'video') {
                @if (s.embedUrl) {
                  <iframe
                    [src]="safe(s.embedUrl)"
                    class="ag-video"
                    title="Video del vehículo"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>
                } @else {
                  <video
                    class="ag-video"
                    [src]="s.url"
                    [attr.poster]="s.poster || null"
                    controls
                    playsinline></video>
                }
              } @else {
                <img [src]="s.itemImageSrc" [alt]="alt()" class="ag-img" />
              }
            </div>
          }

          <!-- flechas -->
          @if (slides().length > 1) {
            <button class="ag-arrow ag-arrow--prev" (click)="prev()" type="button" aria-label="Anterior">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button class="ag-arrow ag-arrow--next" (click)="next()" type="button" aria-label="Siguiente">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          }

          <!-- contador -->
          <span class="ag-counter">{{ current() + 1 }} / {{ slides().length }}</span>
        </div>

      </div>
    }
  `,
  styles: [`
    /* ── Layout raíz ── */
    app-auto-galleria { display: block; width: 100%; font-family: inherit; color: inherit; }

    .ag-root {
      display: grid;
      grid-template-columns: 110px 1fr;
      grid-template-rows: auto;
      gap: 8px;
      width: 100%;
    }

    /* ── Columna de miniaturas ── */
    .ag-thumbs {
      grid-column: 1;
      grid-row: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 100%;
      align-self: start;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,.2) transparent;
      padding-right: 2px;
    }

    .ag-thumb-btn {
      flex-shrink: 0;
      width: 102px;
      height: 68px;
      border: 2px solid transparent;
      border-radius: 6px;
      padding: 0;
      cursor: pointer;
      background: transparent;
      overflow: hidden;
      transition: border-color .15s, opacity .15s;
      opacity: .6;
    }

    .ag-thumb-btn:hover   { opacity: .85; border-color: rgba(255,255,255,.4); }
    .ag-thumb-btn--active { opacity: 1;   border-color: rgba(255,255,255,.85); }

    .ag-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .ag-thumb-video-wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .ag-thumb-video-wrap .ag-thumb-img {
      width: 100%;
      height: 100%;
    }

    .ag-thumb-play {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #fff;
      background: rgba(0,0,0,.45);
      pointer-events: none;
    }

    /* ── Imagen principal (proporción 3:2 = mismo recorte al subir) ── */
    .ag-main {
      grid-column: 2;
      grid-row: 1;
      position: relative;
      width: 100%;
      aspect-ratio: 3 / 2;
      height: auto;
      border-radius: 8px;
      overflow: hidden;
      background: rgba(255,255,255,.04);
    }

    .ag-item {
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
      transition: opacity .25s ease;
    }

    .ag-item--visible {
      opacity: 1;
      pointer-events: auto;
    }

    .ag-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
    }

    .ag-video {
      width: 100%;
      height: 100%;
      display: block;
      border: none;
      object-fit: contain;
      background: #000;
    }

    /* ── Flechas ── */
    .ag-arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: none;
      background: rgba(0,0,0,.55);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
      transition: background .15s;
      backdrop-filter: blur(4px);
    }

    .ag-arrow:hover { background: rgba(0,0,0,.8); }
    .ag-arrow svg   { width: 18px; height: 18px; }

    .ag-arrow--prev { left: 10px; }
    .ag-arrow--next { right: 10px; }

    /* ── Contador ── */
    .ag-counter {
      position: absolute;
      bottom: 10px;
      right: 12px;
      background: rgba(0,0,0,.5);
      color: #fff;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 20px;
      backdrop-filter: blur(4px);
      pointer-events: none;
      z-index: 2;
    }

    /* ── Responsive: mobile ── */
    @media (max-width: 680px) {
      .ag-root {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
        gap: 6px;
      }

      .ag-main {
        grid-column: 1;
        grid-row: 1;
        aspect-ratio: 3 / 2;
        height: auto;
      }

      .ag-thumbs {
        grid-column: 1;
        grid-row: 2;
        flex-direction: row;
        max-height: none;
        overflow-x: auto;
        overflow-y: hidden;
        padding-right: 0;
        padding-bottom: 2px;
      }

      .ag-thumb-btn {
        width: 76px;
        height: 52px;
        flex-shrink: 0;
      }
    }
  `],
})
export class AutoGalleriaComponent {
  private sanitizer = inject(DomSanitizer);

  items             = input.required<AutoGalleryItem[]>();
  alt               = input('Vehículo');
  activeIndex       = input(0);
  activeIndexChange = output<number>();

  slides  = computed(() => mapAutoGalleryToGalleriaSlides(this.items()));
  current = signal(0);

  constructor() {
    effect(() => { this.current.set(this.activeIndex()); });
  }

  goto(i: number) {
    this.current.set(i);
    this.activeIndexChange.emit(i);
  }

  prev() {
    const n = this.slides().length;
    this.goto((this.current() - 1 + n) % n);
  }

  next() {
    const n = this.slides().length;
    this.goto((this.current() + 1) % n);
  }

  safe(url: string | null | undefined): SafeResourceUrl | null {
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }
}
