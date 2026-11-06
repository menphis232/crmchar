import { Component, input, output, signal, computed, effect, inject, NgZone, OnDestroy, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, UpperCasePipe, JsonPipe, KeyValuePipe } from '@angular/common';
import {
  LucideCircle,
  LucideCircleCheck,
  LucideCreditCard,
  LucideHourglass,
  LucideMail,
  LucideMessageCircle,
  LucidePaperclip,
  LucidePhone,
  LucidePlus,
  LucideSend,
  LucideSparkles,
  LucideTimer,
  LucideUser,
  LucideX,
  LucideTrash2,
  LucideBanknote,
} from '@lucide/angular';
import { CrmService, FinancesService, MpService, UploadService, CHAT_ATTACHMENT_ACCEPT } from '../../core/api.service';
import { CrmDeal, LOST_REASONS, MessageTemplate, CrmTeamMember, PeritoAssignOption } from '../../models';
import { SocketService } from '../../core/socket.service';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import {
  QuoteCheckItem,
  checklistFromApi,
  checklistFromTexts,
  checklistToPayload,
  nextChecklistId,
  resetChecklistSeq,
} from '../../shared/quote-checklist.utils';
import { isDealPaymentLocked, isPaidDealBackwardMoveBlocked, isCompletedStage, isShippedStage, CrmStageConfig } from '../../shared/payment-stage.utils';
import { parseFinPaymentMethods, FinPaymentMethodOption } from '../../shared/fin-payment-methods.utils';
import { PERITO_STAGE_LABELS, PeritoStageId } from '../../shared/perito-stages';

@Component({
  selector: 'app-crm-deal-panel',
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe, UpperCasePipe, JsonPipe, KeyValuePipe, LucideX, LucideTrash2, LucideUser, LucideMail, LucidePhone, LucideMessageCircle, LucideTimer, LucideCircleCheck, LucideHourglass, LucideCreditCard, LucideSparkles, LucidePlus, LucideSend, LucidePaperclip, LucideBanknote],
  templateUrl: './crm-deal-panel.component.html',
  styleUrl: './panel-dashboard.css',
  styles: [`
    /* ══ DEAL PANEL — Monday light (Operate) ══ */
    :host {
      --mon-bg: #f6f7fb;
      --mon-surface: #ffffff;
      --mon-border: #e6e9ef;
      --mon-text: #323338;
      --mon-muted: #676879;
      --mon-primary: #0073ea;
      --brand-black: #323338;
      --brand-white: #ffffff;
      --surface: #ffffff;
      --surface-hover: #f5f6f8;
      --surface-2: #f6f7fb;
      --border: #e6e9ef;
      --border-hover: #c5c7d0;
      --text: #323338;
      --muted: #676879;
      --mx-white: #323338;
      --gold: #0073ea;
      --gold-glow: rgba(0, 115, 234, 0.12);
      --gold-dim: rgba(0, 115, 234, 0.08);
      --brand-grey: #676879;
      --shadow-card: 0 1px 2px rgba(50, 51, 56, 0.06);
      --btn-primary-bg: #0073ea;
      --btn-primary-color: #fff;
      --btn-primary-border: #0073ea;
      --btn-primary-hover-bg: #0060c2;
      --btn-primary-hover-color: #fff;
      --btn-primary-hover-border: #0060c2;
      --btn-outline-bg: #fff;
      --btn-outline-color: #323338;
      --btn-outline-border: #c5c7d0;
      --btn-outline-hover-bg: #f5f6f8;
      --btn-outline-hover-color: #323338;
      --btn-outline-hover-border: #c5c7d0;
      color-scheme: light;
    }

    /* Página dentro del container (NO modal / NO overlay fijo) */
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }
    .deal-page {
      display: block;
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      padding: 0 0 48px;
      box-sizing: border-box;
    }
    .deal-page-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 0 0 12px;
    }
    .deal-back-btn {
      border: none;
      background: transparent;
      color: #0073ea;
      font-family: 'Figtree', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 0;
    }
    .deal-back-btn:hover { text-decoration: underline; }

    /* Panel — Monday light, flujo normal (scroll de la página) */
    .deal-panel {
      position: static !important;
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
      max-height: none !important;
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      color: #323338 !important;
      overflow: visible !important;
      display: block !important;
      animation: none !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      padding: 0 !important;
    }
    .deal-panel-body {
      background: transparent !important;
      color: #323338 !important;
      overflow: visible !important;
      flex: none !important;
      height: auto !important;
      max-height: none !important;
      padding: 8px 0 0 !important;
    }
    .deal-section { background: transparent !important; border-bottom: 1px solid #e6e9ef !important; }
    .deal-subsection { background: #fff !important; border: 1px solid #e6e9ef !important; border-radius: 12px !important; margin-bottom: 8px !important; }
    .deal-subsection--ocr { background: #fff !important; border-color: #e6e9ef !important; }
    .deal-subsection--ocr h4 { color: #676879 !important; }

    /* Header */
    .deal-panel-header {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
      padding: 18px 20px !important;
      gap: 12px;
      margin-bottom: 12px;
    }
    .deal-panel-header h3 {
      color: #323338 !important;
      font-family: var(--f-ui, system-ui), sans-serif !important;
      font-size: 18px !important;
      font-weight: 650 !important;
      letter-spacing: 0.01em !important;
    }
    .deal-header-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .deal-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid #e6e9ef;
      color: #323338;
      background: #f5f6f8;
    }
    .deal-chip--paid { border-color: #00c875; color: #fff; background: #00c875; }
    .deal-chip--pending { color: #676879; background: #f5f6f8; }

    .deal-tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 8px;
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      margin-bottom: 12px;
      scrollbar-width: none;
    }
    .deal-tabs::-webkit-scrollbar { display: none; }
    .deal-tab {
      flex: 0 0 auto;
      border: 1px solid transparent;
      background: transparent;
      color: #676879;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .deal-tab:hover { color: #323338; background: #f5f6f8; }
    .deal-tab.active {
      background: #0073ea !important;
      color: #fff !important;
      -webkit-text-fill-color: #fff !important;
    }
    .deal-tab-hint {
      margin: 0 0 16px;
      color: #676879;
      font-size: 13px;
      line-height: 1.45;
    }
    .deal-quick-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .deal-panel-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
    .deal-panel-delete,
    .deal-panel-close {
      background: #fff !important;
      border: 1px solid #c5c7d0 !important;
      color: #676879 !important;
      border-radius: 8px !important;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      cursor: pointer;
    }
    .deal-panel-delete:hover {
      background: #fde8ea !important;
      border-color: #e2445c !important;
      color: #e2445c !important;
    }
    .deal-panel-close:hover {
      background: #f5f6f8 !important;
      border-color: #c5c7d0 !important;
      color: #323338 !important;
    }

    /* Sections */
    .deal-section { border-bottom: 1px solid #e6e9ef !important; padding: 18px 0 !important; }
    .deal-section h4 {
      color: #676879 !important;
      -webkit-text-fill-color: #676879 !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 12px !important;
      letter-spacing: 0.04em !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      margin: 0 0 10px !important;
    }
    .deal-section h4::before { display: none !important; }
    .deal-section label,
    .deal-panel label:not(.deal-outline-btn) {
      color: #676879 !important;
      -webkit-text-fill-color: #676879 !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      letter-spacing: 0.02em !important;
    }

    /* Contact card — Monday surface */
    .deal-contact-card {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
      padding: 18px 20px !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important;
      box-shadow: 0 1px 2px rgba(50, 51, 56, 0.04) !important;
    }
    .deal-contact-card .link-name,
    .deal-contact-card .deal-contact-name,
    .deal-contact-card strong {
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 20px !important;
      font-weight: 700 !important;
      letter-spacing: -0.02em !important;
      text-transform: none !important;
      text-decoration: none !important;
      background: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 0 4px !important;
      cursor: pointer !important;
      line-height: 1.25 !important;
      text-align: left !important;
    }
    .deal-contact-card .link-name:hover {
      color: #0073ea !important;
      -webkit-text-fill-color: #0073ea !important;
      text-decoration: none !important;
    }
    .deal-contact-card p,
    .deal-contact-card .deal-meta-with-icon {
      color: #676879 !important;
      -webkit-text-fill-color: #676879 !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 14px !important;
      letter-spacing: 0 !important;
      margin: 0 !important;
      line-height: 1.45 !important;
    }
    .deal-contact-card .btn-copy.small {
      margin-top: 8px !important;
      align-self: flex-start !important;
      background: #fff !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border: 1px solid #c5c7d0 !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      padding: 8px 14px !important;
      border-radius: 8px !important;
    }
    .deal-contact-card .btn-copy.small:hover {
      background: #e5f4ff !important;
      color: #0073ea !important;
      -webkit-text-fill-color: #0073ea !important;
      border-color: #0073ea !important;
    }
    .deal-contact-card .deal-outline-btn,
    .deal-panel .deal-outline-btn,
    label.deal-outline-btn,
    button.deal-outline-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      padding: 9px 14px !important;
      background: #fff !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border: 1px solid #c5c7d0 !important;
      border-radius: 8px !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      letter-spacing: 0 !important;
      text-transform: none !important;
      cursor: pointer !important;
    }
    .deal-outline-btn:hover {
      background: #f5f6f8 !important;
      border-color: #0073ea !important;
      color: #0073ea !important;
      -webkit-text-fill-color: #0073ea !important;
    }

    /* Selects — Monday light */
    .deal-panel select,
    .deal-section select {
      color-scheme: light !important;
      background-color: #fff !important;
      background: #fff !important;
      border: 1px solid #c5c7d0 !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 8px !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      padding: 10px 12px !important;
      width: 100% !important;
      cursor: pointer !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      box-sizing: border-box !important;
      box-shadow: none !important;
      min-height: 40px !important;
    }
    .deal-panel select:focus,
    .deal-section select:focus {
      border-color: #0073ea !important;
      outline: none !important;
      background-color: #fff !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.16) !important;
    }
    .deal-panel select option,
    .deal-section select option {
      background: #fff !important;
      color: #323338 !important;
    }

    /* Inputs / textarea */
    .deal-panel input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),
    .deal-section input:not([type="checkbox"]):not([type="radio"]):not([type="color"]):not([type="file"]):not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]),
    .deal-panel textarea,
    .deal-section textarea {
      background: #fff !important;
      border: 1px solid #c5c7d0 !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      caret-color: #0073ea !important;
      border-radius: 8px !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 14px !important;
      color-scheme: light !important;
      width: 100% !important;
      box-sizing: border-box !important;
      min-height: 40px !important;
    }
    .deal-panel input::placeholder,
    .deal-panel textarea::placeholder,
    .deal-section input::placeholder,
    .deal-section textarea::placeholder {
      color: #9ca0ad !important;
      -webkit-text-fill-color: #9ca0ad !important;
      opacity: 1;
    }
    .deal-panel input:focus,
    .deal-panel textarea:focus,
    .deal-section input:focus,
    .deal-section textarea:focus {
      border-color: #0073ea !important;
      box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.16) !important;
      outline: none !important;
      background: #fff !important;
    }

    /* Botones — heredan variables del panel padre */
    .btn-copy,
    .btn-ghost {
      font-family: var(--f-display) !important;
      border-radius: var(--btn-radius, 4px) !important;
      background: var(--btn-primary-bg, transparent) !important;
      color: var(--btn-primary-color, #fff) !important;
      border: var(--btn-border-w, 1px) solid var(--btn-primary-border, #fff) !important;
    }
    .btn-copy:hover {
      background: var(--btn-primary-hover-bg, #fff) !important;
      color: var(--btn-primary-hover-color, #000) !important;
      border-color: var(--btn-primary-hover-border, #fff) !important;
    }
    .btn-ghost {
      background: var(--btn-outline-bg, transparent) !important;
      color: var(--btn-outline-color, #fff) !important;
      border-color: var(--btn-outline-border, #fff) !important;
    }
    .btn-ghost:hover {
      background: var(--btn-outline-hover-bg, #fff) !important;
      color: var(--btn-outline-hover-color, #000) !important;
      border-color: var(--btn-outline-hover-border, #fff) !important;
    }
    .btn-delete { border-radius: var(--btn-radius, 4px) !important; font-family: var(--f-display) !important; }

    /* Card desc + general */
    .card-desc { color: #676879 !important; font-family: var(--f-display) !important; font-size: 13px !important; }
    .section-sub { color: #323338 !important; font-family: 'Figtree', system-ui, sans-serif !important; font-size: 15px !important; }
    .divider { border-color: #e6e9ef !important; }
    .inquiry-msg,
    .deal-panel .inquiry-msg {
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 10px !important;
      padding: 12px 14px !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 14px !important;
      font-style: italic !important;
      line-height: 1.5 !important;
      margin: 8px 0 !important;
    }
    .reply-msg { color: #4ade80 !important; font-family: var(--f-display) !important; }

    /* Activity */
    .activity-item {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 10px !important;
      margin-bottom: 8px !important;
      padding: 10px 14px !important;
    }
    .activity-item:hover { background: #f8fbff !important; border-color: #c9d4e4 !important; }
    .activity-item p { color: #323338 !important; font-family: 'Figtree', system-ui, sans-serif !important; font-size: 13px !important; }
    .activity-item small { color: #9ca0ad !important; font-family: 'Figtree', system-ui, sans-serif !important; }
    .activity-type { color: #676879 !important; font-family: 'Figtree', system-ui, sans-serif !important; font-size: 10px !important; letter-spacing: 0.08em !important; text-transform: uppercase !important; }

    /* Chat */
    .deal-chat {
      height: min(420px, 55vh) !important;
      min-height: 280px !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      border: 1px solid #e6e9ef !important;
      background: #fff !important;
    }
    .chat-container { background: #fff !important; border-radius: 12px !important; }
    .deal-panel .chat-messages {
      background: #f8f9fb !important;
      overflow-y: auto !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
    }

    /* Mensajes del cliente */
    .deal-panel .message {
      background: #f0f1f5 !important;
      border: 1px solid #e6e9ef !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 10px !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
      font-size: 13px !important;
    }
    .deal-panel .message.own {
      background: #e5f4ff !important;
      border-color: #b6d9f7 !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      align-self: flex-end !important;
    }

    /* Chat input bar */
    .deal-panel .chat-input {
      background: #fff !important;
      border-top: 1px solid #e6e9ef !important;
      padding: 8px !important;
    }
    .deal-panel .chat-input input[type="text"] {
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 8px !important;
      font-family: var(--f-display) !important;
    }

    /* Template chips */
    .template-chips .chip {
      background: #fff !important;
      border: 1px solid #c5c7d0 !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 8px !important;
      font-family: 'Figtree', system-ui, sans-serif !important;
    }
    .template-chips .chip:hover { background: #e5f4ff !important; color: #0073ea !important; border-color: #0073ea !important; }

    /* Tasks */
    .task-row { background: #fff !important; border: 1px solid #e6e9ef !important; border-radius: 8px !important; color: #323338 !important; font-family: 'Figtree', system-ui, sans-serif !important; }
    .task-row .done { color: #9ca0ad !important; }

    /* Status / chips */
    .chip { border-radius: 999px !important; font-family: var(--f-display) !important; }
    .status-badge { border-radius: 999px !important; }
    .status-tag  { border-radius: 999px !important; }

    /* Payment */
    .deal-payment-box {
      margin-top: 16px !important;
      padding: 18px 20px !important;
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
      border-top: 1px solid #e6e9ef !important;
      color: #323338 !important;
    }
    .deal-payment-status {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 14px !important;
      font-family: var(--f-display) !important;
    }
    .deal-payment-lock-note {
      margin: 8px 0 0;
      font-size: 12px;
      color: #fbbf24;
      line-height: 1.45;
    }
    .register-payment-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
    }
    .register-payment-form label {
      font-size: 11px;
      color: #676879;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }
    .register-payment-form input,
    .register-payment-form select,
    .register-payment-form textarea {
      width: 100%;
      box-sizing: border-box;
      background: #fff !important;
      border: 1px solid #c5c7d0 !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border-radius: 8px;
      padding: 10px 12px;
      color-scheme: light !important;
    }
    .register-payment-form select {
      color-scheme: light !important;
      cursor: pointer;
    }
    .register-payment-form select option {
      background: #fff;
      color: #323338;
    }
    .register-payment-form input[type="date"] {
      color-scheme: light !important;
    }
    .register-payment-hint {
      margin: -4px 0 0;
      font-size: 12px;
      line-height: 1.4;
      color: #676879;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
    }
    .register-payment-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
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
    .deal-payment-status .btn-ghost.small,
    .deal-payment-status .btn-copy.small {
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
      background: #e6e9ef !important;
      color: #323338 !important;
      border-color: #676879 !important;
    }
    .deal-payment-link-box {
      margin-top: 14px !important;
      padding: 14px 16px !important;
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
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
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
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
    .deal-payment-watching {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #676879;
      font-family: var(--f-display);
    }
    .deal-payment-watching-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #c8a94a;
      animation: payPulse 1.4s ease-in-out infinite;
    }
    @keyframes payPulse {
      0%, 100% { opacity: 0.35; transform: scale(0.85); }
      50% { opacity: 1; transform: scale(1); }
    }

    /* Modal selector de pasarela */
    .pay-method-overlay {
      position: fixed;
      inset: 0;
      z-index: 12000;
      background: rgba(0,0,0,0.82);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .pay-method-modal {
      position: relative;
      width: min(440px, 100%);
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 20px;
      padding: 28px 24px 22px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.65);
      font-family: var(--f-display);
    }
    .pay-method-close {
      position: absolute;
      top: 14px;
      right: 14px;
      background: transparent;
      border: none;
      color: #676879;
      cursor: pointer;
      padding: 6px;
    }
    .pay-method-close:hover { color: #fff; }
    .pay-method-eyebrow {
      margin: 0 0 6px;
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #9ca0ad;
    }
    .pay-method-title {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      color: #fff;
    }
    .pay-method-desc {
      margin: 0 0 22px;
      font-size: 13px;
      line-height: 1.55;
      color: rgba(255,255,255,0.50);
    }
    .pay-method-grid {
      display: grid;
      gap: 12px;
    }
    .pay-method-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      text-align: left;
      padding: 16px 18px;
      border-radius: 14px;
      border: 1px solid #e6e9ef;
      background: #fff;
      color: #323338;
      cursor: pointer;
      transition: border-color 0.2s, transform 0.15s, background 0.2s;
      font-family: 'Figtree', system-ui, sans-serif;
    }
    .pay-method-card:hover {
      transform: translateY(-1px);
      border-color: #0073ea;
      background: #f8fbff;
    }
    .pay-method-card strong {
      font-size: 15px;
      letter-spacing: 0.04em;
    }
    .pay-method-card span:last-child {
      font-size: 12px;
      color: #676879;
    }
    .pay-method-card-icon {
      font-size: 22px;
      margin-bottom: 4px;
    }
    .pay-method-card--stripe:hover { border-color: rgba(99,102,241,0.55); }
    .pay-method-card--mp:hover { border-color: rgba(0,158,227,0.55); }
    .pay-method-cancel {
      width: 100%;
      margin-top: 16px;
      padding: 12px;
      background: transparent;
      border: 1px solid #e6e9ef;
      border-radius: 999px;
      color: #676879;
      font-family: var(--f-display);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .pay-method-cancel:hover {
      color: #fff;
      border-color: rgba(255,255,255,0.3);
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
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
      border: 1px solid #9ca0ad !important;
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
      background: #e6e9ef !important;
      border-color: rgba(255,255,255,0.60) !important;
      color: #323338 !important;
      -webkit-text-fill-color: #323338 !important;
    }
    .deal-outline-btn.disabled,
    label.deal-outline-btn.disabled {
      opacity: 0.45;
      pointer-events: none;
    }
    .quote-doc-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 0; }
    .quote-doc-item {
      display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      background: #fff !important; border: 1px solid #e6e9ef !important;
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
      color: #9ca0ad !important;
      cursor: pointer !important;
      padding: 8px 4px !important;
      font-size: 14px !important;
      line-height: 1 !important;
    }
    .deal-doc-delete:hover { color: #ff6b6b !important; }

    .deal-quote-upload {
      padding: 18px 20px !important;
      margin: 8px 0 4px !important;
      background: #fff !important;
      border: 1px solid #e6e9ef !important;
      border-radius: 12px !important;
    }
    .deal-quote-upload h4 {
      margin: 0 0 8px !important;
      color: #676879 !important;
    }
    .deal-quote-upload .card-desc {
      margin: 0 0 16px !important;
      line-height: 1.5 !important;
      color: #676879 !important;
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
      color: #676879 !important;
    }
    .quote-upload-form {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-top: 4px;
    }

    .deal-doc-item { background: #fff !important; border: 1px solid #e6e9ef !important; border-radius: 10px !important; }
    .deal-doc-item-top { background: transparent !important; }

    .quote-upload-form { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }

    .quote-editor-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    @media (max-width: 640px) {
      .quote-editor-grid { grid-template-columns: 1fr; }
    }
    .quote-editor-grid .form-group { margin: 0; }
    .quote-editor-grid label {
      display: block;
      margin-bottom: 4px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .quote-editor-grid input {
      width: 100%;
      box-sizing: border-box;
    }
    .quote-items-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 16px 0 10px;
    }
    .quote-items-header h5 {
      margin: 0;
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #676879;
    }
    .quote-item-row {
      display: grid;
      grid-template-columns: 1fr 120px 36px;
      gap: 8px;
      margin-bottom: 8px;
      align-items: center;
    }
    @media (max-width: 640px) {
      .quote-item-row { grid-template-columns: 1fr; }
    }
    .quote-item-row input { width: 100%; box-sizing: border-box; }
    .quote-item-remove {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(255,255,255,0.15);
      background: transparent;
      color: rgba(255,255,255,0.6);
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .quote-item-remove:hover { border-color: rgba(255,100,100,0.5); color: #ff8a8a; }
    .quote-total-row {
      margin: 14px 0;
      padding: 12px 14px;
      border: 1px solid rgba(200,169,74,0.25);
      border-radius: 10px;
      background: rgba(200,169,74,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .quote-total-row strong { color: var(--gold); font-size: 15px; }
    .quote-editor-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .quote-checklist-block {
      margin-bottom: 18px;
      padding: 14px 16px;
      background: #f6f7fb;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
    }
    .quote-checklist-block h5 {
      margin: 0 0 10px;
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #676879;
    }
    .quote-checklist-row {
      display: grid;
      grid-template-columns: 24px 1fr 36px;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .quote-checklist-row input[type="checkbox"] {
      width: 16px;
      height: 16px;
      accent-color: #c8a94a;
      cursor: pointer;
    }
    .quote-checklist-row input[type="text"] {
      width: 100%;
      box-sizing: border-box;
    }
    .quote-checklist-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }

    /* Upload area */
    .deal-upload-area { background: #fff !important; border-color: #e6e9ef !important; }

    /* Typography catch-all — Monday light */
    p      { color: #676879 !important; font-family: 'Figtree', system-ui, sans-serif !important; }
    strong { color: #323338 !important; font-family: 'Figtree', system-ui, sans-serif !important; }
    h4     { color: #676879 !important; font-family: 'Figtree', system-ui, sans-serif !important; font-size: 12px !important; letter-spacing: 0.04em !important; text-transform: uppercase !important; font-weight: 700 !important; }
    label:not(.deal-outline-btn) { color: #676879 !important; -webkit-text-fill-color: #676879 !important; font-family: 'Figtree', system-ui, sans-serif !important; font-size: 12px !important; letter-spacing: 0.02em !important; font-weight: 600 !important; }
    small  { color: #9ca0ad !important; font-family: 'Figtree', system-ui, sans-serif !important; }
    .deal-delivery-section {
      border: 1px solid #b7ebc6;
      background: #f0fdf4;
      border-radius: 12px;
      padding: 14px;
    }
    .deal-delivery-section-head h4 {
      margin: 0 0 6px !important;
      color: #15803d !important;
      font-size: 12px !important;
    }
    .deal-delivery-desc { margin: 0 0 12px !important; color: #676879 !important; }
    .deal-delivery-list { margin-top: 12px; }
    .deal-shipping-section {
      border: 1px solid #bfdbfe;
      background: #eff6ff;
      border-radius: 12px;
      padding: 14px;
    }
    .deal-shipping-section-head h4 {
      margin: 0 0 6px !important;
      color: #1d4ed8 !important;
      font-size: 12px !important;
    }
    .deal-shipping-desc { margin: 0 0 12px !important; color: #676879 !important; }
    .deal-shipping-list { margin-top: 12px; }
    .deal-delivery-upload-zone {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 16px 0;
      padding: 28px 20px;
      border: 1px dashed #c5c7d0;
      border-radius: 12px;
      cursor: pointer;
      text-align: center;
      color: #323338;
      background: #fff;
      transition: border-color 0.2s, background 0.2s;
    }
    .deal-delivery-upload-zone:hover { border-color: #0073ea; background: #f8fbff; }
    .deal-delivery-upload-zone.loading { opacity: 0.6; pointer-events: none; }
    .deal-delivery-upload-zone span { font-size: 12px; color: #676879; }
    a      { color: #0073ea !important; }
  `],
})
export class CrmDealPanelComponent implements OnDestroy {
  dealId = input<string | null>(null);
  promptDeliveryUpload = input(false);
  promptShippingUpload = input(false);
  stages = input<string[]>([]);
  stageLabels = input<Record<string, string>>({});
  stagesConfig = input<CrmStageConfig[]>([]);
  templates = input<MessageTemplate[]>([]);
  showReply = input(false);
  whatsappNumber = input('');
  isConcesionaria = input(false);

  closed = output<void>();
  updated = output<void>();
  deleted = output<void>();
  openContact = output<string>();
  deliveryUploadDismissed = output<void>();
  shippingUploadDismissed = output<void>();

  deal = signal<CrmDeal | null>(null);
  teamMembers = signal<CrmTeamMember[]>([]);
  peritoMembers = signal<PeritoAssignOption[]>([]);
  isOwner = computed(() => !this.auth.user()?.parent_id);
  assignedToModel = '';
  peritoIdModel = '';
  noteText = '';
  replyText = '';
  estimatedValue = 0;
  internalNotes = '';
  lostReason = '';
  taskTitle = '';
  taskDue = '';
  lostReasons = LOST_REASONS;

  quoteId: string | null = null;
  quoteClientName = '';
  quoteClientEmail = '';
  quoteClientPhone = '';
  quoteDealTitle = '';
  quoteValidUntil = '';
  quoteHonorarios = 0;
  quoteIncludes: QuoteCheckItem[] = [];
  quoteRequirements: QuoteCheckItem[] = [];
  quoteBonus: QuoteCheckItem[] = [];
  isSavingQuote = signal(false);
  isLoadingQuote = signal(false);
  quoteOpen = signal(false);
  /** Pestañas CRM: evita el scroll infinito que confunde al gestor. */
  dealView = signal<'resumen' | 'cotizacion' | 'chat' | 'docs' | 'seguimiento'>('resumen');
  isSendingQuote = signal(false);

  setDealView(view: 'resumen' | 'cotizacion' | 'chat' | 'docs' | 'seguimiento') {
    this.dealView.set(view);
    if (view === 'cotizacion') this.quoteOpen.set(true);
  }
  isCreatingAccess = signal(false);
  clientAccessNotice = signal<{
    created: boolean;
    login: string;
    password?: string | null;
    emailed?: boolean;
    whatsappUrl?: string | null;
  } | null>(null);
  private quoteOpenDealId: string | null = null;
  isDownloadingQuote = signal(false);

  isGeneratingPayment = signal(false);
  isWatchingPayment = signal(false);
  paymentMethodModalOpen = signal(false);
  paymentProviders = signal<{ stripe: boolean; mercadopago: boolean } | null>(null);
  registerPaymentModalOpen = signal(false);
  deliveryUploadModalOpen = signal(false);
  shippingUploadModalOpen = signal(false);
  isUploadingDelivery = signal(false);
  isUploadingShipping = signal(false);
  isRegisteringPayment = signal(false);
  manualPaymentAmount = 0;
  manualPaymentMethod = 'efectivo';
  manualPaymentDate = '';
  manualPaymentNotes = '';
  manualPaymentMethods = signal<FinPaymentMethodOption[]>([]);

  private paymentMethodResolver: ((v: 'stripe' | 'mercadopago' | null) => void) | null = null;
  private paymentWatchInterval: ReturnType<typeof setInterval> | null = null;
  private paymentWatchDealId: string | null = null;
  private onDealPaymentPaid = (payload: unknown) => {
    const data = payload as { dealId?: string; paymentStatus?: string; stage?: string };
    this.zone.run(() => {
      if (data.dealId !== this.dealId()) return;
      this.toast.success('El pago fue acreditado correctamente.', '¡Pagado!');
      this.stopPaymentWatch();
      this.refreshDealPaymentState(true);
    });
  };

  peritoStageLabel(stage: string | null | undefined): string {
    return PERITO_STAGE_LABELS[(stage || 'tramite') as PeritoStageId] || 'Trámite';
  }

  private onPeritoUpdate = (payload: unknown) => {
    const data = payload as { type?: string; ref_id?: string };
    if (data.type !== 'perito_update') return;
    this.zone.run(() => {
      const d = this.deal();
      if (!d || data.ref_id !== d.id) return;
      this.loadDeal(d.id);
    });
  };

  // Chat cliente
  messages: any[] = [];
  newMessage = '';
  // Chat perito (staff)
  staffMessages: any[] = [];
  newStaffMessage = '';
  private joinedDealId: string | null = null;
  private onReceiveMessage = (msg: any) => {
    this.zone.run(() => {
      if (!(this.deal() && msg.dealId === this.deal()!.id)) return;
      const channel = msg.channel || 'client';
      if (channel === 'staff') {
        if (!this.staffMessages.some(m => m.id === msg.id)) {
          this.staffMessages.push(msg);
          this.scrollStaffToBottom();
        }
        return;
      }
      if (!this.messages.some(m => m.id === msg.id)) {
        this.messages.push(msg);
        this.scrollToBottom();
      }
    });
  };

  auth = inject(AuthService);
  toast = inject(ToastService);
  private fin = inject(FinancesService);
  private socketService = inject(SocketService);

  constructor(private crmService: CrmService, private mpService: MpService, private http: HttpClient, private zone: NgZone) {
    effect(() => {
      const id = this.dealId();
      untracked(() => {
        if (id) this.loadDeal(id);
        else {
          this.deal.set(null);
          this.stopPaymentWatch();
        }
      });
    });
    effect(() => {
      if (!this.promptDeliveryUpload()) return;
      const d = this.deal();
      if (!d || !this.isDealCompleted()) return;
      this.deliveryUploadModalOpen.set(true);
      this.deliveryUploadDismissed.emit();
    });
    effect(() => {
      if (!this.promptShippingUpload()) return;
      const d = this.deal();
      if (!d || !this.isDealShipped()) return;
      this.shippingUploadModalOpen.set(true);
      this.shippingUploadDismissed.emit();
    });
  }

  private ensureSocket() {
    const user = this.auth.user();
    if (!user) return;
    this.socketService.connect(user.id, user.parent_id || user.id);
    this.socketService.off('receive_message', this.onReceiveMessage);
    this.socketService.on('receive_message', this.onReceiveMessage);
    this.socketService.off('deal_payment_paid', this.onDealPaymentPaid);
    this.socketService.on('deal_payment_paid', this.onDealPaymentPaid);
    this.socketService.off('notification', this.onPeritoUpdate);
    this.socketService.on('notification', this.onPeritoUpdate);
  }

  ngOnDestroy() {
    this.socketService.off('receive_message', this.onReceiveMessage);
    this.socketService.off('deal_payment_paid', this.onDealPaymentPaid);
    this.socketService.off('notification', this.onPeritoUpdate);
    this.stopPaymentWatch();
    if (this.joinedDealId) {
      this.socketService.emit('leave_deal', this.joinedDealId);
      this.joinedDealId = null;
    }
  }

  loadDeal(id: string) {
    if (this.isOwner() && !this.teamMembers().length) {
      this.crmService.getTeam().subscribe({
        next: (t) => this.teamMembers.set(t),
        error: () => {},
      });
    }
    if (this.isOwner() && !this.isConcesionaria() && !this.peritoMembers().length) {
      this.crmService.getPeritosForAssign().subscribe({
        next: (p) => this.peritoMembers.set(p),
        error: () => {},
      });
    }
    this.crmService.getDeal(id).subscribe(d => {
      this.deal.set(d);
      this.estimatedValue = d.estimatedValue || 0;
      this.internalNotes = d.internalNotes || '';
      this.lostReason = d.lostReason || '';
      this.assignedToModel = d.assignedTo || '';
      this.peritoIdModel = d.peritoId || '';
      if (this.quoteOpenDealId !== id) {
        this.quoteOpenDealId = id;
        this.dealView.set('resumen');
        this.quoteOpen.set(d.paymentStatus !== 'paid');
      }

      this.loadDocuments(id);
      this.loadMessages(id);
      if (d.paymentStatus === 'paid' || this.paymentWatchDealId !== id) {
        this.stopPaymentWatch();
      }
      if (!this.isConcesionaria()) {
        this.loadQuote(id);
        if (d.contact?.id) this.loadContactProfile(d.contact.id);
      }
    });
  }

  private loadContactProfile(contactId: string) {
    this.crmService.getContact(contactId).subscribe({
      next: (c360) => {
        const c = c360.contact;
        this.quoteClientName = c.name || '';
        this.quoteClientEmail = c.email || '';
        this.quoteClientPhone = c.phone || c.whatsapp || '';
      },
      error: () => {},
    });
  }

  private defaultValidUntil(): string {
    const d = new Date(Date.now() + 15 * 86400000);
    return d.toISOString().slice(0, 10);
  }

  private toDateInput(value?: string | null): string {
    if (!value) return this.defaultValidUntil();
    return value.slice(0, 10);
  }

  private toValidUntilDatetime(dateStr: string): string {
    const base = dateStr || this.defaultValidUntil();
    return `${base} 23:59:59`;
  }

  loadQuote(dealId: string) {
    this.isLoadingQuote.set(true);
    this.crmService.getQuotes(dealId).subscribe({
      next: (quotes) => {
        const d = this.deal();
        if (!d) return;
        if (quotes.length > 0) {
          const q = quotes[0];
          this.quoteId = q.id;
          this.quoteValidUntil = this.toDateInput(q.valid_until);
          resetChecklistSeq();
          this.quoteIncludes = checklistFromApi(q.includes_list);
          this.quoteRequirements = checklistFromApi(q.requirements_list);
          this.quoteBonus = checklistFromApi(q.bonus_list);
          if (!this.quoteIncludes.length && !this.quoteRequirements.length && !this.quoteBonus.length) {
            this.bootstrapQuoteChecklists(dealId, d);
            return;
          }
          this.quoteHonorarios = Number(q.total) || d.estimatedValue || 0;
          this.syncQuoteClientFromDeal(d);
          this.isLoadingQuote.set(false);
        } else {
          this.initQuoteFormFromDeal(d, dealId);
        }
      },
      error: () => {
        const d = this.deal();
        if (d) this.initQuoteFormFromDeal(d, dealId);
        this.isLoadingQuote.set(false);
      },
    });
  }

  private bootstrapQuoteChecklists(dealId: string, d: CrmDeal) {
    this.crmService.getQuoteBootstrap(dealId).subscribe({
      next: (boot) => {
        resetChecklistSeq();
        this.quoteIncludes = checklistFromApi(boot.defaults.includes);
        this.quoteRequirements = checklistFromApi(boot.defaults.requirements);
        this.quoteBonus = checklistFromApi(boot.defaults.bonus);
        this.quoteHonorarios = Number(boot.service?.price ?? d.estimatedValue ?? 0) || 0;
        this.syncQuoteClientFromDeal(d);
        this.isLoadingQuote.set(false);
      },
      error: () => {
        this.initQuoteFormFromDeal(d, dealId, true);
        this.isLoadingQuote.set(false);
      },
    });
  }

  private initQuoteFormFromDeal(d: CrmDeal, dealId?: string, skipBootstrap = false) {
    this.quoteId = null;
    this.quoteValidUntil = this.defaultValidUntil();
    resetChecklistSeq();
    this.quoteIncludes = [];
    this.quoteRequirements = [];
    this.quoteBonus = [];
    this.syncQuoteClientFromDeal(d);
    if (dealId && !skipBootstrap) {
      this.bootstrapQuoteChecklists(dealId, d);
      return;
    }
    this.isLoadingQuote.set(false);
  }

  private syncQuoteClientFromDeal(d: CrmDeal) {
    this.quoteClientName = d.contact?.name || '';
    this.quoteClientEmail = d.contact?.email || '';
    this.quoteClientPhone = d.contact?.phone || d.contact?.whatsapp || '';
    this.quoteDealTitle = d.title || '';
    if (!this.quoteHonorarios) {
      this.quoteHonorarios = d.estimatedValue || 0;
    }
  }

  addChecklistItem(section: 'includes' | 'requirements' | 'bonus') {
    const item: QuoteCheckItem = { id: nextChecklistId(section), text: '', checked: true };
    if (section === 'includes') this.quoteIncludes = [...this.quoteIncludes, item];
    if (section === 'requirements') this.quoteRequirements = [...this.quoteRequirements, item];
    if (section === 'bonus') this.quoteBonus = [...this.quoteBonus, item];
  }

  removeChecklistItem(section: 'includes' | 'requirements' | 'bonus', itemId: string) {
    if (section === 'includes') this.quoteIncludes = this.quoteIncludes.filter(i => i.id !== itemId);
    if (section === 'requirements') this.quoteRequirements = this.quoteRequirements.filter(i => i.id !== itemId);
    if (section === 'bonus') this.quoteBonus = this.quoteBonus.filter(i => i.id !== itemId);
  }

  quoteDisplayTotal(): number {
    return Number(this.quoteHonorarios) || 0;
  }

  private buildQuotePayload() {
    const total = this.quoteDisplayTotal();

    return {
      items: [],
      total,
      validUntil: this.toValidUntilDatetime(this.quoteValidUntil),
      dealTitle: this.quoteDealTitle.trim() || undefined,
      clientName: this.quoteClientName.trim() || undefined,
      clientEmail: this.quoteClientEmail.trim() || undefined,
      clientPhone: this.quoteClientPhone.trim() || undefined,
      estimatedValue: total,
      includesList: checklistToPayload(this.quoteIncludes),
      requirementsList: checklistToPayload(this.quoteRequirements),
      bonusList: checklistToPayload(this.quoteBonus),
    };
  }

  saveQuote() {
    const d = this.deal();
    if (!d) return;
    this.isSavingQuote.set(true);
    const payload = this.buildQuotePayload();

    const onSuccess = (quoteId: string) => {
      this.quoteId = quoteId;
      this.isSavingQuote.set(false);
      this.toast.success('Cotización guardada');
      this.loadDeal(d.id);
      this.updated.emit();
    };

    const onError = () => {
      this.isSavingQuote.set(false);
      this.toast.error('Error al guardar la cotización');
    };

    if (this.quoteId) {
      this.crmService.updateQuote(this.quoteId, payload).subscribe({
        next: () => onSuccess(this.quoteId!),
        error: onError,
      });
    } else {
      this.crmService.createQuote(d.id, payload).subscribe({
        next: (res) => onSuccess(res.id),
        error: onError,
      });
    }
  }

  sendQuoteToClient() {
    const d = this.deal();
    if (!d) return;
    this.isSendingQuote.set(true);
    const payload = this.buildQuotePayload();
    const deliver = (quoteId: string) => {
      this.quoteId = quoteId;
      this.crmService.sendQuote(quoteId).subscribe({
        next: (res) => {
          this.isSendingQuote.set(false);
          const parts = [];
          if (res.emailed) parts.push('correo');
          if (res.notified) parts.push('aviso en el portal');
          this.toast.success(parts.length ? `Cotización enviada por ${parts.join(' y ')}` : 'Cotización lista. Se abre WhatsApp para mandarla.');
          if (res.whatsappUrl) window.open(res.whatsappUrl, '_blank', 'noopener');
          this.loadMessages(d.id);
        },
        error: (e) => {
          this.isSendingQuote.set(false);
          this.toast.error(e.error?.error || 'No se pudo enviar la cotización');
        },
      });
    };
    const onError = () => {
      this.isSendingQuote.set(false);
      this.toast.error('Error al guardar la cotización');
    };
    if (this.quoteId) {
      this.crmService.updateQuote(this.quoteId, payload).subscribe({
        next: () => deliver(this.quoteId!),
        error: onError,
      });
    } else {
      this.crmService.createQuote(d.id, payload).subscribe({
        next: (res) => deliver(res.id),
        error: onError,
      });
    }
  }

  createClientAccess(reset = false) {
    const d = this.deal();
    if (!d) return;
    this.isCreatingAccess.set(true);
    this.crmService.createClientAccess(d.id, reset).subscribe({
      next: (access) => {
        this.isCreatingAccess.set(false);
        this.clientAccessNotice.set(access);
      },
      error: (e) => {
        this.isCreatingAccess.set(false);
        this.toast.error(e.error?.error || 'No se pudo crear el usuario');
      },
    });
  }

  copyClientAccess() {
    const access = this.clientAccessNotice();
    if (!access) return;
    const lines = [`Usuario: ${access.login}`];
    if (access.password) lines.push(`Contraseña: ${access.password}`);
    lines.push('Portal: https://central.tramitesvehicularesdemexico.com/login/cliente');
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Clave copiada'),
      () => this.toast.warning('No se pudo copiar. Anótala de la ventana.'),
    );
  }

  downloadGeneratedQuotePdf() {
    if (!this.quoteId) {
      this.toast.error('Guarda la cotización antes de generar el PDF');
      return;
    }
    this.isDownloadingQuote.set(true);
    this.crmService.downloadQuotePdf(this.quoteId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        this.isDownloadingQuote.set(false);
      },
      error: () => {
        this.isDownloadingQuote.set(false);
        this.toast.error('Error al generar el PDF');
      },
    });
  }

  loadMessages(id: string) {
    this.ensureSocket();
    this.http.get<any[]>(`${environment.apiUrl}/crm/deals/${id}/messages`).subscribe(res => {
      this.messages = res;
      if (this.joinedDealId && this.joinedDealId !== id) {
        this.socketService.emit('leave_deal', this.joinedDealId);
      }
      this.joinedDealId = id;
      this.socketService.emit('join_deal', id);
      this.scrollToBottom();
    });
    this.http.get<any[]>(`${environment.apiUrl}/crm/deals/${id}/staff-messages`).subscribe({
      next: (res) => {
        this.staffMessages = res;
        this.scrollStaffToBottom();
      },
      error: () => { this.staffMessages = []; },
    });
  }

  sendMessage() {
    if (!this.newMessage.trim()) return;
    const txt = this.newMessage;
    this.newMessage = '';
    this.postChatMessage(txt);
  }

  sendStaffMessage() {
    if (!this.newStaffMessage.trim()) return;
    const d = this.deal();
    if (!d?.peritoId) return;
    const txt = this.newStaffMessage.trim();
    this.newStaffMessage = '';
    this.http.post<any>(`${environment.apiUrl}/crm/deals/${d.id}/staff-messages`, { message: txt }).subscribe({
      next: (saved) => {
        if (!this.staffMessages.find(m => m.id === saved.id)) {
          this.staffMessages.push({ dealId: d.id, channel: 'staff', ...saved });
          this.scrollStaffToBottom();
        }
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al enviar mensaje al perito'),
    });
  }

  private postChatMessage(message: string, fileUrl?: string) {
    const d = this.deal();
    if (!d || !message.trim()) return;
    this.http.post<any>(`${environment.apiUrl}/crm/deals/${d.id}/messages`, {
      message: message.trim(),
      fileUrl: fileUrl || undefined,
    }).subscribe({
      next: saved => {
        if (!this.messages.find(m => m.id === saved.id)) {
          this.messages.push({ dealId: d.id, ...saved });
          this.scrollToBottom();
        }
        this.socketService.emit('send_message', { dealId: d.id, ...saved });
        if (saved.notified === false) {
          this.toast.warning('El mensaje quedó en el chat. Crea el usuario del cliente para que le llegue el aviso al teléfono.');
        }
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al enviar mensaje al chat'),
    });
  }

  onChatFileSelected(event: Event) {
    const d = this.deal();
    if (!d) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadService.uploadChatAttachment(file).subscribe({
      next: res => {
        const message = /\.(pdf|docx?|xlsx?)$/i.test(file.name)
          ? `Documento adjunto: ${file.name}`
          : 'He subido un documento.';
        this.http.post<any>(`${environment.apiUrl}/crm/deals/${d.id}/messages`, { message, fileUrl: res.url }).subscribe(saved => {
          if (!this.messages.find(m => m.id === saved.id)) {
            this.messages.push({ dealId: d.id, ...saved });
            this.scrollToBottom();
          }
          this.socketService.emit('send_message', { dealId: d.id, ...saved });
          input.value = '';
        });
      },
      error: (e) => {
        this.toast.error(e.error?.error || 'Error al subir archivo');
        input.value = '';
      },
    });
  }

  scrollStaffToBottom() {
    setTimeout(() => {
      const el = document.getElementById('gestor-staff-chat-box');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
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
    if (this.isPaymentLocked()) {
      this.toast.warning('Registra el pago antes de mover este trámite de la etapa Pago.', 'Pago pendiente');
      return;
    }
    const stagesConfig = this.stagesConfig().length ? this.stagesConfig() : this.stageLabels();
    if (isPaidDealBackwardMoveBlocked(d, stagesConfig, stage)) {
      this.toast.warning('Los trámites ya pagados solo pueden avanzar, no retroceder en el embudo.', 'Solo hacia adelante');
      return;
    }
    if (stage === 'perdido' && !this.lostReason) {
      this.deal.update(cur => (cur ? { ...cur, stage } : cur));
      return;
    }
    const payload: { stage: string; lostReason?: string } = { stage };
    if (stage === 'perdido') payload.lostReason = this.lostReason;
    this.crmService.updateDeal(d.id, payload).subscribe({
      next: () => {
        this.loadDeal(d.id);
        this.updated.emit();
        if (isShippedStage(stage, stagesConfig)) {
          this.shippingUploadModalOpen.set(true);
        }
        if (isCompletedStage(stage, stagesConfig)) {
          this.deliveryUploadModalOpen.set(true);
        }
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al cambiar etapa'),
    });
  }

  isDealCompleted(): boolean {
    const d = this.deal();
    if (!d?.stage) return false;

    const config = this.stagesConfig();
    if (config.length && isCompletedStage(d.stage, config)) return true;
    if (isCompletedStage(d.stage, this.stageLabels())) return true;

    const stageIds = this.stages().filter((s) => s !== 'perdido');
    if (stageIds.length && stageIds[stageIds.length - 1] === d.stage) return true;

    const configCols = config.filter((s) => s.id !== 'perdido');
    if (configCols.length && configCols[configCols.length - 1].id === d.stage) return true;

    return false;
  }

  isDealShipped(): boolean {
    const d = this.deal();
    if (!d?.stage) return false;
    const config = this.stagesConfig();
    if (config.length && isShippedStage(d.stage, config)) return true;
    return isShippedStage(d.stage, this.stageLabels());
  }

  closeShippingUploadModal() {
    this.shippingUploadModalOpen.set(false);
    setTimeout(() => this.scrollToShippingSection(), 150);
  }

  private scrollToShippingSection() {
    const el = document.getElementById('deal-shipping-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  uploadShippingDocument(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const d = this.deal();
    if (!d) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Sube un PDF o una imagen (JPG, PNG, WebP).');
      input.value = '';
      return;
    }

    this.isUploadingShipping.set(true);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);
    upload$.subscribe({
      next: (res) => {
        this.crmService.addDocument(d.id, {
          fileName: file.name,
          fileUrl: res.url,
          docKind: 'envio',
        }).subscribe({
          next: () => {
            this.loadDocuments(d.id);
            this.isUploadingShipping.set(false);
            this.shippingUploadModalOpen.set(false);
            this.updated.emit();
            this.toast.success('Etiqueta publicada. El cliente ya puede descargar su guía.', 'Enviado');
            input.value = '';
          },
          error: (e) => {
            this.toast.error(e.error?.error || 'Error al guardar la etiqueta');
            this.isUploadingShipping.set(false);
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.toast.error(e.error?.error || 'Error al subir el archivo');
        this.isUploadingShipping.set(false);
        input.value = '';
      },
    });
  }

  closeDeliveryUploadModal() {
    this.deliveryUploadModalOpen.set(false);
    setTimeout(() => this.scrollToDeliverySection(), 150);
  }

  private scrollToDeliverySection() {
    const el = document.getElementById('deal-delivery-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  uploadDeliveryDocument(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const d = this.deal();
    if (!d) return;

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = file.type.startsWith('image/');
    if (!isPdf && !isImage) {
      this.toast.error('Sube un PDF o una imagen (JPG, PNG, WebP).');
      input.value = '';
      return;
    }

    this.isUploadingDelivery.set(true);
    const upload$ = isPdf ? this.uploadService.uploadDocument(file) : this.uploadService.uploadFile(file);
    upload$.subscribe({
      next: (res) => {
        this.crmService.addDocument(d.id, {
          fileName: file.name,
          fileUrl: res.url,
          docKind: 'entrega',
        }).subscribe({
          next: () => {
            this.loadDocuments(d.id);
            this.isUploadingDelivery.set(false);
            this.deliveryUploadModalOpen.set(false);
            this.updated.emit();
            this.toast.success('Archivo publicado. El cliente ya puede verlo en su panel.', 'Trámite completado');
            input.value = '';
          },
          error: (e) => {
            this.toast.error(e.error?.error || 'Error al guardar el archivo');
            this.isUploadingDelivery.set(false);
            input.value = '';
          },
        });
      },
      error: (e) => {
        this.toast.error(e.error?.error || 'Error al subir el archivo');
        this.isUploadingDelivery.set(false);
        input.value = '';
      },
    });
  }

  isPaymentLocked(): boolean {
    const d = this.deal();
    if (!d) return false;
    const config = this.stagesConfig();
    if (config.length) return isDealPaymentLocked(d, config);
    return isDealPaymentLocked(d, this.stageLabels());
  }

  selectableStages(): string[] {
    const d = this.deal();
    const all = this.stages();
    if (!d || d.paymentStatus !== 'paid') return all;
    const idx = all.indexOf(d.stage);
    if (idx < 0) return all;
    return all.slice(idx);
  }

  todayIso(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
  }

  openRegisterPaymentModal() {
    const d = this.deal();
    if (!d || d.paymentStatus === 'paid') return;
    this.manualPaymentAmount = Number(d.estimatedValue) || 0;
    this.manualPaymentMethod = 'efectivo';
    this.manualPaymentDate = this.todayIso();
    this.manualPaymentNotes = '';
    this.fin.getPaymentMethods().subscribe({
      next: (res) => {
        const methods = parseFinPaymentMethods(res.methods, { excludeStripe: true, onlyEnabled: true });
        if (!methods.length) {
          this.toast.warning('Ve a Finanzas → Métodos de Pago, activa tus métodos y pulsa Guardar configuración.', 'Sin métodos configurados');
          return;
        }
        this.manualPaymentMethods.set(methods);
        this.manualPaymentMethod = methods[0].id;
        this.registerPaymentModalOpen.set(true);
      },
      error: () => {
        this.toast.error('No se pudieron cargar los métodos de cobro.', 'Error');
      },
    });
  }

  closeRegisterPaymentModal() {
    this.registerPaymentModalOpen.set(false);
  }

  submitManualPayment() {
    const d = this.deal();
    if (!d) return;
    const amount = Number(this.manualPaymentAmount);
    if (!amount || amount <= 0) {
      this.toast.warning('Indica un monto válido.', 'Pago');
      return;
    }
    if (!this.manualPaymentDate) {
      this.toast.warning('Indica la fecha en que se recibió el pago.', 'Pago');
      return;
    }
    if (this.manualPaymentDate > this.todayIso()) {
      this.toast.warning('La fecha del pago no puede ser futura.', 'Pago');
      return;
    }
    this.isRegisteringPayment.set(true);
    this.crmService.registerManualPayment(d.id, {
      amount,
      paymentMethod: this.manualPaymentMethod,
      notes: this.manualPaymentNotes.trim() || undefined,
      paidAt: this.manualPaymentDate,
    }).subscribe({
      next: () => {
        this.isRegisteringPayment.set(false);
        this.registerPaymentModalOpen.set(false);
        this.toast.success('Pago registrado. Ya puedes mover el trámite y aparecerá en Finanzas.', '¡Pagado!');
        this.loadDeal(d.id);
        this.updated.emit();
      },
      error: (e) => {
        this.isRegisteringPayment.set(false);
        this.toast.error(e.error?.error || 'No se pudo registrar el pago', 'Error');
      },
    });
  }

  assignDeal(userId: string) {
    const d = this.deal();
    if (!d) return;
    const assignedTo = userId || null;
    if ((d.assignedTo || '') === (assignedTo || '')) return;
    this.crmService.updateDeal(d.id, { assignedTo }).subscribe({
      next: () => {
        this.loadDeal(d.id);
        this.toast.success(assignedTo ? 'Vendedor asignado' : 'Asignación retirada');
        this.updated.emit();
      },
      error: (e) => {
        this.assignedToModel = d.assignedTo || '';
        this.toast.error(e.error?.error || 'Error al asignar vendedor');
      },
    });
  }

  assignPerito(peritoId: string) {
    const d = this.deal();
    if (!d) return;
    const pid = peritoId || null;
    if ((d.peritoId || '') === (pid || '')) return;
    this.crmService.updateDeal(d.id, { peritoId: pid }).subscribe({
      next: () => {
        this.loadDeal(d.id);
        this.toast.success(pid ? 'Perito asignado' : 'Perito retirado');
        this.updated.emit();
      },
      error: (e) => {
        this.peritoIdModel = d.peritoId || '';
        this.toast.error(e.error?.error || 'Error al asignar perito');
      },
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
    const txt = this.noteText.trim();
    this.crmService.addActivity(d.id, txt).subscribe({
      next: () => {
        this.noteText = '';
        this.postChatMessage(txt);
        this.loadDeal(d.id);
        this.toast.success('Nota agregada y enviada al chat');
        this.updated.emit();
      },
      error: (e) => this.toast.error(e.error?.error || 'Error al agregar nota'),
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
  deliveryDocuments = signal<any[]>([]);
  shippingDocuments = signal<any[]>([]);
  clientDocuments = signal<any[]>([]);
  isUploading = signal(false);
  uploadService = inject(UploadService);
  readonly chatAttachmentAccept = CHAT_ATTACHMENT_ACCEPT;

  generatePaymentLink() {
    if (!this.dealId()) return;

    if (this.estimatedValue > 0 && this.deal()?.estimatedValue !== this.estimatedValue) {
      this.saveNotes();
      setTimeout(() => this.startPaymentLinkFlow(), 500);
      return;
    }

    this.startPaymentLinkFlow();
  }

  private startPaymentLinkFlow() {
    if (!this.estimatedValue || this.estimatedValue <= 0) {
      this.toast.warning('Asigna un valor estimado mayor a 0 y guárdalo antes de cobrar.', 'Valor requerido');
      return;
    }

    this.crmService.getPaymentProviders().subscribe({
      next: async (providers) => {
        this.paymentProviders.set(providers);
        const available: ('stripe' | 'mercadopago')[] = [];
        if (providers.stripe) available.push('stripe');
        if (providers.mercadopago) available.push('mercadopago');

        if (available.length === 0) {
          this.toast.error('Configura Stripe o MercadoPago en la pestaña Perfil.', 'Sin método de pago');
          return;
        }

        let method: 'stripe' | 'mercadopago';
        if (available.length === 1) {
          method = available[0];
        } else {
          const picked = await this.pickPaymentMethod();
          if (!picked) return;
          method = picked;
        }

        this.executePaymentLinkGeneration(method);
      },
      error: () => {
        this.toast.error('No se pudieron consultar los métodos de pago.', 'Error');
      },
    });
  }

  private pickPaymentMethod(): Promise<'stripe' | 'mercadopago' | null> {
    return new Promise((resolve) => {
      this.paymentMethodResolver = resolve;
      this.paymentMethodModalOpen.set(true);
    });
  }

  selectPaymentMethod(method: 'stripe' | 'mercadopago') {
    this.paymentMethodModalOpen.set(false);
    this.paymentMethodResolver?.(method);
    this.paymentMethodResolver = null;
  }

  cancelPaymentMethodModal() {
    this.paymentMethodModalOpen.set(false);
    this.paymentMethodResolver?.(null);
    this.paymentMethodResolver = null;
  }

  private executePaymentLinkGeneration(method: 'stripe' | 'mercadopago') {
    const dealId = this.dealId();
    if (!dealId) return;

    this.isGeneratingPayment.set(true);
    const request$ = method === 'stripe'
      ? this.crmService.generatePaymentLink(dealId)
      : this.mpService.generateLink(dealId);

    request$.subscribe({
      next: (res) => {
        this.isGeneratingPayment.set(false);
        navigator.clipboard.writeText(res.url).then(() => {
          const label = method === 'stripe' ? 'Stripe' : 'Mercado Pago';
          this.toast.success(`Link de ${label} copiado al portapapeles`, '¡Listo!');
        }).catch(() => {
          this.toast.warning('Link generado. Cópialo manualmente si el portapapeles no respondió.', 'Link listo');
        });
        this.startPaymentWatch();
      },
      error: (err) => {
        this.isGeneratingPayment.set(false);
        this.toast.error(err.error?.error || 'Error al generar link de pago', 'Error');
      },
    });
  }

  private refreshDealPaymentState(notifyParent = false) {
    const id = this.dealId();
    if (!id) return;
    this.crmService.getDeal(id).subscribe(d => {
      this.deal.set(d);
      if (d.paymentStatus === 'paid') {
        this.quoteOpen.set(false);
        this.stopPaymentWatch();
        if (notifyParent) this.updated.emit();
      }
    });
  }

  private startPaymentWatch() {
    const id = this.dealId();
    if (!id || this.deal()?.paymentStatus === 'paid') return;
    this.paymentWatchDealId = id;
    this.isWatchingPayment.set(true);
    this.stopPaymentWatch(false);
    this.paymentWatchInterval = setInterval(() => {
      const currentId = this.dealId();
      if (!currentId || this.deal()?.paymentStatus === 'paid') {
        this.stopPaymentWatch();
        return;
      }
      this.crmService.getDeal(currentId, { silent: true }).subscribe({
        next: (d) => {
          if (d.paymentStatus === 'paid' && this.deal()?.paymentStatus !== 'paid') {
            this.deal.set(d);
            this.quoteOpen.set(false);
            this.toast.success('El pago fue acreditado correctamente.', '¡Pagado!');
            this.stopPaymentWatch();
            this.updated.emit();
          }
        },
      });
    }, 15000);
  }

  private stopPaymentWatch(clearWatching = true) {
    if (this.paymentWatchInterval) {
      clearInterval(this.paymentWatchInterval);
      this.paymentWatchInterval = null;
    }
    if (clearWatching) {
      this.isWatchingPayment.set(false);
      this.paymentWatchDealId = null;
    }
  }

  loadDocuments(dealId: string) {
    this.crmService.getDocuments(dealId).subscribe(docs => {
      const all = docs as any[];
      this.quoteDocuments.set(all.filter(doc => doc.doc_kind === 'cotizacion'));
      this.deliveryDocuments.set(all.filter(doc => doc.doc_kind === 'entrega'));
      this.shippingDocuments.set(all.filter(doc => doc.doc_kind === 'envio'));
      this.documents.set(all.filter(doc => !['cotizacion', 'entrega', 'envio'].includes(doc.doc_kind)));
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

  downloadDocument(doc: { file_url: string; file_name?: string; document_type?: string }) {
    const fromUrl = doc.file_url.split('/').pop()?.split('?')[0] || '';
    const hasExt = fromUrl.includes('.');
    const name = doc.file_name
      || (hasExt ? fromUrl : `${(doc.document_type || 'documento').replace(/\s+/g, '_')}.pdf`);
    const a = document.createElement('a');
    a.href = doc.file_url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.download = name;
    a.click();
  }

  deleteDeal() {
    const d = this.deal();
    if (!d) return;
    const label = d.contact?.name ? `${d.title} (${d.contact.name})` : d.title;
    void this.confirmAndDeleteDeal(d.id, label);
  }

  private async confirmAndDeleteDeal(dealId: string, label: string) {
    const ok = await this.toast.confirmDelete(label);
    if (!ok) return;
    this.crmService.deleteDeal(dealId).subscribe({
      next: () => {
        this.toast.success('Eliminado del embudo');
        this.deleted.emit();
      },
      error: (e) => this.toast.error(e.error?.error || 'No se pudo eliminar'),
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
      error: () => alert('Error al aplicar datos')
    });
  }

  onOverlayClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('deal-panel-overlay')) {
      this.closed.emit();
    }
  }
}
