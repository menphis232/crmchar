import { Component, input, signal, HostListener, effect, ElementRef, viewChild } from '@angular/core';

@Component({
  selector: 'app-gestor-showcase-gallery',
  standalone: true,
  template: `
    @if (images().length) {
      <section class="gg" [attr.aria-label]="title() || 'Galería'">
        <div class="gg-head">
          <h3 class="gg-title">{{ title() }}</h3>
          <span class="gg-meta">{{ images().length }} {{ images().length === 1 ? 'foto' : 'fotos' }}</span>
        </div>

        <div class="gg-stage-wrap">
          <div class="gg-stage" (click)="open(current())">
            @for (img of images(); track img; let i = $index) {
              <figure class="gg-slide" [class.gg-slide--on]="current() === i" [attr.aria-hidden]="current() !== i">
                <img [src]="img" alt="" loading="lazy" draggable="false" />
              </figure>
            }

            @if (images().length > 1) {
              <button type="button" class="gg-nav gg-nav--prev" (click)="prev($event)" aria-label="Foto anterior">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" class="gg-nav gg-nav--next" (click)="next($event)" aria-label="Foto siguiente">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            }

            <span class="gg-counter">{{ current() + 1 }} / {{ images().length }}</span>
            <span class="gg-expand-hint" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
            </span>
          </div>
        </div>

        @if (images().length > 1) {
          <div class="gg-thumbs-bar">
            <div class="gg-thumbs" #thumbsTrack>
              @for (img of images(); track img; let i = $index) {
                <button
                  type="button"
                  class="gg-thumb"
                  [class.gg-thumb--active]="current() === i"
                  (click)="goto(i)"
                  [attr.aria-label]="'Ver foto ' + (i + 1)"
                  [attr.aria-current]="current() === i ? 'true' : null">
                  <img [src]="img" alt="" loading="lazy" draggable="false" />
                </button>
              }
            </div>
          </div>
        }
      </section>

      @if (lightboxIdx() !== null) {
        <div class="gg-lightbox" (click)="close()" role="dialog" aria-modal="true" aria-label="Vista ampliada">
          <div class="gg-lb-toolbar">
            <span class="gg-lb-title">{{ title() }}</span>
            <span class="gg-lb-count">{{ lightboxIdx()! + 1 }} / {{ images().length }}</span>
            <button type="button" class="gg-lb-close" (click)="close($event)" aria-label="Cerrar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
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

    .gg-stage-wrap {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: #0a0a0a;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
    }

    .gg-stage {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      max-height: min(52vh, 440px);
      cursor: zoom-in;
      overflow: hidden;
      background: #111;
    }

    .gg-slide {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      transition: opacity 0.45s ease;
      pointer-events: none;
    }

    .gg-slide--on {
      opacity: 1;
      pointer-events: auto;
    }

    .gg-slide img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      user-select: none;
    }

    .gg-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      z-index: 3;
      width: 42px;
      height: 42px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(6px);
      opacity: 0;
      transition: opacity 0.2s, background 0.2s;
    }

    .gg-stage:hover .gg-nav { opacity: 1; }
    .gg-nav:hover { background: rgba(0, 0, 0, 0.78); }
    .gg-nav svg { width: 18px; height: 18px; }
    .gg-nav--prev { left: 14px; }
    .gg-nav--next { right: 14px; }

    .gg-counter {
      position: absolute;
      bottom: 14px;
      left: 14px;
      z-index: 3;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #fff;
      background: rgba(0, 0, 0, 0.55);
      padding: 5px 10px;
      border-radius: 20px;
      backdrop-filter: blur(6px);
      pointer-events: none;
    }

    .gg-expand-hint {
      position: absolute;
      top: 14px;
      right: 14px;
      z-index: 3;
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.55);
      color: rgba(255, 255, 255, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(6px);
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    }

    .gg-expand-hint svg { width: 16px; height: 16px; }
    .gg-stage:hover .gg-expand-hint { opacity: 1; }

    .gg-thumbs-bar {
      margin-top: 10px;
      padding: 2px 0;
    }

    .gg-thumbs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,.25) transparent;
      padding-bottom: 4px;
    }

    .gg-thumb {
      flex: 0 0 auto;
      width: 88px;
      height: 58px;
      padding: 0;
      border: 2px solid transparent;
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      background: #111;
      opacity: 0.55;
      transition: opacity 0.2s, border-color 0.2s, transform 0.2s;
    }

    .gg-thumb:hover { opacity: 0.85; }
    .gg-thumb--active {
      opacity: 1;
      border-color: rgba(255, 255, 255, 0.9);
      transform: translateY(-1px);
    }

    .gg-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* Lightbox */
    .gg-lightbox {
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0, 0, 0, 0.96);
      display: flex;
      flex-direction: column;
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

    .gg-lb-count {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.45);
    }

    .gg-lb-close {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .gg-lb-close svg { width: 18px; height: 18px; }
    .gg-lb-close:hover { background: rgba(255, 255, 255, 0.14); }

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
      max-width: 100%;
      max-height: 100%;
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
      .gg-stage { aspect-ratio: 4 / 3; max-height: none; }
      .gg-nav { opacity: 1; width: 36px; height: 36px; }
      .gg-expand-hint { opacity: 1; }
      .gg-thumb { width: 72px; height: 48px; }
      .gg-lb-body { padding: 12px 44px; }
      .gg-lb-nav { width: 40px; height: 40px; }
    }
  `],
})
export class GestorShowcaseGalleryComponent {
  images = input.required<string[]>();
  title = input('Galería');

  thumbsTrack = viewChild<ElementRef<HTMLElement>>('thumbsTrack');

  current = signal(0);
  lightboxIdx = signal<number | null>(null);

  constructor() {
    effect(() => {
      const idx = this.current();
      const imgs = this.images();
      if (idx >= imgs.length && imgs.length) {
        this.current.set(0);
      }
      queueMicrotask(() => this.scrollThumbIntoView(idx));
    });
  }

  goto(i: number) {
    this.current.set(i);
  }

  prev(e: Event) {
    e.stopPropagation();
    const n = this.images().length;
    if (this.lightboxIdx() !== null) {
      this.lightboxIdx.set((this.lightboxIdx()! - 1 + n) % n);
      this.current.set(this.lightboxIdx()!);
    } else {
      this.current.set((this.current() - 1 + n) % n);
    }
  }

  next(e: Event) {
    e.stopPropagation();
    const n = this.images().length;
    if (this.lightboxIdx() !== null) {
      this.lightboxIdx.set((this.lightboxIdx()! + 1) % n);
      this.current.set(this.lightboxIdx()!);
    } else {
      this.current.set((this.current() + 1) % n);
    }
  }

  open(i: number) {
    this.lightboxIdx.set(i);
    document.body.style.overflow = 'hidden';
  }

  close(e?: Event) {
    e?.stopPropagation();
    this.lightboxIdx.set(null);
    document.body.style.overflow = '';
  }

  private scrollThumbIntoView(idx: number) {
    const track = this.thumbsTrack()?.nativeElement;
    if (!track) return;
    const thumb = track.children[idx] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.lightboxIdx() === null) return;
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.prev(e);
    if (e.key === 'ArrowRight') this.next(e);
  }
}
