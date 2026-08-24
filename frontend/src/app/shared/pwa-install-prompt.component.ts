import { Component, OnInit, OnDestroy, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LucideDownload, LucideShare, LucideX, LucideSmartphone } from '@lucide/angular';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'tvm_pwa_install_dismissed_until';
const DISMISS_DAYS = 7;

@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  imports: [LucideDownload, LucideShare, LucideX, LucideSmartphone],
  template: `
    @if (visible()) {
      <div class="pwa-banner" role="dialog" aria-labelledby="pwa-title" aria-describedby="pwa-desc">
        <button type="button" class="pwa-close" (click)="dismiss()" aria-label="Cerrar">
          <svg lucideX [size]="16" aria-hidden="true"></svg>
        </button>

        <div class="pwa-brand">
          <img src="assets/pwa/icon-192.png" alt="Trámites Vehiculares de México" width="56" height="56" />
        </div>

        <div class="pwa-copy">
          <h2 id="pwa-title">Lleva Trámites MX en tu celular</h2>
          <p id="pwa-desc">
            {{ message() }}
          </p>

          @if (isIos()) {
            <ol class="pwa-steps">
              <li>
                Toca <strong>Compartir</strong>
                <svg lucideShare [size]="14" aria-hidden="true"></svg>
                en Safari
              </li>
              <li>Elige <strong>Agregar a pantalla de inicio</strong></li>
              <li>Confirma con <strong>Agregar</strong></li>
            </ol>
          }
        </div>

        <div class="pwa-actions">
          @if (!isIos() && canPrompt()) {
            <button type="button" class="pwa-btn-primary" (click)="install()">
              <svg lucideDownload [size]="16" aria-hidden="true"></svg>
              Instalar app
            </button>
          } @else if (isIos()) {
            <button type="button" class="pwa-btn-primary" (click)="dismiss()">
              <svg lucideSmartphone [size]="16" aria-hidden="true"></svg>
              Entendido
            </button>
          } @else {
            <button type="button" class="pwa-btn-primary" (click)="dismiss()">
              Más tarde
            </button>
          }
          <button type="button" class="pwa-btn-ghost" (click)="dismiss()">Ahora no</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .pwa-banner {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      z-index: 10050;
      max-width: 420px;
      margin: 0 auto;
      background: #0a0a0a;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 18px;
      padding: 16px 16px 14px;
      box-shadow: 0 18px 48px rgba(0,0,0,0.55);
      display: grid;
      grid-template-columns: 56px 1fr;
      gap: 12px 14px;
      animation: pwa-in 0.35s ease-out;
    }

    @keyframes pwa-in {
      from { transform: translateY(18px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .pwa-close {
      position: absolute;
      top: 10px;
      right: 10px;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .pwa-brand img {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      object-fit: cover;
      background: #000;
      border: 1px solid rgba(255,255,255,0.12);
      display: block;
    }

    .pwa-copy {
      padding-right: 28px;
      min-width: 0;
    }

    .pwa-copy h2 {
      margin: 0 0 6px;
      font-size: 15px;
      line-height: 1.25;
      font-weight: 800;
      letter-spacing: 0.01em;
    }

    .pwa-copy p {
      margin: 0;
      font-size: 13px;
      line-height: 1.45;
      color: rgba(255,255,255,0.72);
    }

    .pwa-steps {
      margin: 10px 0 0;
      padding-left: 18px;
      font-size: 12px;
      color: rgba(255,255,255,0.78);
      line-height: 1.55;
    }

    .pwa-steps li { margin-bottom: 2px; }
    .pwa-steps svg {
      display: inline-block;
      vertical-align: -2px;
      margin: 0 2px;
    }

    .pwa-actions {
      grid-column: 1 / -1;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pwa-btn-primary,
    .pwa-btn-ghost {
      border-radius: 999px;
      padding: 9px 14px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid transparent;
    }

    .pwa-btn-primary {
      background: #fff;
      color: #111;
      border-color: #fff;
    }

    .pwa-btn-primary:hover { opacity: 0.92; }

    .pwa-btn-ghost {
      background: transparent;
      color: rgba(255,255,255,0.75);
      border-color: rgba(255,255,255,0.22);
    }

    .pwa-btn-ghost:hover {
      background: rgba(255,255,255,0.06);
    }

    @media (min-width: 720px) {
      .pwa-banner {
        left: auto;
        right: 20px;
        bottom: 20px;
        margin: 0;
      }
    }
  `],
})
export class PwaInstallPromptComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private deferred: BeforeInstallPromptEvent | null = null;
  private onBeforeInstall?: (e: Event) => void;
  private onAppInstalled?: () => void;

  visible = signal(false);
  canPrompt = signal(false);
  isIos = signal(false);
  message = signal(
    'Instala la app gratis: ábrela desde tu pantalla de inicio, más rápido y con el look de Trámites Vehiculares de México.',
  );

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    // Solo móvil: no mostrar invitación en desktop/web
    if (!this.isMobile()) return;

    if (this.isStandalone() || this.isDismissed()) return;

    const ua = navigator.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    this.isIos.set(ios);

    if (ios) {
      this.message.set(
        'En iPhone/iPad puedes instalar Trámites MX como app desde Safari. Así la tendrás en tu pantalla de inicio con fondo negro e icono oficial.',
      );
      setTimeout(() => this.visible.set(true), 1800);
      return;
    }

    this.onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (!this.isMobile()) return;
      this.deferred = e as BeforeInstallPromptEvent;
      this.canPrompt.set(true);
      this.message.set(
        'Descarga Trámites MX en tu dispositivo. Acceso directo, splash negro con el logo oficial y experiencia a pantalla completa.',
      );
      this.visible.set(true);
    };

    this.onAppInstalled = () => {
      this.visible.set(false);
      this.deferred = null;
      this.canPrompt.set(false);
    };

    window.addEventListener('beforeinstallprompt', this.onBeforeInstall);
    window.addEventListener('appinstalled', this.onAppInstalled);

    // Android/otros móviles: si no llega beforeinstallprompt, guía manual
    setTimeout(() => {
      if (!this.isMobile() || this.visible() || this.isStandalone() || this.isDismissed() || this.canPrompt()) {
        return;
      }
      this.message.set(
        'Agrega Trámites MX a tu pantalla de inicio desde el menú del navegador (Instalar aplicación / Agregar a inicio) y úsala como app.',
      );
      this.visible.set(true);
    }, 8000);
  }

  ngOnDestroy() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.onBeforeInstall) window.removeEventListener('beforeinstallprompt', this.onBeforeInstall);
    if (this.onAppInstalled) window.removeEventListener('appinstalled', this.onAppInstalled);
  }

  async install() {
    if (!this.deferred) return;
    await this.deferred.prompt();
    const choice = await this.deferred.userChoice;
    this.deferred = null;
    this.canPrompt.set(false);
    if (choice.outcome === 'accepted') {
      this.visible.set(false);
    } else {
      this.dismiss();
    }
  }

  dismiss() {
    this.visible.set(false);
    if (!isPlatformBrowser(this.platformId)) return;
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(DISMISS_KEY, String(until));
    } catch { /* ignore */ }
  }

  /** Teléfono/tablet táctil; excluye escritorio aunque el viewport sea estrecho. */
  private isMobile(): boolean {
    const ua = navigator.userAgent || '';
    const mobileUa = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
    const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    // Desktop clásico: sin UA móvil y sin coarse → no mostrar
    if (!mobileUa && !iPadOs && !coarsePointer) return false;
    // Móvil/tablet real, o táctil + viewport estrecho
    return mobileUa || iPadOs || (coarsePointer && narrow);
  }

  private isStandalone(): boolean {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || !!nav.standalone;
  }

  private isDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      return Number(raw) > Date.now();
    } catch {
      return false;
    }
  }
}
