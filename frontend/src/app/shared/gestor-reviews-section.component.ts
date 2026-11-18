import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { GestorReview } from '../models';

@Component({
  selector: 'app-gestor-reviews-section',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './gestor-reviews-section.component.html',
  styleUrl: './gestor-reviews-section.component.css',
})
export class GestorReviewsSectionComponent implements OnChanges {
  @Input() rating = 0;
  @Input() reviewCount: number | undefined = 0;
  @Input() reviews: GestorReview[] = [];
  @Input() title = 'Reseñas de clientes';
  @Input() googleMapsUrl: string | null = null;
  @Input() fromGoogle = false;
  @Input() googleReviewsEmbed: string | null = null;
  /** Reseñas visibles por página en el listado nativo (no aplica al iframe). */
  @Input() pageSize = 10;

  @ViewChild('embedHost', { static: false }) embedHost?: ElementRef<HTMLDivElement>;

  visibleCount = 10;

  get visibleReviews(): GestorReview[] {
    return (this.reviews || []).slice(0, this.visibleCount);
  }

  get hasMoreReviews(): boolean {
    return (this.reviews || []).length > this.visibleCount;
  }

  get nextBatchSize(): number {
    return Math.min(this.pageSize, Math.max(0, (this.reviews || []).length - this.visibleCount));
  }

  stars(rating: number) {
    const full = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  loadMore() {
    this.visibleCount += this.pageSize;
  }

  ngOnChanges() {
    const size = Math.max(1, Number(this.pageSize) || 10);
    this.pageSize = size;
    this.visibleCount = size;
    // Diferir al siguiente tick para que el ViewChild exista si el @if acaba de montar el host
    queueMicrotask(() => this.mountEmbed());
  }

  private mountEmbed() {
    const host = this.embedHost?.nativeElement;
    const html = (this.googleReviewsEmbed || '').trim();
    if (!host) return;
    host.innerHTML = '';
    if (!html) return;

    // Inyectar HTML completo (iframe + script de WidgetPop/Famewall/Elfsight)
    // y re-ejecutar scripts (innerHTML solo no los corre).
    host.innerHTML = html;
    host.querySelectorAll('iframe').forEach((iframe) => {
      iframe.style.width = '100%';
      iframe.style.minHeight = iframe.style.height || '640px';
      iframe.style.height = iframe.style.height || '640px';
      iframe.style.border = '0';
      iframe.style.borderRadius = '0';
      iframe.style.background = 'transparent';
      iframe.style.display = 'block';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('color-scheme', 'dark');
    });
    host.querySelectorAll('script').forEach((oldScript) => {
      const s = document.createElement('script');
      for (const attr of Array.from(oldScript.attributes)) {
        s.setAttribute(attr.name, attr.value);
      }
      if (oldScript.textContent) s.textContent = oldScript.textContent;
      oldScript.replaceWith(s);
    });
  }
}
