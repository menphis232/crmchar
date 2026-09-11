import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CARS } from '../../core/cars';

@Component({
  selector: 'app-drive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './drive.page.html',
  styleUrl: './drive.page.scss',
})
export class DrivePage {
  private readonly reel = viewChild<ElementRef<HTMLVideoElement>>('reel');
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  readonly cars = CARS;
  readonly brand = signal(CARS[0].id);
  readonly menu = signal(false);
  readonly progress = signal(0);
  readonly reveal = computed(() => {
    const start = 0.18;
    return Math.min(1, Math.max(0, (this.progress() - start) / (1 - start)));
  });

  constructor() {
    afterNextRender(() => {
      const onScroll = () => this.scrub();
      window.addEventListener('resize', onScroll, { passive: true });
      window.addEventListener('scroll', onScroll, { passive: true });
      this.scrub();
    });
  }

  pick(id: string): void {
    this.brand.set(id);
  }

  onReady(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    void this.reel()?.nativeElement.play();
  }

  goPink(): void {
    const track = this.track()?.nativeElement;
    if (!track) {
      return;
    }
    const top = track.offsetTop + track.offsetHeight - window.innerHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  replay(): void {
    const video = this.reel()?.nativeElement;
    if (!video) {
      return;
    }
    video.pause();
    video.currentTime = 0;
    void video.play();
  }

  active() {
    return this.cars.find((car) => car.id === this.brand()) ?? CARS[0];
  }

  private scrub(): void {
    const track = this.track()?.nativeElement;
    if (!track) {
      return;
    }
    const total = track.offsetHeight - window.innerHeight;
    const scrolled = Math.min(Math.max(-track.getBoundingClientRect().top, 0), Math.max(total, 0));
    const next = total > 0 ? scrolled / total : 0;
    this.progress.set(Number(next.toFixed(3)));
  }
}
