import { Component, input, signal, computed } from '@angular/core';

const FALLBACK = 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&auto=format&fit=crop';

/**
 * Mini carrusel de fotos para las cards del catálogo.
 * Uso:
 *   <app-car-card-carousel [images]="car.images" [imageUrl]="car.imageUrl" [alt]="car.model" />
 */
@Component({
  selector: 'app-car-card-carousel',
  standalone: true,
  template: `
    <div class="cc-wrap">
      <!-- imagen activa -->
      @for (img of slides(); track $index) {
        <img
          [src]="img"
          [alt]="alt()"
          class="cc-img"
          [class.cc-img--visible]="current() === $index" />
      }

      <!-- flechas — solo si hay más de 1 foto -->
      @if (slides().length > 1) {
        <button class="cc-btn cc-btn--prev"
          type="button"
          aria-label="Foto anterior"
          (click)="prev($event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button class="cc-btn cc-btn--next"
          type="button"
          aria-label="Foto siguiente"
          (click)="next($event)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <!-- puntos indicadores -->
        <div class="cc-dots">
          @for (img of slides(); track $index) {
            <span class="cc-dot" [class.cc-dot--active]="current() === $index"></span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .cc-wrap {
      position: relative;
      width: 100%;
      aspect-ratio: 3 / 2;
      overflow: hidden;
      background: #111;
      flex-shrink: 0;
    }

    .cc-img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      opacity: 0;
      transition: opacity .3s ease, transform .5s ease;
    }

    .cc-img--visible {
      opacity: 1;
    }

    /* hover zoom on the visible image via the parent card's :hover */
    :host-context(.car-card:hover) .cc-img--visible,
    :host-context(.dp-car-card:hover) .cc-img--visible {
      transform: scale(1.04);
    }

    /* arrows */
    .cc-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: none;
      background: rgba(0, 0, 0, .55);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 3;
      opacity: 0;
      transition: opacity .2s, background .15s;
      backdrop-filter: blur(3px);
      padding: 0;
    }

    .cc-btn svg { width: 15px; height: 15px; }

    .cc-wrap:hover .cc-btn { opacity: 1; }
    .cc-btn:hover { background: rgba(0, 0, 0, .8); }

    .cc-btn--prev { left: 7px; }
    .cc-btn--next { right: 7px; }

    /* dots */
    .cc-dots {
      position: absolute;
      bottom: 7px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 4px;
      z-index: 3;
    }

    .cc-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: rgba(255,255,255,.45);
      transition: background .2s, transform .2s;
    }

    .cc-dot--active {
      background: #fff;
      transform: scale(1.3);
    }
  `],
})
export class CarCardCarouselComponent {
  images   = input<string[] | undefined>(undefined);
  imageUrl = input<string | undefined>(undefined);
  alt      = input('Vehículo');

  slides = computed(() => {
    const imgs = this.images();
    if (imgs && imgs.length > 0) return imgs;
    const url = this.imageUrl();
    return url ? [url] : [FALLBACK];
  });

  current = signal(0);

  prev(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const n = this.slides().length;
    this.current.set((this.current() - 1 + n) % n);
  }

  next(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const n = this.slides().length;
    this.current.set((this.current() + 1) % n);
  }
}
