import { Component, Input, OnInit, signal, effect } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { CrmService } from '../core/api.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, DatePipe],
  template: `
    <nav id="main-nav">
      <a routerLink="/autos" class="nav-logo">
        <span class="logo-icon">🏛️</span>
        <span class="logo-text">TRÁMITES<span class="logo-accent">VEHICULARES</span><em>.mx</em></span>
      </a>
      @if (showLinks) {
        <ul class="nav-links">
          <li><a routerLink="/autos" routerLinkActive="active">Autos en Venta</a></li>
          <li><a routerLink="/gestores" routerLinkActive="active">Gestores Autorizados</a></li>
        </ul>
      }
      <div class="nav-actions">
        @if (auth.isLoggedIn()) {
          <div class="notification-wrapper">
            <button class="btn-ghost notification-btn" (click)="toggleNotifications()">
              🔔
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
          <a [routerLink]="panelLink" class="btn-ghost">Mi Panel</a>
          <button class="btn-ghost" (click)="auth.logout()">Salir</button>
        } @else {
          <a routerLink="/login" class="btn-ghost">👤 INICIAR SESIÓN</a>
        }
      </div>
    </nav>
  `,
  styles: [`
    .notification-wrapper { position: relative; display: inline-block; }
    .notification-btn { position: relative; font-size: 1.2rem; padding: 8px 12px; }
    .badge {
      position: absolute; top: -5px; right: -5px; background: var(--gold); color: var(--bg);
      font-size: 10px; font-weight: bold; border-radius: 50%; padding: 2px 6px;
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: 0; width: 320px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
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

  markAllRead() {
    this.crmService.markAllNotificationsRead().subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, isRead: 1 })));
      this.unreadCount.set(0);
    });
  }
}
