import {
  Component, EventEmitter, HostListener, Input, Output, signal,
} from '@angular/core';
import { LucideCreditCard, LucideKeyRound } from '@lucide/angular';
import { SubscriptionBillingComponent } from './subscription-billing.component';
import { ChangeCredentialsComponent } from './change-credentials.component';

@Component({
  selector: 'app-panel-user-menu',
  standalone: true,
  imports: [SubscriptionBillingComponent, ChangeCredentialsComponent, LucideKeyRound, LucideCreditCard],
  template: `
    <div class="panel-user-menu">
      @if (showName && name) {
        <span class="panel-user-name">{{ name }}</span>
      }
      <button type="button" class="panel-avatar" (click)="toggleMenu($event)" [title]="name || 'Cuenta'">
        @if (avatarUrl) {
          <img [src]="avatarUrl" [alt]="name || 'Avatar'" class="panel-avatar-img" />
        } @else {
          {{ initials }}
        }
      </button>

      @if (menuOpen()) {
        <div class="avatar-dropdown">
          <div class="avatar-dropdown-header">
            @if (avatarUrl) {
              <img [src]="avatarUrl" [alt]="name || 'Avatar'" class="avatar-dropdown-photo" />
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
            Cambiar contraseña / correo
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
      background: #0073ea;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 12px;
      letter-spacing: 0;
      cursor: pointer;
      border: none;
      padding: 0;
      overflow: hidden;
      flex-shrink: 0;
      font-family: Figtree, system-ui, sans-serif;
    }
    .panel-avatar:hover { box-shadow: 0 0 0 3px rgba(0, 115, 234, 0.2); }
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
    .avatar-dropdown-photo {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 1px solid #e6e9ef;
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
  @Input() showBilling = true;
  @Input() showName = false;
  @Output() logout = new EventEmitter<void>();

  menuOpen         = signal(false);
  billingOpen      = signal(false);
  credentialsOpen  = signal(false);

  @HostListener('document:click')
  closeOnOutsideClick() {
    this.menuOpen.set(false);
  }

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
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
