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
    /* ══ DEAL PANEL — NEGRO TOTAL ══ */
    :host {
      --brand-black:  #ffffff;
      --brand-white:  #0a0a0a;
      --surface:      #141414;
      --surface-hover:#1a1a1a;
      --surface-2:    rgba(255,255,255,0.04);
      --border:       rgba(255,255,255,0.10);
      --border-hover: rgba(255,255,255,0.30);
      --text:         #ffffff;
      --muted:        rgba(255,255,255,0.45);
      --mx-white:     #ffffff;
      --gold:         rgba(255,255,255,0.55);
      --gold-glow:    rgba(255,255,255,0.05);
      --gold-dim:     rgba(255,255,255,0.05);
      --brand-grey:   rgba(255,255,255,0.35);
      --shadow-card:  0 4px 20px rgba(0,0,0,0.6);
    }

    /* Overlay */
    .deal-panel-overlay { background: rgba(0,0,0,0.75) !important; backdrop-filter: blur(6px); }

    /* Panel — todo negro */
    .deal-panel {
      background: #000 !important;
      border-left: 1px solid rgba(255,255,255,0.10) !important;
      color: #ffffff !important;
      scrollbar-color: rgba(255,255,255,0.12) transparent;
      font-family: var(--f-display) !important;
    }
    .deal-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14) !important; }
    .deal-panel-body { background: #000 !important; }
    .deal-section { background: transparent !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
    .deal-subsection { background: #0d0d0d !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 12px !important; margin-bottom: 8px !important; }

    /* Header */
    .deal-panel-header {
      background: #111 !important;
      border-bottom: 1px solid rgba(255,255,255,0.09) !important;
    }
    .deal-panel-eyebrow {
      color: rgba(255,255,255,0.35) !important;
      font-size: 9px !important;
      letter-spacing: 0.20em !important;
      font-family: var(--f-display) !important;
    }
    .deal-panel-header h3 {
      color: #ffffff !important;
      font-family: var(--f-display) !important;
      font-size: 18px !important;
      font-weight: 800 !important;
    }
    .deal-panel-close {
      background: transparent !important;
      border: 1px solid rgba(255,255,255,0.15) !important;
      color: rgba(255,255,255,0.50) !important;
      border-radius: 8px !important;
    }
    .deal-panel-close:hover { background: rgba(230,61,47,0.15) !important; border-color: #e63d2f !important; color: #e63d2f !important; }

    /* Sections */
    .deal-section { border-bottom: 1px solid rgba(255,255,255,0.07) !important; }
    .deal-section h4 {
      color: rgba(255,255,255,0.35) !important;
      font-family: var(--f-display) !important;
      font-size: 9px !important;
      letter-spacing: 0.22em !important;
      font-weight: 700 !important;
    }
    .deal-section h4::before { background: rgba(255,255,255,0.20) !important; }

    /* Contact card */
    .deal-contact-card {
      background: #161616 !important;
      border: 1px solid rgba(255,255,255,0.09) !important;
      border-radius: 12px !important;
    }
    .deal-contact-card p { color: rgba(255,255,255,0.65) !important; font-family: var(--f-display) !important; }
    .deal-contact-card strong { color: #ffffff !important; font-family: var(--f-display) !important; font-weight: 700 !important; }
    .link-name { color: #ffffff !important; font-family: var(--f-display) !important; font-weight: 700 !important; }
    .link-name:hover { color: rgba(255,255,255,0.60) !important; }

    /* Inputs / selects */
    input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),
    textarea, select {
      background: #161616 !important;
      border: 1px solid rgba(255,255,255,0.13) !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
      font-size: 14px !important;
      color-scheme: dark !important;
    }
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.25) !important; opacity: 1; }
    input:focus, textarea:focus, select:focus {
      border-color: rgba(255,255,255,0.40) !important;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.05) !important;
      outline: none !important;
    }
    select option { background: #161616 !important; color: #ffffff !important; }

    /* Botones */
    .btn-copy {
      background: #ffffff !important;
      color: #000000 !important;
      border: 2px solid #ffffff !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
    }
    .btn-copy:hover { background: transparent !important; color: #ffffff !important; }
    .btn-ghost {
      color: rgba(255,255,255,0.65) !important;
      border: 1px solid rgba(255,255,255,0.20) !important;
      background: transparent !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
    }
    .btn-ghost:hover { background: rgba(255,255,255,0.08) !important; color: #fff !important; }
    .btn-delete { border-radius: 8px !important; font-family: var(--f-display) !important; }

    /* Card desc + general */
    .card-desc { color: rgba(255,255,255,0.45) !important; font-family: var(--f-display) !important; font-size: 13px !important; }
    .section-sub { color: rgba(255,255,255,0.75) !important; font-family: var(--f-display) !important; font-size: 15px !important; }
    .divider { border-color: rgba(255,255,255,0.07) !important; }
    .inquiry-msg { color: rgba(255,255,255,0.65) !important; font-family: var(--f-display) !important; }
    .reply-msg { color: #4ade80 !important; font-family: var(--f-display) !important; }

    /* Activity */
    .activity-item { border-bottom: 1px solid rgba(255,255,255,0.06) !important; }
    .activity-item p { color: rgba(255,255,255,0.65) !important; font-family: var(--f-display) !important; font-size: 13px !important; }
    .activity-item small { color: rgba(255,255,255,0.30) !important; font-family: var(--f-display) !important; }

    /* Chat */
    .chat-container { background: #111 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 12px !important; }
    .message { font-family: var(--f-display) !important; font-size: 13px !important; color: rgba(255,255,255,0.70) !important; }
    .chat-input { background: #161616 !important; border-top: 1px solid rgba(255,255,255,0.09) !important; }

    /* Tasks */
    .task-row { background: #161616 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 8px !important; color: #fff !important; font-family: var(--f-display) !important; }
    .task-row .done { color: rgba(255,255,255,0.30) !important; }

    /* Status / chips */
    .chip { border-radius: 999px !important; font-family: var(--f-display) !important; }
    .status-badge { border-radius: 999px !important; }
    .status-tag  { border-radius: 999px !important; }

    /* Payment */
    .deal-payment-box { background: #161616 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 12px !important; }
    .deal-payment-error { color: #ff6b6b !important; }
    .deal-payment-link-label { color: rgba(255,255,255,0.50) !important; font-family: var(--f-display) !important; }

    /* Docs */
    .deal-doc-item { background: #161616 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 10px !important; }

    /* Payment */
    .deal-payment-box,
    .deal-payment-link-box { background: #111 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 12px !important; }
    .deal-payment-error { color: #ff6b6b !important; }
    .deal-payment-link-label { color: rgba(255,255,255,0.50) !important; font-family: var(--f-display) !important; }
    .deal-value-row { background: transparent !important; }

    /* Docs */
    .deal-doc-item { background: #111 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 10px !important; }
    .deal-doc-item-top { background: transparent !important; }

    /* Upload area */
    .deal-upload-area,
    [class*="upload"] { background: #111 !important; border-color: rgba(255,255,255,0.15) !important; }

    /* Cover ALL remaining white/cream backgrounds */
    div:not([class*="vega"]):not([class*="toast"]) { color: inherit; }

    /* Typography catch-all */
    p      { color: rgba(255,255,255,0.65) !important; font-family: var(--f-display) !important; }
    strong { color: #ffffff !important; font-family: var(--f-display) !important; }
    h4     { color: rgba(255,255,255,0.35) !important; font-family: var(--f-display) !important; font-size: 9px !important; letter-spacing: 0.22em !important; text-transform: uppercase !important; font-weight: 700 !important; }
    label  { color: rgba(255,255,255,0.40) !important; font-family: var(--f-display) !important; font-size: 11px !important; letter-spacing: 0.12em !important; }
    small  { color: rgba(255,255,255,0.35) !important; font-family: var(--f-display) !important; }
    a      { color: rgba(255,255,255,0.75) !important; }
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
