import { Component, Input } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { GestorReview } from '../models';

@Component({
  selector: 'app-gestor-reviews-section',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  templateUrl: './gestor-reviews-section.component.html',
  styleUrl: './gestor-reviews-section.component.css',
})
export class GestorReviewsSectionComponent {
  @Input() rating = 0;
  @Input() reviewCount: number | undefined = 0;
  @Input() reviews: GestorReview[] = [];
  @Input() title = 'Reseñas de clientes';

  stars(rating: number) {
    const full = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }
}
