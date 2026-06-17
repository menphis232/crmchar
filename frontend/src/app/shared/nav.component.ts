import { Component, Input, OnInit, signal, effect, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { CrmService } from '../core/api.service';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from './brand.constants';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DatePipe, NgTemplateOutlet],
  template: `
    <nav id="main-nav">
      <a [href]="tvmMainSite" class="nav-logo">
        <img [src]="tvmLogo" alt="Trámites Vehiculares de México" class="brand-logo" />
      </a>

      <div class="header-mobile-actions">
        @if (auth.isLoggedIn()) {
          <div class="mobile-bell">
            <ng-container *ngTemplateOutlet="bellTpl"></ng-container>
          </div>
        }
        <!-- Hamburger Button (Mobile only) -->
        <button class="mobile-menu-toggle" (click)="toggleMobileMenu()" aria-label="Abrir menú">
          @if (!isMobileMenuOpen()) {
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          } @else {
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          }
        </button>
      </div>

      <!-- Main Navigation Wrapper -->
      <div class="nav-wrapper" [class.mobile-open]="isMobileMenuOpen()">
        @if (showLinks) {
          <ul class="nav-links">
            <li><a routerLink="/autos" routerLinkActive="active" (click)="closeMobileMenu()">Autos en Venta</a></li>
            <li><a routerLink="/gestores" routerLinkActive="active" (click)="closeMobileMenu()">Gestores Autorizados</a></li>
          </ul>
        }
        <div class="nav-actions">
          @if (auth.isLoggedIn()) {
            <div class="desktop-bell">
              <ng-container *ngTemplateOutlet="bellTpl"></ng-container>
            </div>
            <a [routerLink]="panelLink" class="btn-primary" (click)="closeMobileMenu()">Mi Panel</a>
            <button class="btn-text" (click)="logout()">Salir</button>
          } @else {
            <a routerLink="/login" class="btn-text" (click)="closeMobileMenu()">👤 Iniciar Sesión</a>
          }
        </div>
      </div>
    </nav>

    <!-- Notification Bell Template -->
    <ng-template #bellTpl>
      <div class="notification-wrapper">
        <button class="btn-icon notification-btn" (click)="toggleNotifications()" aria-label="Notificaciones">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          @if (unreadCount() > 0) {
            <span class="badge">{{ unreadCount() }}</span>
          }
        </button>
        @if (showDropdown()) {
          <div class="notification-dropdown">
            <div class="nd-header">
              <h4>Notificaciones</h4>
              <button class="btn-link" (click)="markAllRead()">Marcar todas leídas</button>
            </div>
            <div class="nd-body">
              @if (notifications().length === 0) {
                <div class="nd-empty">No tienes notificaciones nuevas.</div>
              }
              @for (n of notifications(); track n.id) {
                <div class="nd-item" [class.unread]="!n.isRead" (click)="readNotif(n)">
                  <div class="nd-title">{{ n.title }}</div>
                  <div class="nd-body-text">{{ n.body }}</div>
                  <div class="nd-date">{{ n.createdAt | date:'short' }}</div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    .notification-wrapper { position: relative; display: inline-block; }
    .notification-btn { display: flex; align-items: center; justify-content: center; }
    .badge {
      position: absolute; top: -5px; right: -5px; background: #ffffff; color: var(--brand-black);
      font-size: 10px; font-weight: bold; border-radius: 50%; padding: 2px 6px;
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: 0; width: 340px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.12);
      border-top: 3px solid var(--brand-black);
      border-radius: 0;
      box-shadow: 0 12px 32px rgba(0,0,0,0.15);
      z-index: 1000; margin-top: 10px; display: flex; flex-direction: column; max-height: 420px;
    }
    .nd-header {
      display: flex; justify-content: space-between; align-items: center; padding: 14px 16px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      background: #f8f7f5;
    }
    .nd-header h4 {
      margin: 0; color: var(--brand-black); font-family: var(--f-display);
      font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    }
    .btn-link {
      background: none; border: none; color: var(--brand-black); cursor: pointer;
      font-size: 11px; font-weight: 600; text-decoration: underline; opacity: 0.7;
    }
    .btn-link:hover { opacity: 1; }
    .nd-body { overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: #ccc transparent; }
    .nd-body::-webkit-scrollbar { width: 6px; }
    .nd-body::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
    .nd-empty { padding: 24px; text-align: center; color: var(--muted); font-size: 13px; }
    .nd-item {
      padding: 14px 16px; border-bottom: 1px solid rgba(0,0,0,0.06);
      cursor: pointer; transition: background 0.2s;
    }
    .nd-item:hover { background: #f0ede9; }
    .nd-item.unread {
      border-left: 3px solid var(--brand-black);
      background: #f8f7f5;
    }
    .nd-title { font-weight: 700; font-size: 13px; color: var(--brand-black); margin-bottom: 4px; }
    .nd-body-text { font-size: 12px; color: #555; margin-bottom: 6px; line-height: 1.5; }
    .nd-date { font-size: 10px; color: var(--muted); text-align: right; }
  `]
})
export class NavComponent implements OnInit {
  @Input() showLinks = true;

  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  showDropdown = signal(false);
  isMobileMenuOpen = signal(false);
  notifications = signal<any[]>([]);
  unreadCount = signal(0);

  constructor(public auth: AuthService, private crmService: CrmService) {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.loadNotifications();
      }
    });
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.loadNotifications();
    }
  }

  get panelLink(): string {
    const role = this.auth.user()?.role;
    if (role === 'gestor') return '/panel/gestor';
    if (role === 'concesionaria') return '/panel/concesionaria';
    if (role === 'admin') return '/panel/admin';
    return '/login';
  }

  toggleNotifications() {
    this.showDropdown.update(v => !v);
  }

  loadNotifications() {
    this.crmService.getNotifications().subscribe(data => {
      this.notifications.set(data);
      this.unreadCount.set(data.filter(n => !n.isRead).length);
    });
  }

  readNotif(n: any) {
    if (!n.isRead) {
      this.crmService.markNotificationRead(n.id).subscribe(() => {
        n.isRead = 1;
        this.notifications.set([...this.notifications()]);
        this.unreadCount.update(c => Math.max(0, c - 1));
      });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (this.showDropdown() && !target.closest('.notification-wrapper')) {
      this.showDropdown.set(false);
    }
  }

  markAllRead() {
    this.crmService.markAllNotificationsRead().subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, isRead: 1 })));
      this.unreadCount.set(0);
    });
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMobileMenu() {
    this.isMobileMenuOpen.set(false);
  }

  logout() {
    this.closeMobileMenu();
    this.auth.logout();
  }
}
