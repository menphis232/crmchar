import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../shared/nav.component';
import { AutosService, ConcesionariaService } from '../../core/api.service';
import { Auto } from '../../models';

@Component({
  selector: 'app-auto-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule],
  templateUrl: './auto-detail.component.html',
  styleUrl: './auto-detail.component.css',
})
export class AutoDetailComponent implements OnInit {
  auto = signal<Auto | null>(null);
  mainImage = signal('');
  loading = signal(true);
  inquirySent = signal(false);
  inquiryError = signal('');

  inquiry = { clientName: '', clientEmail: '', clientPhone: '', message: '' };

  constructor(
    private route: ActivatedRoute,
    private autosService: AutosService,
    private concesionariaService: ConcesionariaService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.autosService.getById(id).subscribe({
      next: data => {
        this.auto.set(data);
        this.mainImage.set(data.imageUrl || data.images?.[0] || '');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setMainImage(url: string) { this.mainImage.set(url); }

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }

  whatsappLink() {
    const a = this.auto();
    if (!a) return '#';
    const text = encodeURIComponent(`Hola, estoy interesado en el ${a.make} ${a.model} publicado.`);
    return `https://wa.me/525500000000?text=${text}`;
  }

  dealerInitials(name?: string) {
    return (name || 'AP').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  scrollToForm() {
    document.getElementById('dynamic-form-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  shareAuto() {
    const a = this.auto();
    const url = window.location.href;
    const title = a ? `${a.make} ${a.model} ${a.year}` : 'Vehículo en venta';
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => alert('¡Enlace copiado al portapapeles!'));
    }
  }

  sendInquiry() {
    const a = this.auto();
    if (!a || !this.inquiry.clientName || !this.inquiry.message) {
      this.inquiryError.set('Nombre y mensaje son obligatorios');
      return;
    }
    this.concesionariaService.sendInquiry({
      autoId: a.id,
      ...this.inquiry,
    }).subscribe({
      next: () => {
        this.inquirySent.set(true);
        this.inquiry = { clientName: '', clientEmail: '', clientPhone: '', message: '' };
      },
      error: (e) => this.inquiryError.set(e.error?.error || 'Error al enviar'),
    });
  }
}
