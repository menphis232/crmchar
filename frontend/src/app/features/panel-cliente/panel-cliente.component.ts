import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, CurrencyPipe, TitleCasePipe],
  templateUrl: './panel-cliente.component.html',
  styleUrls: ['./panel-cliente.component.css']
})
export class PanelClienteComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);

  activeTab = signal<'dashboard' | 'tramites' | 'ajustes'>('dashboard');
  deals = signal<any[]>([]);
  selectedDeal = signal<any>(null);
  loading = signal(true);

  // Chat
  messages = signal<any[]>([]);
  newMessage = '';
  socket!: Socket;
  chatLoading = signal(false);
  uploadingFile = signal(false);

  // Stats computed from deals
  totalDeals = computed(() => this.deals().length);
  activeDeals = computed(() => this.deals().filter(d => d.stage !== 'completado' && d.stage !== 'perdido').length);
  completedDeals = computed(() => this.deals().filter(d => d.stage === 'completado').length);

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

    this.socket.on('receive_message', (msg: any) => {
      const deal = this.selectedDeal();
      if (deal && msg.dealId === deal.id) {
        this.messages.update(msgs => [...msgs, msg]);
        this.scrollToBottom();
      }
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
  }

  closeDeal() {
    const deal = this.selectedDeal();
    if (deal) this.socket.emit('leave_deal', deal.id);
    this.selectedDeal.set(null);
    this.messages.set([]);
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const dealId = this.selectedDeal()?.id;
    if (!dealId) return;
    const txt = this.newMessage;
    this.newMessage = '';

    this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/messages`, { message: txt }).subscribe(saved => {
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
          this.socket.emit('send_message', { dealId, ...saved });
          this.uploadingFile.set(false);
        });
      },
      error: () => this.uploadingFile.set(false)
    });
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

  stageLabel(stage: string): string {
    const labels: Record<string, string> = {
      nuevo: 'Recibido',
      contactado: 'En Revisión',
      en_tramite: 'En Trámite',
      completado: 'Completado',
      perdido: 'Cancelado'
    };
    return labels[stage] || stage;
  }

  stageClass(stage: string): string {
    const classes: Record<string, string> = {
      nuevo: 'badge-new',
      contactado: 'badge-review',
      en_tramite: 'badge-progress',
      completado: 'badge-done',
      perdido: 'badge-lost'
    };
    return classes[stage] || '';
  }

  stageProgress(stage: string): number {
    const map: Record<string, number> = {
      nuevo: 15,
      contactado: 35,
      en_tramite: 65,
      completado: 100,
      perdido: 0
    };
    return map[stage] || 0;
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
