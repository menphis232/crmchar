import { Component, OnInit, inject, signal, PLATFORM_ID, effect, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { OneSignalService } from '../core/onesignal.service';

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
            <p class="push-prompt-text">
              @if (errorMsg()) {
                {{ errorMsg() }}
              } @else if (oneSignal.permissionState() === 'denied') {
                Las notificaciones están bloqueadas en tu teléfono. Actívalas en Ajustes → Apps → Trámites MX → Notificaciones.
              } @else {
                Recibe avisos de trámites, mensajes y actualizaciones importantes. Tras tocar Activar, elige Permitir en el mensaje del sistema Android.
              }
            </p>
            <p class="push-prompt-status">Estado: {{ oneSignal.statusLabel() }}</p>
          </div>
          <div class="push-prompt-actions">
            <button type="button" class="push-prompt-btn push-prompt-btn--primary" [disabled]="activating()" (click)="activate()">
              @if (activating()) { Activando... } @else { Activar }
            </button>
            <button type="button" class="push-prompt-btn push-prompt-btn--ghost" (click)="hideForNow()">Ahora no</button>
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
      z-index: 99999;
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
      word-break: break-word;
    }
    .push-prompt-status {
      margin: 6px 0 0;
      font-family: var(--f-ui);
      font-size: 11px;
      color: rgba(165,180,252,0.85);
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
  private readonly zone = inject(NgZone);
  private readonly auth = inject(AuthService);
  readonly oneSignal = inject(OneSignalService);

  visible = signal(false);
  activating = signal(false);
  errorMsg = signal('');
  private hiddenForSession = false;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        setTimeout(() => this.updateVisibility(), 400);
        setTimeout(() => this.updateVisibility(), 2000);
        setTimeout(() => this.updateVisibility(), 6000);
      } else {
        this.visible.set(false);
      }
    });
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.auth.user();
    this.updateVisibility();
  }

  private updateVisibility() {
    if (!this.auth.isLoggedIn() || this.hiddenForSession) {
      this.visible.set(false);
      return;
    }
    this.oneSignal.refreshPermissionState().then(() => {
      this.visible.set(this.oneSignal.shouldShowPrompt());
    });
  }

  /** Sin await antes de encolar OneSignal — Android PWA pierde el gesto si no. */
  activate(): void {
    if (this.activating()) return;
    this.errorMsg.set('');
    const user = this.auth.user();

    this.zone.runOutsideAngular(() => {
      this.activating.set(true);
      void this.oneSignal.activatePushFromClick(user?.id, user?.role).then(result => {
        this.zone.run(() => {
          if (result.ok) {
            this.visible.set(false);
            return;
          }
          this.errorMsg.set(result.error || 'No se pudo activar. Intenta de nuevo.');
          void this.oneSignal.refreshPermissionState();
        });
      }).finally(() => {
        this.zone.run(() => this.activating.set(false));
      });
    });
  }

  hideForNow() {
    this.hiddenForSession = true;
    this.visible.set(false);
  }
}
