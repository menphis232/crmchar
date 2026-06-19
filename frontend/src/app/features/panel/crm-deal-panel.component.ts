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
    .deal-subsection--ocr { background: #0d0d0d !important; border-color: rgba(255,255,255,0.10) !important; }
    .deal-subsection--ocr h4 { color: rgba(255,255,255,0.45) !important; }

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
      color: rgba(255,255,255,0.40) !important;
      font-family: var(--f-display) !important;
      font-size: 11px !important;
      letter-spacing: 0.22em !important;
      font-weight: 700 !important;
    }
    .deal-section h4::before { background: rgba(255,255,255,0.20) !important; }

    /* Contact card */
    .deal-contact-card {
      background: #141414 !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 14px !important;
      padding: 20px 22px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 12px !important;
    }
    .deal-contact-card .link-name,
    .deal-contact-card .deal-contact-name,
    .deal-contact-card strong {
      color: #ffffff !important;
      font-family: var(--f-display) !important;
      font-size: 22px !important;
      font-weight: 800 !important;
      letter-spacing: 0.06em !important;
      text-transform: uppercase !important;
      text-decoration: none !important;
      background: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 0 6px !important;
      cursor: pointer !important;
      line-height: 1.2 !important;
    }
    .deal-contact-card .link-name:hover {
      color: rgba(255,255,255,0.65) !important;
      text-decoration: none !important;
    }
    .deal-contact-card p {
      color: rgba(255,255,255,0.72) !important;
      font-family: var(--f-display) !important;
      font-size: 16px !important;
      letter-spacing: 0.03em !important;
      margin: 0 !important;
      line-height: 1.5 !important;
    }
    .deal-contact-card .btn-copy.small {
      margin-top: 8px !important;
      align-self: flex-start !important;
      background: transparent !important;
      color: rgba(255,255,255,0.75) !important;
      border: 1px solid rgba(255,255,255,0.28) !important;
      font-family: var(--f-display) !important;
      font-size: 11px !important;
      letter-spacing: 0.14em !important;
      padding: 9px 18px !important;
      border-radius: 999px !important;
    }
    .deal-contact-card .btn-copy.small:hover {
      background: rgba(255,255,255,0.08) !important;
      color: #ffffff !important;
      border-color: rgba(255,255,255,0.50) !important;
    }

    /* Selects — mismo estilo que kanban leads */
    .deal-panel select,
    .deal-section select {
      color-scheme: dark !important;
      background-color: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.18) !important;
      color: rgba(255,255,255,0.80) !important;
      -webkit-text-fill-color: rgba(255,255,255,0.80) !important;
      border-radius: 6px !important;
      font-size: 12px !important;
      padding: 8px 10px !important;
      width: 100% !important;
      cursor: pointer !important;
      font-family: var(--f-display) !important;
      box-sizing: border-box !important;
    }
    .deal-panel select:focus,
    .deal-section select:focus {
      border-color: rgba(255,255,255,0.45) !important;
      outline: none !important;
      background-color: #1a1a1a !important;
      color: rgba(255,255,255,0.80) !important;
      -webkit-text-fill-color: rgba(255,255,255,0.80) !important;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.05) !important;
    }
    .deal-panel select option,
    .deal-section select option {
      background: #1a1a1a !important;
      color: #ffffff !important;
    }

    /* Inputs / textarea */
    .deal-panel input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),
    .deal-section input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),
    .deal-panel textarea,
    .deal-section textarea {
      background: #161616 !important;
      border: 1px solid rgba(255,255,255,0.13) !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
      font-size: 14px !important;
      color-scheme: dark !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .deal-panel input::placeholder,
    .deal-panel textarea::placeholder,
    .deal-section input::placeholder,
    .deal-section textarea::placeholder { color: rgba(255,255,255,0.25) !important; opacity: 1; }
    .deal-panel input:focus,
    .deal-panel textarea:focus,
    .deal-section input:focus,
    .deal-section textarea:focus {
      border-color: rgba(255,255,255,0.40) !important;
      box-shadow: 0 0 0 3px rgba(255,255,255,0.05) !important;
      outline: none !important;
      background: #161616 !important;
    }

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
    .inquiry-msg,
    .deal-panel .inquiry-msg {
      color: rgba(255,255,255,0.80) !important;
      background: #161616 !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
      border-left: 3px solid rgba(255,255,255,0.25) !important;
      border-radius: 10px !important;
      padding: 12px 14px !important;
      font-family: var(--f-display) !important;
      font-size: 14px !important;
      font-style: italic !important;
      line-height: 1.5 !important;
      margin: 8px 0 !important;
    }
    .reply-msg { color: #4ade80 !important; font-family: var(--f-display) !important; }

    /* Activity */
    .activity-item {
      background: #111 !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-left: 3px solid rgba(255,255,255,0.20) !important;
      border-radius: 10px !important;
      margin-bottom: 8px !important;
      padding: 10px 14px !important;
    }
    .activity-item:hover { border-left-color: rgba(255,255,255,0.50) !important; background: #161616 !important; }
    .activity-item p { color: rgba(255,255,255,0.70) !important; font-family: var(--f-display) !important; font-size: 13px !important; }
    .activity-item small { color: rgba(255,255,255,0.30) !important; font-family: var(--f-display) !important; }
    .activity-type { color: rgba(255,255,255,0.40) !important; font-family: var(--f-display) !important; font-size: 10px !important; letter-spacing: 0.12em !important; text-transform: uppercase !important; }

    /* Chat */
    .deal-chat { border-radius: 12px !important; overflow: hidden !important; border: 1px solid rgba(255,255,255,0.10) !important; }
    .chat-container { background: #0d0d0d !important; border-radius: 12px !important; }
    .deal-panel .chat-messages { background: #0d0d0d !important; }

    /* Mensajes del cliente */
    .deal-panel .message {
      background: #1e1e1e !important;
      border: 1px solid rgba(255,255,255,0.09) !important;
      color: rgba(255,255,255,0.80) !important;
      border-radius: 10px !important;
      font-family: var(--f-display) !important;
      font-size: 13px !important;
    }
    .deal-panel .message.own {
      background: #2a2a2a !important;
      border-color: rgba(255,255,255,0.18) !important;
      color: #ffffff !important;
      align-self: flex-end !important;
    }

    /* Chat input bar */
    .deal-panel .chat-input {
      background: #111 !important;
      border-top: 1px solid rgba(255,255,255,0.09) !important;
      padding: 8px !important;
    }
    .deal-panel .chat-input input[type="text"] {
      background: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.14) !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
    }

    /* Template chips */
    .template-chips .chip {
      background: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.14) !important;
      color: rgba(255,255,255,0.65) !important;
      border-radius: 999px !important;
      font-family: var(--f-display) !important;
    }
    .template-chips .chip:hover { background: #2a2a2a !important; color: #fff !important; border-color: rgba(255,255,255,0.35) !important; }

    /* Tasks */
    .task-row { background: #161616 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 8px !important; color: #fff !important; font-family: var(--f-display) !important; }
    .task-row .done { color: rgba(255,255,255,0.30) !important; }

    /* Status / chips */
    .chip { border-radius: 999px !important; font-family: var(--f-display) !important; }
    .status-badge { border-radius: 999px !important; }
    .status-tag  { border-radius: 999px !important; }

    /* Payment */
    .deal-payment-box {
      margin-top: 16px !important;
      padding: 18px 20px !important;
      background: #141414 !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 14px !important;
      border-top: none !important;
    }
    .deal-payment-status {
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 14px !important;
      font-family: var(--f-display) !important;
    }
    .deal-payment-status > span {
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      color: rgba(255,255,255,0.40) !important;
      font-size: 11px !important;
      letter-spacing: 0.16em !important;
      text-transform: uppercase !important;
      font-weight: 700 !important;
    }
    .deal-payment-status strong {
      font-family: var(--f-display) !important;
      font-size: 14px !important;
      letter-spacing: 0.10em !important;
      font-weight: 800 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 7px 14px !important;
      border-radius: 999px !important;
      width: fit-content !important;
      text-transform: uppercase !important;
    }
    .deal-payment-status strong.pending {
      color: #fbbf24 !important;
      background: rgba(251,191,36,0.10) !important;
      border: 1px solid rgba(251,191,36,0.22) !important;
    }
    .deal-payment-status strong.paid {
      color: #4ade80 !important;
      background: rgba(74,222,128,0.10) !important;
      border: 1px solid rgba(74,222,128,0.22) !important;
    }
    .deal-payment-status .btn-ghost.small {
      width: 100% !important;
      justify-content: center !important;
      padding: 11px 18px !important;
      font-size: 11px !important;
      letter-spacing: 0.14em !important;
      text-transform: uppercase !important;
      border-radius: 999px !important;
      color: rgba(255,255,255,0.80) !important;
      border: 1px solid rgba(255,255,255,0.25) !important;
      background: transparent !important;
      font-family: var(--f-display) !important;
      font-weight: 700 !important;
    }
    .deal-payment-status .btn-ghost.small:hover {
      background: rgba(255,255,255,0.08) !important;
      color: #ffffff !important;
      border-color: rgba(255,255,255,0.45) !important;
    }
    .deal-payment-link-box {
      margin-top: 14px !important;
      padding: 14px 16px !important;
      background: #1a1a1a !important;
      border: 1px solid rgba(255,255,255,0.09) !important;
      border-radius: 12px !important;
    }
    .deal-payment-link-label {
      color: rgba(255,255,255,0.50) !important;
      font-family: var(--f-display) !important;
      font-size: 12px !important;
      margin-bottom: 10px !important;
    }
    .deal-payment-link-row {
      display: flex !important;
      gap: 8px !important;
      flex-wrap: wrap !important;
      align-items: center !important;
    }
    .deal-payment-link-row input {
      flex: 1 !important;
      min-width: 0 !important;
      font-size: 12px !important;
      font-family: var(--f-display) !important;
      background: #111 !important;
      border: 1px solid rgba(255,255,255,0.14) !important;
      color: rgba(255,255,255,0.75) !important;
      border-radius: 8px !important;
      padding: 8px 10px !important;
    }
    .deal-payment-error {
      color: #ff6b6b !important;
      font-family: var(--f-display) !important;
      font-size: 12px !important;
      margin-top: 10px !important;
    }
    .deal-value-row { background: transparent !important; }

    /* Docs + file cards */
    .deal-attach-section {
      padding: 18px 20px !important;
    }
    .deal-attach-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px !important;
    }
    .deal-attach-header h4 {
      margin: 0 !important;
      flex: 1;
      min-width: 0;
    }
    .deal-outline-btn,
    label.deal-outline-btn,
    button.deal-outline-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0;
      align-self: flex-start;
      padding: 9px 16px !important;
      background: transparent !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
      border: 1px solid rgba(255,255,255,0.35) !important;
      border-radius: 999px !important;
      font-family: var(--f-display) !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      letter-spacing: 0.14em !important;
      text-transform: uppercase !important;
      cursor: pointer !important;
      margin: 0 !important;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .deal-outline-btn:hover,
    label.deal-outline-btn:hover,
    button.deal-outline-btn:hover {
      background: rgba(255,255,255,0.10) !important;
      border-color: rgba(255,255,255,0.60) !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .deal-outline-btn.disabled,
    label.deal-outline-btn.disabled {
      opacity: 0.45;
      pointer-events: none;
    }
    .quote-doc-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 0; }
    .quote-doc-item {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      background: #111 !important; border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 10px !important; padding: 12px 14px;
    }
    .quote-doc-info { flex: 1; min-width: 0; }
    .quote-doc-info strong { display: block; font-size: 13px !important; margin-bottom: 4px; }
    .quote-doc-note { font-size: 12px !important; color: rgba(255,255,255,0.70) !important; margin: 0 0 4px; line-height: 1.4; }
    .quote-doc-actions {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      flex-shrink: 0;
    }
    .deal-doc-delete {
      background: transparent !important;
      border: none !important;
      color: rgba(255,255,255,0.35) !important;
      cursor: pointer !important;
      padding: 8px 4px !important;
      font-size: 14px !important;
      line-height: 1 !important;
    }
    .deal-doc-delete:hover { color: #ff6b6b !important; }

    .deal-quote-upload {
      padding: 18px 20px !important;
      margin: 8px 0 4px !important;
      background: #141414 !important;
      border: 1px solid rgba(255,255,255,0.10) !important;
      border-radius: 14px !important;
    }
    .deal-quote-upload h4 {
      margin: 0 0 8px !important;
      color: rgba(255,255,255,0.55) !important;
    }
    .deal-quote-upload .card-desc {
      margin: 0 0 16px !important;
      line-height: 1.5 !important;
    }
    .deal-quote-upload .quote-doc-list {
      margin-bottom: 14px !important;
    }
    .deal-quote-upload .form-group {
      margin-bottom: 14px !important;
    }
    .deal-quote-upload .form-group label {
      display: block !important;
      margin-bottom: 8px !important;
      color: rgba(255,255,255,0.50) !important;
    }
    .quote-upload-form {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-top: 4px;
    }

    .deal-doc-item { background: #111 !important; border: 1px solid rgba(255,255,255,0.09) !important; border-radius: 10px !important; }
    .deal-doc-item-top { background: transparent !important; }

    /* Upload area */
    .deal-upload-area { background: #111 !important; border-color: rgba(255,255,255,0.15) !important; }

    /* Cover ALL remaining white/cream backgrounds */
    div:not([class*="vega"]):not([class*="toast"]) { color: inherit; }

    /* Typography catch-all */
    p      { color: rgba(255,255,255,0.65) !important; font-family: var(--f-display) !important; }
    strong { color: #ffffff !important; font-family: var(--f-display) !important; }
    h4     { color: rgba(255,255,255,0.35) !important; font-family: var(--f-display) !important; font-size: 9px !important; letter-spacing: 0.22em !important; text-transform: uppercase !important; font-weight: 700 !important; }
    label:not(.deal-outline-btn) { color: rgba(255,255,255,0.40) !important; font-family: var(--f-display) !important; font-size: 11px !important; letter-spacing: 0.12em !important; }
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
  isConcesionaria = input(false);

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

  // PDF cotización (subida manual)
  quoteDocuments = signal<any[]>([]);
  quoteNote = '';
  isUploadingQuote = signal(false);

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
    this.crmService.getDocuments(dealId).subscribe(docs => {
      const all = docs as any[];
      this.quoteDocuments.set(all.filter(doc => doc.doc_kind === 'cotizacion'));
      this.documents.set(all.filter(doc => doc.doc_kind !== 'cotizacion'));
    });
    if (!this.isConcesionaria()) {
      this.http.get<any[]>(`${environment.apiUrl}/crm/deals/${dealId}/client-documents`).subscribe(docs => {
        const parsedDocs = docs.map(d => {
          if (typeof d.extracted_data === 'string') {
            try { d.extracted_data = JSON.parse(d.extracted_data); } catch(e) {}
          }
          return d;
        });
        this.clientDocuments.set(parsedDocs);
      });
    } else {
      this.clientDocuments.set([]);
    }
  }

  uploadDocument(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const d = this.deal();
    if (!d) return;

    this.isUploading.set(true);
    this.uploadService.uploadDocument(file).subscribe({
      next: (res) => {
        this.crmService.addDocument(d.id, {
          fileName: res.fileName || file.name,
          fileUrl: res.url,
          docKind: 'attachment',
        }).subscribe({
          next: () => {
            this.loadDocuments(d.id);
            this.isUploading.set(false);
            this.updated.emit();
          },
          error: (e) => {
            this.toast.error(e.error?.error || 'Error al guardar el documento');
            this.isUploading.set(false);
          },
        });
      },
      error: (e) => {
        this.toast.error(e.error?.error || 'Error al subir el documento');
        this.isUploading.set(false);
      },
    });
  }

  uploadQuotePdf(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const d = this.deal();
    if (!d) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.toast.error('Solo se permiten archivos PDF');
      input.value = '';
      return;
    }

    this.isUploadingQuote.set(true);
    this.uploadService.uploadDocument(file).subscribe({
      next: (res) => {
        this.crmService.addDocument(d.id, {
          fileName: res.fileName || file.name,
          fileUrl: res.url,
          notes: this.quoteNote.trim() || undefined,
          docKind: 'cotizacion',
        }).subscribe({
          next: () => {
            this.quoteNote = '';
            this.loadDocuments(d.id);
            this.isUploadingQuote.set(false);
            this.updated.emit();
            this.toast.success('PDF subido');
            input.value = '';
          },
          error: (e) => {
            this.toast.error(e.error?.error || 'Error al guardar el PDF');
            this.isUploadingQuote.set(false);
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.toast.error(e.error?.error || 'Error al subir el PDF');
        this.isUploadingQuote.set(false);
        input.value = '';
      },
    });
  }

  downloadDocument(doc: { file_url: string; file_name: string }) {
    const a = document.createElement('a');
    a.href = doc.file_url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = doc.file_name || 'cotizacion.pdf';
    a.click();
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
