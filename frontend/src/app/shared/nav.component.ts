import { Component, OnInit, signal, effect, HostListener, ElementRef, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { CrmService } from '../core/api.service';
import { TVM_LOGO_URL, TVM_MAIN_SITE_URL } from './brand.constants';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, DatePipe, NgTemplateOutlet],
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
        <div class="nav-actions">
          @if (auth.isLoggedIn()) {
            <div class="desktop-bell">
              <ng-container *ngTemplateOutlet="bellTpl"></ng-container>
            </div>
            <a [routerLink]="panelLink" class="btn-primary" (click)="closeMobileMenu()">Mi Panel</a>
            <button class="btn-text" (click)="logout()">Salir</button>
          } @else {
            <div class="login-menu-wrapper">
              <button
                type="button"
                class="btn-text login-menu-trigger"
                (click)="toggleLoginMenu(); $event.stopPropagation()"
                [attr.aria-expanded]="loginMenuOpen()"
                aria-haspopup="menu"
              >
                👤 Iniciar Sesión
              </button>
              @if (loginMenuOpen()) {
                <div class="login-menu-dropdown" role="menu">
                  @for (opt of loginOptions; track opt.path) {
                    <button
                      type="button"
                      class="login-menu-item"
                      role="menuitem"
                      (click)="goToLogin(opt.path)"
                    >
                      {{ opt.label }}
                    </button>
                  }
                </div>
              }
            </div>
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
      position: absolute; top: -5px; right: -5px; background: #ffffff; color: #000000;
      font-size: 10px; font-weight: 800; border-radius: 999px; padding: 2px 6px;
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: 0; width: 340px;
      background: #141414;
      border: 1px solid rgba(255,255,255,0.12);
      border-top: 2px solid rgba(255,255,255,0.35);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.65);
      z-index: 1000; margin-top: 10px;
      display: flex; flex-direction: column; max-height: 420px; overflow: hidden;
    }
    .nd-header {
      display: flex; justify-content: space-between; align-items: center; padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      background: #0d0d0d;
    }
    .nd-header h4 {
      margin: 0; color: #ffffff; font-family: var(--f-display);
      font-size: 11px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase;
    }
    .btn-link {
      background: none; border: none; color: rgba(255,255,255,0.45); cursor: pointer;
      font-size: 11px; font-weight: 600; font-family: var(--f-display);
      text-decoration: none; transition: color 0.2s;
    }
    .btn-link:hover { color: #ffffff; }
    .nd-body {
      overflow-y: auto; flex: 1;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
    }
    .nd-body::-webkit-scrollbar { width: 6px; }
    .nd-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    .nd-empty {
      padding: 28px 20px; text-align: center;
      color: rgba(255,255,255,0.40); font-size: 13px; font-family: var(--f-display);
    }
    .nd-item {
      padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);
      cursor: pointer; transition: background 0.2s;
    }
    .nd-item:last-child { border-bottom: none; }
    .nd-item:hover { background: rgba(255,255,255,0.04); }
    .nd-item.unread {
      border-left: 3px solid rgba(255,255,255,0.65);
      background: rgba(255,255,255,0.03);
      padding-left: 13px;
    }
    .nd-title {
      font-weight: 700; font-size: 13px; color: #ffffff;
      margin-bottom: 4px; font-family: var(--f-display); line-height: 1.35;
    }
    .nd-body-text {
      font-size: 12px; color: rgba(255,255,255,0.50);
      margin-bottom: 6px; line-height: 1.5; font-family: var(--f-display);
    }
    .nd-date {
      font-size: 10px; color: rgba(255,255,255,0.32);
      text-align: right; font-family: var(--f-display);
    }

    .login-menu-wrapper {
      position: relative;
      display: inline-block;
    }

    .login-menu-trigger {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .login-menu-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 220px;
      background: #0a0a0a;
      border: 2px solid rgba(255,255,255,0.5);
      z-index: 1001;
      display: flex;
      flex-direction: column;
      animation: login-menu-in 0.18s ease-out;
    }

    @keyframes login-menu-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .login-menu-item {
      width: 100%;
      border: none;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      background: transparent;
      color: #fff;
      text-align: center;
      padding: 14px 20px;
      font-family: var(--f-display);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.2s;
    }

    .login-menu-item:last-child {
      border-bottom: none;
    }

    .login-menu-item:hover {
      background: rgba(255,255,255,0.08);
    }
  `]
})
export class NavComponent implements OnInit {
  readonly tvmMainSite = TVM_MAIN_SITE_URL;
  readonly tvmLogo = TVM_LOGO_URL;

  readonly loginOptions = [
    { label: 'Administrador', path: '/login/admin' },
    { label: 'Cliente', path: '/login/cliente' },
    { label: 'Concesionaria', path: '/login/concesionaria' },
    { label: 'Consultor', path: '/login/gestor' },
  ];

  showDropdown = signal(false);
  loginMenuOpen = signal(false);
  isMobileMenuOpen = signal(false);
  notifications = signal<any[]>([]);
  unreadCount = signal(0);
  private readonly host = inject(ElementRef);

  constructor(public auth: AuthService, private crmService: CrmService, private router: Router) {
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

  toggleLoginMenu() {
    this.loginMenuOpen.update(v => !v);
    if (this.loginMenuOpen()) this.showDropdown.set(false);
  }

  goToLogin(path: string) {
    this.loginMenuOpen.set(false);
    this.closeMobileMenu();
    this.router.navigate([path]);
  }

  get panelLink(): string {
    return this.auth.panelPathByRole() || '/login/cliente';
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
    if (this.loginMenuOpen() && !this.host.nativeElement.contains(event.target)) {
      this.loginMenuOpen.set(false);
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
