import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

const PAGES: Record<string, { kicker: string; title: string; lead: string; points: string[] }> = {
  performance: {
    kicker: 'Performance',
    title: 'The limit is a line you choose.',
    lead: 'Weight, grip, and silence tuned until the corner feels shorter than it is.',
    points: ['Carbon brake feel', 'Rear-axle steer', 'Launch held to the millisecond'],
  },
  technology: {
    kicker: 'Technology',
    title: 'Instruments that stay out of the way.',
    lead: 'A dark glass cockpit. Numbers appear only when the road asks for them.',
    points: ['15h energy reserve', 'Predictive dampers', 'Night-vision overlay'],
  },
  interior: {
    kicker: 'Interior',
    title: 'A cabin cut from one piece of night.',
    lead: 'Leather, carbon, and a low horizon. The road stays the loudest thing in the room.',
    points: ['Sculpted buckets', 'Hushed glass', 'A single metal control'],
  },
  experience: {
    kicker: 'Experience',
    title: 'Book the night pass.',
    lead: 'A private hour on a closed stretch. No crowd. Just the car you picked.',
    points: ['Concierge handoff', 'Closed-road window', 'Return before dawn'],
  },
};

@Component({
  selector: 'app-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './section.page.html',
  styleUrl: './section.page.scss',
})
export class SectionPage {
  private readonly route = inject(ActivatedRoute);
  private readonly key = toSignal(this.route.data.pipe(map((data) => String(data['page'] ?? 'performance'))), {
    initialValue: 'performance',
  });

  readonly page = computed(() => PAGES[this.key()] ?? PAGES['performance']);
}
