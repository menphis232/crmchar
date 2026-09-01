import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AnalyticsTrackerService } from './core/analytics-tracker.service';
import { OneSignalService } from './core/onesignal.service';
import { AuthService } from './core/auth.service';
import { PwaInstallPromptComponent } from './shared/pwa-install-prompt.component';
import { PushPermissionPromptComponent } from './shared/push-permission-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PwaInstallPromptComponent, PushPermissionPromptComponent],
  template: `
    <router-outlet />
    <app-pwa-install-prompt />
    <app-push-permission-prompt />
  `,
})
export class AppComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private oneSignal = inject(OneSignalService);
  private auth = inject(AuthService);

  constructor(tracker: AnalyticsTrackerService) {
    tracker.init();
  }

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.oneSignal.init();
    const user = this.auth.user();
    if (user?.id) {
      this.oneSignal.syncUser(user.id, user.role);
    }
  }
}
