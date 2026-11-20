import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AnalyticsTrackerService } from './core/analytics-tracker.service';
import { OneSignalService } from './core/onesignal.service';
import { AuthService } from './core/auth.service';
import { ColorModeService } from './core/color-mode.service';
import { LegalAcceptanceModalComponent } from './shared/legal-acceptance-modal.component';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, LegalAcceptanceModalComponent],
  template: `
    @if (auth.isImpersonating()) {
      <div class="impersonation-bar" role="status">
        <span>
          Viendo el panel de
          <strong>{{ auth.user()?.name || 'cliente' }}</strong>
        </span>
        <button type="button" (click)="auth.stopImpersonation()">Volver al panel</button>
      </div>
    }
    <router-outlet />
    <app-legal-acceptance-modal />
  `,
  styles: [`
    .impersonation-bar {
      position: sticky;
      top: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      background: #1f2937;
      color: #fff;
      font-family: Figtree, system-ui, sans-serif;
      font-size: 13px;
    }
    .impersonation-bar strong { font-weight: 700; }
    .impersonation-bar button {
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 8px;
      background: transparent;
      color: #fff;
      font: inherit;
      font-weight: 600;
      padding: 6px 12px;
      cursor: pointer;
    }
    .impersonation-bar button:hover { background: rgba(255,255,255,.12); }
  `],
})
export class AppComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private oneSignal = inject(OneSignalService);
  readonly auth = inject(AuthService);
  private colorMode = inject(ColorModeService);

  constructor(tracker: AnalyticsTrackerService) {
    tracker.init();
  }

  ngOnInit() {
    this.colorMode.mode();
    if (!isPlatformBrowser(this.platformId)) return;
    this.oneSignal.init();
    const user = this.auth.user();
    if (user?.id) {
      this.oneSignal.syncUser(user.id, user.role);
      // Refresca términos / last_seen para el modal legal y presencia.
      this.auth.getMe().subscribe({ error: () => {} });
    }
  }
}
