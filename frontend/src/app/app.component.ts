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
    <router-outlet />
    <app-legal-acceptance-modal />
  `,
})
export class AppComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private oneSignal = inject(OneSignalService);
  private auth = inject(AuthService);
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
