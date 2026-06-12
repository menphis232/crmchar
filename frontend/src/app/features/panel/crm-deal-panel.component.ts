import { Component, input, output, signal, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, UpperCasePipe, JsonPipe } from '@angular/common';
import { CrmService, UploadService } from '../../core/api.service';
import { CrmDeal, LOST_REASONS, MessageTemplate } from '../../models';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-crm-deal-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, UpperCasePipe, JsonPipe],
  templateUrl: './crm-deal-panel.component.html',
  styleUrl: './panel-dashboard.css',
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

  constructor(private crmService: CrmService, private http: HttpClient) {
    this.socket = io(environment.apiUrl.replace('/api', ''));
    
    this.socket.on('receive_message', (msg: any) => {
      if (this.deal() && msg.dealId === this.deal()!.id) {
        this.messages.push(msg);
        this.scrollToBottom();
      }
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
      this.updated.emit();
    });
  }

  addNote() {
    const d = this.deal();
    if (!d || !this.noteText.trim()) return;
    this.crmService.addActivity(d.id, this.noteText.trim()).subscribe(() => {
      this.noteText = '';
      this.loadDeal(d.id);
      this.updated.emit();
    });
  }

  sendReply() {
    const d = this.deal();
    if (!d || !this.replyText.trim()) return;
    this.crmService.replyDeal(d.id, this.replyText.trim()).subscribe(() => {
      this.replyText = '';
      this.loadDeal(d.id);
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
    this.http.get<any[]>(`${environment.apiUrl}/crm/deals/${dealId}/client-documents`).subscribe(docs => this.clientDocuments.set(docs));
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
