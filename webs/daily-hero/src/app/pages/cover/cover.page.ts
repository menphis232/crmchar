import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

interface Berry {
  id: string;
  left: number;
  top: number;
  box: number;
  leaf: number;
  rot: number;
  blur: number;
  dur: number;
  delay: number;
  amp: number;
}

@Component({
  selector: 'app-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './cover.page.html',
  styleUrl: './cover.page.scss',
})
export class CoverPage {
  private readonly platformId = inject(PLATFORM_ID);
  readonly scale = signal(1);
  readonly day = signal(13);
  readonly px = signal(0);
  readonly py = signal(0);

  readonly berries: readonly Berry[] = [
    { id: '10001:2260', left: -103.44, top: 19.13, box: 280.868, leaf: 199.861, rot: 38.57, blur: 0, dur: 5.8, delay: 0, amp: 16 },
    { id: '10001:2262', left: 1581.43, top: 41.87, box: 219.132, leaf: 202.828, rot: 94.81, blur: 0, dur: 6.6, delay: 0.35, amp: 14 },
    { id: '10001:2264', left: 282.08, top: -453.91, box: 922.916, leaf: 653.217, rot: -42.51, blur: 10, dur: 8.4, delay: 0.15, amp: 22 },
    { id: '10001:2261', left: 834.44, top: 1074, box: 529.5, leaf: 419.978, rot: -18.06, blur: 0, dur: 7.2, delay: 0.7, amp: 18 },
    { id: '10001:2263', left: -442.83, top: 975.41, box: 813.81, leaf: 653.217, rot: 106.76, blur: 10, dur: 9.1, delay: 0.2, amp: 20 },
    { id: '10001:2259', left: 302.57, top: 1128.52, box: 162.484, leaf: 115.621, rot: 38.57, blur: 0, dur: 5.2, delay: 1.05, amp: 12 },
  ];

  constructor() {
    afterNextRender(() => {
      this.fit();
      const onResize = () => this.fit();
      window.addEventListener('resize', onResize);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.countUp();
      }
    });
  }

  onPointer(event: PointerEvent): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const x = event.clientX / window.innerWidth - 0.5;
    const y = event.clientY / window.innerHeight - 0.5;
    this.px.set(Number(x.toFixed(3)));
    this.py.set(Number(y.toFixed(3)));
  }

  private fit(): void {
    const next = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    this.scale.set(Number(Math.max(next, 0.28).toFixed(4)));
  }

  private countUp(): void {
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / 900, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.day.set(Math.max(1, Math.round(eased * 13)));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    this.day.set(1);
    requestAnimationFrame(tick);
  }
}
