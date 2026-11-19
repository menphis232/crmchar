import {
  Component, EventEmitter, HostListener, Input, Output, signal,
} from '@angular/core';
import { LucideCreditCard, LucideKeyRound, LucideX } from '@lucide/angular';
import { SubscriptionBillingComponent } from './subscription-billing.component';
import { ChangeCredentialsComponent } from './change-credentials.component';

@Component({
  selector: 'app-panel-user-menu',
  standalone: true,
  imports: [
    SubscriptionBillingComponent,
    ChangeCredentialsComponent,
    LucideKeyRound,
    LucideCreditCard,
    LucideX,
  ],
  template: `
    <div class="panel-user-menu">
      @if (showName && name) {
        <span class="panel-user-name">{{ name }}</span>
      }
      <button
        type="button"
        class="panel-avatar"
        (click)="toggleMenu($event)"
        [title]="name || 'Cuenta'"
        [style.width.px]="sizePx"
        [style.height.px]="sizePx"
        [style.minWidth.px]="sizePx"
        [style.minHeight.px]="sizePx"
        [style.fontSize.px]="avatarFontPx"
      >
        @if (avatarUrl) {
          <img [src]="avatarUrl" [alt]="name || 'Avatar'" class="panel-avatar-img" />
        } @else {
          {{ initials }}
        }
      </button>

      @if (menuOpen()) {
        <div class="avatar-dropdown" (click)="$event.stopPropagation()">
          <div class="avatar-dropdown-header">
            @if (avatarUrl) {
              <button
                type="button"
                class="avatar-dropdown-photo-btn"
                (click)="openPreview($event)"
                title="Ver foto"
                aria-label="Ver mi foto ampliada"
              >
                <img [src]="avatarUrl" [alt]="name || 'Avatar'" class="avatar-dropdown-photo" />
                <span class="avatar-dropdown-photo-hint">Toca para ampliar</span>
              </button>
            }
            <div class="avatar-dropdown-meta">
              <strong>{{ name }}</strong>
              @if (email) {
                <span>{{ email }}</span>
              }
            </div>
          </div>
          <button type="button" class="avatar-dropdown-item btn-with-icon" (click)="openCredentials()">
            <svg lucideKeyRound [size]="14" aria-hidden="true"></svg>
            Cambiar correo / contraseña
          </button>
          @if (showBilling) {
            <button type="button" class="avatar-dropdown-item btn-with-icon" (click)="openBilling()">
              <svg lucideCreditCard [size]="14" aria-hidden="true"></svg>
              Suscripción y facturación
            </button>
          }
          <button type="button" class="avatar-dropdown-item danger" (click)="onLogout()">
            Cerrar sesión
          </button>
        </div>
      }
    </div>

    @if (previewOpen() && avatarUrl) {
      <div
        class="avatar-preview-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Vista de foto de perfil"
        (click)="closePreview()"
      >
        <button
          type="button"
          class="avatar-preview-close"
          (click)="closePreview(); $event.stopPropagation()"
          aria-label="Cerrar"
        >
          <svg lucideX [size]="22" aria-hidden="true"></svg>
        </button>
        <img
          [src]="avatarUrl"
          [alt]="name || 'Mi foto'"
          class="avatar-preview-img"
          (click)="$event.stopPropagation()"
        />
        @if (name) {
          <p class="avatar-preview-caption">{{ name }}</p>
        }
      </div>
    }

    @if (billingOpen()) {
      <app-subscription-billing (closed)="billingOpen.set(false)" />
    }

    @if (credentialsOpen()) {
      <app-change-credentials (closed)="credentialsOpen.set(false)" />
    }
  `,
  styles: [`
    .panel-user-menu {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .panel-user-name {
      color: #676879;
      font-size: 13px;
      font-weight: 500;
      font-family: Figtree, system-ui, sans-serif;
      white-space: nowrap;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .panel-avatar {
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      border-radius: 50%;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0;
      cursor: pointer;
      border: 1.5px solid #000;
      padding: 0;
      overflow: hidden;
      flex-shrink: 0;
      font-family: Figtree, system-ui, sans-serif;
      box-sizing: border-box;
    }
    /* Panel cliente: avatar grande en header */
    @media (min-width: 992px) {
      :host-context(app-panel-cliente) .panel-avatar {
        width: 72px !important;
        height: 72px !important;
        min-width: 72px !important;
        min-height: 72px !important;
        font-size: 24px !important;
        border-width: 2px !important;
      }
      :host-context(app-panel-cliente) .avatar-dropdown {
        left: 0;
        right: auto;
      }
    }
    @media (max-width: 991px) {
      :host-context(app-panel-cliente) .panel-avatar {
        width: 104px !important;
        height: 104px !important;
        min-width: 104px !important;
        min-height: 104px !important;
        font-size: 36px !important;
        border-width: 2.5px !important;
      }
      :host-context(app-panel-cliente) .avatar-dropdown {
        left: 0;
        right: auto;
        min-width: min(300px, calc(100vw - 24px));
      }
      :host-context(app-panel-cliente) .avatar-dropdown-header {
        flex-direction: column;
        text-align: center;
        padding: 16px;
        gap: 10px;
      }
      :host-context(app-panel-cliente) .avatar-dropdown-photo-btn {
        width: 120px;
      }
      :host-context(app-panel-cliente) .avatar-dropdown-photo {
        width: 112px;
        height: 112px;
      }
      :host-context(app-panel-cliente) .avatar-dropdown-meta {
        align-items: center;
      }
    }
    .panel-avatar:hover { box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.12); }
    .panel-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
      display: block;
    }
    .avatar-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 260px;
      max-width: min(320px, calc(100vw - 24px));
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(50, 51, 56, 0.16);
      z-index: 500;
      overflow: hidden;
      font-family: Figtree, system-ui, sans-serif;
    }
    .avatar-dropdown-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid #e6e9ef;
      background: #f7f8fa;
    }
    .avatar-dropdown-photo-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      flex-shrink: 0;
    }
    .avatar-dropdown-photo {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid #e6e9ef;
      display: block;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .avatar-dropdown-photo-btn:hover .avatar-dropdown-photo,
    .avatar-dropdown-photo-btn:focus-visible .avatar-dropdown-photo {
      transform: scale(1.04);
      box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.25);
    }
    .avatar-dropdown-photo-hint {
      font-size: 11px;
      font-weight: 600;
      color: #0073ea;
      font-family: Figtree, system-ui, sans-serif;
      line-height: 1.2;
    }
    .avatar-dropdown-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .avatar-dropdown-header strong {
      color: #323338;
      font-size: 14px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .avatar-dropdown-header span {
      color: #676879;
      font-size: 12px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .avatar-dropdown-item {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      color: #323338;
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 500;
      font-family: Figtree, system-ui, sans-serif;
      cursor: pointer;
    }
    .avatar-dropdown-item:hover { background: #f5f6f8; color: #0073ea; }
    .avatar-dropdown-item.danger { color: #e2445c; }
    .avatar-dropdown-item.danger:hover { background: #fff0f1; color: #e2445c; }

    .avatar-preview-overlay {
      position: fixed;
      inset: 0;
      z-index: 10050;
      background: rgba(10, 12, 18, 0.88);
      backdrop-filter: blur(6px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 24px 16px;
      box-sizing: border-box;
    }
    .avatar-preview-close {
      position: absolute;
      top: max(12px, env(safe-area-inset-top));
      right: 12px;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .avatar-preview-close:hover {
      background: rgba(255, 255, 255, 0.24);
    }
    .avatar-preview-img {
      width: min(86vw, 420px);
      height: min(86vw, 420px);
      max-height: min(70vh, 420px);
      object-fit: cover;
      border-radius: 50%;
      border: 4px solid #fff;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
      background: #fff;
    }
    .avatar-preview-caption {
      margin: 0;
      color: #fff;
      font-size: 16px;
      font-weight: 700;
      font-family: Figtree, system-ui, sans-serif;
      text-align: center;
    }

    :host-context(.sidebar-user-section) .panel-user-name {
      color: #676879;
      font-size: 12px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    :host-context(.sidebar-user-section) .avatar-dropdown {
      left: 0;
      right: auto;
      min-width: 100%;
    }
  `],
})
export class PanelUserMenuComponent {
  @Input({ required: true }) name = '';
  @Input() email = '';
  @Input() initials = '?';
  @Input() avatarUrl = '';
  /** Diámetro del avatar en px (p. ej. 104 en móvil del panel cliente). */
  @Input() sizePx = 34;

  get avatarFontPx(): number {
    return Math.max(12, Math.round(this.sizePx * 0.34));
  }
  @Input() showBilling = true;
  @Input() showName = false;
  @Output() logout = new EventEmitter<void>();

  menuOpen         = signal(false);
  previewOpen      = signal(false);
  billingOpen      = signal(false);
  credentialsOpen  = signal(false);

  @HostListener('document:click')
  closeOnOutsideClick() {
    this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.previewOpen()) {
      this.closePreview();
      return;
    }
    this.menuOpen.set(false);
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  openPreview(event?: Event) {
    event?.stopPropagation();
    if (!this.avatarUrl) return;
    this.menuOpen.set(false);
    this.previewOpen.set(true);
  }

  closePreview() {
    this.previewOpen.set(false);
  }

  openBilling() {
    this.menuOpen.set(false);
    this.billingOpen.set(true);
  }

  openCredentials() {
    this.menuOpen.set(false);
    this.credentialsOpen.set(true);
  }

  onLogout() {
    this.menuOpen.set(false);
    this.logout.emit();
  }
}
