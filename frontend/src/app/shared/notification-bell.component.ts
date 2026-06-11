import { Component, OnInit, signal, effect, HostListener, ElementRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CrmService } from '../core/api.service';
import { AuthService } from '../core/auth.service';

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
                <div class="nd-title">{{ n.title }}</div>
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
    .notification-btn { position: relative; font-size: 1.2rem; padding: 8px; background: transparent; border: none; cursor: pointer; color: white;}
    .badge {
      position: absolute; top: 0px; right: 0px; background: var(--gold); color: var(--bg);
      font-size: 10px; font-weight: bold; border-radius: 50%; padding: 2px 6px; pointer-events: none;
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: -50px; width: 320px; background: #0b111e;
      border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.8);
      z-index: 9999; margin-top: 10px; display: flex; flex-direction: column; max-height: 400px;
    }
    .nd-header {
      display: flex; justify-content: space-between; align-items: center; padding: 12px 15px;
      border-bottom: 1px solid var(--border);
    }
    .nd-header h4 { margin: 0; color: var(--mx-white); font-family: var(--f-display); font-size: 16px; }
    .btn-link { background: none; border: none; color: var(--gold); cursor: pointer; font-size: 12px; }
    .btn-link:hover { text-decoration: underline; }
    .nd-body { overflow-y: auto; flex: 1; text-align: left; }
    .nd-empty { padding: 20px; text-align: center; color: var(--muted); font-size: 13px; }
    .nd-item { padding: 12px 15px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; }
    .nd-item:hover { background: rgba(200, 169, 74, 0.05); }
    .nd-item.unread { border-left: 3px solid var(--gold); background: rgba(255, 255, 255, 0.02); }
    .nd-title { font-weight: bold; font-size: 13px; color: var(--mx-white); margin-bottom: 4px; }
    .nd-body-text { font-size: 12px; color: var(--muted); margin-bottom: 6px; }
    .nd-date { font-size: 10px; color: #888; text-align: right; }
  `]
})
export class NotificationBellComponent implements OnInit {
  showDropdown = signal(false);
  notifications = signal<any[]>([]);
  unreadCount = signal(0);

  constructor(private auth: AuthService, private crmService: CrmService, private eRef: ElementRef) {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.loadNotifications();
      }
    });
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
