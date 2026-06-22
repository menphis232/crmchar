import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavComponent } from '../../shared/nav.component';
import { AutoGalleriaComponent } from '../../shared/auto-galleria.component';
import { CAR_LUCIDE_ICONS } from '../../shared/car-lucide-icons';
import { AutosService, ConcesionariaService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Auto, PageBuilderConfig } from '../../models';
import { buildAutoGalleryItems } from '../../shared/auto-video.util';
import { hasSpecialPrice } from '../../shared/auto-price.util';
import { AUTO_SHARE_TAGLINE } from '../../shared/brand.constants';
import { buildAutoWhatsappMessage, getAutoShareSubtitle } from '../../shared/auto-share.util';
import { MetaTagsService } from '../../shared/meta-tags.service';

@Component({
  selector: 'app-auto-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, FormsModule, AutoGalleriaComponent, ...CAR_LUCIDE_ICONS],
  templateUrl: './auto-detail.component.html',
  styleUrl: './auto-detail.component.css',
})
export class AutoDetailComponent implements OnInit, OnDestroy {
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

  formatPrice(price: number) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  }

  hasSpecialPrice = hasSpecialPrice;

  /** Solo usar layout personalizado si incluye galería (plantilla de auto, no de gestor). */
  isAutoPageConfig(config?: PageBuilderConfig | null): boolean {
    return !!config?.blocks?.some(b => b.type === 'gallery');
  }

  openWhatsapp(e: Event) {
    e.preventDefault();
    const a = this.auto();
    if (!a) return;
    const phone = (a.whatsapp?.trim() || a.dealerPhone || '').replace(/\D/g, '');
    if (!phone) {
      this.toast.error('Este vehículo no tiene número de WhatsApp configurado.');
      return;
    }
    const text = encodeURIComponent(buildAutoWhatsappMessage(a));
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  dealerInitials(name?: string) {
    return (name || 'AP').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  scrollToForm() {
    document.getElementById('dynamic-form-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  shareAuto() {
    const a = this.auto();
    // /s/:id siempre sirve OG tags → WhatsApp/redes ven imagen y título correctamente
    const shareUrl = a
      ? `${window.location.origin}/s/${a.id}`
      : window.location.href;

    // En móvil usamos el share nativo; en escritorio directamente al portapapeles
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      navigator.share({
        title: AUTO_SHARE_TAGLINE,
        text: a ? getAutoShareSubtitle(a) : AUTO_SHARE_TAGLINE,
        url: shareUrl,
      }).catch(() => this.copyShareLink(shareUrl));
    } else {
      this.copyShareLink(shareUrl);
    }
  }

  private copyShareLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Enlace copiado');
    }).catch(() => {
      prompt('Copia este enlace y pégalo en WhatsApp:', url);
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
