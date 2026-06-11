import { Component, Input, OnInit, signal, effect, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { CrmService } from '../core/api.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DatePipe, NgTemplateOutlet],
  template: `
    <nav id="main-nav">
      <a routerLink="/autos" class="nav-logo">
        <span class="logo-icon">🏛️</span>
        <span class="logo-text">TRÁMITES<span class="logo-accent">VEHICULARES</span><em>.mx</em></span>
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
      position: absolute; top: -5px; right: -5px; background: var(--gold); color: var(--bg);
      font-size: 10px; font-weight: bold; border-radius: 50%; padding: 2px 6px;
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: 0; width: 320px; background: #0b111e;
      border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.8);
      z-index: 1000; margin-top: 10px; display: flex; flex-direction: column; max-height: 400px;
    }
    .nd-header {
      display: flex; justify-content: space-between; align-items: center; padding: 12px 15px;
      border-bottom: 1px solid var(--border);
    }
    .nd-header h4 { margin: 0; color: var(--mx-white); font-family: var(--f-display); }
    .btn-link { background: none; border: none; color: var(--gold); cursor: pointer; font-size: 12px; }
    .btn-link:hover { text-decoration: underline; }
    .nd-body { overflow-y: auto; flex: 1; }
    .nd-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 13px; }
    .nd-item { padding: 12px 15px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; }
    .nd-item:hover { background: rgba(200, 169, 74, 0.05); }
    .nd-item.unread { border-left: 3px solid var(--gold); background: rgba(255, 255, 255, 0.02); }
    .nd-title { font-weight: bold; font-size: 13px; color: var(--mx-white); margin-bottom: 4px; }
    .nd-body-text { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .nd-date { font-size: 10px; color: #888; text-align: right; }
  `]
})
export class NavComponent implements OnInit {
  @Input() showLinks = true;

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
