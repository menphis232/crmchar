import {
  Component, EventEmitter, HostListener, Input, Output, signal,
} from '@angular/core';
import { SubscriptionBillingComponent } from './subscription-billing.component';

@Component({
  selector: 'app-panel-user-menu',
  standalone: true,
  imports: [SubscriptionBillingComponent],
  template: `
    <div class="panel-user-menu">
      @if (showName && name) {
        <span class="panel-user-name">{{ name }}</span>
      }
      <button type="button" class="panel-avatar" (click)="toggleMenu($event)" [title]="name || 'Cuenta'">
        {{ initials }}
      </button>

      @if (menuOpen()) {
        <div class="avatar-dropdown">
          <div class="avatar-dropdown-header">
            <strong>{{ name }}</strong>
            @if (email) {
              <span>{{ email }}</span>
            }
          </div>
          @if (showBilling) {
            <button type="button" class="avatar-dropdown-item" (click)="openBilling()">
              💳 Suscripción y facturación
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
  `,
  styles: [`
    .panel-user-menu {
      position: relative;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .panel-user-name {
      color: rgba(255,255,255,0.55);
      font-size: 13px;
      white-space: nowrap;
    }
    .panel-avatar {
      width: 34px;
      height: 34px;
      min-width: 34px;
      min-height: 34px;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #000;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.05em;
      cursor: pointer;
      border: none;
      padding: 0;
      overflow: hidden;
      flex-shrink: 0;
      font-family: var(--f-display, sans-serif);
    }
    .panel-avatar:hover { box-shadow: 0 0 0 2px rgba(255,255,255,0.25); }
    .avatar-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 240px;
      background: #111;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,.55);
      z-index: 500;
      overflow: hidden;
    }
    .avatar-dropdown-header {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .avatar-dropdown-header strong { color: #fff; font-size: 14px; }
    .avatar-dropdown-header span { color: rgba(255,255,255,.45); font-size: 12px; }
    .avatar-dropdown-item {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: none;
      color: rgba(255,255,255,.85);
      padding: 12px 16px;
      font-size: 13px;
      cursor: pointer;
    }
    .avatar-dropdown-item:hover { background: rgba(255,255,255,.06); }
    .avatar-dropdown-item.danger { color: #ff6b6b; }

    :host-context(.sidebar-user-section) .panel-user-name {
      color: rgba(255,255,255,0.75);
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
  @Input() showBilling = true;
  @Input() showName = false;
  @Output() logout = new EventEmitter<void>();

  menuOpen = signal(false);
  billingOpen = signal(false);

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

  onLogout() {
    this.menuOpen.set(false);
    this.logout.emit();
  }
}
