import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsTrackerService } from './core/analytics-tracker.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {
  constructor(tracker: AnalyticsTrackerService) {
    tracker.init();
  }
}
