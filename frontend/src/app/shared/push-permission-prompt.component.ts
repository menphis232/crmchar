import { Component, OnInit, inject, signal, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { OneSignalService } from '../core/onesignal.service';

const DISMISS_KEY = 'push_prompt_dismissed_until';

@Component({
  selector: 'app-push-permission-prompt',
  standalone: true,
  template: `
    @if (visible()) {
      <div class="push-prompt" role="dialog" aria-labelledby="push-prompt-title">
        <div class="push-prompt-inner">
          <div class="push-prompt-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div class="push-prompt-copy">
            <p id="push-prompt-title" class="push-prompt-title">Activa las notificaciones</p>
            <p class="push-prompt-text">Recibe avisos de trámites, mensajes y actualizaciones importantes en tu teléfono.</p>
          </div>
          <div class="push-prompt-actions">
            <button type="button" class="push-prompt-btn push-prompt-btn--primary" [disabled]="activating()" (click)="activate()">
              @if (activating()) { Activando... } @else { Activar }
            </button>
            <button type="button" class="push-prompt-btn push-prompt-btn--ghost" (click)="dismiss()">Ahora no</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .push-prompt {
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
      z-index: 8500;
      pointer-events: none;
    }
    .push-prompt-inner {
      pointer-events: auto;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #111;
      border: 1px solid rgba(255,255,255,0.18);
      border-top: 2px solid rgba(255,255,255,0.45);
      box-shadow: 0 16px 48px rgba(0,0,0,0.55);
      max-width: 520px;
      margin: 0 auto;
    }
    .push-prompt-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(99,102,241,0.18);
      color: #a5b4fc;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .push-prompt-copy { flex: 1; min-width: 180px; }
    .push-prompt-title {
      margin: 0 0 4px;
      font-family: var(--f-display);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #fff;
    }
    .push-prompt-text {
      margin: 0;
      font-family: var(--f-ui);
      font-size: 13px;
      line-height: 1.45;
      color: rgba(255,255,255,0.62);
    }
    .push-prompt-actions {
      display: flex;
      gap: 8px;
      width: 100%;
    }
    .push-prompt-btn {
      flex: 1;
      border: none;
      padding: 12px 14px;
      font-family: var(--f-display);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .push-prompt-btn:disabled { opacity: 0.6; cursor: wait; }
    .push-prompt-btn--primary {
      background: #4f46e5;
      color: #fff;
    }
    .push-prompt-btn--ghost {
      background: transparent;
      color: rgba(255,255,255,0.55);
      border: 1px solid rgba(255,255,255,0.15);
    }
    @media (min-width: 641px) {
      .push-prompt { left: auto; right: 24px; bottom: 24px; width: 380px; }
      .push-prompt-inner { margin: 0; }
      .push-prompt-actions { width: auto; margin-left: auto; }
      .push-prompt-btn { flex: 0 0 auto; min-width: 100px; }
    }
  `],
})
export class PushPermissionPromptComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly oneSignal = inject(OneSignalService);

  visible = signal(false);
  activating = signal(false);

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        setTimeout(() => this.updateVisibility(), 800);
      } else {
        this.visible.set(false);
      }
    });
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.auth.user();
    this.updateVisibility();
    setTimeout(() => this.updateVisibility(), 1500);
    setTimeout(() => this.updateVisibility(), 5000);
  }

  private updateVisibility() {
    if (!this.auth.isLoggedIn()) {
      this.visible.set(false);
      return;
    }
    if (this.isDismissed()) {
      this.visible.set(false);
      return;
    }
    this.oneSignal.refreshPermissionState().then(() => {
      this.visible.set(this.oneSignal.shouldShowPrompt());
    });
  }

  async activate() {
    this.activating.set(true);
    const ok = await this.oneSignal.enablePushFromUserGesture();
    this.activating.set(false);
    if (ok) {
      this.visible.set(false);
      return;
    }
    await this.oneSignal.refreshPermissionState();
    if (this.oneSignal.permissionState() === 'denied') {
      this.visible.set(false);
    }
  }

  dismiss() {
    if (isPlatformBrowser(this.platformId)) {
      const until = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(DISMISS_KEY, String(until));
    }
    this.visible.set(false);
  }

  private isDismissed(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until) || Date.now() > until) {
      localStorage.removeItem(DISMISS_KEY);
      return false;
    }
    return true;
  }
}
