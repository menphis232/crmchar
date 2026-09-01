import { Component, signal } from '@angular/core';
import { SupportChatComponent } from './support-chat.component';
import { SupportService } from '../core/api.service';

@Component({
  selector: 'app-support-widget',
  standalone: true,
  imports: [SupportChatComponent],
  styles: [`
    .support-fab {
      position: fixed;
      right: 90px;
      bottom: 22px;
      z-index: 80;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: 1px solid rgba(200,169,74,0.5);
      background: linear-gradient(135deg, #c8a94a, #8a6d22);
      color: #060b14;
      cursor: pointer;
      box-shadow: 0 10px 30px rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .support-fab svg {
      flex-shrink: 0;
    }
    .fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #ce1126;
      color: #fff;
      font-size: 11px;
      min-width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
    }
    .support-drawer {
      position: fixed;
      right: 22px;
      bottom: 88px;
      width: min(420px, calc(100vw - 32px));
      height: min(560px, calc(100vh - 140px));
      z-index: 81;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55);
    }
    @media (max-width: 640px) {
      .support-fab {
        left: 16px;
        right: auto;
        bottom: 16px;
        width: 48px;
        height: 48px;
      }
      .support-drawer {
        left: 16px;
        right: 16px;
        bottom: 76px;
        width: auto;
        height: min(520px, calc(100vh - 120px));
      }
    }
  `],
  template: `
    @if (open()) {
      <div class="support-drawer">
        <app-support-chat mode="user" title="Soporte" subtitle="Super Admin · Trámites Vehiculares" />
      </div>
    }
    <button
      type="button"
      class="support-fab"
      (click)="toggle()"
      title="Soporte técnico"
      aria-label="Soporte técnico"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      @if (!open() && unread()) {
        <span class="fab-badge">{{ unread() }}</span>
      }
    </button>
  `,
})
export class SupportWidgetComponent {
  open = signal(false);
  unread = signal(0);

  constructor(private support: SupportService) {
    this.support.getUnread().subscribe({
      next: r => this.unread.set(r.unread || 0),
      error: () => {},
    });
  }

  toggle() {
    this.open.update(v => !v);
    if (this.open()) this.unread.set(0);
  }
}
