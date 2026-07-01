import { Component, OnInit, OnDestroy, signal, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { NavComponent } from '../../shared/nav.component';
import { WhatsappIconComponent } from '../../shared/whatsapp-icon.component';
import { GestoresService } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Gestor } from '../../models';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DomSanitizer } from '@angular/platform-browser';
import { GESTOR_SHARE_TAGLINE } from '../../shared/brand.constants';
import { MetaTagsService } from '../../shared/meta-tags.service';
import { getGestorShareUrl } from '../../shared/gestor-share.util';
import { GESTOR_LUCIDE_ICONS } from '../../shared/gestor-lucide-icons';
import { MEXICO_STATES } from '../../shared/mexico-states';
import { GestorShowcaseGalleryComponent } from '../../shared/gestor-showcase-gallery.component';
import { GestorReviewsSectionComponent } from '../../shared/gestor-reviews-section.component';
import { PageBlock, PageBuilderConfig } from '../../models';
import { hasServicePrice, serviceRequirements } from '../../shared/gestor-service.utils';
import { toGoogleMapsEmbedUrl } from '../../shared/map-embed.utils';

@Component({
  selector: 'app-gestor-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, DatePipe, FormsModule, WhatsappIconComponent, GestorShowcaseGalleryComponent, GestorReviewsSectionComponent, ...GESTOR_LUCIDE_ICONS],
  templateUrl: './gestor-detail.component.html',
  styleUrl: './gestor-detail.component.css',
})
export class GestorDetailComponent implements OnInit, OnDestroy {
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private metaTags = inject(MetaTagsService);

  readonly mexicoStates = MEXICO_STATES;

  gestor = signal<Gestor | null>(null);
  loading = signal(true);
  solicitudSent = signal(false);
  solicitudForm = { clientName: '', clientEmail: '', clientPhone: '', serviceName: '', location: '' };
  customData: Record<string, any> = {};

  trackCode = '';
  trackLoading = signal(false);
  trackResult = signal<{ title: string; stageLabel: string; updatedAt: string } | null>(null);
  trackError = signal<string | null>(null);

  // Chatbot
  chatOpen = false;
  chatMessage = '';
  chatHistory: { role: 'user' | 'model', content: string }[] = [];
  isChatLoading = false;
  leadCreated = false;

  constructor(private route: ActivatedRoute, private gestoresService: GestoresService, private http: HttpClient) {}

  safeMapUrl = computed(() => {
    const g = this.gestor();
    const raw = g?.mapEmbedUrl;
    if (!raw && !g?.address) return null;
    const url = toGoogleMapsEmbedUrl(raw || '', g?.address || undefined);
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.gestoresService.getBySlug(slug).subscribe({
      next: data => {
        this.gestor.set(data);
        this.metaTags.setGestorShareTags(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    this.metaTags.reset();
  }

  whatsappLink(g: Gestor) {
    const digits = (g.whatsapp || g.phone || '').replace(/\D/g, '');
    const text = encodeURIComponent('Hola, vengo del Directorio y necesito ayuda con un trámite.');
    return `https://wa.me/${digits}?text=${text}`;
  }

  /** Logo del panel (users.logo_url) tiene prioridad sobre la foto legacy del gestor. */
  profileImage(g: Gestor): string {
    return g.logoUrl || g.photoUrl || '';
  }

  /** La descripción del perfil (gestores.bio) tiene prioridad sobre el bloque del constructor web. */
  publicBio(g: Gestor, block?: PageBlock): string {
    const fromProfile = g.bio?.trim() || '';
    const fromBlock = String(block?.data?.content ?? '').trim();
    return fromProfile || fromBlock;
  }

  hasMainTextBlock(config: PageBuilderConfig): boolean {
    return !!config.blocks?.some(b => b.type === 'text' && b.region !== 'sidebar');
  }

  /** Orden fijo en ficha pública: stats → descripción → servicios → galería → reseñas. */
  orderedMainBlocks(config: PageBuilderConfig, g: Gestor): PageBlock[] {
    const blocks = (config.blocks ?? []).filter(b => b.region !== 'sidebar' && b.type !== 'hero');
    const pick = (type: PageBlock['type']) => blocks.filter(b => b.type === type);

    let textBlocks = pick('text');
    let galleryBlocks = pick('gallery');

    if (g.bio?.trim() && !textBlocks.length) {
      textBlocks = [{
        id: '__profile-bio__',
        type: 'text',
        region: 'main',
        data: { content: g.bio.trim() },
      }];
    }

    if (g.galleryImages?.length && !galleryBlocks.length) {
      galleryBlocks = [{
        id: '__profile-gallery__',
        type: 'gallery',
        region: 'main',
        data: { images: g.galleryImages },
      }];
    }

    return [
      ...pick('stats'),
      ...textBlocks,
      ...pick('services'),
      ...galleryBlocks,
      ...pick('reviews'),
    ];
  }

  galleryImagesForBlock(block: PageBlock, g: Gestor): string[] {
    const fromBlock = block.data?.images;
    if (Array.isArray(fromBlock) && fromBlock.length) return fromBlock.filter(Boolean);
    return g.galleryImages ?? [];
  }

  readonly hasServicePrice = hasServicePrice;
  readonly serviceRequirements = serviceRequirements;

  hasSidebarFormBlock(config: PageBuilderConfig): boolean {
    return !!config.blocks?.some(b => b.region === 'sidebar' && b.type === 'form');
  }

  sendSolicitud() {
    const g = this.gestor();
    if (!g || !this.solicitudForm.clientName?.trim() || !this.solicitudForm.serviceName) {
      this.toast.warning('Completa tu nombre y el trámite que necesitas.', 'Datos incompletos');
      return;
    }
    this.gestoresService.createSolicitud(g.id, { ...this.solicitudForm, customData: this.customData }).subscribe({
      next: () => {
        const hadEmail = !!this.solicitudForm.clientEmail?.trim();
        this.solicitudSent.set(true);
        this.solicitudForm = { clientName: '', clientEmail: '', clientPhone: '', serviceName: '', location: '' };
        this.customData = {};
        this.toast.success(
          hadEmail
            ? 'Revisa el embudo Trámites en tu panel de gestor.'
            : 'Solicitud registrada. Revisa el embudo Trámites en tu panel.',
          '¡Solicitud enviada!',
        );
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'No se pudo registrar la solicitud.', 'Error');
      },
    });
  }

  shareGestor() {
    const g = this.gestor();
    const shareUrl = g ? getGestorShareUrl(g) : window.location.href;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      navigator.share({
        title: GESTOR_SHARE_TAGLINE,
        text: g ? g.name : GESTOR_SHARE_TAGLINE,
        url: shareUrl,
      }).catch(() => this.copyLink(shareUrl));
    } else {
      this.copyLink(shareUrl);
    }
  }

  private copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Enlace copiado');
    }).catch(() => {
      prompt('Copia este enlace:', url);
    });
  }

  scrollToForm() {
    const el = document.getElementById('dynamic-form-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  trackDeal() {
    if (!this.trackCode.trim()) return;
    const slug = this.route.snapshot.paramMap.get('slug')!;
    
    this.trackLoading.set(true);
    this.trackResult.set(null);
    this.trackError.set(null);

    this.gestoresService.trackSolicitud(slug, this.trackCode.trim()).subscribe({
      next: (res) => {
        let stageLabel = res.stage;
        if (res.stages && Array.isArray(res.stages)) {
          const match = res.stages.find(s => s.id === res.stage);
          if (match) stageLabel = match.label;
        } else {
          // Fallback static stages
          const stages: Record<string, string> = {
            'nuevo': 'Recibido',
            'contactado': 'En Revisión',
            'en_tramite': 'En Trámite',
            'completado': 'Completado',
            'perdido': 'Cancelado / Perdido'
          };
          stageLabel = stages[res.stage] || res.stage;
        }

        this.trackResult.set({
          title: res.title,
          stageLabel,
          updatedAt: res.updatedAt
        });
        this.trackLoading.set(false);
      },
      error: (err) => {
        this.trackError.set(err.error?.error || 'Código no encontrado.');
        this.trackLoading.set(false);
      }
    });
  }

  toggleChat() {
    this.chatOpen = !this.chatOpen;
    // Show a greeting when opening chat for the first time
    if (this.chatOpen && this.chatHistory.length === 0) {
      const g = this.gestor();
      if (g) {
        this.chatHistory.push({
          role: 'model',
          content: `¡Hola! Bienvenido/a a ${g.name}. Soy tu asistente virtual. ¿En qué te puedo ayudar hoy? Si deseas iniciar un trámite, con gusto te registro. Solo dime qué servicio necesitas.`
        });
      }
    }
  }

  sendChatMessage() {
    if (!this.chatMessage.trim() || this.isChatLoading || this.leadCreated) return;
    const txt = this.chatMessage.trim();
    this.chatMessage = '';
    
    this.chatHistory.push({ role: 'user', content: txt });
    this.isChatLoading = true;
    this.scrollToBottom();

    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.http.post<{ reply: string; leadCreated?: boolean }>(`${environment.apiUrl}/gestores/${slug}/chat`, {
      message: txt,
      history: this.chatHistory.slice(0, -1)
    }).subscribe({
      next: (res) => {
        this.chatHistory.push({ role: 'model', content: res.reply });
        if (res.leadCreated) {
          this.leadCreated = true;
        }
        this.isChatLoading = false;
        this.scrollToBottom();
      },
      error: (err) => {
        this.chatHistory.push({ role: 'model', content: 'Lo siento, no puedo responder en este momento. ' + (err.error?.error || '') });
        this.isChatLoading = false;
        this.scrollToBottom();
      }
    });
  }

  scrollToBottom() {
    setTimeout(() => {
      const box = document.getElementById('chatbot-messages');
      if (box) box.scrollTop = box.scrollHeight;
    }, 100);
  }
}
