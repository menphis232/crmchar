import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavComponent } from '../../shared/nav.component';
import { AutosService, ConcesionariaService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Auto } from '../../models';
import { buildAutoGalleryItems } from '../../shared/auto-video.util';
import { hasSpecialPrice } from '../../shared/auto-price.util';
import { AUTO_SHARE_TAGLINE } from '../../shared/brand.constants';
import { getAutoShareSubtitle } from '../../shared/auto-share.util';
import { MetaTagsService } from '../../shared/meta-tags.service';

@Component({
  selector: 'app-auto-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule],
  templateUrl: './auto-detail.component.html',
  styleUrl: './auto-detail.component.css',
})
export class AutoDetailComponent implements OnInit, OnDestroy {
  private sanitizer = inject(DomSanitizer);
  private metaTags = inject(MetaTagsService);
  private toast = inject(ToastService);

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
        this.metaTags.setAutoShareTags(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    this.metaTags.reset();
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

  hasSpecialPrice = hasSpecialPrice;

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
    const shareData: ShareData = {
      title: AUTO_SHARE_TAGLINE,
      text: a ? getAutoShareSubtitle(a) : AUTO_SHARE_TAGLINE,
      url,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => this.copyShareLink(url));
    } else {
      this.copyShareLink(url);
    }
  }

  private copyShareLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Enlace copiado al portapapeles');
    });
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
