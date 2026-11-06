import { Component, signal, effect, HostListener, ElementRef, NgZone } from '@angular/core';
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
    .notification-wrapper { position: relative; display: inline-flex; align-items: center; margin-right: 8px; }
    .notification-btn {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      background: transparent;
      border: 1px solid #e6e9ef;
      border-radius: 8px;
      cursor: pointer;
      color: #323338;
    }
    .notification-btn:hover {
      border-color: #0073ea;
      color: #0073ea;
      background: #f8fbff;
    }
    .notification-btn svg {
      display: block;
      stroke: currentColor;
      flex-shrink: 0;
    }
    .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #e2445c;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      border-radius: 999px;
      padding: 0 4px;
      pointer-events: none;
      font-family: Figtree, system-ui, sans-serif;
      border: 2px solid #fff;
      box-sizing: border-box;
      line-height: 1;
    }
    .notification-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: min(340px, calc(100vw - 24px));
      background: #fff;
      border: 1px solid #e6e9ef;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(50, 51, 56, 0.16);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      max-height: min(420px, 70vh);
      overflow: hidden;
      font-family: Figtree, system-ui, sans-serif;
    }
    .nd-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-bottom: 1px solid #e6e9ef;
      background: #f7f8fa;
    }
    .nd-header h4 {
      margin: 0;
      color: #323338;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
    }
    .btn-link {
      background: none;
      border: none;
      color: #0073ea;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      font-family: Figtree, system-ui, sans-serif;
      text-decoration: none;
      white-space: nowrap;
      padding: 0;
    }
    .btn-link:hover { color: #0060c2; text-decoration: underline; }
    .nd-body {
      overflow-y: auto;
      flex: 1;
      text-align: left;
      background: #fff;
      scrollbar-width: thin;
      scrollbar-color: #c5c7d0 transparent;
    }
    .nd-body::-webkit-scrollbar { width: 6px; }
    .nd-body::-webkit-scrollbar-thumb { background: #c5c7d0; border-radius: 3px; }
    .nd-empty {
      padding: 28px 20px;
      text-align: center;
      color: #676879;
      font-size: 13px;
      font-family: Figtree, system-ui, sans-serif;
    }
    .nd-item {
      padding: 12px 14px;
      border-bottom: 1px solid #eef0f4;
      cursor: pointer;
      transition: background 0.15s;
    }
    .nd-item:last-child { border-bottom: none; }
    .nd-item:hover { background: #f8fbff; }
    .nd-item.unread {
      border-left: 3px solid #0073ea;
      background: #f8fbff;
      padding-left: 11px;
    }
    .nd-title {
      font-weight: 700;
      font-size: 13px;
      color: #323338;
      margin-bottom: 4px;
      font-family: Figtree, system-ui, sans-serif;
      line-height: 1.35;
    }
    .nd-body-text {
      font-size: 12px;
      color: #676879;
      margin-bottom: 6px;
      line-height: 1.5;
      font-family: Figtree, system-ui, sans-serif;
    }
    .nd-date {
      font-size: 11px;
      color: #9ca0ad;
      text-align: right;
      font-family: Figtree, system-ui, sans-serif;
      letter-spacing: 0;
    }
  `]
})
export class NotificationBellComponent {
  showDropdown = signal(false);
  notifications = signal<any[]>([]);
  unreadCount = signal(0);
  private socketReady = false;
  private onNotification = (notif: any) => {
    this.zone.run(() => {
      const normalized = {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        body: notif.body,
        refId: notif.ref_id ?? notif.refId,
        isRead: notif.is_read ?? notif.isRead ?? 0,
        createdAt: notif.created_at ?? notif.createdAt ?? new Date().toISOString(),
      };
      this.notifications.update(list => [normalized, ...list]);
      this.unreadCount.update(c => c + 1);

      this.toast.info(normalized.body, normalized.title, () => {
        if (normalized.refId) {
          const currentPath = this.router.url.split('?')[0];
          this.router.navigate([currentPath], { queryParams: { deal: normalized.refId }, queryParamsHandling: 'merge' });
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
    const refId = n.refId ?? n.ref_id;
    if (!n.isRead) {
      this.crmService.markNotificationRead(n.id).subscribe(() => {
        n.isRead = 1;
        this.notifications.set([...this.notifications()]);
        this.unreadCount.update(c => Math.max(0, c - 1));
        if (refId) {
          const currentPath = this.router.url.split('?')[0];
          this.router.navigate([currentPath], { queryParams: { deal: refId }, queryParamsHandling: 'merge' });
        }
      });
    } else {
      if (refId) {
        const currentPath = this.router.url.split('?')[0];
        this.router.navigate([currentPath], { queryParams: { deal: refId }, queryParamsHandling: 'merge' });
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
