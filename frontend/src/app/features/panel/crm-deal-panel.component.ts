import { Component, input, output, signal, effect, inject, NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, UpperCasePipe, JsonPipe, KeyValuePipe } from '@angular/common';
import { CrmService, UploadService } from '../../core/api.service';
import { CrmDeal, LOST_REASONS, MessageTemplate } from '../../models';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-crm-deal-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, UpperCasePipe, JsonPipe, KeyValuePipe],
  templateUrl: './crm-deal-panel.component.html',
  styleUrl: './panel-dashboard.css',
  styles: [`
    /* ══ DEAL PANEL — TEMA OSCURO ══ */
    .deal-panel-overlay { background: rgba(0,0,0,0.70) !important; backdrop-filter: blur(4px); }

    .deal-panel {
      background: #0a0a0a !important;
      border-left: 1px solid rgba(255,255,255,0.10) !important;
      color: #ffffff !important;
      scrollbar-color: rgba(255,255,255,0.12) transparent !important;
    }
    .deal-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12) !important; }

    /* Header */
    .deal-panel-header {
      background: #0d0d0d !important;
      border-bottom: 1px solid rgba(255,255,255,0.10) !important;
    }
    .deal-panel-eyebrow { color: rgba(255,255,255,0.38) !important; font-family: var(--f-display) !important; font-size: 10px !important; letter-spacing: 0.18em !important; text-transform: uppercase !important; }
    .deal-panel-header h3 { color: #ffffff !important; font-family: var(--f-display) !important; font-size: 18px !important; font-weight: 800 !important; letter-spacing: 0.04em !important; }
    .deal-panel-close {
      background: transparent !important;
      border: 1px solid rgba(255,255,255,0.18) !important;
      color: rgba(255,255,255,0.55) !important;
      border-radius: 8px !important;
    }
    .deal-panel-close:hover { background: rgba(230,61,47,0.15) !important; border-color: #e63d2f !important; color: #e63d2f !important; }

    /* Sections */
    .deal-section { border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
    .deal-section h4 {
      color: rgba(255,255,255,0.45) !important;
      font-family: var(--f-display) !important;
      font-size: 10px !important;
      letter-spacing: 0.18em !important;
      text-transform: uppercase !important;
      font-weight: 700 !important;
    }
    .deal-section h4::before { background: rgba(255,255,255,0.25) !important; }

    /* Contact card */
    .deal-contact-card {
      background: #141414 !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 12px !important;
    }
    .deal-contact-card p { color: rgba(255,255,255,0.70) !important; font-family: var(--f-display) !important; font-size: 14px !important; }
    .deal-contact-card strong,
    .deal-contact-card .link-name { color: #ffffff !important; font-family: var(--f-display) !important; font-size: 15px !important; font-weight: 700 !important; }
    .deal-contact-card .link-name:hover { color: rgba(255,255,255,0.70) !important; }

    /* Card desc */
    .deal-panel .card-desc { color: rgba(255,255,255,0.45) !important; font-family: var(--f-display) !important; font-size: 13px !important; }

    /* Inputs / selects */
    .deal-panel input,
    .deal-panel textarea,
    .deal-panel select,
    .deal-section select {
      background: #141414 !important;
      border: 1px solid rgba(255,255,255,0.14) !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
      font-size: 14px !important;
      color-scheme: dark !important;
    }
    .deal-panel input::placeholder,
    .deal-panel textarea::placeholder { color: rgba(255,255,255,0.28) !important; }
    .deal-panel input:focus,
    .deal-panel textarea:focus,
    .deal-panel select:focus,
    .deal-section select:focus {
      border-color: rgba(255,255,255,0.45) !important;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.06) !important;
    }
    .deal-panel select option,
    .deal-section select option { background: #141414 !important; color: #ffffff !important; }

    /* Botones */
    .deal-panel .btn-copy {
      background: #ffffff !important; color: #000 !important; border-color: #ffffff !important; border-radius: 8px !important; font-family: var(--f-display) !important;
    }
    .deal-panel .btn-copy:hover { background: transparent !important; color: #ffffff !important; }
    .deal-panel .btn-ghost {
      color: rgba(255,255,255,0.65) !important; border-color: rgba(255,255,255,0.22) !important; background: transparent !important; border-radius: 8px !important; font-family: var(--f-display) !important;
    }
    .deal-panel .btn-ghost:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
    .deal-panel .btn-delete { border-radius: 8px !important; font-family: var(--f-display) !important; }

    /* Activity */
    .deal-panel .activity-item { border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
    .deal-panel .activity-item p { color: rgba(255,255,255,0.70) !important; font-family: var(--f-display) !important; font-size: 13px !important; }
    .deal-panel .activity-item small { color: rgba(255,255,255,0.35) !important; font-family: var(--f-display) !important; }

    /* Chat */
    .deal-panel .chat-container { background: #0d0d0d !important; border: 1px solid rgba(255,255,255,0.10) !important; border-radius: 12px !important; }
    .deal-panel .chat-messages { background: transparent !important; }
    .deal-panel .message { font-family: var(--f-display) !important; font-size: 13px !important; }
    .deal-panel .inquiry-msg { color: rgba(255,255,255,0.70) !important; font-family: var(--f-display) !important; }
    .deal-panel .reply-msg { color: #44bb66 !important; font-family: var(--f-display) !important; }
    .deal-panel .chat-input { background: #141414 !important; border-top: 1px solid rgba(255,255,255,0.10) !important; border-radius: 0 0 12px 12px !important; }
    .deal-panel .chat-input input { background: #1a1a1a !important; border-color: rgba(255,255,255,0.14) !important; color: #fff !important; -webkit-text-fill-color: #fff !important; border-radius: 8px !important; font-family: var(--f-display) !important; }

    /* Tasks */
    .deal-panel .task-row { background: #141414 !important; border-color: rgba(255,255,255,0.10) !important; border-radius: 8px !important; color: #fff !important; font-family: var(--f-display) !important; }
    .deal-panel .task-row .done { color: rgba(255,255,255,0.35) !important; }

    /* Chips / badges */
    .deal-panel .chip { border-radius: 999px !important; font-family: var(--f-display) !important; }
    .deal-panel .section-sub { color: rgba(255,255,255,0.80) !important; font-family: var(--f-display) !important; font-size: 15px !important; }

    /* Tracking code badge */
    span[style*="var(--gold)"] { color: rgba(255,255,255,0.75) !important; border-color: rgba(255,255,255,0.20) !important; background: rgba(255,255,255,0.08) !important; }

    /* Divider */
    .deal-panel .divider { border-color: rgba(255,255,255,0.07) !important; }

    /* Payment box */
    .deal-payment-box { background: #141414 !important; border: 1px solid rgba(255,255,255,0.10) !important; border-radius: 12px !important; }
    .deal-payment-status { color: rgba(255,255,255,0.70) !important; font-family: var(--f-display) !important; }
    .deal-payment-error { color: #ff6b6b !important; font-family: var(--f-display) !important; }
    .deal-payment-link-label { color: rgba(255,255,255,0.55) !important; font-family: var(--f-display) !important; }

    /* Doc items */
    .deal-doc-item { background: #141414 !important; border: 1px solid rgba(255,255,255,0.10) !important; border-radius: 10px !important; }
    .deal-doc-item strong { color: #ffffff !important; font-family: var(--f-display) !important; }

    /* General text */
    .deal-panel strong { color: #ffffff !important; font-family: var(--f-display) !important; }
    .deal-panel p { color: rgba(255,255,255,0.70) !important; font-family: var(--f-display) !important; }
    .deal-panel label { color: rgba(255,255,255,0.45) !important; font-family: var(--f-display) !important; font-size: 11px !important; letter-spacing: 0.10em !important; }
    .deal-panel small { color: rgba(255,255,255,0.38) !important; font-family: var(--f-display) !important; }
  `],
})
export class CrmDealPanelComponent {
  dealId = input<string | null>(null);
  stages = input<string[]>([]);
  stageLabels = input<Record<string, string>>({});
  templates = input<MessageTemplate[]>([]);
  showReply = input(false);
  whatsappNumber = input('');

  closed = output<void>();
  updated = output<void>();
  openContact = output<string>();

  deal = signal<CrmDeal | null>(null);
  noteText = '';
  replyText = '';
  estimatedValue = 0;
  internalNotes = '';
  lostReason = '';
  taskTitle = '';
  taskDue = '';
  lostReasons = LOST_REASONS;

  isGeneratingPayment = signal(false);
  paymentLink = signal('');
  paymentError = signal('');

  // Chat
  messages: any[] = [];
  newMessage = '';
  socket!: Socket;

  auth = inject(AuthService);
  toast = inject(ToastService);

  constructor(private crmService: CrmService, private http: HttpClient, private zone: NgZone) {
    this.socket = io(environment.apiUrl.replace('/api', ''));
    
    this.socket.on('receive_message', (msg: any) => {
      this.zone.run(() => {
        if (this.deal() && msg.dealId === this.deal()!.id) {
          if (!this.messages.some(m => m.id === msg.id)) {
            this.messages.push(msg);
            this.scrollToBottom();
          }
        }
      });
    });

    effect(() => {
      const id = this.dealId();
      if (id) this.loadDeal(id);
      else this.deal.set(null);
    });
  }

  loadDeal(id: string) {
    this.crmService.getDeal(id).subscribe(d => {
      this.deal.set(d);
      this.estimatedValue = d.estimatedValue || 0;
      this.internalNotes = d.internalNotes || '';
      this.lostReason = d.lostReason || '';
      this.paymentLink.set('');
      this.paymentError.set('');
      
      this.downPayment = d.downPayment || 0;
      this.tradeInValue = d.tradeInValue || 0;
      this.termMonths = d.termMonths || 0;

      if (d.dealType === 'venta_auto') {
        this.loadQuotes(id);
      }
      this.loadDocuments(id);
      this.loadMessages(id);
    });
  }

  loadMessages(id: string) {
    this.http.get<any[]>(`${environment.apiUrl}/crm/deals/${id}/messages`).subscribe(res => {
      this.messages = res;
      this.socket.emit('join_deal', id);
      this.scrollToBottom();
    });
  }

  sendMessage() {
    const d = this.deal();
    if (!d || !this.newMessage.trim()) return;
    const txt = this.newMessage;
    this.newMessage = '';
    
    this.http.post<any>(`${environment.apiUrl}/crm/deals/${d.id}/messages`, { message: txt }).subscribe(saved => {
      if (!this.messages.find(m => m.id === saved.id)) {
        this.messages.push({ dealId: d.id, ...saved });
        this.scrollToBottom();
      }
      this.socket.emit('send_message', { dealId: d.id, ...saved });
    });
  }

  onChatFileSelected(event: any) {
    const d = this.deal();
    if (!d) return;
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    this.http.post<{url: string}>(`${environment.apiUrl}/upload`, formData).subscribe(res => {
      this.http.post<any>(`${environment.apiUrl}/crm/deals/${d.id}/messages`, { message: 'He subido un documento.', fileUrl: res.url }).subscribe(saved => {
        if (!this.messages.find(m => m.id === saved.id)) {
          this.messages.push({ dealId: d.id, ...saved });
          this.scrollToBottom();
        }
        this.socket.emit('send_message', { dealId: d.id, ...saved });
      });
    });
  }

  scrollToBottom() {
    setTimeout(() => {
      const box = document.getElementById('gestor-chat-box');
      if (box) box.scrollTop = box.scrollHeight;
    }, 100);
  }

  changeStage(stage: string) {
    const d = this.deal();
    if (!d || stage === d.stage) return;
    if (stage === 'perdido' && !this.lostReason) {
      this.deal.update(cur => (cur ? { ...cur, stage } : cur));
      return;
    }
    const payload: { stage: string; lostReason?: string } = { stage };
    if (stage === 'perdido') payload.lostReason = this.lostReason;
    this.crmService.updateDeal(d.id, payload).subscribe({
      next: () => { this.loadDeal(d.id); this.updated.emit(); },
      error: (e) => alert(e.error?.error || 'Error al cambiar etapa'),
    });
  }

  saveNotes() {
    const d = this.deal();
    if (!d) return;
    this.crmService.updateDeal(d.id, { internalNotes: this.internalNotes, estimatedValue: this.estimatedValue }).subscribe(() => {
      this.loadDeal(d.id);
      this.toast.success('Notas guardadas');
      this.updated.emit();
    });
  }

  addNote() {
    const d = this.deal();
    if (!d || !this.noteText.trim()) return;
    this.crmService.addActivity(d.id, this.noteText.trim()).subscribe(() => {
      this.noteText = '';
      this.loadDeal(d.id);
      this.toast.success('Nota agregada');
      this.updated.emit();
    });
  }

  sendReply() {
    const d = this.deal();
    if (!d || !this.replyText.trim()) return;
    this.crmService.replyDeal(d.id, this.replyText.trim()).subscribe(() => {
      this.replyText = '';
      this.loadDeal(d.id);
      this.toast.success('Respuesta enviada');
      this.updated.emit();
    });
  }

  generateAIReply() {
    const d = this.deal();
    if (!d) return;
    this.replyText = 'Generando respuesta con IA...';
    this.http.post<{reply: string}>(`${environment.apiUrl}/crm/deals/${d.id}/ai-reply`, {}).subscribe({
      next: (res) => {
        this.replyText = res.reply;
      },
      error: (e) => {
        alert(e.error?.error || 'Error al generar respuesta');
        this.replyText = '';
      }
    });
  }

  addTask() {
    const d = this.deal();
    if (!d || !this.taskTitle.trim() || !this.taskDue) return;
    this.crmService.createTask(d.id, this.taskTitle.trim(), this.taskDue).subscribe(() => {
      this.taskTitle = '';
      this.taskDue = '';
      this.loadDeal(d.id);
      this.toast.success('Tarea agregada');
      this.updated.emit();
    });
  }

  toggleTask(taskId: string, completed: boolean) {
    this.crmService.updateTask(taskId, { completed: !completed }).subscribe(() => {
      const d = this.deal();
      if (d) this.loadDeal(d.id);
      this.updated.emit();
    });
  }

  applyTemplate(t: MessageTemplate) {
    const d = this.deal();
    if (!d) return;
    const text = t.content
      .replace(/\{\{nombre\}\}/g, d.contact?.name || '')
      .replace(/\{\{titulo\}\}/g, d.title);
    if (this.showReply()) this.replyText = text;
    else this.noteText = text;
  }

  whatsappLink() {
    const d = this.deal();
    const phone = d?.contact?.whatsapp || d?.contact?.phone || this.whatsappNumber();
    if (!phone) return '#';
    const text = encodeURIComponent(`Hola ${d?.contact?.name}, respecto a ${d?.title}...`);
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`;
  }

  defaultTaskDue() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }

  // Phase 3.1: Quotes
  quotes = signal<any[]>([]);
  downPayment = 0;
  tradeInValue = 0;
  termMonths = 0;

  loadQuotes(dealId: string) {
    this.crmService.getQuotes(dealId).subscribe(qs => this.quotes.set(qs));
  }

  generateQuote() {
    const d = this.deal();
    if (!d) return;
    
    const payload = {
      total: this.estimatedValue,
      downPayment: this.downPayment,
      tradeInValue: this.tradeInValue,
      termMonths: Number(this.termMonths),
      items: [
        { description: 'Gestión de placas y engomado', price: 1500 },
        { description: 'Seguro cobertura amplia (1er año)', price: 12000 }
      ] // Demo items, in a real app this would be dynamic
    };

    this.crmService.createQuote(d.id, payload).subscribe(() => {
      this.loadQuotes(d.id);
      this.updated.emit();
    });
  }

  downloadQuote(quoteId: string) {
    this.crmService.downloadQuotePdf(quoteId).subscribe(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion_${quoteId.split('-')[0]}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  documents = signal<any[]>([]);
  clientDocuments = signal<any[]>([]);
  isUploading = signal(false);
  uploadService = inject(UploadService);

  generatePaymentLink() {
    if (!this.dealId()) return;
    
    // Auto-save if they typed a new value but forgot to click Save
    if (this.estimatedValue > 0 && this.deal()?.estimatedValue !== this.estimatedValue) {
      this.saveNotes();
      // Wait for save to complete before generating link
      setTimeout(() => this.executePaymentLinkGeneration(), 500);
      return;
    }
    
    this.executePaymentLinkGeneration();
  }

  executePaymentLinkGeneration() {
    if (!this.estimatedValue || this.estimatedValue <= 0) {
      alert('Debes asignar un "Valor estimado" mayor a 0 y guardarlo antes de cobrar.');
      return;
    }

    this.isGeneratingPayment.set(true);
    this.paymentError.set('');
    this.crmService.generatePaymentLink(this.dealId()!).subscribe({
      next: (res) => {
        this.paymentLink.set(res.url);
        this.isGeneratingPayment.set(false);
      },
      error: (err) => {
        this.paymentError.set(err.error?.error || 'Error al generar link de pago');
        this.isGeneratingPayment.set(false);
      }
    });
  }

  copyToClipboard(val: string) {
    navigator.clipboard.writeText(val);
    alert('Link copiado al portapapeles');
  }

  loadDocuments(dealId: string) {
    this.crmService.getDocuments(dealId).subscribe(docs => this.documents.set(docs));
    this.http.get<any[]>(`${environment.apiUrl}/crm/deals/${dealId}/client-documents`).subscribe(docs => {
      const parsedDocs = docs.map(d => {
        if (typeof d.extracted_data === 'string') {
          try { d.extracted_data = JSON.parse(d.extracted_data); } catch(e) {}
        }
        return d;
      });
      this.clientDocuments.set(parsedDocs);
    });
  }

  uploadDocument(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const d = this.deal();
    if (!d) return;

    this.isUploading.set(true);
    this.uploadService.uploadFile(file).subscribe({
      next: (res) => {
        this.crmService.addDocument(d.id, {
          fileName: file.name,
          fileUrl: res.url
        }).subscribe(() => {
          this.loadDocuments(d.id);
          this.isUploading.set(false);
          this.updated.emit();
        });
      },
      error: () => {
        alert('Error al subir el documento');
        this.isUploading.set(false);
      }
    });
  }

  deleteDocument(docId: string) {
    if (!confirm('¿Seguro que deseas eliminar este documento?')) return;
    this.crmService.deleteDocument(docId).subscribe(() => {
      const d = this.deal();
      if (d) this.loadDocuments(d.id);
      this.updated.emit();
    });
  }

  applyOcrData(docId: string) {
    const d = this.deal();
    if (!d) return;
    if (!confirm('¿Aplicar los datos extraídos a la Nota Interna?')) return;
    
    this.http.post<{success: boolean, notes: string}>(`${environment.apiUrl}/crm/deals/${d.id}/apply-ocr`, { documentId: docId }).subscribe({
      next: (res) => {
        this.internalNotes = res.notes;
        this.loadDocuments(d.id);
        this.updated.emit();
        alert('Datos aplicados correctamente');
      },
      error: () => alert('Error al aplicar datos OCR')
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('deal-panel-overlay')) {
      this.closed.emit();
    }
  }
}
