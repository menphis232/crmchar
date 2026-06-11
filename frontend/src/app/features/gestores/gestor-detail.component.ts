import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, DatePipe } from '@angular/common';
import { NavComponent } from '../../shared/nav.component';
import { GestoresService } from '../../core/api.service';
import { Gestor } from '../../models';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-gestor-detail',
  standalone: true,
  imports: [NavComponent, RouterLink, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './gestor-detail.component.html',
  styleUrl: './gestor-detail.component.css',
})
export class GestorDetailComponent implements OnInit {
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

  constructor(private route: ActivatedRoute, private gestoresService: GestoresService, private http: HttpClient, private sanitizer: DomSanitizer) {}

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.gestoresService.getBySlug(slug).subscribe({
      next: data => { 
        this.gestor.set(data); 
        this.loading.set(false);
        // Compute safe map URL after data loads
        if (data.mapEmbedUrl) {
          this.safeMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.mapEmbedUrl);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  safeMapUrl: SafeResourceUrl | null = null;

  whatsappLink(g: Gestor) {
    const text = encodeURIComponent('Hola, vengo del Directorio y necesito ayuda con un trámite.');
    return `https://wa.me/${g.whatsapp}?text=${text}`;
  }

  stars(rating: number) {
    return '⭐'.repeat(Math.round(rating));
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
    this.http.post<{reply: string}>(`${environment.apiUrl}/gestores/${slug}/chat`, {
      message: txt,
      history: this.chatHistory.slice(0, -1)
    }).subscribe({
      next: (res) => {
        // Check if the reply is a confirmation message indicating a lead was created
        const isLeadConfirmation = res.reply.toLowerCase().includes('registrad') && (res.reply.toLowerCase().includes('solicitud') || res.reply.toLowerCase().includes('trámite'));
        this.chatHistory.push({ role: 'model', content: res.reply });
        if (isLeadConfirmation) {
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
