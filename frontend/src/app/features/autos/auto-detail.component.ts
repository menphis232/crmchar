import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavComponent } from '../../shared/nav.component';
import { AutosService, ConcesionariaService } from '../../core/api.service';
import { Auto } from '../../models';
import { buildAutoGalleryItems } from '../../shared/auto-video.util';

@Component({
  selector: 'app-auto-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule],
  templateUrl: './auto-detail.component.html',
  styleUrl: './auto-detail.component.css',
})
export class AutoDetailComponent implements OnInit {
  private sanitizer = inject(DomSanitizer);

  auto = signal<Auto | null>(null);
  activeGalleryIndex = signal(0);
  loading = signal(true);
  inquirySent = signal(false);
  inquiryError = signal('');

  inquiry = { clientName: '', clientEmail: '', clientPhone: '', message: '' };

  galleryItems = computed(() => {
    const a = this.auto();
    return a ? buildAutoGalleryItems(a) : [];
  });

  currentGalleryItem = computed(() => this.galleryItems()[this.activeGalleryIndex()] ?? null);

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
        this.activeGalleryIndex.set(0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setGalleryIndex(index: number) {
    this.activeGalleryIndex.set(index);
  }

  safeEmbedUrl(embedUrl: string | null | undefined): SafeResourceUrl | null {
    if (!embedUrl) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  showGalleryNav(): boolean {
    return this.galleryItems().length > 1;
  }

  prevGalleryItem() {
    const items = this.galleryItems();
    if (items.length <= 1) return;
    const idx = this.activeGalleryIndex();
    this.activeGalleryIndex.set(idx <= 0 ? items.length - 1 : idx - 1);
  }

  nextGalleryItem() {
    const items = this.galleryItems();
    if (items.length <= 1) return;
    const idx = this.activeGalleryIndex();
    this.activeGalleryIndex.set(idx >= items.length - 1 ? 0 : idx + 1);
  }

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
