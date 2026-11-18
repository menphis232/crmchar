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

  @ViewChild('embedHost', { static: false }) embedHost?: ElementRef<HTMLDivElement>;

  stars(rating: number) {
    const full = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  ngOnChanges() {
    // Diferir al siguiente tick para que el ViewChild exista si el @if acaba de montar el host
    queueMicrotask(() => this.mountEmbed());
  }

  private mountEmbed() {
    const host = this.embedHost?.nativeElement;
    const html = (this.googleReviewsEmbed || '').trim();
    if (!host) return;
    host.innerHTML = '';
    if (!html) return;

    // Preferir iframe si viene en el código (más seguro y suele bastar)
    const iframeSrc = html.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
    if (iframeSrc && /^https?:\/\//i.test(iframeSrc)) {
      const iframe = document.createElement('iframe');
      iframe.src = iframeSrc;
      iframe.title = 'Reseñas de Google';
      iframe.loading = 'lazy';
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      iframe.style.width = '100%';
      iframe.style.minHeight = '420px';
      iframe.style.border = '0';
      iframe.style.borderRadius = '12px';
      host.appendChild(iframe);
      return;
    }

    // Widget con script (Famewall / WidgetPop / Elfsight): inyectar y re-ejecutar scripts
    host.innerHTML = html;
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
