import { Component, OnInit, signal, effect, HostListener, ElementRef, NgZone } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CrmService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { environment } from '../../environments/environment';
import { io } from 'socket.io-client';

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
      position: absolute; top: 0px; right: 0px; background: #ffffff; color: var(--brand-black);
      font-size: 10px; font-weight: bold; border-radius: 50%; padding: 2px 6px; pointer-events: none;
    }
    .notification-dropdown {
      position: absolute; top: 100%; right: -50px; width: 340px;
      background: #ffffff;
      border: 1px solid rgba(0,0,0,0.12);
      border-top: 3px solid var(--brand-black);
      border-radius: 0;
      box-shadow: 0 12px 32px rgba(0,0,0,0.15);
      z-index: 9999; margin-top: 10px; display: flex; flex-direction: column; max-height: 420px;
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
    .nd-body { overflow-y: auto; flex: 1; text-align: left; scrollbar-width: thin; scrollbar-color: #ccc transparent; }
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
export class NotificationBellComponent implements OnInit {
  showDropdown = signal(false);
  notifications = signal<any[]>([]);
  unreadCount = signal(0);

  constructor(
    private auth: AuthService, 
    private crmService: CrmService, 
    private eRef: ElementRef,
    private router: Router,
    private toast: ToastService,
    private zone: NgZone
  ) {
    effect(() => {
      if (this.auth.isLoggedIn()) {
        this.loadNotifications();
        this.setupSocket();
      }
    });
  }

  setupSocket() {
    const user = this.auth.user();
    if (user) {
      const socket = io(environment.apiUrl.replace('/api', ''));
      socket.emit('identify', user.id);
      
      socket.on('notification', (notif: any) => {
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
}
