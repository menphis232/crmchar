import { Component, OnInit, signal, effect, HostListener, ElementRef, NgZone } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CrmService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { SocketService } from '../core/socket.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="notification-wrapper">
      <button class="notification-btn" (click)="toggleNotifications()" aria-label="Notificaciones">
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
                <div class="nd-title">{{ formatTitle(n.title) }}</div>
                <div class="nd-body-text">{{ n.body }}</div>
                <div class="nd-date">{{ n.createdAt | date:'short' }}</div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-wrapper { position: relative; display: inline-block; margin-right: 15px; }
    .notification-btn {
      position: relative; font-size: 1.2rem; padding: 8px;
      background: transparent; border: none; cursor: pointer; color: #ffffff;
    }
    .badge {
      position: absolute; top: 0; right: 0;
      background: #ffffff; color: #000000;
      font-size: 10px; font-weight: 800; border-radius: 999px;
      padding: 2px 6px; pointer-events: none; font-family: var(--f-display);
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: -50px; width: 340px;
      background: #141414;
      border: 1px solid rgba(255,255,255,0.12);
      border-top: 2px solid rgba(255,255,255,0.35);
      border-radius: 12px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.65);
      z-index: 9999; margin-top: 10px;
      display: flex; flex-direction: column; max-height: 420px;
      overflow: hidden;
    }
    .nd-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 16px;
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
      overflow-y: auto; flex: 1; text-align: left;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
    }
    .nd-body::-webkit-scrollbar { width: 6px; }
    .nd-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
    .nd-empty {
      padding: 28px 20px; text-align: center;
      color: rgba(255,255,255,0.40); font-size: 13px; font-family: var(--f-display);
    }
    .nd-item {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
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
      text-align: right; font-family: var(--f-display); letter-spacing: 0.02em;
    }
  `]
})
export class NotificationBellComponent implements OnInit {
  showDropdown = signal(false);
  notifications = signal<any[]>([]);
  unreadCount = signal(0);
  private socketReady = false;
  private onNotification = (notif: any) => {
    this.zone.run(() => {
      this.notifications.update(list => [notif, ...list]);
      this.unreadCount.update(c => c + 1);

      this.toast.info(notif.body, notif.title, () => {
        if (notif.ref_id) {
          const currentPath = this.router.url.split('?')[0];
          this.router.navigate([currentPath], { queryParams: { deal: notif.ref_id }, queryParamsHandling: 'merge' });
        }
      });
    });
  };

  constructor(
    private auth: AuthService,
    private crmService: CrmService,
    private eRef: ElementRef,
    private router: Router,
    private toast: ToastService,
    private zone: NgZone,
    private socketService: SocketService,
  ) {
    effect(() => {
      if (this.auth.isLoggedIn() && !this.socketReady) {
        this.socketReady = true;
        this.loadNotifications();
        this.setupSocket();
      } else if (!this.auth.isLoggedIn() && this.socketReady) {
        this.socketReady = false;
        this.socketService.off('notification', this.onNotification);
      }
    });
  }

  setupSocket() {
    const user = this.auth.user();
    if (!user) return;

    this.socketService.connect(user.id, user.parent_id || user.id);
    this.socketService.off('notification', this.onNotification);
    this.socketService.on('notification', this.onNotification);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (this.showDropdown() && !target.closest('.notification-wrapper')) {
      this.showDropdown.set(false);
    }
  }

  ngOnInit() {
    if (this.auth.isLoggedIn()) {
      this.loadNotifications();
    }
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
        if (n.ref_id) {
          const currentPath = this.router.url.split('?')[0];
          this.router.navigate([currentPath], { queryParams: { deal: n.ref_id }, queryParamsHandling: 'merge' });
        }
      });
    } else {
      if (n.ref_id) {
        const currentPath = this.router.url.split('?')[0];
        this.router.navigate([currentPath], { queryParams: { deal: n.ref_id }, queryParamsHandling: 'merge' });
      }
    }
  }

  markAllRead() {
    this.crmService.markAllNotificationsRead().subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, isRead: 1 })));
      this.unreadCount.set(0);
    });
  }

  formatTitle(title: string): string {
    const role = this.auth.user()?.role;
    if (role === 'concesionaria') {
      return (title || '')
        .replace(/Gestor\/Concesionaria/gi, 'cliente')
        .replace(/tu trámite/gi, 'tu vehículo')
        .replace(/trámite/gi, 'vehículo');
    }
    return title || '';
  }
}
