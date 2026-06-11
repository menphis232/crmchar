import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../../shared/nav.component';
import { GestoresService } from '../../../core/api.service';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [NavComponent, RouterLink, FormsModule],
  templateUrl: './review.component.html',
  styleUrl: './review.component.css',
})
export class ReviewComponent implements OnInit {
  dealId = '';
  loading = signal(true);
  error = signal<string | null>(null);
  context = signal<{ title: string; gestorName: string; gestorId: string } | null>(null);

  rating = 0;
  hoverRating = 0;
  comment = '';
  authorName = '';
  submitting = signal(false);
  success = signal(false);

  constructor(private route: ActivatedRoute, private gestoresService: GestoresService) {}

  ngOnInit() {
    this.dealId = this.route.snapshot.paramMap.get('dealId')!;
    this.gestoresService.getReviewContext(this.dealId).subscribe({
      next: (data) => {
        this.context.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.error || 'No se pudo cargar la información del trámite.');
        this.loading.set(false);
      }
    });
  }

  setHover(val: number) { this.hoverRating = val; }
  setRating(val: number) { this.rating = val; }

  submitReview() {
    if (this.rating < 1 || !this.comment || !this.authorName) return;
    this.submitting.set(true);
    
    this.gestoresService.submitReview(this.dealId, {
      rating: this.rating,
      comment: this.comment,
      authorName: this.authorName
    }).subscribe({
      next: () => {
        this.success.set(true);
        this.submitting.set(false);
      },
      error: (err) => {
        alert(err.error?.error || 'Error al enviar reseña');
        this.submitting.set(false);
      }
    });
  }
}
