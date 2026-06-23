import { Component, OnInit, signal, inject, computed } from '@angular/core';
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
import { GESTOR_LUCIDE_ICONS } from '../../shared/gestor-lucide-icons';
import { MEXICO_STATES } from '../../shared/mexico-states';
import { GestorShowcaseGalleryComponent } from '../../shared/gestor-showcase-gallery.component';
import { PageBlock, PageBuilderConfig } from '../../models';

@Component({
  selector: 'app-gestor-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, DatePipe, FormsModule, WhatsappIconComponent, GestorShowcaseGalleryComponent, ...GESTOR_LUCIDE_ICONS],
  templateUrl: './gestor-detail.component.html',
  styleUrl: './gestor-detail.component.css',
})
export class GestorDetailComponent implements OnInit {
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

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
    const raw = this.gestor()?.mapEmbedUrl;
    if (!raw) return null;
    const url = this.toEmbedUrl(raw);
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.gestoresService.getBySlug(slug).subscribe({
      next: data => {
        this.gestor.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private toEmbedUrl(url: string): string | null {
    const s = url.trim();
    if (!s) return null;
    if (s.includes('openstreetmap.org/export/embed')) return s;
    if (s.includes('output=embed')) return s;
    if (s.includes('maps/embed')) return s;
    if (s.includes('google.com/maps') || s.includes('goo.gl/maps') || s.includes('maps.google')) {
      const coordMatch = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        const [, lat, lng] = coordMatch;
        return `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
      }
      const placeMatch = s.match(/\/place\/([^/@?&]+)/);
      if (placeMatch) {
        const q = encodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
        return `https://maps.google.com/maps?q=${q}&output=embed`;
      }
      const qMatch = s.match(/[?&]q=([^&]+)/);
      if (qMatch) {
        return `https://maps.google.com/maps?q=${qMatch[1]}&output=embed`;
      }
    }
    if (s.startsWith('https://')) return s;
    return null;
  }

  whatsappLink(g: Gestor) {
    const text = encodeURIComponent('Hola, vengo del Directorio y necesito ayuda con un trámite.');
    return `https://wa.me/${g.whatsapp}?text=${text}`;
  }

  stars(rating: number) {
    return Math.max(0, Math.min(5, Math.round(rating)));
  }

  starIndexes = [1, 2, 3, 4, 5];

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

  sendSolicitud() {
    const g = this.gestor();
    if (!g || !this.solicitudForm.clientName || !this.solicitudForm.serviceName) return;
    this.gestoresService.createSolicitud(g.id, { ...this.solicitudForm, customData: this.customData }).subscribe({
      next: () => {
        this.solicitudSent.set(true);
        this.solicitudForm = { clientName: '', clientEmail: '', clientPhone: '', serviceName: '', location: '' };
        this.customData = {};
      },
    });
  }

  shareGestor() {
    const g = this.gestor();
    const shareUrl = g
      ? `${window.location.origin}/sg/${g.slug}`
      : window.location.href;
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
