import { Component, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AnalyticsTrackerService } from './core/analytics-tracker.service';
import { PwaInstallPromptComponent } from './shared/pwa-install-prompt.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PwaInstallPromptComponent],
  template: `
    <router-outlet />
    <app-pwa-install-prompt />
  `,
})
export class AppComponent implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);

  constructor(tracker: AnalyticsTrackerService) {
    tracker.init();
  }

  ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    // Quita splash nativo del index.html
    setTimeout(() => window.dispatchEvent(new Event('tvm-app-ready')), 120);
  }
}
