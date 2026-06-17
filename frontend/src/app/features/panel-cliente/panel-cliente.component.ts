import { Component, inject, OnInit, OnDestroy, signal, computed, NgZone } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe, RouterLink],
  templateUrl: './panel-cliente.component.html',
  styleUrls: ['../panel/panel-dashboard.css', './panel-cliente.component.css']
})
export class PanelClienteComponent implements OnInit, OnDestroy {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  auth = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);
  toast = inject(ToastService);
  zone = inject(NgZone);

  activeTab = signal<'dashboard' | 'tramites' | 'ajustes'>('dashboard');
  isMobileMenuOpen = signal(false);
  dealTab = signal<'chat' | 'docs'>('chat');
  deals = signal<any[]>([]);
  selectedDeal = signal<any>(null);
  loading = signal(true);
  documents = signal<any[]>([]);
  uploadingDocType = signal<string | null>(null);

  // Chat
  messages = signal<any[]>([]);
  newMessage = '';
  socket!: Socket;
  chatLoading = signal(false);
  uploadingFile = signal(false);

  // Stats computed from deals
  totalDeals = computed(() => this.deals().length);
  activeDeals = computed(() => this.deals().filter(d => !this.isTerminalStage(d)).length);
  completedDeals = computed(() => this.deals().filter(d => {
    const stages = this.pipelineStages(d);
    const idx = this.stageIndex(d);
    const last = stages[stages.length - 1];
    return d.stage === 'completado' || d.stage === 'vendido' || (last && d.stage === last.id && last.id !== 'perdido');
  }).length);

  // Ajustes
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  pwdLoading = signal(false);
  pwdSuccess = signal('');
  pwdError = signal('');

  ngOnInit() {
    this.loadDeals();
    this.socket = io(environment.apiUrl.replace('/api', ''));

    const user = this.auth.user();
    if (user) {
      this.socket.emit('identify', user.id);
    }

    this.socket.on('receive_message', (msg: any) => {
      this.zone.run(() => {
        const deal = this.selectedDeal();
        const msgDealId = msg.dealId || msg.deal_id;
        if (deal && msgDealId === deal.id) {
          this.messages.update(msgs => {
            if (msgs.some(m => m.id === msg.id)) return msgs;
            return [...msgs, msg];
          });
          this.scrollToBottom();
        }
      });
    });

    this.socket.on('notification', (notif: any) => {
      this.zone.run(() => {
        const toast = this.toast;
        if (toast) {
          toast.info(notif.body, notif.title, () => {
            if (notif.ref_id) {
              const d = this.deals().find(x => x.id === notif.ref_id);
              if (d) this.openDeal(d);
            }
          });
        }
      });
    });
  }

  ngOnDestroy() {
    if (this.socket) this.socket.disconnect();
  }

  loadDeals() {
    this.loading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/deals`).subscribe({
      next: res => {
        this.deals.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openDeal(deal: any) {
    this.selectedDeal.set(deal);
    this.activeTab.set('tramites');
    this.dealTab.set('chat');
    this.chatLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/deals/${deal.id}/messages`).subscribe({
      next: res => {
        this.messages.set(res);
        this.socket.emit('join_deal', deal.id);
        this.chatLoading.set(false);
        this.scrollToBottom();
      },
      error: () => this.chatLoading.set(false)
    });
    this.http.get<any[]>(`${environment.apiUrl}/client/deals/${deal.id}/documents`).subscribe({
      next: docs => this.documents.set(docs)
    });
  }

  closeDeal() {
    const deal = this.selectedDeal();
    if (deal) this.socket.emit('leave_deal', deal.id);
    this.selectedDeal.set(null);
    this.messages.set([]);
    this.documents.set([]);
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const dealId = this.selectedDeal()?.id;
    if (!dealId) return;
    const txt = this.newMessage;
    this.newMessage = '';

    this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/messages`, { message: txt }).subscribe(saved => {
      // Optimistic update for the sender
      this.messages.update(msgs => {
        // Only append if it's not already there (in case socket was faster)
        if (!msgs.find(m => m.id === saved.id)) {
          return [...msgs, { dealId, ...saved }];
        }
        return msgs;
      });
      this.scrollToBottom();
      
      this.socket.emit('send_message', { dealId, ...saved });
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.uploadingFile.set(true);
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<{ url: string }>(`${environment.apiUrl}/upload`, formData).subscribe({
      next: res => {
        const dealId = this.selectedDeal()?.id;
        if (!dealId) return;
        this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/messages`, {
          message: `📎 Documento adjunto: ${file.name}`,
          fileUrl: res.url
        }).subscribe(saved => {
          this.messages.update(msgs => {
            if (!msgs.find(m => m.id === saved.id)) {
              return [...msgs, { dealId, ...saved }];
            }
            return msgs;
          });
          this.scrollToBottom();
          this.socket.emit('send_message', { dealId, ...saved });
          this.uploadingFile.set(false);
        });
      },
      error: () => this.uploadingFile.set(false)
    });
  }

  onDocSelected(docType: string, event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.uploadingDocType.set(docType);
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<{ url: string }>(`${environment.apiUrl}/upload`, formData).subscribe({
      next: res => {
        const dealId = this.selectedDeal()?.id;
        if (!dealId) return;
        this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/documents`, {
          documentType: docType,
          fileUrl: res.url
        }).subscribe(newDoc => {
          this.documents.update(docs => [newDoc, ...docs]);
          this.uploadingDocType.set(null);
        });
      },
      error: () => this.uploadingDocType.set(null)
    });
  }

  getDocStatus(docType: string) {
    return this.documents().find(d => d.document_type === docType);
  }

  updatePassword() {
    this.pwdError.set('');
    this.pwdSuccess.set('');

    if (!this.newPassword || this.newPassword.length < 6) {
      this.pwdError.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.pwdError.set('Las contraseñas no coinciden.');
      return;
    }
    this.pwdLoading.set(true);
    this.http.patch<{ success: boolean }>(`${environment.apiUrl}/auth/change-password`, {
      currentPassword: this.currentPassword || undefined,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.pwdSuccess.set('¡Contraseña actualizada con éxito! Ahora puedes iniciar sesión con tu nueva clave.');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.pwdLoading.set(false);
      },
      error: (err) => {
        this.pwdError.set(err.error?.error || 'Ocurrió un error. Intenta de nuevo.');
        this.pwdLoading.set(false);
      }
    });
  }

  pipelineStages(deal: any): { id: string; label: string }[] {
    if (deal?.pipeline_stages?.length) return deal.pipeline_stages;
    return [
      { id: 'nuevo', label: 'Nuevo' },
      { id: 'contactado', label: 'Contactado' },
      { id: 'en_tramite', label: 'En trámite' },
      { id: 'documentacion', label: 'Documentación' },
      { id: 'completado', label: 'Completado' },
      { id: 'perdido', label: 'Perdido' },
    ];
  }

  stageIndex(deal: any): number {
    if (!deal?.stage) return 0;
    const idx = this.pipelineStages(deal).findIndex(s => s.id === deal.stage);
    return idx >= 0 ? idx : 0;
  }

  isTerminalStage(deal: any): boolean {
    const id = deal?.stage;
    if (id === 'perdido') return true;
    const stages = this.pipelineStages(deal);
    const last = stages[stages.length - 1];
    return id === 'completado' || id === 'vendido' || (!!last && id === last.id);
  }

  stageLabel(deal: any): string {
    const match = this.pipelineStages(deal).find(s => s.id === deal?.stage);
    return match?.label || deal?.stage || '—';
  }

  stageClass(deal: any): string {
    const id = deal?.stage || '';
    if (id === 'perdido') return 'badge-lost';
    const stages = this.pipelineStages(deal);
    const idx = this.stageIndex(deal);
    if (idx === stages.length - 1) return 'badge-done';
    if (idx === 0) return 'badge-new';
    return 'badge-progress';
  }

  stageProgress(deal: any): number {
    const stages = this.pipelineStages(deal);
    if (!stages.length || deal?.stage === 'perdido') return 0;
    const idx = this.stageIndex(deal);
    return Math.round(((idx + 1) / stages.length) * 100);
  }

  initials(name?: string) {
    if (!name) return 'CL';
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  logout() {
    this.auth.logout();
  }

  scrollToBottom() {
    setTimeout(() => {
      const box = document.getElementById('chat-box');
      if (box) box.scrollTop = box.scrollHeight;
    }, 100);
  }
}
