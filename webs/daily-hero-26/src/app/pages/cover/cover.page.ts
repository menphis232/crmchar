import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './cover.page.html',
  styleUrl: './cover.page.scss',
})
export class CoverPage {
  readonly scale = signal(1);
  readonly day = signal(28);
  readonly px = signal(0);
  readonly py = signal(0);

  constructor() {
    afterNextRender(() => {
      this.fit();
      window.addEventListener('resize', () => this.fit());
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.countUp();
      }
    });
  }

  onPointer(event: PointerEvent): void {
    this.px.set(Number((event.clientX / window.innerWidth - 0.5).toFixed(3)));
    this.py.set(Number((event.clientY / window.innerHeight - 0.5).toFixed(3)));
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
      this.day.set(Math.max(1, Math.round(eased * 28)));
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    this.day.set(1);
    requestAnimationFrame(tick);
  }
}
