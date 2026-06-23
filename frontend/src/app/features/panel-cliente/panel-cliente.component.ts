import { Component, inject, OnInit, OnDestroy, signal, computed, NgZone } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { UploadService } from '../../core/api.service';
import { PanelUserMenuComponent } from '../panel/panel-user-menu.component';
import { AiAssistantComponent } from '../../shared/ai-assistant.component';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from '../../shared/brand.constants';
import {
  LucideArrowLeft,
  LucideBot,
  LucideCar,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClipboardList,
  LucideFileText,
  LucideFolderOpen,
  LucideHistory,
  LucideInbox,
  LucideKeyRound,
  LucideLayoutDashboard,
  LucideMapPin,
  LucideMessageCircle,
  LucidePaperclip,
  LucideSearch,
  LucideSettings,
  LucideTrash2,
  LucideUpload,
  LucideUser,
  LucideReceipt,
  LucideDownload,
  LucideWallet,
} from '@lucide/angular';

interface PaginatedDeals {
  items: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type ClientTab = 'dashboard' | 'tramites' | 'historial' | 'billetera' | 'facturas' | 'ajustes';

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [
    CommonModule, FormsModule, DatePipe, CurrencyPipe, NgTemplateOutlet,
    PanelUserMenuComponent, AiAssistantComponent,
    LucideLayoutDashboard, LucideClipboardList, LucideHistory, LucideWallet, LucideSettings,
    LucideCar, LucideInbox, LucideMapPin, LucideArrowLeft, LucideCheck, LucideMessageCircle,
    LucideFileText, LucidePaperclip, LucideKeyRound, LucideUser, LucideReceipt, LucideDownload,
    LucideSearch, LucideChevronLeft, LucideChevronRight, LucideUpload, LucideTrash2,
    LucideFolderOpen, LucideBot,
  ],
  templateUrl: './panel-cliente.component.html',
  styleUrls: ['../panel/panel-dashboard.css', './panel-cliente.component.css'],
})
export class PanelClienteComponent implements OnInit, OnDestroy {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;
  readonly walletCategories = [
    'INE / Identificación',
    'Licencia de conducir',
    'Tarjeta de circulación',
    'Factura / Comprobante',
    'Póliza de seguro',
    'Comprobante de domicilio',
    'Otro',
  ];
  readonly pageSize = 10;

  auth = inject(AuthService);
  http = inject(HttpClient);
  uploadService = inject(UploadService);
  toast = inject(ToastService);
  zone = inject(NgZone);

  activeTab = signal<ClientTab>('dashboard');
  isMobileMenuOpen = signal(false);
  dealTab = signal<'chat' | 'docs' | 'factura'>('chat');

  stats = signal({ total: 0, active: 0, closed: 0 });
  recentDeals = signal<any[]>([]);
  tramitesList = signal<any[]>([]);
  historialList = signal<any[]>([]);
  tramitesMeta = signal({ total: 0, page: 1, totalPages: 1 });
  historialMeta = signal({ total: 0, page: 1, totalPages: 1 });
  tramitesSearch = '';
  historialSearch = '';
  tramitesLoading = signal(false);
  historialLoading = signal(false);
  dashboardLoading = signal(true);

  selectedDeal = signal<any>(null);
  documents = signal<any[]>([]);
  dealInvoice = signal<any>(null);
  allInvoices = signal<any[]>([]);
  invoicesLoading = signal(false);
  downloadingInvoiceId = signal<string | null>(null);
  uploadingDocType = signal<string | null>(null);

  walletDocs = signal<any[]>([]);
  walletLoading = signal(false);
  uploadingWallet = signal(false);
  walletForm = { label: '', category: 'Otro', notes: '' };

  messages = signal<any[]>([]);
  newMessage = '';
  socket!: Socket;
  chatLoading = signal(false);
  uploadingFile = signal(false);

  totalDeals = computed(() => this.stats().total);
  activeDeals = computed(() => this.stats().active);
  completedDeals = computed(() => this.stats().closed);

  ngOnInit() {
    document.documentElement.style.setProperty('--bg', '#000000');
    document.documentElement.style.setProperty('--panel-bg', '#000000');
    document.body.style.backgroundColor = '#000000';
    this.loadDashboard();
    this.loadInvoices();
    this.loadWallet();
    this.socket = io(environment.apiUrl.replace('/api', ''));

    const user = this.auth.user();
    if (user) this.socket.emit('identify', user.id);

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
        this.toast.info(notif.body, notif.title, () => {
          if (notif.ref_id) {
            this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
              params: { status: 'all', page: '1', limit: '100' },
            }).subscribe(res => {
              const d = res.items.find(x => x.id === notif.ref_id);
              if (d) this.openDeal(d);
            });
          }
        });
      });
    });
  }

  ngOnDestroy() {
    if (this.socket) this.socket.disconnect();
  }

  setTab(tab: ClientTab) {
    this.activeTab.set(tab);
    this.isMobileMenuOpen.set(false);
    if (tab === 'tramites' && !this.selectedDeal()) this.loadTramites(1);
    if (tab === 'historial') this.loadHistorial(1);
    if (tab === 'billetera') this.loadWallet();
  }

  loadDashboard() {
    this.dashboardLoading.set(true);
    this.http.get<{ total: number; active: number; closed: number }>(`${environment.apiUrl}/client/deals/stats`).subscribe({
      next: stats => {
        this.stats.set(stats);
        this.dashboardLoading.set(false);
      },
      error: () => this.dashboardLoading.set(false),
    });
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: { status: 'all', page: '1', limit: '4' },
    }).subscribe({
      next: res => this.recentDeals.set(res.items),
    });
  }

  loadTramites(page = 1) {
    this.tramitesLoading.set(true);
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: {
        status: 'active',
        page: String(page),
        limit: String(this.pageSize),
        ...(this.tramitesSearch.trim() ? { q: this.tramitesSearch.trim() } : {}),
      },
    }).subscribe({
      next: res => {
        this.tramitesList.set(res.items);
        this.tramitesMeta.set({ total: res.total, page: res.page, totalPages: res.totalPages });
        this.tramitesLoading.set(false);
      },
      error: () => this.tramitesLoading.set(false),
    });
  }

  loadHistorial(page = 1) {
    this.historialLoading.set(true);
    this.http.get<PaginatedDeals>(`${environment.apiUrl}/client/deals`, {
      params: {
        status: 'closed',
        page: String(page),
        limit: String(this.pageSize),
        ...(this.historialSearch.trim() ? { q: this.historialSearch.trim() } : {}),
      },
    }).subscribe({
      next: res => {
        this.historialList.set(res.items);
        this.historialMeta.set({ total: res.total, page: res.page, totalPages: res.totalPages });
        this.historialLoading.set(false);
      },
      error: () => this.historialLoading.set(false),
    });
  }

  searchTramites() {
    this.loadTramites(1);
  }

  searchHistorial() {
    this.loadHistorial(1);
  }

  loadWallet() {
    this.walletLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/wallet`).subscribe({
      next: docs => {
        this.walletDocs.set(docs);
        this.walletLoading.set(false);
      },
      error: () => this.walletLoading.set(false),
    });
  }

  onWalletFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.walletForm.label.trim()) {
      this.toast.warning('Escribe un nombre para el documento antes de subir.', 'Datos incompletos');
      input.value = '';
      return;
    }
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Usa una foto (JPG, PNG, WebP) o un PDF.', 'Formato no válido');
      input.value = '';
      return;
    }
    this.uploadingWallet.set(true);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);
    upload$.subscribe({
      next: res => {
        this.http.post<any>(`${environment.apiUrl}/client/wallet`, {
          label: this.walletForm.label.trim(),
          category: this.walletForm.category,
          fileUrl: res.url,
          notes: this.walletForm.notes.trim() || null,
        }).subscribe({
          next: doc => {
            this.walletDocs.update(d => [doc, ...d]);
            this.walletForm = { label: '', category: 'Otro', notes: '' };
            this.uploadingWallet.set(false);
            input.value = '';
            this.toast.success('Documento guardado en tu billetera.', 'Listo');
          },
          error: () => {
            this.uploadingWallet.set(false);
            this.toast.error('No se pudo guardar el documento.', 'Error');
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.uploadingWallet.set(false);
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
        input.value = '';
      },
    });
  }

  deleteWalletDoc(id: string) {
    if (!confirm('¿Eliminar este documento de tu billetera?')) return;
    this.http.delete(`${environment.apiUrl}/client/wallet/${id}`).subscribe({
      next: () => {
        this.walletDocs.update(d => d.filter(x => x.id !== id));
        this.toast.success('Documento eliminado.', 'Listo');
      },
      error: () => this.toast.error('No se pudo eliminar.', 'Error'),
    });
  }

  loadInvoices() {
    this.invoicesLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/invoices`).subscribe({
      next: res => {
        this.allInvoices.set(res);
        this.invoicesLoading.set(false);
      },
      error: () => this.invoicesLoading.set(false),
    });
  }

  openDeal(deal: any) {
    this.selectedDeal.set(deal);
    this.activeTab.set('tramites');
    this.dealTab.set(deal.payment_status === 'paid' && deal.invoice_id ? 'factura' : 'chat');
    this.dealInvoice.set(deal.invoice_id ? {
      id: deal.invoice_id,
      invoice_number: deal.invoice_number,
      amount: deal.invoice_amount,
      pdf_url: deal.invoice_pdf_url,
      created_at: deal.invoice_date,
    } : null);
    this.chatLoading.set(true);
    this.http.get<any[]>(`${environment.apiUrl}/client/deals/${deal.id}/messages`).subscribe({
      next: res => {
        this.messages.set(res);
        this.socket.emit('join_deal', deal.id);
        this.chatLoading.set(false);
        this.scrollToBottom();
      },
      error: () => this.chatLoading.set(false),
    });
    this.http.get<any[]>(`${environment.apiUrl}/client/deals/${deal.id}/documents`).subscribe({
      next: docs => this.documents.set(docs),
    });
    if (deal.payment_status === 'paid' && !deal.invoice_id) {
      this.http.get<any>(`${environment.apiUrl}/client/deals/${deal.id}/invoice`).subscribe({
        next: inv => this.dealInvoice.set(inv),
        error: () => this.dealInvoice.set(null),
      });
    }
  }

  closeDeal() {
    const deal = this.selectedDeal();
    if (deal) this.socket.emit('leave_deal', deal.id);
    this.selectedDeal.set(null);
    this.messages.set([]);
    this.documents.set([]);
    this.dealInvoice.set(null);
  }

  downloadInvoice(invoiceId: string, invoiceNumber?: string) {
    this.downloadingInvoiceId.set(invoiceId);
    this.http.get(`${environment.apiUrl}/client/invoices/${invoiceId}/download`, {
      responseType: 'blob',
    }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoiceNumber || 'factura'}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingInvoiceId.set(null);
      },
      error: () => {
        this.downloadingInvoiceId.set(null);
        this.toast.error('No se pudo descargar la factura.', 'Error');
      },
    });
  }

  isPaid(deal: any): boolean {
    return deal?.payment_status === 'paid';
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const dealId = this.selectedDeal()?.id;
    if (!dealId) return;
    const txt = this.newMessage;
    this.newMessage = '';

    this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/messages`, { message: txt }).subscribe(saved => {
      this.messages.update(msgs => {
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
          message: `Documento adjunto: ${file.name}`,
          fileUrl: res.url,
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
      error: () => this.uploadingFile.set(false),
    });
  }

  onDocSelected(docType: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Usa una foto (JPG, PNG, WebP) o un PDF.', 'Formato no válido');
      input.value = '';
      return;
    }

    this.uploadingDocType.set(docType);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);

    upload$.subscribe({
      next: res => {
        const dealId = this.selectedDeal()?.id;
        if (!dealId) return;
        this.http.post<any>(`${environment.apiUrl}/client/deals/${dealId}/documents`, {
          documentType: docType,
          fileUrl: res.url,
        }).subscribe({
          next: newDoc => {
            this.documents.update(docs => [newDoc, ...docs]);
            this.uploadingDocType.set(null);
            input.value = '';
          },
          error: () => {
            this.uploadingDocType.set(null);
            this.toast.error('No se pudo registrar el documento.', 'Error');
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.uploadingDocType.set(null);
        this.toast.error(e.error?.error || 'Error al subir archivo', 'Error');
        input.value = '';
      },
    });
  }

  getDocStatus(docType: string) {
    return this.documents().find(d => d.document_type === docType);
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
    return !!deal?.is_closed;
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
